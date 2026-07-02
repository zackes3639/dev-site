import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { NewsletterDeliveryItem } from "@briefly/contracts";
import { ddb } from "../lib/dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

interface CreateQueuedDeliveryParams {
  campaign_id: string;
  subscriber_id: string;
  email: string;
  created_at: string;
}

export const deliveryIdFor = (campaignId: string, subscriberId: string): string => {
  return `${campaignId}#${subscriberId}`;
};

export class DeliveriesRepository {
  constructor(private readonly tableName: string) {}

  async createQueuedIfAbsent(params: CreateQueuedDeliveryParams): Promise<NewsletterDeliveryItem | null> {
    const delivery: NewsletterDeliveryItem = {
      delivery_id: deliveryIdFor(params.campaign_id, params.subscriber_id),
      campaign_id: params.campaign_id,
      subscriber_id: params.subscriber_id,
      email: params.email,
      status: "queued",
      created_at: params.created_at,
      updated_at: params.created_at
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: delivery,
          ConditionExpression: "attribute_not_exists(campaign_id) AND attribute_not_exists(subscriber_id)"
        })
      );

      return delivery;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        return null;
      }

      throw error;
    }
  }

  async markSent(
    campaignId: string,
    subscriberId: string,
    messageId: string | undefined,
    sentAt: string
  ): Promise<void> {
    const expressionParts = ["#status = :status", "sent_at = :sentAt", "updated_at = :sentAt"];
    const values: Record<string, unknown> = {
      ":status": "sent",
      ":sentAt": sentAt
    };

    if (messageId) {
      expressionParts.push("message_id = :messageId");
      values[":messageId"] = messageId;
    }

    await ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { campaign_id: campaignId, subscriber_id: subscriberId },
        UpdateExpression: `SET ${expressionParts.join(", ")} REMOVE error_message, failed_at`,
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(campaign_id) AND attribute_exists(subscriber_id)"
      })
    );
  }

  async markFailed(campaignId: string, subscriberId: string, errorMessage: string, failedAt: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { campaign_id: campaignId, subscriber_id: subscriberId },
        UpdateExpression:
          "SET #status = :status, error_message = :errorMessage, failed_at = :failedAt, updated_at = :failedAt",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": "failed",
          ":errorMessage": errorMessage.slice(0, 1000),
          ":failedAt": failedAt
        },
        ConditionExpression: "attribute_exists(campaign_id) AND attribute_exists(subscriber_id)"
      })
    );
  }
}
