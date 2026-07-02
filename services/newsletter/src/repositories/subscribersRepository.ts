import { randomBytes } from "crypto";
import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewsletterSubscriberItem {
  subscriber_id: string;
  email: string;
  status: "active";
  unsubscribe_token?: string;
}

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return EMAIL_RE.test(normalized) ? normalized : null;
};

const toActiveSubscriber = (item: Record<string, unknown>): NewsletterSubscriberItem | null => {
  if (item.status !== "active" || typeof item.subscriber_id !== "string") {
    return null;
  }

  const email = normalizeEmail(item.email);
  if (!email) {
    return null;
  }

  const subscriber: NewsletterSubscriberItem = {
    subscriber_id: item.subscriber_id,
    email,
    status: "active"
  };

  if (typeof item.unsubscribe_token === "string" && item.unsubscribe_token.trim().length > 0) {
    subscriber.unsubscribe_token = item.unsubscribe_token;
  }

  return subscriber;
};

const createUnsubscribeToken = (): string => {
  return randomBytes(24).toString("base64url");
};

export class SubscribersRepository {
  constructor(private readonly tableName: string) {}

  async scanActiveSubscribers(): Promise<NewsletterSubscriberItem[]> {
    const subscribers: NewsletterSubscriberItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "#status = :active",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":active": "active"
          },
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        })
      );

      for (const item of result.Items ?? []) {
        const subscriber = toActiveSubscriber(item as Record<string, unknown>);
        if (subscriber) {
          subscribers.push(subscriber);
        }
      }

      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return subscribers;
  }

  async ensureUnsubscribeToken(subscriber: NewsletterSubscriberItem, updatedAt: string): Promise<string> {
    if (subscriber.unsubscribe_token) {
      return subscriber.unsubscribe_token;
    }

    const token = createUnsubscribeToken();

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { subscriber_id: subscriber.subscriber_id },
          UpdateExpression: "SET unsubscribe_token = :token, updated_at = :updatedAt",
          ExpressionAttributeValues: {
            ":token": token,
            ":updatedAt": updatedAt,
            ":empty": ""
          },
          ConditionExpression:
            "attribute_exists(subscriber_id) AND (attribute_not_exists(unsubscribe_token) OR unsubscribe_token = :empty)",
          ReturnValues: "ALL_NEW"
        })
      );

      const updatedToken = (result.Attributes as { unsubscribe_token?: unknown } | undefined)?.unsubscribe_token;
      if (typeof updatedToken === "string" && updatedToken.length > 0) {
        return updatedToken;
      }

      return token;
    } catch (error) {
      if (!isConditionalCheckFailedError(error)) {
        throw error;
      }

      const result = await ddb.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { subscriber_id: subscriber.subscriber_id }
        })
      );
      const existingToken = (result.Item as { unsubscribe_token?: unknown } | undefined)?.unsubscribe_token;
      if (typeof existingToken === "string" && existingToken.length > 0) {
        return existingToken;
      }

      throw error;
    }
  }
}
