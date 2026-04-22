import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { json, logError, logInfo } from "@briefly/shared";
import { loadConfig } from "../lib/config";
import { ddb } from "../repositories/dynamo";
import { parseJsonBody } from "../lib/body";
import { requireIdentity } from "../lib/auth";

interface UpdateDraftBody {
  title?: string;
  summary?: string;
  content_md?: string;
  editor_notes?: string;
  status?: "pending_review" | "approved" | "rejected";
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const draftId = event.pathParameters?.draftId;
    if (!draftId) {
      return json(400, { message: "Missing path parameter: draftId" });
    }

    const body = parseJsonBody<UpdateDraftBody>(event);
    const cfg = loadConfig();
    const now = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: cfg.draftsTable,
        Key: { draft_id: draftId },
        UpdateExpression:
          "SET title = if_not_exists(title, :empty), summary = :summary, content_md = :content, editor_notes = :notes, #status = :status, reviewed_by = :reviewedBy, updated_at = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":empty": "",
          ":summary": body.summary ?? "",
          ":content": body.content_md ?? "",
          ":notes": body.editor_notes ?? "",
          ":status": body.status ?? "pending_review",
          ":reviewedBy": identity.userId,
          ":updatedAt": now
        },
        ConditionExpression: "attribute_exists(draft_id)",
        ReturnValues: "ALL_NEW"
      })
    );

    logInfo("draft_updated", { draftId, userId: identity.userId });
    return json(200, { draft_id: draftId, updated_at: now });
  } catch (error) {
    logError("update_draft_failed", { error: String(error) });
    return json(500, { message: "Failed to update draft" });
  }
};
