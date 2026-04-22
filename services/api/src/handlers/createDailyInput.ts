import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { CreateDailyInputRequest, CreateDailyInputResponse } from "@briefly/contracts";
import { createId, json, logError, logInfo } from "@briefly/shared";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { ddb } from "../repositories/dynamo";
import { requireIdentity } from "../lib/auth";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const body = parseJsonBody<CreateDailyInputRequest>(event);

    if (!Array.isArray(body.bullets) || body.bullets.length !== 3) {
      return json(400, { message: "bullets must be an array of exactly 3 items" });
    }

    const bullets = body.bullets.map((bullet: string) => String(bullet).trim()).filter(Boolean);
    if (bullets.length !== 3) {
      return json(400, { message: "all 3 bullet items must be non-empty" });
    }

    const now = new Date().toISOString();
    const inputId = createId("din");
    const cfg = loadConfig();

    await ddb.send(
      new PutCommand({
        TableName: cfg.dailyInputsTable,
        Item: {
          input_id: inputId,
          input_date: body.input_date,
          bullets,
          tone: body.tone ?? "practical",
          tags: body.tags ?? [],
          status: "submitted",
          latest_run_id: null,
          created_by: identity.userId,
          created_at: now,
          updated_at: now
        }
      })
    );

    const response: CreateDailyInputResponse = {
      input_id: inputId,
      status: "submitted",
      created_at: now
    };

    logInfo("daily_input_created", { inputId, userId: identity.userId });
    return json(201, response);
  } catch (error) {
    logError("create_daily_input_failed", { error: String(error) });
    return json(500, { message: "Failed to create daily input" });
  }
};
