import {
  type CreateDailyInputRequest,
  type DraftReviewStatus,
  type DraftItem,
  type PublishDraftRequest,
  type StartGenerationRequest,
  type StylePreset,
  type UpdateDraftRequest
} from "@briefly/contracts";
import {
  ApiRequestError,
  BrieflyApiClient,
  type NewsletterCampaign,
  type NewsletterCampaignCounts,
  type NewsletterCampaignSummary,
  type NewsletterSourcePost
} from "./api";
import { CognitoAuthError, signInWithCognito } from "./cognitoAuth";
import "./styles.css";

interface AdminSettings {
  apiBase: string;
  authEmail?: string;
}

interface ActiveConnection extends AdminSettings {
  token: string;
}

const SETTINGS_KEY = "briefly_admin_settings_v1";
const SESSION_TOKEN_KEY = "briefly_admin_session_token_v1";
const SESSION_REFRESH_SKEW_SECONDS = 30;
const DEFAULT_API_BASE = import.meta.env.VITE_BRIEFLY_API_BASE ?? "";
const DEFAULT_COGNITO_REGION = import.meta.env.VITE_BRIEFLY_COGNITO_REGION ?? "us-east-2";
const DEFAULT_COGNITO_CLIENT_ID =
  import.meta.env.VITE_BRIEFLY_COGNITO_CLIENT_ID ?? "436n9qucieqcg55k6ufv7nr9s6";

type NoticeTone = "neutral" | "success" | "error" | "warning";
const DRAFT_REVIEW_STATUSES: DraftReviewStatus[] = ["pending_review", "approved", "rejected"];
const STYLE_PRESETS: StylePreset[] = ["build_log_v1"];
const NEWSLETTER_SEND_STATUS_ORDER = [
  "draft",
  "ready",
  "test_sending",
  "test_sent",
  "send_failed",
  "sending",
  "sent"
] as const;
const NEWSLETTER_SEND_CLOSED_STATUSES = new Set(["sending", "sent"]);

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toStoredSettings = (apiBase: string, authEmail?: string): AdminSettings => {
  const trimmedEmail = authEmail?.trim();
  return trimmedEmail ? { apiBase, authEmail: trimmedEmail } : { apiBase };
};

const readStoredSettings = (): AdminSettings | null => {
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    if (typeof parsed.apiBase !== "string") {
      return null;
    }

    if (typeof parsed.token === "string" && parsed.token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, parsed.token);
    }

    const settings = toStoredSettings(parsed.apiBase, typeof parsed.authEmail === "string" ? parsed.authEmail : undefined);
    saveSettings(settings);

    return settings;
  } catch {
    return null;
  }
};

const saveSettings = (settings: AdminSettings): void => {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const readSessionToken = (): string => window.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? "";

const saveSessionToken = (token: string): void => {
  if (token) {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }

  return el as T;
};

const setStatus = (el: HTMLElement, message: string, tone: NoticeTone): void => {
  el.textContent = message;
  el.classList.remove("success", "error", "warning");
  if (tone === "success") {
    el.classList.add("success");
  }
  if (tone === "error") {
    el.classList.add("error");
  }
  if (tone === "warning") {
    el.classList.add("warning");
  }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const [, payloadSegment] = token.split(".");
  if (!payloadSegment) {
    return null;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const parsed = JSON.parse(window.atob(padded)) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getSessionTokenExpiresAt = (token: string): number | null => {
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp : null;
};

const isSessionTokenExpired = (token: string): boolean => {
  const expiresAt = getSessionTokenExpiresAt(token);
  if (expiresAt === null) {
    return false;
  }

  return expiresAt <= Math.floor(Date.now() / 1000) + SESSION_REFRESH_SKEW_SECONDS;
};

const clearStoredSessionToken = (): void => {
  saveSessionToken("");
  const tokenInput = document.getElementById("admin-token");
  if (tokenInput instanceof HTMLInputElement) {
    tokenInput.value = "";
  }
};

const isUnauthorizedApiError = (error: unknown): boolean => {
  return error instanceof ApiRequestError && error.status === 401;
};

const showActionError = (stateEl: HTMLElement, error: unknown, tone: NoticeTone = "error"): void => {
  if (isUnauthorizedApiError(error)) {
    clearStoredSessionToken();
    setStatus(byId("connection-state"), "Admin session expired or was rejected. Sign in again.", "error");
  }

  setStatus(stateEl, formatApiError(error), tone);
};

const setDisabled = (controls: HTMLElement[], disabled: boolean): void => {
  for (const control of controls) {
    if (
      control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.disabled = disabled;
    }
  }
};

const formatDate = (iso: string | undefined): string => {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

const formatApiError = (error: unknown): string => {
  if (error instanceof CognitoAuthError) {
    return `${error.message} [${error.code}]`;
  }

  if (error instanceof ApiRequestError) {
    const details = isObject(error.details) ? ` (${JSON.stringify(error.details)})` : "";
    return `${error.message} [${error.status}/${error.code}]${details}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
};

type MetaValue = string | number | null | undefined;

const hasMetaValue = (value: MetaValue): value is string | number => {
  return value !== undefined && value !== null && String(value).trim().length > 0;
};

const appendMetaEntry = (nodes: Node[], label: string, value: MetaValue): void => {
  if (!hasMetaValue(value)) {
    return;
  }

  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = typeof value === "number" ? value.toLocaleString() : value;
  nodes.push(dt, dd);
};

const renderMetaEntries = (meta: HTMLDListElement, entries: Array<[string, MetaValue]>): void => {
  const nodes: Node[] = [];
  for (const [label, value] of entries) {
    appendMetaEntry(nodes, label, value);
  }
  meta.replaceChildren(...nodes);
};

const normalizeNewsletterStatus = (status: string | undefined): string => {
  return (status ?? "").trim().toLowerCase();
};

const canSendNewsletterCampaign = (campaign: NewsletterCampaign | null): boolean => {
  if (!campaign) {
    return false;
  }

  const status = normalizeNewsletterStatus(campaign.status);
  if (NEWSLETTER_SEND_CLOSED_STATUSES.has(status)) {
    return false;
  }

  const statusRank = NEWSLETTER_SEND_STATUS_ORDER.indexOf(status as (typeof NEWSLETTER_SEND_STATUS_ORDER)[number]);
  const testSentRank = NEWSLETTER_SEND_STATUS_ORDER.indexOf("test_sent");

  return statusRank >= testSentRank;
};

const getNewsletterSendGateMessage = (campaign: NewsletterCampaign | null): string => {
  if (!campaign) {
    return "Load a newsletter campaign first.";
  }

  const status = normalizeNewsletterStatus(campaign.status);
  if (status === "sending") {
    return "Subscriber send is already running.";
  }
  if (status === "sent") {
    return "This campaign has already been sent.";
  }
  if (!canSendNewsletterCampaign(campaign)) {
    return "Send is locked until a test email has been sent for this campaign.";
  }

  return "";
};

const getNewsletterCampaignBody = (campaign: NewsletterCampaign | null): string => {
  return campaign?.body ?? "";
};

const getNewsletterCounts = (campaign: NewsletterCampaign): NewsletterCampaignCounts => {
  const counts: NewsletterCampaignCounts = {};
  const copyCount = (key: keyof NewsletterCampaignCounts, value: number | undefined): void => {
    if (typeof value === "number") {
      counts[key] = value;
    }
  };

  copyCount("subscriber_count", campaign.counts?.subscriber_count ?? campaign.subscriber_count);
  copyCount("eligible_subscriber_count", campaign.counts?.eligible_subscriber_count ?? campaign.eligible_subscriber_count);
  copyCount("recipient_count", campaign.counts?.recipient_count ?? campaign.recipient_count);
  copyCount("test_send_count", campaign.counts?.test_send_count ?? campaign.test_send_count);
  copyCount("sent_count", campaign.counts?.sent_count ?? campaign.sent_count);
  copyCount("delivered_count", campaign.counts?.delivered_count ?? campaign.delivered_count);
  copyCount("failed_count", campaign.counts?.failed_count ?? campaign.failed_count);
  copyCount("suppressed_count", campaign.counts?.suppressed_count ?? campaign.suppressed_count);
  copyCount("bounced_count", campaign.counts?.bounced_count ?? campaign.bounced_count);
  copyCount("complained_count", campaign.counts?.complained_count ?? campaign.complained_count);

  return counts;
};

const renderNewsletterSourceMeta = (sourcePost: NewsletterSourcePost | undefined): void => {
  const meta = byId<HTMLDListElement>("newsletter-source-meta");
  if (!sourcePost) {
    renderMetaEntries(meta, [["Source post", "Not returned"]]);
    return;
  }

  const entries: Array<[string, MetaValue]> = [
    ["Post ID", sourcePost.post_id],
    ["Title", sourcePost.title],
    ["Slug", sourcePost.slug],
    ["Status", sourcePost.status],
    ["URL", sourcePost.url],
    ["Published", sourcePost.published_at ? formatDate(sourcePost.published_at) : undefined],
    ["Updated", sourcePost.updated_at ? formatDate(sourcePost.updated_at) : undefined]
  ];

  if (!entries.some(([, value]) => hasMetaValue(value))) {
    renderMetaEntries(meta, [["Source post", "Not returned"]]);
    return;
  }

  renderMetaEntries(meta, entries);
};

const sourcePostFromCampaign = (campaign: NewsletterCampaign): NewsletterSourcePost | undefined => {
  if (campaign.source_post) {
    return campaign.source_post;
  }

  if (
    !campaign.source_post_id &&
    !campaign.source_slug &&
    !campaign.source_title &&
    !campaign.source_url
  ) {
    return undefined;
  }

  const sourcePost: NewsletterSourcePost = {};
  if (campaign.source_post_id) {
    sourcePost.post_id = campaign.source_post_id;
  }
  if (campaign.source_slug) {
    sourcePost.slug = campaign.source_slug;
  }
  if (campaign.source_title) {
    sourcePost.title = campaign.source_title;
  }
  if (campaign.source_url) {
    sourcePost.url = campaign.source_url;
  }

  return sourcePost;
};

const renderNewsletterCountsMeta = (campaign: NewsletterCampaign | null): void => {
  const meta = byId<HTMLDListElement>("newsletter-counts-meta");
  if (!campaign) {
    renderMetaEntries(meta, [["Counts", "Load a campaign"]]);
    return;
  }

  const counts = getNewsletterCounts(campaign);
  const entries: Array<[string, MetaValue]> = [
    ["Subscribers", counts.subscriber_count],
    ["Eligible", counts.eligible_subscriber_count],
    ["Recipients", counts.recipient_count],
    ["Test sends", counts.test_send_count],
    ["Sent", counts.sent_count],
    ["Delivered", counts.delivered_count],
    ["Failed", counts.failed_count],
    ["Suppressed", counts.suppressed_count],
    ["Bounced", counts.bounced_count],
    ["Complaints", counts.complained_count]
  ];

  if (!entries.some(([, value]) => hasMetaValue(value))) {
    renderMetaEntries(meta, [["Counts", "Not returned"]]);
    return;
  }

  renderMetaEntries(meta, entries);
};

const renderNewsletterCampaignOptions = (
  campaigns: NewsletterCampaignSummary[],
  selectedCampaignId: string | null
): void => {
  const select = byId<HTMLSelectElement>("newsletter-campaign-select");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = campaigns.length > 0 ? "Select a campaign" : "No campaigns returned";

  const options = campaigns.map((campaign) => {
    const option = document.createElement("option");
    option.value = campaign.campaign_id;
    const subject = campaign.subject?.trim() || "(no subject)";
    option.textContent = `${subject} [${campaign.status}]`;
    return option;
  });

  select.replaceChildren(placeholder, ...options);
  if (selectedCampaignId && campaigns.some((campaign) => campaign.campaign_id === selectedCampaignId)) {
    select.value = selectedCampaignId;
  }
};

const isPublicSendsDisabledError = (error: unknown): boolean => {
  return error instanceof ApiRequestError && error.code === "public_sends_disabled";
};

const isTestSendRequiredError = (error: unknown): boolean => {
  return error instanceof ApiRequestError && error.code === "test_send_required";
};

const applyDraftToForm = (draft: DraftItem): void => {
  byId<HTMLInputElement>("draft-title").value = draft.title;
  byId<HTMLTextAreaElement>("draft-summary").value = draft.summary;
  byId<HTMLTextAreaElement>("draft-content").value = draft.content_md;
  byId<HTMLTextAreaElement>("draft-editor-notes").value = draft.editor_notes ?? "";

  const statusSelect = byId<HTMLSelectElement>("draft-status");
  if (DRAFT_REVIEW_STATUSES.includes(draft.status as DraftReviewStatus)) {
    statusSelect.value = draft.status;
  } else {
    statusSelect.value = "pending_review";
  }

  const publishSlug = byId<HTMLInputElement>("publish-slug");
  if (!publishSlug.value || publishSlug.value === draft.slug_suggestion || publishSlug.dataset.auto === "1") {
    publishSlug.value = draft.slug_suggestion;
    publishSlug.dataset.auto = "1";
  }
};

const renderDraftMeta = (draft: DraftItem | null): void => {
  const meta = byId<HTMLDListElement>("draft-meta");
  if (!draft) {
    meta.replaceChildren();
    return;
  }

  const entries: Array<[string, string]> = [
    ["Draft ID", draft.draft_id],
    ["Version", String(draft.version)],
    ["Status", draft.status],
    ["Run ID", draft.run_id],
    ["Input ID", draft.input_id],
    ["Model", draft.model_id],
    ["Prompt", draft.prompt_version],
    ["Updated", formatDate(draft.updated_at)]
  ];

  const nodes: Node[] = [];
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    nodes.push(dt, dd);
  }

  meta.replaceChildren(...nodes);
};

const getClient = (): BrieflyApiClient => {
  const settings = getActiveSettings();
  if (!settings.apiBase) {
    throw new Error("API base is required.");
  }

  if (!settings.token) {
    throw new Error("Sign in or save an ID token first.");
  }

  if (isSessionTokenExpired(settings.token)) {
    clearStoredSessionToken();
    setStatus(byId("connection-state"), "Admin session expired. Sign in again.", "warning");
    throw new Error("Admin session expired. Sign in again.");
  }

  return new BrieflyApiClient(settings);
};

const getActiveSettings = (): ActiveConnection => {
  return {
    apiBase: byId<HTMLInputElement>("api-base").value.trim(),
    token: byId<HTMLInputElement>("admin-token").value.trim(),
    authEmail: byId<HTMLInputElement>("admin-email").value.trim()
  };
};

const setQueryParam = (key: string, value: string | null): void => {
  const url = new URL(window.location.href);
  if (!value) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, "", url.toString());
};

const init = (): void => {
  const storedSettings = readStoredSettings();

  const apiBaseInput = byId<HTMLInputElement>("api-base");
  const tokenInput = byId<HTMLInputElement>("admin-token");
  const emailInput = byId<HTMLInputElement>("admin-email");
  const passwordInput = byId<HTMLInputElement>("admin-password");
  apiBaseInput.value = storedSettings?.apiBase ?? DEFAULT_API_BASE;
  tokenInput.value = readSessionToken();
  emailInput.value = storedSettings?.authEmail ?? "";
  byId<HTMLInputElement>("newsletter-test-email").value = storedSettings?.authEmail ?? "";
  const hadExpiredStoredToken = tokenInput.value !== "" && isSessionTokenExpired(tokenInput.value);
  if (hadExpiredStoredToken) {
    clearStoredSessionToken();
  }

  byId<HTMLInputElement>("input-date").value = new Date().toISOString().slice(0, 10);
  byId<HTMLInputElement>("target-word-count").value = "500";

  const url = new URL(window.location.href);
  const draftIdFromQuery = url.searchParams.get("draftId");
  const inputIdFromQuery = url.searchParams.get("inputId");
  const runIdFromQuery = url.searchParams.get("runId");
  const campaignIdFromQuery = url.searchParams.get("campaignId");

  if (draftIdFromQuery) {
    byId<HTMLInputElement>("draft-id").value = draftIdFromQuery;
  }
  if (inputIdFromQuery) {
    byId<HTMLInputElement>("generation-input-id").value = inputIdFromQuery;
  }
  if (runIdFromQuery) {
    byId<HTMLInputElement>("generation-run-id").value = runIdFromQuery;
  }

  setStatus(
    byId("connection-state"),
    hadExpiredStoredToken
      ? "Stored admin session expired. Sign in again."
      : "Sign in to start an admin session in this browser.",
    hadExpiredStoredToken ? "warning" : "neutral"
  );
  setStatus(byId("create-input-state"), "", "neutral");
  setStatus(byId("generation-state"), "", "neutral");
  setStatus(byId("draft-state"), "Load a draft to edit and publish.", "neutral");
  setStatus(byId("newsletter-state"), "Load newsletter campaigns to edit delivery copy.", "neutral");

  let currentDraft: DraftItem | null = null;
  let currentNewsletterCampaign: NewsletterCampaign | null = null;
  let currentInputId = inputIdFromQuery ?? "";
  let latestRunId = runIdFromQuery ?? "";
  let runPollTimer: number | null = null;
  let runPollInFlight = false;

  const clearConflict = (): void => {
    const conflict = byId<HTMLDivElement>("slug-conflict");
    conflict.replaceChildren();
    conflict.classList.add("hidden");
  };

  const showSlugConflict = (slug: string, suggestedSlug?: string): void => {
    const conflict = byId<HTMLDivElement>("slug-conflict");
    if (!suggestedSlug) {
      const paragraph = document.createElement("p");
      paragraph.append("Slug ");
      const strong = document.createElement("strong");
      strong.textContent = slug;
      paragraph.append(strong, " is already taken.");
      conflict.replaceChildren(paragraph);
      conflict.classList.remove("hidden");
      return;
    }

    const paragraph = document.createElement("p");
    paragraph.append("Slug ");
    const strong = document.createElement("strong");
    strong.textContent = slug;
    paragraph.append(strong, " is already taken.");

    const applyButton = document.createElement("button");
    applyButton.id = "apply-suggested-slug";
    applyButton.type = "button";
    applyButton.textContent = `Use suggested slug: ${suggestedSlug}`;

    conflict.replaceChildren(paragraph, applyButton);
    conflict.classList.remove("hidden");

    applyButton.onclick = () => {
      const slugInput = byId<HTMLInputElement>("publish-slug");
      slugInput.value = suggestedSlug;
      slugInput.dataset.auto = "0";
      clearConflict();
      setStatus(byId("draft-state"), "Applied suggested slug. Publish again when ready.", "warning");
    };
  };

  const stopRunPolling = (): void => {
    if (runPollTimer !== null) {
      window.clearInterval(runPollTimer);
      runPollTimer = null;
    }
  };

  const setLatestRunId = (runId: string | null): void => {
    latestRunId = runId ?? "";
    byId<HTMLInputElement>("generation-run-id").value = latestRunId;
    setQueryParam("runId", latestRunId || null);
  };

  const syncDraftMetaAndForm = (draft: DraftItem): void => {
    currentDraft = draft;
    currentInputId = draft.input_id;

    byId<HTMLInputElement>("draft-id").value = draft.draft_id;
    byId<HTMLInputElement>("generation-input-id").value = draft.input_id;
    setLatestRunId(draft.run_id);

    renderDraftMeta(draft);
    applyDraftToForm(draft);

    setQueryParam("draftId", draft.draft_id);
    setQueryParam("inputId", draft.input_id);
  };

  const scrollToDraftWorkspace = (): void => {
    byId("draft-workspace-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setNewsletterActionState = (): void => {
    const hasCampaign = currentNewsletterCampaign !== null;
    const gateMessage = getNewsletterSendGateMessage(currentNewsletterCampaign);
    byId<HTMLButtonElement>("save-newsletter-campaign-btn").disabled = !hasCampaign;
    byId<HTMLButtonElement>("send-test-newsletter-btn").disabled = !hasCampaign;
    byId<HTMLButtonElement>("send-newsletter-campaign-btn").disabled = gateMessage.length > 0;
    byId<HTMLParagraphElement>("newsletter-send-gate").textContent = gateMessage || "Ready to send to subscribers.";
  };

  const renderNewsletterCampaign = (campaign: NewsletterCampaign | null): void => {
    currentNewsletterCampaign = campaign;

    byId<HTMLInputElement>("newsletter-subject").value = campaign?.subject ?? "";
    byId<HTMLTextAreaElement>("newsletter-body").value = getNewsletterCampaignBody(campaign);

    if (!campaign) {
      renderMetaEntries(byId<HTMLDListElement>("newsletter-campaign-meta"), [["Campaign", "Load a campaign"]]);
      renderNewsletterSourceMeta(undefined);
      renderNewsletterCountsMeta(null);
      setNewsletterActionState();
      return;
    }

    renderMetaEntries(byId<HTMLDListElement>("newsletter-campaign-meta"), [
      ["Campaign ID", campaign.campaign_id],
      ["Status", campaign.status],
      ["Version", campaign.version],
      ["Subject", campaign.subject],
      ["Created", campaign.created_at ? formatDate(campaign.created_at) : undefined],
      ["Updated", campaign.updated_at ? formatDate(campaign.updated_at) : undefined],
      ["Test sent", campaign.test_sent_at ? formatDate(campaign.test_sent_at) : undefined],
      ["Sent", campaign.sent_at ? formatDate(campaign.sent_at) : undefined]
    ]);
    renderNewsletterSourceMeta(sourcePostFromCampaign(campaign));
    renderNewsletterCountsMeta(campaign);
    setNewsletterActionState();
  };

  const loadNewsletterCampaigns = async (preferredCampaignId?: string): Promise<void> => {
    const stateEl = byId<HTMLElement>("newsletter-state");
    const loadListBtn = byId<HTMLButtonElement>("load-newsletter-campaigns-btn");
    const loadSelectedBtn = byId<HTMLButtonElement>("load-newsletter-campaign-btn");

    setDisabled([loadListBtn, loadSelectedBtn], true);
    setStatus(stateEl, "Loading newsletter campaigns...", "neutral");

    try {
      const client = getClient();
      const response = await client.listNewsletterCampaigns();
      renderNewsletterCampaignOptions(
        response.campaigns,
        preferredCampaignId ?? currentNewsletterCampaign?.campaign_id ?? null
      );
      const campaignCount = response.campaigns.length;
      setStatus(
        stateEl,
        campaignCount === 1 ? "Loaded 1 newsletter campaign." : `Loaded ${campaignCount} newsletter campaigns.`,
        "success"
      );
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setDisabled([loadListBtn, loadSelectedBtn], false);
      setNewsletterActionState();
    }
  };

  const loadNewsletterCampaign = async (campaignId?: string): Promise<void> => {
    const stateEl = byId<HTMLElement>("newsletter-state");
    const selectedCampaignId = campaignId ?? byId<HTMLSelectElement>("newsletter-campaign-select").value.trim();

    if (!selectedCampaignId) {
      setStatus(stateEl, "Select a newsletter campaign first.", "error");
      return;
    }

    const loadSelectedBtn = byId<HTMLButtonElement>("load-newsletter-campaign-btn");
    const loadListBtn = byId<HTMLButtonElement>("load-newsletter-campaigns-btn");

    setDisabled([loadListBtn, loadSelectedBtn], true);
    setStatus(stateEl, "Loading newsletter campaign...", "neutral");

    try {
      const client = getClient();
      const response = await client.getNewsletterCampaign(selectedCampaignId);
      renderNewsletterCampaign(response.campaign);
      const campaignSelect = byId<HTMLSelectElement>("newsletter-campaign-select");
      if (![...campaignSelect.options].some((option) => option.value === response.campaign.campaign_id)) {
        const option = document.createElement("option");
        option.value = response.campaign.campaign_id;
        option.textContent = `${response.campaign.subject?.trim() || "(no subject)"} [${response.campaign.status}]`;
        campaignSelect.append(option);
      }
      campaignSelect.value = response.campaign.campaign_id;
      setQueryParam("campaignId", response.campaign.campaign_id);
      setStatus(stateEl, `Loaded newsletter campaign ${response.campaign.campaign_id}.`, "success");
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setDisabled([loadListBtn, loadSelectedBtn], false);
      setNewsletterActionState();
    }
  };

  const tryLoadDraftForInput = async (client: BrieflyApiClient, inputId: string, fallbackDraftId?: string): Promise<boolean> => {
    const dailyInputDraft = await client.getDailyInputDraft(inputId);
    if (dailyInputDraft.draft) {
      syncDraftMetaAndForm(dailyInputDraft.draft);
      return true;
    }

    if (fallbackDraftId) {
      try {
        const byDraftId = await client.getDraft(fallbackDraftId);
        syncDraftMetaAndForm(byDraftId.draft);
        return true;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          return false;
        }
        throw error;
      }
    }

    return false;
  };

  const checkRunStatus = async (fromAutoPoll: boolean): Promise<void> => {
    if (runPollInFlight) {
      return;
    }

    if (!latestRunId) {
      if (!fromAutoPoll) {
        setStatus(byId("generation-state"), "Run id is required.", "error");
      }
      return;
    }

    runPollInFlight = true;

    try {
      const client = getClient();
      const response = await client.getWorkflowRun(latestRunId);
      const run = response.workflow_run;

      setLatestRunId(run.run_id);

      if (run.input_id) {
        currentInputId = run.input_id;
        byId<HTMLInputElement>("generation-input-id").value = run.input_id;
        setQueryParam("inputId", run.input_id);
      }

      if (run.lifecycle_status === "running") {
        setStatus(
          byId("generation-state"),
          `Run ${run.run_id} is running (started ${formatDate(run.started_at)}).`,
          "neutral"
        );
        return;
      }

      if (run.lifecycle_status === "failed") {
        stopRunPolling();
        const message = run.error_message
          ? `Run ${run.run_id} failed: ${run.error_message}`
          : `Run ${run.run_id} failed.`;
        setStatus(byId("generation-state"), message, "error");
        return;
      }

      const resolvedInputId = run.input_id ?? currentInputId ?? byId<HTMLInputElement>("generation-input-id").value.trim();
      if (!resolvedInputId) {
        stopRunPolling();
        setStatus(byId("generation-state"), "Run completed, but input id is missing.", "warning");
        return;
      }

      const loaded = await tryLoadDraftForInput(client, resolvedInputId, run.draft_id);
      if (loaded) {
        stopRunPolling();
        setStatus(byId("generation-state"), `Run ${run.run_id} completed. Draft loaded automatically.`, "success");
        setStatus(byId("draft-state"), "Generated draft loaded. Review and publish when ready.", "success");
        scrollToDraftWorkspace();
        return;
      }

      setStatus(byId("generation-state"), `Run ${run.run_id} completed. Waiting for draft record...`, "warning");
      if (!fromAutoPoll) {
        // keep polling after a manual check if the draft record has not materialized yet
        if (runPollTimer === null) {
          runPollTimer = window.setInterval(() => {
            void checkRunStatus(true);
          }, 4000);
        }
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404 && fromAutoPoll) {
        setStatus(byId("generation-state"), `Run ${latestRunId} not found yet. Retrying...`, "warning");
      } else {
        showActionError(byId("generation-state"), error);
        if (fromAutoPoll) {
          stopRunPolling();
        }
      }
    } finally {
      runPollInFlight = false;
    }
  };

  const startRunPolling = (): void => {
    if (!latestRunId) {
      return;
    }

    if (runPollTimer !== null) {
      return;
    }

    runPollTimer = window.setInterval(() => {
      void checkRunStatus(true);
    }, 4000);

    void checkRunStatus(true);
  };

  const connectionForm = byId<HTMLFormElement>("connection-form");
  connectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const settings = getActiveSettings();

    if (!settings.apiBase || !settings.token) {
      setStatus(byId("connection-state"), "API base and token are both required.", "error");
      return;
    }

    saveSessionToken(settings.token);
    saveSettings(toStoredSettings(settings.apiBase, settings.authEmail));
    setStatus(byId("connection-state"), "Connection settings saved. Token is kept for this browser session.", "success");
  });

  const authForm = byId<HTMLFormElement>("auth-form");
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const stateEl = byId<HTMLElement>("connection-state");
    const signInBtn = byId<HTMLButtonElement>("sign-in-btn");
    const signOutBtn = byId<HTMLButtonElement>("sign-out-btn");
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const apiBase = apiBaseInput.value.trim();

    if (!apiBase) {
      setStatus(stateEl, "API base is required.", "error");
      return;
    }

    if (!email || !password) {
      setStatus(stateEl, "Email and password are required.", "error");
      return;
    }

    setDisabled([signInBtn, signOutBtn], true);
    setStatus(stateEl, "Signing in with Cognito...", "neutral");

    try {
      const token = await signInWithCognito({
        email,
        password,
        region: DEFAULT_COGNITO_REGION,
        clientId: DEFAULT_COGNITO_CLIENT_ID
      });
      tokenInput.value = token;
      passwordInput.value = "";
      saveSessionToken(token);
      saveSettings(toStoredSettings(apiBase, email));
      if (!byId<HTMLInputElement>("newsletter-test-email").value.trim()) {
        byId<HTMLInputElement>("newsletter-test-email").value = email;
      }
      setStatus(stateEl, "Signed in. Token is kept for this browser session.", "success");
    } catch (error) {
      setStatus(stateEl, formatApiError(error), "error");
    } finally {
      passwordInput.value = "";
      setDisabled([signInBtn, signOutBtn], false);
    }
  });

  byId<HTMLButtonElement>("sign-out-btn").addEventListener("click", () => {
    tokenInput.value = "";
    passwordInput.value = "";
    saveSessionToken("");
    saveSettings(toStoredSettings(apiBaseInput.value.trim(), emailInput.value.trim()));
    setStatus(byId("connection-state"), "Signed out. Admin session cleared.", "success");
  });

  const createForm = byId<HTMLFormElement>("daily-input-form");
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearConflict();

    const stateEl = byId<HTMLElement>("create-input-state");
    const createButton = byId<HTMLButtonElement>("create-input-btn");

    setDisabled([createButton], true);
    setStatus(stateEl, "Creating daily input...", "neutral");

    try {
      const client = getClient();
      const formData = new FormData(createForm);

      const tone = String(formData.get("tone") ?? "practical");
      const request: CreateDailyInputRequest = {
        input_date: String(formData.get("input_date") ?? ""),
        tone: tone === "reflective" || tone === "technical" ? tone : "practical",
        bullets: [
          String(formData.get("bullet_1") ?? ""),
          String(formData.get("bullet_2") ?? ""),
          String(formData.get("bullet_3") ?? "")
        ],
        tags: parseTags(String(formData.get("tags") ?? ""))
      };

      const response = await client.createDailyInput(request);
      currentInputId = response.input_id;
      byId<HTMLInputElement>("generation-input-id").value = response.input_id;
      setQueryParam("inputId", response.input_id);

      setStatus(stateEl, `Daily input created: ${response.input_id}`, "success");
      setStatus(byId("generation-state"), "Ready to start generation.", "neutral");
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setDisabled([createButton], false);
    }
  });

  const generationForm = byId<HTMLFormElement>("generation-form");
  generationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearConflict();

    const startBtn = byId<HTMLButtonElement>("start-generation-btn");
    const checkBtn = byId<HTMLButtonElement>("check-run-btn");
    const stateEl = byId<HTMLElement>("generation-state");

    setDisabled([startBtn, checkBtn], true);
    setStatus(stateEl, "Starting generation...", "neutral");

    try {
      const client = getClient();

      const inputId = byId<HTMLInputElement>("generation-input-id").value.trim() || currentInputId;
      const stylePreset = byId<HTMLSelectElement>("style-preset").value;
      const targetWordCount = Number(byId<HTMLInputElement>("target-word-count").value);

      if (!inputId) {
        throw new Error("Daily input id is required.");
      }

      const request: StartGenerationRequest = {
        style_preset: STYLE_PRESETS.includes(stylePreset as StylePreset) ? (stylePreset as StylePreset) : "build_log_v1",
        target_word_count: targetWordCount
      };

      const response = await client.startGeneration(inputId, request);

      currentInputId = inputId;
      setQueryParam("inputId", inputId);
      setLatestRunId(response.run_id);

      stopRunPolling();
      startRunPolling();

      setStatus(stateEl, `Generation started (run: ${response.run_id}). Watching run status...`, "success");
      setStatus(byId("draft-state"), "Waiting for generated draft...", "neutral");
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setDisabled([startBtn, checkBtn], false);
    }
  });

  byId<HTMLButtonElement>("check-run-btn").addEventListener("click", async () => {
    const runId = byId<HTMLInputElement>("generation-run-id").value.trim();
    if (runId) {
      setLatestRunId(runId);
    }

    await checkRunStatus(false);
  });

  byId<HTMLInputElement>("generation-run-id").addEventListener("change", () => {
    const runId = byId<HTMLInputElement>("generation-run-id").value.trim();
    setLatestRunId(runId || null);
  });

  const loadDraft = async (): Promise<void> => {
    clearConflict();
    const draftState = byId<HTMLElement>("draft-state");
    const draftId = byId<HTMLInputElement>("draft-id").value.trim();

    if (!draftId) {
      setStatus(draftState, "Draft id is required.", "error");
      return;
    }

    const loadBtn = byId<HTMLButtonElement>("load-draft-btn");
    const reloadBtn = byId<HTMLButtonElement>("reload-draft-btn");

    setDisabled([loadBtn, reloadBtn], true);
    setStatus(draftState, "Loading draft...", "neutral");

    try {
      const client = getClient();
      const response = await client.getDraft(draftId);
      syncDraftMetaAndForm(response.draft);

      const publishSlugInput = byId<HTMLInputElement>("publish-slug");
      if (!publishSlugInput.value) {
        publishSlugInput.value = response.draft.slug_suggestion;
        publishSlugInput.dataset.auto = "1";
      }

      setStatus(draftState, `Draft loaded (version ${response.draft.version}).`, "success");
    } catch (error) {
      showActionError(draftState, error);
    } finally {
      setDisabled([loadBtn, reloadBtn], false);
    }
  };

  const loadDraftForm = byId<HTMLFormElement>("load-draft-form");
  loadDraftForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadDraft();
  });

  byId<HTMLButtonElement>("reload-draft-btn").addEventListener("click", async () => {
    await loadDraft();
  });

  const draftEditForm = byId<HTMLFormElement>("draft-edit-form");
  draftEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearConflict();

    const stateEl = byId<HTMLElement>("draft-state");
    const saveBtn = byId<HTMLButtonElement>("save-draft-btn");

    if (!currentDraft) {
      setStatus(stateEl, "Load a draft first.", "error");
      return;
    }

    setDisabled([saveBtn], true);
    setStatus(stateEl, "Saving draft changes...", "neutral");

    try {
      const client = getClient();

      const title = byId<HTMLInputElement>("draft-title").value.trim();
      const summary = byId<HTMLTextAreaElement>("draft-summary").value.trim();
      const contentMd = byId<HTMLTextAreaElement>("draft-content").value.trim();
      const editorNotes = byId<HTMLTextAreaElement>("draft-editor-notes").value.trim();
      const status = byId<HTMLSelectElement>("draft-status").value;

      const request: UpdateDraftRequest = {
        expected_version: currentDraft.version,
        title,
        summary,
        content_md: contentMd,
        editor_notes: editorNotes,
        status: DRAFT_REVIEW_STATUSES.includes(status as DraftReviewStatus)
          ? (status as DraftReviewStatus)
          : "pending_review"
      };

      const response = await client.updateDraft(currentDraft.draft_id, request);
      syncDraftMetaAndForm(response.draft);

      const slugInput = byId<HTMLInputElement>("publish-slug");
      if (slugInput.dataset.auto === "1") {
        slugInput.value = toSlug(response.draft.title) || response.draft.slug_suggestion;
      }

      setStatus(stateEl, `Draft saved. Version is now ${response.draft.version}.`, "success");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setStatus(stateEl, `${formatApiError(error)} Reload draft to resolve version conflict.`, "warning");
      } else {
        showActionError(stateEl, error);
      }
    } finally {
      setDisabled([saveBtn], false);
    }
  });

  const publishForm = byId<HTMLFormElement>("publish-form");
  publishForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearConflict();

    const stateEl = byId<HTMLElement>("draft-state");
    const publishBtn = byId<HTMLButtonElement>("publish-btn");

    if (!currentDraft) {
      setStatus(stateEl, "Load a draft first.", "error");
      return;
    }

    setDisabled([publishBtn], true);
    setStatus(stateEl, "Publishing draft...", "neutral");

    try {
      const client = getClient();

      const request: PublishDraftRequest = {
        expected_version: currentDraft.version,
        edited_title: byId<HTMLInputElement>("draft-title").value.trim(),
        edited_summary: byId<HTMLTextAreaElement>("draft-summary").value.trim(),
        edited_content_md: byId<HTMLTextAreaElement>("draft-content").value.trim(),
        slug: byId<HTMLInputElement>("publish-slug").value.trim().toLowerCase(),
        publish_at: "now"
      };

      const response = await client.publishDraft(currentDraft.draft_id, request);
      setStatus(
        stateEl,
        `Published: ${response.url} (post ${response.post_id}). Reload draft to confirm published status.`,
        "success"
      );

      if (currentDraft) {
        currentDraft = {
          ...currentDraft,
          status: "published",
          version: currentDraft.version + 1,
          published_post_id: response.post_id
        };
        renderDraftMeta(currentDraft);
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "slug_conflict") {
        const detailSlug = isObject(error.details) && typeof error.details.slug === "string" ? error.details.slug : "";
        const suggestedSlug =
          isObject(error.details) && typeof error.details.suggested_slug === "string"
            ? error.details.suggested_slug
            : undefined;
        showSlugConflict(detailSlug, suggestedSlug);
        setStatus(stateEl, formatApiError(error), "warning");
      } else if (error instanceof ApiRequestError && error.status === 409) {
        setStatus(stateEl, `${formatApiError(error)} Reload draft and try again.`, "warning");
      } else {
        showActionError(stateEl, error);
      }
    } finally {
      setDisabled([publishBtn], false);
    }
  });

  byId<HTMLInputElement>("publish-slug").addEventListener("input", () => {
    byId<HTMLInputElement>("publish-slug").dataset.auto = "0";
  });

  const newsletterListForm = byId<HTMLFormElement>("newsletter-list-form");
  newsletterListForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadNewsletterCampaigns();
  });

  byId<HTMLSelectElement>("newsletter-campaign-select").addEventListener("change", async () => {
    const campaignId = byId<HTMLSelectElement>("newsletter-campaign-select").value.trim();
    if (campaignId) {
      await loadNewsletterCampaign(campaignId);
    }
  });

  byId<HTMLButtonElement>("load-newsletter-campaign-btn").addEventListener("click", async () => {
    await loadNewsletterCampaign();
  });

  const newsletterEditForm = byId<HTMLFormElement>("newsletter-edit-form");
  newsletterEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const stateEl = byId<HTMLElement>("newsletter-state");
    const saveBtn = byId<HTMLButtonElement>("save-newsletter-campaign-btn");

    if (!currentNewsletterCampaign) {
      setStatus(stateEl, "Load a newsletter campaign first.", "error");
      return;
    }

    const subject = byId<HTMLInputElement>("newsletter-subject").value.trim();
    const body = byId<HTMLTextAreaElement>("newsletter-body").value.trim();

    if (!subject || !body) {
      setStatus(stateEl, "Subject and body are required.", "error");
      return;
    }
    if (typeof currentNewsletterCampaign.version !== "number") {
      setStatus(stateEl, "Campaign version is missing. Reload the campaign and try again.", "error");
      return;
    }

    setDisabled([saveBtn], true);
    setStatus(stateEl, "Saving newsletter campaign...", "neutral");

    try {
      const client = getClient();
      const response = await client.updateNewsletterCampaign(currentNewsletterCampaign.campaign_id, {
        expected_version: currentNewsletterCampaign.version,
        subject,
        body
      });
      renderNewsletterCampaign(response.campaign);
      setStatus(stateEl, `Newsletter campaign saved (${response.campaign.status}).`, "success");
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setNewsletterActionState();
    }
  });

  const newsletterTestForm = byId<HTMLFormElement>("newsletter-test-form");
  newsletterTestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const stateEl = byId<HTMLElement>("newsletter-state");
    const testBtn = byId<HTMLButtonElement>("send-test-newsletter-btn");

    if (!currentNewsletterCampaign) {
      setStatus(stateEl, "Load a newsletter campaign first.", "error");
      return;
    }

    const recipientEmail = byId<HTMLInputElement>("newsletter-test-email").value.trim();
    if (!recipientEmail) {
      setStatus(stateEl, "Test recipient email is required.", "error");
      return;
    }

    setDisabled([testBtn], true);
    setStatus(stateEl, "Sending test email...", "neutral");

    try {
      const client = getClient();
      const response = await client.testNewsletterCampaign(currentNewsletterCampaign.campaign_id, {
        recipient_email: recipientEmail
      });
      renderNewsletterCampaign(response.campaign);
      const message = response.message ?? `Test sent to ${recipientEmail}.`;
      setStatus(stateEl, message, "success");
    } catch (error) {
      showActionError(stateEl, error);
    } finally {
      setNewsletterActionState();
    }
  });

  const newsletterSendForm = byId<HTMLFormElement>("newsletter-send-form");
  newsletterSendForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const stateEl = byId<HTMLElement>("newsletter-state");
    const sendBtn = byId<HTMLButtonElement>("send-newsletter-campaign-btn");

    if (!currentNewsletterCampaign) {
      setStatus(stateEl, "Load a newsletter campaign first.", "error");
      return;
    }

    const gateMessage = getNewsletterSendGateMessage(currentNewsletterCampaign);
    if (gateMessage) {
      setStatus(stateEl, gateMessage, "warning");
      return;
    }

    setDisabled([sendBtn], true);
    setStatus(stateEl, "Sending newsletter to subscribers...", "neutral");

    try {
      const client = getClient();
      const response = await client.sendNewsletterCampaign(currentNewsletterCampaign.campaign_id);
      renderNewsletterCampaign(response.campaign);
      setStatus(stateEl, response.message ?? "Newsletter send started.", "success");
    } catch (error) {
      if (isPublicSendsDisabledError(error)) {
        setStatus(
          stateEl,
          "Subscriber sending is paused until SES production access is approved. Test sends can still be used.",
          "warning"
        );
      } else if (isTestSendRequiredError(error)) {
        setStatus(stateEl, "Send is locked until a test email has been sent for this campaign.", "warning");
      } else {
        showActionError(stateEl, error);
      }
    } finally {
      setNewsletterActionState();
    }
  });

  renderNewsletterCampaign(null);

  if (draftIdFromQuery) {
    void loadDraft();
  }

  if (campaignIdFromQuery) {
    void loadNewsletterCampaign(campaignIdFromQuery);
  }

  if (latestRunId) {
    setStatus(byId("generation-state"), `Loaded run ${latestRunId}. Click "Check run status" or start a new generation.`, "neutral");
  } else if (currentInputId) {
    setStatus(byId("generation-state"), `Using input ${currentInputId}.`, "neutral");
  }
};

init();
