import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { GetDailyInputDraftResponse } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { loadConfig } from "../lib/config";
import { NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam } from "../lib/validators";
import { DailyInputsRepository } from "../repositories/dailyInputsRepository";
import { DraftsRepository } from "../repositories/draftsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const inputId = validateIdPathParam(event.pathParameters?.inputId, "inputId");

    const cfg = loadConfig();
    const dailyInputsRepository = new DailyInputsRepository(cfg.dailyInputsTable);
    const draftsRepository = new DraftsRepository(cfg.draftsTable);

    const input = await dailyInputsRepository.getById(inputId);
    if (!input) {
      throw new NotFoundError("Daily input not found", { input_id: inputId });
    }

    const draft = await draftsRepository.getLatestByInputId(inputId);

    const response: GetDailyInputDraftResponse = {
      input_id: inputId,
      draft
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch daily input draft");
  }
};
