import type { GenerationRunRequest, WorkflowRunItem, WorkflowStatus } from "@briefly/contracts";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NotFoundError } from "../lib/errors";
import { ddb } from "./dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

interface CreateGenerationRunParams {
  run_id: string;
  input_id: string;
  started_at: string;
  request: GenerationRunRequest;
}

export class WorkflowRunsRepository {
  constructor(private readonly tableName: string) {}

  async getById(runId: string): Promise<WorkflowRunItem | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { run_id: runId }
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as WorkflowRunItem;
  }

  async createGenerationRun(params: CreateGenerationRunParams): Promise<WorkflowRunItem> {
    const item: WorkflowRunItem = {
      run_id: params.run_id,
      workflow_name: "generate-draft",
      entity_ref: `daily_input#${params.input_id}`,
      status: "running",
      request: params.request,
      started_at: params.started_at,
      created_at: params.started_at,
      updated_at: params.started_at
    };

    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(run_id)"
      })
    );

    return item;
  }

  async updateStatus(runId: string, status: WorkflowStatus, updatedAt: string, details?: Record<string, unknown>): Promise<void> {
    const expressionParts = ["#status = :status", "updated_at = :updatedAt"];
    const values: Record<string, unknown> = {
      ":status": status,
      ":updatedAt": updatedAt
    };

    const names: Record<string, string> = {
      "#status": "status"
    };

    if (status === "failed" || status === "completed" || status === "pending_review") {
      expressionParts.push("ended_at = :endedAt");
      values[":endedAt"] = updatedAt;
    }

    if (details?.error_message && typeof details.error_message === "string") {
      expressionParts.push("error_message = :errorMessage");
      values[":errorMessage"] = details.error_message;
    }

    if (details?.result) {
      expressionParts.push("result = :result");
      values[":result"] = details.result;
    }

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { run_id: runId },
          UpdateExpression: `SET ${expressionParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(run_id)"
        })
      );
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new NotFoundError("Workflow run not found", { run_id: runId });
      }

      throw error;
    }
  }

  async markFailed(runId: string, updatedAt: string, errorMessage: string): Promise<void> {
    await this.updateStatus(runId, "failed", updatedAt, {
      error_message: errorMessage
    });
  }
}
