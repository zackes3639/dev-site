import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { GetWorkflowRunResponse, WorkflowRunStatusView } from "@briefly/contracts";
import { json } from "@briefly/shared";
import { requireIdentity } from "../lib/auth";
import { loadConfig } from "../lib/config";
import { NotFoundError } from "../lib/errors";
import { toErrorResponse } from "../lib/errorResponse";
import { validateIdPathParam } from "../lib/validators";
import { WorkflowRunsRepository } from "../repositories/workflowRunsRepository";

const toLifecycleStatus = (status: WorkflowRunStatusView["status"]): WorkflowRunStatusView["lifecycle_status"] => {
  if (status === "running") {
    return "running";
  }

  if (status === "failed") {
    return "failed";
  }

  return "completed";
};

const extractInputId = (entityRef: string): string | undefined => {
  const prefix = "daily_input#";
  if (!entityRef.startsWith(prefix)) {
    return undefined;
  }

  const value = entityRef.slice(prefix.length);
  return value.length > 0 ? value : undefined;
};

const extractDraftId = (result: unknown): string | undefined => {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  const maybe = (result as { draft_id?: unknown }).draft_id;
  return typeof maybe === "string" && maybe.length > 0 ? maybe : undefined;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    requireIdentity(event);
    const runId = validateIdPathParam(event.pathParameters?.runId, "runId");

    const cfg = loadConfig();
    const repository = new WorkflowRunsRepository(cfg.workflowRunsTable);

    const run = await repository.getById(runId);
    if (!run) {
      throw new NotFoundError("Workflow run not found", { run_id: runId });
    }

    const inputId = extractInputId(run.entity_ref);
    const draftId = extractDraftId(run.result);

    const view: WorkflowRunStatusView = {
      run_id: run.run_id,
      workflow_name: run.workflow_name,
      status: run.status,
      lifecycle_status: toLifecycleStatus(run.status),
      started_at: run.started_at,
      ...(run.ended_at ? { ended_at: run.ended_at } : {}),
      ...(run.error_message ? { error_message: run.error_message } : {}),
      ...(inputId ? { input_id: inputId } : {}),
      ...(draftId ? { draft_id: draftId } : {})
    };

    const response: GetWorkflowRunResponse = {
      workflow_run: view
    };

    return json(200, response);
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch workflow run");
  }
};
