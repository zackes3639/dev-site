import type { GenerationRunRequest } from "@briefly/contracts";
import { WorkflowRunsRepository } from "./workflowRunsRepository";

interface CreateGenerationWorkflowRunInput {
  run_id: string;
  input_id: string;
  started_at: string;
  request: GenerationRunRequest;
}

export const createGenerationWorkflowRun = async (
  repository: WorkflowRunsRepository,
  input: CreateGenerationWorkflowRunInput
) => {
  return repository.createGenerationRun(input);
};

export const markWorkflowRunFailed = async (
  repository: WorkflowRunsRepository,
  runId: string,
  failedAt: string,
  errorMessage: string
) => {
  await repository.markFailed(runId, failedAt, errorMessage);
};
