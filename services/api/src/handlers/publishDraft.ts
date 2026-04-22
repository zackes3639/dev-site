import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { PublishDraftRequest } from "@briefly/contracts";
import { json, logError } from "@briefly/shared";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { requireIdentity } from "../lib/auth";

const lambda = new LambdaClient({});

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const draftId = event.pathParameters?.draftId;
    if (!draftId) {
      return json(400, { message: "Missing path parameter: draftId" });
    }

    const payload = parseJsonBody<PublishDraftRequest>(event);
    const cfg = loadConfig();

    const invoke = await lambda.send(
      new InvokeCommand({
        FunctionName: cfg.publishFunctionName,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(
          JSON.stringify({
            draft_id: draftId,
            reviewer_id: identity.userId,
            ...payload
          })
        )
      })
    );

    if (!invoke.Payload) {
      return json(502, { message: "Publish service returned empty payload" });
    }

    const raw = Buffer.from(invoke.Payload).toString("utf-8");
    const parsed = JSON.parse(raw) as { statusCode?: number; body?: string };

    if (typeof parsed.statusCode === "number" && parsed.body) {
      return {
        statusCode: parsed.statusCode,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*"
        },
        body: parsed.body
      };
    }

    return json(200, parsed);
  } catch (error) {
    logError("publish_draft_failed", { error: String(error) });
    return json(500, { message: "Failed to publish draft" });
  }
};
