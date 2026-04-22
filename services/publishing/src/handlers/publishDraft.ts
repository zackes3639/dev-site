import type { PublishDraftRequest, PublishDraftResponse } from "@briefly/contracts";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createId, json, logError, logInfo } from "@briefly/shared";
import { ddb } from "../lib/dynamo";

interface PublishRequestInternal extends PublishDraftRequest {
  draft_id: string;
  reviewer_id: string;
}

const requiredEnv = () => {
  const draftsTable = process.env.DRAFTS_TABLE;
  const postsTable = process.env.POSTS_TABLE;
  if (!draftsTable || !postsTable) {
    throw new Error("Missing DRAFTS_TABLE or POSTS_TABLE");
  }
  return { draftsTable, postsTable };
};

export const handler = async (event: PublishRequestInternal) => {
  try {
    const cfg = requiredEnv();

    const existingDraft = await ddb.send(
      new GetCommand({
        TableName: cfg.draftsTable,
        Key: { draft_id: event.draft_id }
      })
    );

    if (!existingDraft.Item) {
      return json(404, { message: "Draft not found" });
    }

    if (existingDraft.Item.status === "published") {
      return json(409, { message: "Draft already published" });
    }

    const slugCollision = await ddb.send(
      new QueryCommand({
        TableName: cfg.postsTable,
        IndexName: "by_slug",
        KeyConditionExpression: "slug = :slug",
        ExpressionAttributeValues: {
          ":slug": event.slug
        },
        Limit: 1
      })
    );

    if ((slugCollision.Items ?? []).length > 0) {
      return json(409, { message: "Slug already exists" });
    }

    const now = new Date().toISOString();
    const postId = createId("post");

    await ddb.send(
      new PutCommand({
        TableName: cfg.postsTable,
        Item: {
          post_id: postId,
          slug: event.slug,
          title: event.edited_title,
          summary: event.edited_summary,
          content_md: event.edited_content_md,
          published: true,
          published_at: now,
          published_partition: "posts",
          source_draft_id: event.draft_id,
          author_id: event.reviewer_id,
          created_at: now,
          updated_at: now
        },
        ConditionExpression: "attribute_not_exists(post_id)"
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: cfg.draftsTable,
        Key: { draft_id: event.draft_id },
        UpdateExpression: "SET #status = :published, published_post_id = :postId, updated_at = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":published": "published",
          ":postId": postId,
          ":updatedAt": now
        }
      })
    );

    const response: PublishDraftResponse = {
      post_id: postId,
      slug: event.slug,
      published_at: now,
      url: `/build-log/${event.slug}`
    };

    logInfo("draft_published", { draftId: event.draft_id, postId, reviewer: event.reviewer_id });
    return json(200, response);
  } catch (error) {
    logError("publish_draft_service_failed", { error: String(error) });
    return json(500, { message: "Failed to publish draft" });
  }
};
