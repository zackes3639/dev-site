import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { StartExecutionCommand, SFNClient } from "@aws-sdk/client-sfn";
import type { StartGenerationRequest, StartGenerationResponse } from "@briefly/contracts";
import { createId, json, logError, logInfo } from "@briefly/shared";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { ddb } from "../repositories/dynamo";
import { requireIdentity } from "../lib/auth";

const sfn = new SFNClient({});

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const inputId = event.pathParameters?.inputId;
    if (!inputId) {
      return json(400, { message: "Missing path parameter: inputId" });
    }

    const body = parseJsonBody<StartGenerationRequest>(event);
    const cfg = loadConfig();

    const runId = createId("run");
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: cfg.workflowRunsTable,
        Item: {
          run_id: runId,
          workflow_name: "generate-draft",
          entity_ref: `daily_input#${inputId}`,
          status: "running",
          started_at: now,
          created_at: now,
          updated_at: now,
          request: {
            style_preset: body.style_preset ?? "build_log_v1",
            target_word_count: body.target_word_count ?? 500
          }
        }
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: cfg.dailyInputsTable,
        Key: { input_id: inputId },
        UpdateExpression: "SET #status = :status, latest_run_id = :runId, updated_at = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "running",
          ":runId": runId,
          ":updatedAt": now
        }
      })
    );

    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: cfg.generationStateMachineArn,
        name: runId,
        input: JSON.stringify({
          run_id: runId,
          input_id: inputId,
          style_preset: body.style_preset ?? "build_log_v1",
          target_word_count: body.target_word_count ?? 500
        })
      })
    );

    const response: StartGenerationResponse = {
      run_id: runId,
      status: "running"
    };

    logInfo("generation_started", { runId, inputId });
    return json(202, response);
  } catch (error) {
    logError("start_generation_failed", { error: String(error) });
    return json(500, { message: "Failed to start generation" });
  }
};
