import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { json, logError } from "@briefly/shared";
import { loadConfig } from "../lib/config";
import { ddb } from "../repositories/dynamo";
import { requireIdentity } from "../lib/auth";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const draftId = event.pathParameters?.draftId;
    if (!draftId) {
      return json(400, { message: "Missing path parameter: draftId" });
    }

    const cfg = loadConfig();
    const result = await ddb.send(
      new GetCommand({
        TableName: cfg.draftsTable,
        Key: { draft_id: draftId }
      })
    );

    if (!result.Item) {
      return json(404, { message: "Draft not found" });
    }

    return json(200, result.Item);
  } catch (error) {
    logError("get_draft_failed", { error: String(error) });
    return json(500, { message: "Failed to fetch draft" });
  }
};
