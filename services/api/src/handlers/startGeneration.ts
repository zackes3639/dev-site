import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { StartExecutionCommand, SFNClient } from "@aws-sdk/client-sfn";
import type { StartGenerationResponse } from "@briefly/contracts";
import { createId, json, logError, logInfo } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { parseJsonBody } from "../lib/body";
import { loadConfig } from "../lib/config";
import { ConflictError, NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam, validateStartGeneration } from "../lib/validators";
import { DailyInputsRepository } from "../repositories/dailyInputsRepository";
import { createGenerationWorkflowRun, markWorkflowRunFailed } from "../repositories/workflowRunHelpers";
import { WorkflowRunsRepository } from "../repositories/workflowRunsRepository";

const sfn = new SFNClient({});

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const identity = requireIdentity(event);
    const inputId = validateIdPathParam(event.pathParameters?.inputId, "inputId");
    const payload = validateStartGeneration(parseJsonBody<unknown>(event, { allowEmpty: true }));

    const cfg = loadConfig();
    const dailyInputsRepository = new DailyInputsRepository(cfg.dailyInputsTable);
    const workflowRunsRepository = new WorkflowRunsRepository(cfg.workflowRunsTable);

    const dailyInput = await dailyInputsRepository.getById(inputId);
    if (!dailyInput) {
      throw new NotFoundError("Daily input not found", { input_id: inputId });
    }

    if (dailyInput.status === "running") {
      throw new ConflictError("Daily input already has a generation run in progress", {
        input_id: inputId,
        latest_run_id: dailyInput.latest_run_id
      });
    }

    if (dailyInput.status === "pending_review") {
      throw new ConflictError("Daily input already has a draft pending review", {
        input_id: inputId,
        latest_run_id: dailyInput.latest_run_id
      });
    }

    const runId = createId("run");
    const startedAt = new Date().toISOString();

    await createGenerationWorkflowRun(workflowRunsRepository, {
      run_id: runId,
      input_id: inputId,
      started_at: startedAt,
      request: {
        style_preset: payload.style_preset,
        target_word_count: payload.target_word_count
      }
    });

    await dailyInputsRepository.updateStatus(inputId, "running", startedAt, runId);

    try {
      await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: cfg.generationStateMachineArn,
          name: runId,
          input: JSON.stringify({
            run_id: runId,
            input_id: inputId,
            requested_by: identity.userId,
            style_preset: payload.style_preset,
            target_word_count: payload.target_word_count
          })
        })
      );
    } catch (error) {
      const failedAt = new Date().toISOString();
      await Promise.allSettled([
        markWorkflowRunFailed(workflowRunsRepository, runId, failedAt, String(error)),
        dailyInputsRepository.updateStatus(inputId, "failed", failedAt, runId)
      ]);
      throw error;
    }

    const response: StartGenerationResponse = {
      run_id: runId,
      status: "running",
      started_at: startedAt
    };

    logInfo("generation_started", { inputId, runId, userId: identity.userId });
    return json(202, response);
  } catch (error) {
    logError("start_generation_failed", { error: String(error) });
    return toErrorResponse(error, "Failed to start generation");
  }
};
