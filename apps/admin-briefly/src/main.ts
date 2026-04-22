import {
  type CreateDailyInputRequest,
  type DraftReviewStatus,
  type DraftItem,
  type PublishDraftRequest,
  type StartGenerationRequest,
  type StylePreset,
  type UpdateDraftRequest
} from "@briefly/contracts";
import { ApiRequestError, BrieflyApiClient } from "./api";
import "./styles.css";

interface AdminSettings {
  apiBase: string;
  token: string;
}

const SETTINGS_KEY = "briefly_admin_settings_v1";
const DEFAULT_API_BASE = import.meta.env.VITE_BRIEFLY_API_BASE ?? "";
const DEFAULT_TOKEN = import.meta.env.VITE_ADMIN_BEARER_TOKEN ?? "";

type NoticeTone = "neutral" | "success" | "error" | "warning";
const DRAFT_REVIEW_STATUSES: DraftReviewStatus[] = ["pending_review", "approved", "rejected"];
const STYLE_PRESETS: StylePreset[] = ["build_log_v1"];

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
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

    if (typeof parsed.apiBase !== "string" || typeof parsed.token !== "string") {
      return null;
    }

    return {
      apiBase: parsed.apiBase,
      token: parsed.token
    };
  } catch {
    return null;
  }
};

const saveSettings = (settings: AdminSettings): void => {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
  if (error instanceof ApiRequestError) {
    const details = isObject(error.details) ? ` (${JSON.stringify(error.details)})` : "";
    return `${error.message} [${error.status}/${error.code}]${details}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
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
    meta.innerHTML = "";
    return;
  }

  meta.innerHTML = `
    <dt>Draft ID</dt><dd>${draft.draft_id}</dd>
    <dt>Version</dt><dd>${draft.version}</dd>
    <dt>Status</dt><dd>${draft.status}</dd>
    <dt>Run ID</dt><dd>${draft.run_id}</dd>
    <dt>Input ID</dt><dd>${draft.input_id}</dd>
    <dt>Model</dt><dd>${draft.model_id}</dd>
    <dt>Prompt</dt><dd>${draft.prompt_version}</dd>
    <dt>Updated</dt><dd>${formatDate(draft.updated_at)}</dd>
  `;
};

const getClient = (): BrieflyApiClient => {
  const settings = getActiveSettings();
  if (!settings.apiBase || !settings.token) {
    throw new Error("Save API base and token first.");
  }

  return new BrieflyApiClient(settings);
};

const getActiveSettings = (): AdminSettings => {
  return {
    apiBase: byId<HTMLInputElement>("api-base").value.trim(),
    token: byId<HTMLInputElement>("admin-token").value.trim()
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
  apiBaseInput.value = storedSettings?.apiBase ?? DEFAULT_API_BASE;
  tokenInput.value = storedSettings?.token ?? DEFAULT_TOKEN;

  byId<HTMLInputElement>("input-date").value = new Date().toISOString().slice(0, 10);
  byId<HTMLInputElement>("target-word-count").value = "500";

  const url = new URL(window.location.href);
  const draftIdFromQuery = url.searchParams.get("draftId");
  const inputIdFromQuery = url.searchParams.get("inputId");
  const runIdFromQuery = url.searchParams.get("runId");

  if (draftIdFromQuery) {
    byId<HTMLInputElement>("draft-id").value = draftIdFromQuery;
  }
  if (inputIdFromQuery) {
    byId<HTMLInputElement>("generation-input-id").value = inputIdFromQuery;
  }
  if (runIdFromQuery) {
    byId<HTMLInputElement>("generation-run-id").value = runIdFromQuery;
  }

  setStatus(byId("connection-state"), "Configure API base and token once. Stored locally in this browser.", "neutral");
  setStatus(byId("create-input-state"), "", "neutral");
  setStatus(byId("generation-state"), "", "neutral");
  setStatus(byId("draft-state"), "Load a draft to edit and publish.", "neutral");

  let currentDraft: DraftItem | null = null;
  let currentInputId = inputIdFromQuery ?? "";
  let latestRunId = runIdFromQuery ?? "";
  let runPollTimer: number | null = null;
  let runPollInFlight = false;

  const clearConflict = (): void => {
    const conflict = byId<HTMLDivElement>("slug-conflict");
    conflict.innerHTML = "";
    conflict.classList.add("hidden");
  };

  const showSlugConflict = (slug: string, suggestedSlug?: string): void => {
    const conflict = byId<HTMLDivElement>("slug-conflict");
    if (!suggestedSlug) {
      conflict.innerHTML = `<p>Slug <strong>${slug}</strong> is already taken.</p>`;
      conflict.classList.remove("hidden");
      return;
    }

    conflict.innerHTML = `
      <p>Slug <strong>${slug}</strong> is already taken.</p>
      <button id="apply-suggested-slug" type="button">Use suggested slug: ${suggestedSlug}</button>
    `;
    conflict.classList.remove("hidden");

    const applyBtn = byId<HTMLButtonElement>("apply-suggested-slug");
    applyBtn.onclick = () => {
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
        setStatus(byId("generation-state"), formatApiError(error), "error");
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

    saveSettings(settings);
    setStatus(byId("connection-state"), "Connection settings saved locally.", "success");
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
      setStatus(stateEl, formatApiError(error), "error");
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
      setStatus(stateEl, formatApiError(error), "error");
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
      setStatus(draftState, formatApiError(error), "error");
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
        setStatus(stateEl, formatApiError(error), "error");
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
        setStatus(stateEl, formatApiError(error), "error");
      }
    } finally {
      setDisabled([publishBtn], false);
    }
  });

  byId<HTMLInputElement>("publish-slug").addEventListener("input", () => {
    byId<HTMLInputElement>("publish-slug").dataset.auto = "0";
  });

  if (draftIdFromQuery) {
    void loadDraft();
  }

  if (latestRunId) {
    setStatus(byId("generation-state"), `Loaded run ${latestRunId}. Click "Check run status" or start a new generation.`, "neutral");
  } else if (currentInputId) {
    setStatus(byId("generation-state"), `Using input ${currentInputId}.`, "neutral");
  }
};

init();
