import {
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  type QueryCommandOutput
} from "@aws-sdk/lib-dynamodb";
import {
  type DraftItem,
  type PostItem,
  type PublishDraftResponse,
  type PublishDraftServiceRequest
} from "@briefly/contracts";
import { createId, json, logError, logInfo } from "@briefly/shared";
import { ddb } from "../lib/dynamo";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const requiredEnv = () => {
  const draftsTable = process.env.DRAFTS_TABLE;
  const postsTable = process.env.POSTS_TABLE;
  if (!draftsTable || !postsTable) {
    throw new Error("Missing DRAFTS_TABLE or POSTS_TABLE");
  }
  return { draftsTable, postsTable };
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseStringField = (payload: Record<string, unknown>, field: string): string => {
  const value = payload[field];
  if (typeof value !== "string") {
    throw new Error(`Invalid field: ${field}`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid field: ${field}`);
  }

  return trimmed;
};

const parsePayload = (payload: unknown): PublishDraftServiceRequest => {
  if (!isObject(payload)) {
    throw new Error("Invalid publish payload");
  }

  const draftId = parseStringField(payload, "draft_id");
  const reviewerId = parseStringField(payload, "reviewer_id");
  const editedTitle = parseStringField(payload, "edited_title");
  const editedSummary = parseStringField(payload, "edited_summary");
  const editedContent = parseStringField(payload, "edited_content_md");
  const publishAt = parseStringField(payload, "publish_at");
  const slugInput = parseStringField(payload, "slug");

  if (
    typeof payload.expected_version !== "number" ||
    !Number.isInteger(payload.expected_version) ||
    payload.expected_version < 1
  ) {
    throw new Error("expected_version must be a positive integer");
  }

  if (publishAt !== "now") {
    throw new Error("publish_at must be 'now'");
  }

  const slug = slugInput.toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new Error("slug format is invalid");
  }

  return {
    draft_id: draftId,
    reviewer_id: reviewerId,
    expected_version: payload.expected_version,
    edited_title: editedTitle,
    edited_summary: editedSummary,
    edited_content_md: editedContent,
    slug,
    publish_at: "now"
  };
};

const querySlug = async (postsTable: string, slug: string): Promise<QueryCommandOutput> => {
  return ddb.send(
    new QueryCommand({
      TableName: postsTable,
      IndexName: "by_slug",
      KeyConditionExpression: "slug = :slug",
      ExpressionAttributeValues: {
        ":slug": slug
      },
      Limit: 5
    })
  );
};

const findSuggestedSlug = async (postsTable: string, baseSlug: string): Promise<string> => {
  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${baseSlug}-${i}`;
    const result = await querySlug(postsTable, candidate);
    if ((result.Items ?? []).length === 0) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now().toString().slice(-6)}`;
};

export const handler = async (event: unknown) => {
  try {
    const payload = parsePayload(event);
    const cfg = requiredEnv();

    const existingDraft = await ddb.send(
      new GetCommand({
        TableName: cfg.draftsTable,
        Key: { draft_id: payload.draft_id }
      })
    );

    if (!existingDraft.Item) {
      return json(404, { code: "not_found", message: "Draft not found" });
    }

    const draft = existingDraft.Item as DraftItem;

    if (draft.status === "published") {
      return json(409, {
        code: "already_published",
        message: "Draft already published",
        details: {
          draft_id: payload.draft_id,
          published_post_id: draft.published_post_id ?? null
        }
      });
    }

    if (!["approved", "pending_review"].includes(draft.status)) {
      return json(409, {
        code: "invalid_status",
        message: "Draft must be pending_review or approved before publishing",
        details: {
          draft_id: payload.draft_id,
          status: draft.status
        }
      });
    }

    if (draft.version !== payload.expected_version) {
      return json(409, {
        code: "version_conflict",
        message: "Draft has changed since you last fetched it",
        details: {
          draft_id: payload.draft_id,
          expected_version: payload.expected_version,
          current_version: draft.version
        }
      });
    }

    const slugResult = await querySlug(cfg.postsTable, payload.slug);
    const collision = (slugResult.Items ?? []).find(
      (item) => (item as PostItem).source_draft_id !== payload.draft_id
    );

    if (collision) {
      const suggestedSlug = await findSuggestedSlug(cfg.postsTable, payload.slug);
      return json(409, {
        code: "slug_conflict",
        message: "Slug already exists",
        details: {
          slug: payload.slug,
          suggested_slug: suggestedSlug
        }
      });
    }

    const now = new Date().toISOString();
    const postId = createId("post");

    const postItem: PostItem = {
      post_id: postId,
      slug: payload.slug,
      title: payload.edited_title,
      summary: payload.edited_summary,
      content_md: payload.edited_content_md,
      published: true,
      published_at: now,
      published_partition: "posts",
      source_input_id: draft.input_id,
      source_draft_id: payload.draft_id,
      author_id: payload.reviewer_id,
      created_at: now,
      updated_at: now
    };

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: cfg.postsTable,
              Item: postItem,
              ConditionExpression: "attribute_not_exists(post_id)"
            }
          },
          {
            Update: {
              TableName: cfg.draftsTable,
              Key: { draft_id: payload.draft_id },
              UpdateExpression:
                "SET #status = :published, published_post_id = :postId, reviewed_by = :reviewedBy, updated_at = :updatedAt, #version = :nextVersion",
              ExpressionAttributeNames: {
                "#status": "status",
                "#version": "version"
              },
              ExpressionAttributeValues: {
                ":published": "published",
                ":postId": postId,
                ":reviewedBy": payload.reviewer_id,
                ":updatedAt": now,
                ":expectedVersion": payload.expected_version,
                ":nextVersion": payload.expected_version + 1
              },
              ConditionExpression: "attribute_exists(draft_id) AND #version = :expectedVersion"
            }
          }
        ]
      })
    );

    const response: PublishDraftResponse = {
      post_id: postId,
      slug: payload.slug,
      published_at: now,
      url: `/build-log/${payload.slug}`
    };

    logInfo("draft_published", {
      draftId: payload.draft_id,
      postId,
      reviewer: payload.reviewer_id
    });

    return json(200, response);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "TransactionCanceledException"
    ) {
      return json(409, {
        code: "write_conflict",
        message: "Draft publish conflict. Reload the draft and try again."
      });
    }

    logError("publish_draft_service_failed", { error: String(error) });
    return json(500, { code: "internal_error", message: "Failed to publish draft" });
  }
};
