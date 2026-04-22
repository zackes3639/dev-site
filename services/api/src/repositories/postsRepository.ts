import type { PostItem } from "@briefly/contracts";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError } from "../lib/errors";
import { ddb } from "./dynamo";

export class PostsRepository {
  constructor(private readonly tableName: string) {}

  async findBySlug(slug: string): Promise<PostItem | null> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "by_slug",
        KeyConditionExpression: "slug = :slug",
        ExpressionAttributeValues: {
          ":slug": slug
        },
        Limit: 1
      })
    );

    const item = result.Items?.[0];
    return (item as PostItem | undefined) ?? null;
  }

  async create(item: PostItem): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(post_id)"
        })
      );
    } catch {
      throw new ConflictError("Could not create post item", { post_id: item.post_id });
    }
  }
}
