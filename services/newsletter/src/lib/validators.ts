import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UpdateNewsletterCampaignRequest } from "@briefly/contracts";
import { ValidationError } from "./errors";

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

export const validateCampaignIdPathParam = (event: APIGatewayProxyEventV2): string => {
  const raw = event.pathParameters?.campaignId ?? event.pathParameters?.campaign_id;
  if (typeof raw !== "string") {
    throw new ValidationError("Missing path parameter: campaignId");
  }

  const decoded = decodeURIComponent(raw).trim();
  if (decoded.length < 6 || decoded.length > 180) {
    throw new ValidationError("campaignId must be between 6 and 180 characters");
  }

  return decoded;
};

export const validateUpdateNewsletterCampaign = (raw: unknown): UpdateNewsletterCampaignRequest => {
  if (!isObject(raw)) {
    throw new ValidationError("Request body must be an object");
  }

  const expectedVersion = parsePositiveInt(raw.expected_version, "expected_version");
  const subject = parseOptionalString(raw.subject, "subject", 1, 200);
  const body = parseOptionalString(raw.body, "body", 1, 100000);

  if (!subject && !body) {
    throw new ValidationError("At least one updatable field must be provided");
  }

  const request: UpdateNewsletterCampaignRequest = {
    expected_version: expectedVersion
  };

  if (subject) {
    request.subject = subject;
  }
  if (body) {
    request.body = body;
  }

  return request;
};
