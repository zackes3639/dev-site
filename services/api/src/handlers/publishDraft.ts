import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { PublishDraftServiceRequest } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { ConflictError, ValidationError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam, validatePublishDraft } from "../lib/validators";

const lambda = new LambdaClient({});

const parseLambdaResponse = (rawPayload: Buffer): { statusCode: number; body: string } => {
  const raw = rawPayload.toString("utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Publish service returned invalid JSON");
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "statusCode" in parsed &&
    typeof (parsed as { statusCode?: unknown }).statusCode === "number" &&
    "body" in parsed &&
    typeof (parsed as { body?: unknown }).body === "string"
  ) {
    return {
      statusCode: (parsed as { statusCode: number }).statusCode,
      body: (parsed as { body: string }).body
    };
  }

  throw new ValidationError("Publish service response shape is invalid");
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const draftId = validateIdPathParam(event.pathParameters?.draftId, "draftId");
    const payload = validatePublishDraft(parseJsonBody<unknown>(event));
    const cfg = loadConfig();

    const publishPayload: PublishDraftServiceRequest = {
      draft_id: draftId,
      reviewer_id: identity.userId,
      ...payload
    };

    const invoke = await lambda.send(
      new InvokeCommand({
        FunctionName: cfg.publishFunctionName,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(publishPayload))
      })
    );

    if (!invoke.Payload) {
      throw new ConflictError("Publish service returned an empty payload");
    }

    const parsed = parseLambdaResponse(Buffer.from(invoke.Payload));

    return {
      statusCode: parsed.statusCode,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type,authorization",
        "access-control-allow-methods": "POST,OPTIONS"
      },
      body: parsed.body
    };
  } catch (error) {
    return toErrorResponse(error, "Failed to publish draft");
  }
};
