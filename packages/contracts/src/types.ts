export const DAILY_INPUT_TONES = ["practical", "reflective", "technical"] as const;
export type DailyInputTone = (typeof DAILY_INPUT_TONES)[number];

export const DAILY_INPUT_STATUSES = ["submitted", "running", "pending_review", "failed"] as const;
export type DailyInputStatus = (typeof DAILY_INPUT_STATUSES)[number];

export const DRAFT_STATUSES = ["pending_review", "approved", "published", "rejected"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_REVIEW_STATUSES = ["pending_review", "approved", "rejected"] as const;
export type DraftReviewStatus = (typeof DRAFT_REVIEW_STATUSES)[number];

export const WORKFLOW_NAMES = ["generate-draft", "publish-draft"] as const;
export type WorkflowName = (typeof WORKFLOW_NAMES)[number];

export const WORKFLOW_STATUSES = ["running", "pending_review", "completed", "failed"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const STYLE_PRESETS = ["build_log_v1"] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];

export type ThreeBullets = [string, string, string];

export interface TimestampedItem {
  created_at: string;
  updated_at: string;
}

export interface DailyInputItem extends TimestampedItem {
  input_id: string;
  input_date: string;
  bullets: ThreeBullets;
  tone: DailyInputTone;
  tags: string[];
  status: DailyInputStatus;
  latest_run_id: string | null;
  created_by: string;
}

export interface DraftItem extends TimestampedItem {
  draft_id: string;
  input_id: string;
  run_id: string;
  title: string;
  slug_suggestion: string;
  summary: string;
  content_md: string;
  status: DraftStatus;
  prompt_version: string;
  model_id: string;
  editor_notes: string;
  reviewed_by?: string;
  published_post_id?: string;
  version: number;
}

export interface PostItem extends TimestampedItem {
  post_id: string;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  published: true;
  published_at: string;
  published_partition: "posts";
  source_input_id: string;
  source_draft_id: string;
  author_id: string;
}

export interface GenerationRunRequest {
  style_preset: StylePreset;
  target_word_count: number;
}

export interface GenerationRunResult {
  draft_id?: string;
  status: WorkflowStatus;
}

export interface WorkflowRunItem extends TimestampedItem {
  run_id: string;
  workflow_name: WorkflowName;
  entity_ref: string;
  status: WorkflowStatus;
  request: GenerationRunRequest | Record<string, unknown>;
  result?: GenerationRunResult;
  error_message?: string;
  started_at: string;
  ended_at?: string;
  ttl?: number;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface CreateDailyInputRequest {
  input_date: string;
  bullets: ThreeBullets;
  tone?: DailyInputTone;
  tags?: string[];
}

export interface CreateDailyInputResponse {
  input_id: string;
  status: DailyInputStatus;
  created_at: string;
}

export interface StartGenerationRequest {
  style_preset?: StylePreset;
  target_word_count?: number;
}

export interface StartGenerationResponse {
  run_id: string;
  status: "running";
  started_at: string;
}

export interface WorkflowRunStatusView {
  run_id: string;
  workflow_name: WorkflowName;
  status: WorkflowStatus;
  lifecycle_status: "running" | "failed" | "completed";
  input_id?: string;
  draft_id?: string;
  started_at: string;
  ended_at?: string;
  error_message?: string;
}

export interface GetWorkflowRunResponse {
  workflow_run: WorkflowRunStatusView;
}

export interface GetDraftResponse {
  draft: DraftItem;
}

export interface GetDailyInputDraftResponse {
  input_id: string;
  draft: DraftItem | null;
}

export interface UpdateDraftRequest {
  expected_version: number;
  title?: string;
  summary?: string;
  content_md?: string;
  editor_notes?: string;
  status?: DraftReviewStatus;
}

export interface UpdateDraftResponse {
  draft: DraftItem;
}

export interface PublishDraftRequest {
  expected_version: number;
  edited_title: string;
  edited_summary: string;
  edited_content_md: string;
  slug: string;
  publish_at: "now";
}

export interface PublishDraftServiceRequest extends PublishDraftRequest {
  draft_id: string;
  reviewer_id: string;
}

export interface PublishDraftResponse {
  post_id: string;
  slug: string;
  published_at: string;
  url: string;
}

export interface StartGenerationWorkflowInput extends GenerationRunRequest {
  run_id: string;
  input_id: string;
  requested_by: string;
}
