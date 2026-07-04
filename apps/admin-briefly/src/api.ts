import type {
  ApiErrorResponse,
  CreateDailyInputRequest,
  CreateDailyInputResponse,
  GetDailyInputDraftResponse,
  GetDraftResponse,
  GetWorkflowRunResponse,
  PublishDraftRequest,
  PublishDraftResponse,
  StartGenerationRequest,
  StartGenerationResponse,
  UpdateDraftRequest,
  UpdateDraftResponse
} from "@briefly/contracts";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, code = "api_error", details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    if (details) {
      this.details = details;
    }
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseApiError = (status: number, payload: unknown): ApiRequestError => {
  if (isObject(payload)) {
    const typed = payload as Partial<ApiErrorResponse>;
    const fallbackCode = status === 401 ? "unauthorized" : "api_error";
    const code = typeof typed.code === "string" ? typed.code : fallbackCode;
    const rawMessage = typeof typed.message === "string" ? typed.message : `Request failed with status ${status}`;
    const message =
      status === 401 && rawMessage.trim().toLowerCase() === "unauthorized"
        ? "Admin session expired or was rejected. Sign in again."
        : rawMessage;
    const details = isObject(typed.details) ? typed.details : undefined;
    return new ApiRequestError(status, message, code, details);
  }

  if (status === 401) {
    return new ApiRequestError(status, "Admin session expired or was rejected. Sign in again.", "unauthorized");
  }

  return new ApiRequestError(status, `Request failed with status ${status}`);
};

const parseJsonSafe = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

interface ApiClientOptions {
  apiBase: string;
  token: string;
}

export type NewsletterCampaignStatus = string;

export interface NewsletterSourcePost {
  post_id?: string;
  slug?: string;
  title?: string;
  status?: string;
  url?: string;
  published_at?: string;
  updated_at?: string;
}

export interface NewsletterCampaignCounts {
  subscriber_count?: number;
  eligible_subscriber_count?: number;
  recipient_count?: number;
  test_send_count?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;
  suppressed_count?: number;
  bounced_count?: number;
  complained_count?: number;
}

export interface NewsletterCampaignSummary {
  campaign_id: string;
  status: NewsletterCampaignStatus;
  version?: number;
  subject?: string;
  body?: string;
  source_post_id?: string;
  source_slug?: string;
  source_title?: string;
  source_summary?: string;
  source_url?: string;
  source_post?: NewsletterSourcePost;
  counts?: NewsletterCampaignCounts;
  subscriber_count?: number;
  eligible_subscriber_count?: number;
  recipient_count?: number;
  test_send_count?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;
  suppressed_count?: number;
  bounced_count?: number;
  complained_count?: number;
  created_at?: string;
  updated_at?: string;
  test_sent_at?: string;
  sent_at?: string;
}

export interface NewsletterCampaign extends NewsletterCampaignSummary {
  body?: string;
}

export interface ListNewsletterCampaignsResponse {
  campaigns: NewsletterCampaignSummary[];
}

export interface GetNewsletterCampaignResponse {
  campaign: NewsletterCampaign;
}

export interface UpdateNewsletterCampaignRequest {
  expected_version: number;
  subject: string;
  body: string;
}

export interface UpdateNewsletterCampaignResponse {
  campaign: NewsletterCampaign;
}

export interface TestNewsletterCampaignRequest {
  recipient_email: string;
}

export interface NewsletterCampaignActionResponse {
  campaign: NewsletterCampaign;
  message?: string;
}

export class BrieflyApiClient {
  private readonly apiBase: string;
  private readonly token: string;

  constructor(options: ApiClientOptions) {
    this.apiBase = options.apiBase.replace(/\/$/, "");
    this.token = options.token.trim();
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${this.token}`,
      ...(init.headers as Record<string, string> | undefined)
    };

    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      throw parseApiError(response.status, payload);
    }

    return payload as T;
  }

  async createDailyInput(request: CreateDailyInputRequest): Promise<CreateDailyInputResponse> {
    return this.request<CreateDailyInputResponse>("/v1/daily-inputs", {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  async startGeneration(inputId: string, request: StartGenerationRequest): Promise<StartGenerationResponse> {
    return this.request<StartGenerationResponse>(`/v1/daily-inputs/${encodeURIComponent(inputId)}/generate`, {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  async getWorkflowRun(runId: string): Promise<GetWorkflowRunResponse> {
    return this.request<GetWorkflowRunResponse>(`/v1/workflow-runs/${encodeURIComponent(runId)}`, {
      method: "GET"
    });
  }

  async getDailyInputDraft(inputId: string): Promise<GetDailyInputDraftResponse> {
    return this.request<GetDailyInputDraftResponse>(`/v1/daily-inputs/${encodeURIComponent(inputId)}/draft`, {
      method: "GET"
    });
  }

  async getDraft(draftId: string): Promise<GetDraftResponse> {
    return this.request<GetDraftResponse>(`/v1/drafts/${encodeURIComponent(draftId)}`, {
      method: "GET"
    });
  }

  async updateDraft(draftId: string, request: UpdateDraftRequest): Promise<UpdateDraftResponse> {
    return this.request<UpdateDraftResponse>(`/v1/drafts/${encodeURIComponent(draftId)}`, {
      method: "PUT",
      body: JSON.stringify(request)
    });
  }

  async publishDraft(draftId: string, request: PublishDraftRequest): Promise<PublishDraftResponse> {
    return this.request<PublishDraftResponse>(`/v1/drafts/${encodeURIComponent(draftId)}/publish`, {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  async listNewsletterCampaigns(): Promise<ListNewsletterCampaignsResponse> {
    return this.request<ListNewsletterCampaignsResponse>("/v1/newsletter/campaigns", {
      method: "GET"
    });
  }

  async getNewsletterCampaign(campaignId: string): Promise<GetNewsletterCampaignResponse> {
    return this.request<GetNewsletterCampaignResponse>(`/v1/newsletter/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "GET"
    });
  }

  async updateNewsletterCampaign(
    campaignId: string,
    request: UpdateNewsletterCampaignRequest
  ): Promise<UpdateNewsletterCampaignResponse> {
    return this.request<UpdateNewsletterCampaignResponse>(`/v1/newsletter/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "PUT",
      body: JSON.stringify(request)
    });
  }

  async testNewsletterCampaign(
    campaignId: string,
    request: TestNewsletterCampaignRequest
  ): Promise<NewsletterCampaignActionResponse> {
    return this.request<NewsletterCampaignActionResponse>(
      `/v1/newsletter/campaigns/${encodeURIComponent(campaignId)}/test`,
      {
        method: "POST",
        body: JSON.stringify(request)
      }
    );
  }

  async sendNewsletterCampaign(campaignId: string): Promise<NewsletterCampaignActionResponse> {
    return this.request<NewsletterCampaignActionResponse>(
      `/v1/newsletter/campaigns/${encodeURIComponent(campaignId)}/send`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
  }
}
