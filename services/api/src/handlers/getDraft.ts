import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { GetDraftResponse } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { loadConfig } from "../lib/config";
import { NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam } from "../lib/validators";
import { DraftsRepository } from "../repositories/draftsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);

    const draftId = validateIdPathParam(event.pathParameters?.draftId, "draftId");

    const cfg = loadConfig();
    const draftsRepository = new DraftsRepository(cfg.draftsTable);

    const draft = await draftsRepository.getById(draftId);
    if (!draft) {
      throw new NotFoundError("Draft not found", { draft_id: draftId });
    }

    const response: GetDraftResponse = { draft };
    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch draft");
  }
};
