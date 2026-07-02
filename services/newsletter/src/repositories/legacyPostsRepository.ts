import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { NewsletterCampaignSourcePost } from "@briefly/contracts";
import { ddb } from "../lib/dynamo";

const isPublishedPost = (item: Record<string, unknown>): boolean => {
  return item.published === true;
};

const toSourcePost = (item: Record<string, unknown>): NewsletterCampaignSourcePost | null => {
  if (
    typeof item.post_id !== "string" ||
    typeof item.slug !== "string" ||
    typeof item.title !== "string" ||
    typeof item.summary !== "string" ||
    typeof item.content !== "string"
  ) {
    return null;
  }

  const post: NewsletterCampaignSourcePost = {
    post_id: item.post_id,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    content: item.content
  };

  if (typeof item.created_at === "string") {
    post.created_at = item.created_at;
  }

  return post;
};

export class LegacyPostsRepository {
  constructor(private readonly tableName: string) {}

  async scanPublishedPosts(): Promise<NewsletterCampaignSourcePost[]> {
    const posts: NewsletterCampaignSourcePost[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: this.tableName,
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        })
      );

      for (const item of result.Items ?? []) {
        const raw = item as Record<string, unknown>;
        if (!isPublishedPost(raw)) {
          continue;
        }

        const post = toSourcePost(raw);
        if (post) {
          posts.push(post);
        }
      }

      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return posts;
  }
}
