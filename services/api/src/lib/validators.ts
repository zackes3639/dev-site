import {
  DAILY_INPUT_TONES,
  DRAFT_REVIEW_STATUSES,
  STYLE_PRESETS,
  type CreateDailyInputRequest,
  type DailyInputTone,
  type DraftReviewStatus,
  type PublishDraftRequest,
  type StartGenerationRequest,
  type StylePreset,
  type ThreeBullets,
  type UpdateDraftRequest
} from "@briefly/contracts";
import { ValidationError } from "./errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseString = (value: unknown, field: string, min = 1, max = 4000): string => {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${field} must be at least ${min} characters`);
  }

  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }

  return trimmed;
};

const parseOptionalString = (value: unknown, field: string, min = 1, max = 4000): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  return parseString(value, field, min, max);
};

const parsePositiveInt = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }

  return value;
};

export const validateIdPathParam = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new ValidationError(`Missing path parameter: ${field}`);
  }

  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 128) {
    throw new ValidationError(`${field} must be between 3 and 128 characters`);
  }

  return trimmed;
};

export const validateCreateDailyInput = (raw: unknown): CreateDailyInputRequest => {
  if (!isObject(raw)) {
    throw new ValidationError("Request body must be an object");
  }

  const inputDate = parseString(raw.input_date, "input_date", 10, 10);
  if (!DATE_RE.test(inputDate)) {
    throw new ValidationError("input_date must use YYYY-MM-DD format");
  }

  const [yearRaw, monthRaw, dayRaw] = inputDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new ValidationError("input_date is not a valid calendar date");
  }

  if (!Array.isArray(raw.bullets) || raw.bullets.length !== 3) {
    throw new ValidationError("bullets must be an array of exactly 3 items");
  }

  const bullets = raw.bullets.map((value, index) => parseString(value, `bullets[${index}]`, 1, 280));

  const toneRaw = typeof raw.tone === "undefined" ? "practical" : raw.tone;
  if (typeof toneRaw !== "string" || !DAILY_INPUT_TONES.includes(toneRaw as DailyInputTone)) {
    throw new ValidationError(`tone must be one of: ${DAILY_INPUT_TONES.join(", ")}`);
  }
  const tone = toneRaw as DailyInputTone;

  const tagsRaw = typeof raw.tags === "undefined" ? [] : raw.tags;
  if (!Array.isArray(tagsRaw)) {
    throw new ValidationError("tags must be an array of strings");
  }

  const tags = tagsRaw.map((value, index) => parseString(value, `tags[${index}]`, 1, 32).toLowerCase());

  return {
    input_date: inputDate,
    bullets: bullets as ThreeBullets,
    tone,
    tags
  };
};

export const validateStartGeneration = (raw: unknown): Required<StartGenerationRequest> => {
  if (!isObject(raw)) {
    throw new ValidationError("Request body must be an object");
  }

  const stylePresetRaw = typeof raw.style_preset === "undefined" ? "build_log_v1" : raw.style_preset;
  if (typeof stylePresetRaw !== "string" || !STYLE_PRESETS.includes(stylePresetRaw as StylePreset)) {
    throw new ValidationError(`style_preset must be one of: ${STYLE_PRESETS.join(", ")}`);
  }
  const stylePreset = stylePresetRaw as StylePreset;

  const targetRaw = typeof raw.target_word_count === "undefined" ? 500 : raw.target_word_count;
  if (typeof targetRaw !== "number" || !Number.isInteger(targetRaw) || targetRaw < 250 || targetRaw > 1500) {
    throw new ValidationError("target_word_count must be an integer between 250 and 1500");
  }

  return {
    style_preset: stylePreset,
    target_word_count: targetRaw
  };
};

export const validateUpdateDraft = (raw: unknown): UpdateDraftRequest => {
  if (!isObject(raw)) {
    throw new ValidationError("Request body must be an object");
  }

  const expectedVersion = parsePositiveInt(raw.expected_version, "expected_version");

  const title = parseOptionalString(raw.title, "title", 1, 180);
  const summary = parseOptionalString(raw.summary, "summary", 1, 320);
  const contentMd = parseOptionalString(raw.content_md, "content_md", 1, 100000);
  const editorNotes = parseOptionalString(raw.editor_notes, "editor_notes", 1, 2000);

  let status: UpdateDraftRequest["status"];
  if (typeof raw.status !== "undefined") {
    if (typeof raw.status !== "string" || !DRAFT_REVIEW_STATUSES.includes(raw.status as DraftReviewStatus)) {
      throw new ValidationError(`status must be one of: ${DRAFT_REVIEW_STATUSES.join(", ")}`);
    }

    status = raw.status as DraftReviewStatus;
  }

  if (!title && !summary && !contentMd && !editorNotes && !status) {
    throw new ValidationError("At least one updatable field must be provided");
  }

  return {
    expected_version: expectedVersion,
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(contentMd ? { content_md: contentMd } : {}),
    ...(editorNotes ? { editor_notes: editorNotes } : {}),
    ...(status ? { status } : {})
  };
};

export const validatePublishDraft = (raw: unknown): PublishDraftRequest => {
  if (!isObject(raw)) {
    throw new ValidationError("Request body must be an object");
  }

  const expectedVersion = parsePositiveInt(raw.expected_version, "expected_version");
  const editedTitle = parseString(raw.edited_title, "edited_title", 1, 180);
  const editedSummary = parseString(raw.edited_summary, "edited_summary", 1, 320);
  const editedContent = parseString(raw.edited_content_md, "edited_content_md", 1, 100000);
  const slug = parseString(raw.slug, "slug", 1, 120).toLowerCase();

  if (!SLUG_RE.test(slug)) {
    throw new ValidationError("slug must match ^[a-z0-9]+(?:-[a-z0-9]+)*$");
  }

  const publishAt = raw.publish_at;
  if (publishAt !== "now") {
    throw new ValidationError("publish_at must be 'now'");
  }

  return {
    expected_version: expectedVersion,
    edited_title: editedTitle,
    edited_summary: editedSummary,
    edited_content_md: editedContent,
    slug,
    publish_at: "now"
  };
};
