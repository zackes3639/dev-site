import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { CreateDailyInputResponse, DailyInputItem } from "@briefly/contracts";
import { createId, json, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { toErrorResponse } from "../lib/errorResponse";
import { loadConfig } from "../lib/config";
import { validateCreateDailyInput } from "../lib/validators";
import { DailyInputsRepository } from "../repositories/dailyInputsRepository";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const rawBody = parseJsonBody<unknown>(event);
    const payload = validateCreateDailyInput(rawBody);

    const now = new Date().toISOString();
    const inputId = createId("din");

    const item: DailyInputItem = {
      input_id: inputId,
      input_date: payload.input_date,
      bullets: payload.bullets,
      tone: payload.tone ?? "practical",
      tags: payload.tags ?? [],
      status: "submitted",
      latest_run_id: null,
      created_by: identity.userId,
      created_at: now,
      updated_at: now
    };

    const cfg = loadConfig();
    const repository = new DailyInputsRepository(cfg.dailyInputsTable);
    await repository.create(item);

    const response: CreateDailyInputResponse = {
      input_id: inputId,
      status: "submitted",
      created_at: now
    };

    logInfo("daily_input_created", { inputId, userId: identity.userId });
    return json(201, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to create daily input");
  }
};
