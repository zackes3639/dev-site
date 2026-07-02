import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type {
  NewsletterCampaignItem,
  NewsletterCampaignStatus,
  UpdateNewsletterCampaignRequest
} from "@briefly/contracts";
import { ConflictError, NotFoundError } from "../lib/errors";
import { ddb } from "../lib/dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

interface UpdateEditableParams {
  campaign_id: string;
  expected_version: number;
  patch: Omit<UpdateNewsletterCampaignRequest, "expected_version">;
  updated_by: string;
  updated_at: string;
}

interface CompleteSendParams {
  campaign_id: string;
  status: Extract<NewsletterCampaignStatus, "sent" | "failed">;
  updated_at: string;
  total_recipients: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
  last_error?: string;
}

const editableStatuses: NewsletterCampaignStatus[] = ["draft", "test_sent", "failed"];

export class CampaignsRepository {
  constructor(private readonly tableName: string) {}

  async getById(campaignId: string): Promise<NewsletterCampaignItem | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { campaign_id: campaignId }
      })
    );

    return result.Item ? (result.Item as NewsletterCampaignItem) : null;
  }

  async listAll(): Promise<NewsletterCampaignItem[]> {
    const campaigns: NewsletterCampaignItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: this.tableName,
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        })
      );

      campaigns.push(...((result.Items ?? []) as NewsletterCampaignItem[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return campaigns;
  }

  async putDraftIfAbsent(campaign: NewsletterCampaignItem): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: campaign,
          ConditionExpression: "attribute_not_exists(campaign_id)"
        })
      );

      return true;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        return false;
      }

      throw error;
    }
  }

  async updateEditable(params: UpdateEditableParams): Promise<NewsletterCampaignItem> {
    const current = await this.getById(params.campaign_id);
    if (!current) {
      throw new NotFoundError("Campaign not found", { campaign_id: params.campaign_id });
    }

    if (!editableStatuses.includes(current.status)) {
      throw new ConflictError("Campaign cannot be edited in its current status", {
        campaign_id: params.campaign_id,
        status: current.status
      });
    }

    if (current.version !== params.expected_version) {
      throw new ConflictError("Campaign has been updated by another operation", {
        campaign_id: params.campaign_id,
        current_version: current.version,
        expected_version: params.expected_version
      });
    }

    const expressionParts = [
      "#status = :draft",
      "updated_at = :updatedAt",
      "updated_by = :updatedBy",
      "#version = :nextVersion"
    ];
    const names: Record<string, string> = {
      "#status": "status",
      "#version": "version"
    };
    const values: Record<string, unknown> = {
      ":draft": "draft",
      ":updatedAt": params.updated_at,
      ":updatedBy": params.updated_by,
      ":expectedVersion": params.expected_version,
      ":nextVersion": params.expected_version + 1
    };

    if (typeof params.patch.subject === "string") {
      expressionParts.push("#subject = :subject");
      names["#subject"] = "subject";
      values[":subject"] = params.patch.subject;
    }

    if (typeof params.patch.body === "string") {
      expressionParts.push("#body = :body");
      names["#body"] = "body";
      values[":body"] = params.patch.body;
    }

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { campaign_id: params.campaign_id },
          UpdateExpression:
            `SET ${expressionParts.join(", ")} ` +
            "REMOVE test_sent_at, test_recipient, send_started_at, sent_at, failed_at, last_error",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(campaign_id) AND #version = :expectedVersion",
          ReturnValues: "ALL_NEW"
        })
      );

      return result.Attributes as NewsletterCampaignItem;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new ConflictError("Campaign version conflict", {
          campaign_id: params.campaign_id,
          expected_version: params.expected_version
        });
      }

      throw error;
    }
  }

  async markTestSent(
    campaignId: string,
    expectedVersion: number,
    recipient: string,
    sentAt: string
  ): Promise<NewsletterCampaignItem> {
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { campaign_id: campaignId },
          UpdateExpression:
            "SET #status = :status, test_sent_at = :sentAt, test_recipient = :recipient, " +
            "updated_at = :sentAt, #version = :nextVersion " +
            "REMOVE send_started_at, sent_at, failed_at, last_error",
          ExpressionAttributeNames: {
            "#status": "status",
            "#version": "version"
          },
          ExpressionAttributeValues: {
            ":status": "test_sent",
            ":sentAt": sentAt,
            ":recipient": recipient,
            ":expectedVersion": expectedVersion,
            ":nextVersion": expectedVersion + 1
          },
          ConditionExpression: "attribute_exists(campaign_id) AND #version = :expectedVersion",
          ReturnValues: "ALL_NEW"
        })
      );

      return result.Attributes as NewsletterCampaignItem;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new ConflictError("Campaign version conflict", {
          campaign_id: campaignId,
          expected_version: expectedVersion
        });
      }

      throw error;
    }
  }

  async markSending(campaignId: string, startedAt: string): Promise<NewsletterCampaignItem> {
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { campaign_id: campaignId },
          UpdateExpression:
            "SET #status = :sending, send_started_at = :startedAt, updated_at = :startedAt, " +
            "#version = #version + :one REMOVE failed_at, last_error",
          ExpressionAttributeNames: {
            "#status": "status",
            "#version": "version"
          },
          ExpressionAttributeValues: {
            ":sending": "sending",
            ":requiredStatus": "test_sent",
            ":startedAt": startedAt,
            ":one": 1
          },
          ConditionExpression: "attribute_exists(campaign_id) AND #status = :requiredStatus",
          ReturnValues: "ALL_NEW"
        })
      );

      return result.Attributes as NewsletterCampaignItem;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new ConflictError("Campaign must have a completed test send before subscriber send", {
          campaign_id: campaignId
        }, "test_send_required");
      }

      throw error;
    }
  }

  async completeSend(params: CompleteSendParams): Promise<NewsletterCampaignItem> {
    const expressionParts = [
      "#status = :status",
      "updated_at = :updatedAt",
      "total_recipients = :totalRecipients",
      "delivered_count = :deliveredCount",
      "failed_count = :failedCount",
      "skipped_count = :skippedCount",
      "#version = #version + :one"
    ];
    const values: Record<string, unknown> = {
      ":status": params.status,
      ":updatedAt": params.updated_at,
      ":totalRecipients": params.total_recipients,
      ":deliveredCount": params.delivered_count,
      ":failedCount": params.failed_count,
      ":skippedCount": params.skipped_count,
      ":one": 1
    };
    const removeParts: string[] = [];

    if (params.status === "sent") {
      expressionParts.push("sent_at = :updatedAt");
      removeParts.push("failed_at", "last_error");
    } else {
      expressionParts.push("failed_at = :updatedAt", "last_error = :lastError");
      values[":lastError"] = params.last_error ?? "One or more newsletter deliveries failed";
      removeParts.push("sent_at");
    }

    const updateExpression =
      `SET ${expressionParts.join(", ")}` + (removeParts.length > 0 ? ` REMOVE ${removeParts.join(", ")}` : "");

    const result = await ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { campaign_id: params.campaign_id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          "#status": "status",
          "#version": "version"
        },
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(campaign_id)",
        ReturnValues: "ALL_NEW"
      })
    );

    return result.Attributes as NewsletterCampaignItem;
  }
}
