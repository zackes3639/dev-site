import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UpdateDraftResponse } from "@briefly/contracts";
import { json, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam, validateUpdateDraft } from "../lib/validators";
import { DraftsRepository } from "../repositories/draftsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const draftId = validateIdPathParam(event.pathParameters?.draftId, "draftId");
    const payload = validateUpdateDraft(parseJsonBody<unknown>(event));

    const cfg = loadConfig();
    const draftsRepository = new DraftsRepository(cfg.draftsTable);

    const updatedDraft = await draftsRepository.updateForReview({
      draft_id: draftId,
      expected_version: payload.expected_version,
      patch: {
        ...(typeof payload.title === "string" ? { title: payload.title } : {}),
        ...(typeof payload.summary === "string" ? { summary: payload.summary } : {}),
        ...(typeof payload.content_md === "string" ? { content_md: payload.content_md } : {}),
        ...(typeof payload.editor_notes === "string" ? { editor_notes: payload.editor_notes } : {}),
        ...(typeof payload.status === "string" ? { status: payload.status } : {})
      },
      reviewed_by: identity.userId,
      updated_at: new Date().toISOString()
    });

    logInfo("draft_updated", {
      draftId,
      reviewer: identity.userId,
      version: updatedDraft.version
    });

    const response: UpdateDraftResponse = {
      draft: updatedDraft
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to update draft");
  }
};
