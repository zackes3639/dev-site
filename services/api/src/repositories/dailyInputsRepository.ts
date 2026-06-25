import type { DailyInputItem, DailyInputStatus } from "@briefly/contracts";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError, NotFoundError } from "../lib/errors";
import { ddb } from "./dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

export class DailyInputsRepository {
  constructor(private readonly tableName: string) {}

  async create(item: DailyInputItem): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(input_id)"
        })
      );
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new ConflictError("Daily input already exists", { input_id: item.input_id });
      }

      throw error;
    }
  }

  async getById(inputId: string, consistentRead = false): Promise<DailyInputItem | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { input_id: inputId },
        ConsistentRead: consistentRead
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as DailyInputItem;
  }

  async transitionToRunningForGeneration(inputId: string, updatedAt: string, latestRunId: string): Promise<void> {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { input_id: inputId },
          UpdateExpression: "SET #status = :running, latest_run_id = :latestRunId, updated_at = :updatedAt",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":running": "running",
            ":latestRunId": latestRunId,
            ":updatedAt": updatedAt,
            ":submitted": "submitted",
            ":failed": "failed"
          },
          ConditionExpression: "attribute_exists(input_id) AND (#status = :submitted OR #status = :failed)"
        })
      );
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        await this.throwGenerationStartConflict(inputId);
      }

      throw error;
    }
  }

  async updateStatus(inputId: string, status: DailyInputStatus, updatedAt: string, latestRunId?: string): Promise<void> {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { input_id: inputId },
          UpdateExpression: "SET #status = :status, latest_run_id = :latestRunId, updated_at = :updatedAt",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":status": status,
            ":latestRunId": latestRunId ?? null,
            ":updatedAt": updatedAt
          },
          ConditionExpression: "attribute_exists(input_id)"
        })
      );
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new NotFoundError("Daily input not found", { input_id: inputId });
      }

      throw error;
    }
  }

  private async throwGenerationStartConflict(inputId: string): Promise<never> {
    const dailyInput = await this.getById(inputId, true);
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

    throw new ConflictError("Daily input is not eligible to start generation", {
      input_id: inputId,
      status: dailyInput.status,
      latest_run_id: dailyInput.latest_run_id
    });
  }
}
