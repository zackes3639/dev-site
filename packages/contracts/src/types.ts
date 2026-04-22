export type WorkflowStatus =
  | "submitted"
  | "running"
  | "pending_review"
  | "approved"
  | "published"
  | "failed";

export interface CreateDailyInputRequest {
  input_date: string;
  bullets: [string, string, string] | string[];
  tone?: "practical" | "reflective" | "technical";
  tags?: string[];
}

export interface CreateDailyInputResponse {
  input_id: string;
  status: "submitted";
  created_at: string;
}

export interface StartGenerationRequest {
  style_preset?: "build_log_v1";
  target_word_count?: number;
}

export interface StartGenerationResponse {
  run_id: string;
  status: "running";
}

export interface DraftRecord {
  draft_id: string;
  input_id: string;
  run_id: string;
  title: string;
  slug_suggestion: string;
  summary: string;
  content_md: string;
  status: "pending_review" | "approved" | "published" | "rejected";
  prompt_version: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface PublishDraftRequest {
  edited_title: string;
  edited_summary: string;
  edited_content_md: string;
  slug: string;
  publish_at: "now";
}

export interface PublishDraftResponse {
  post_id: string;
  slug: string;
  published_at: string;
  url: string;
}
