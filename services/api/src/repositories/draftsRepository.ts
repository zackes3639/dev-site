import type { DraftItem, UpdateDraftRequest } from "@briefly/contracts";
import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConflictError, NotFoundError } from "../lib/errors";
import { ddb } from "./dynamo";
import { isConditionalCheckFailedError } from "./repositoryErrors";

interface UpdateDraftParams {
  draft_id: string;
  expected_version: number;
  patch: Omit<UpdateDraftRequest, "expected_version">;
  reviewed_by: string;
  updated_at: string;
}

export class DraftsRepository {
  constructor(private readonly tableName: string) {}

  async getById(draftId: string): Promise<DraftItem | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { draft_id: draftId }
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as DraftItem;
  }

  async updateForReview(params: UpdateDraftParams): Promise<DraftItem> {
    const current = await this.getById(params.draft_id);
    if (!current) {
      throw new NotFoundError("Draft not found", { draft_id: params.draft_id });
    }

    if (current.status === "published") {
      throw new ConflictError("Published drafts cannot be modified", {
        draft_id: params.draft_id,
        status: current.status
      });
    }

    if (current.version !== params.expected_version) {
      throw new ConflictError("Draft has been updated by another operation", {
        draft_id: params.draft_id,
        current_version: current.version,
        expected_version: params.expected_version
      });
    }

    const expressionParts: string[] = [
      "reviewed_by = :reviewedBy",
      "updated_at = :updatedAt",
      "#version = :nextVersion"
    ];

    const values: Record<string, unknown> = {
      ":reviewedBy": params.reviewed_by,
      ":updatedAt": params.updated_at,
      ":expectedVersion": params.expected_version,
      ":nextVersion": params.expected_version + 1
    };

    const names: Record<string, string> = {
      "#version": "version"
    };

    if (typeof params.patch.title === "string") {
      expressionParts.push("title = :title");
      values[":title"] = params.patch.title;
    }

    if (typeof params.patch.summary === "string") {
      expressionParts.push("summary = :summary");
      values[":summary"] = params.patch.summary;
    }

    if (typeof params.patch.content_md === "string") {
      expressionParts.push("content_md = :contentMd");
      values[":contentMd"] = params.patch.content_md;
    }

    if (typeof params.patch.editor_notes === "string") {
      expressionParts.push("editor_notes = :editorNotes");
      values[":editorNotes"] = params.patch.editor_notes;
    }

    if (typeof params.patch.status === "string") {
      expressionParts.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = params.patch.status;
    }

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { draft_id: params.draft_id },
          UpdateExpression: `SET ${expressionParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(draft_id) AND #version = :expectedVersion",
          ReturnValues: "ALL_NEW"
        })
      );

      return result.Attributes as DraftItem;
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        throw new ConflictError("Draft version conflict", {
          draft_id: params.draft_id,
          expected_version: params.expected_version
        });
      }

      throw error;
    }
  }

  async getLatestByInputId(inputId: string): Promise<DraftItem | null> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "by_input",
        KeyConditionExpression: "input_id = :inputId",
        ExpressionAttributeValues: {
          ":inputId": inputId
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );

    const first = result.Items?.[0];
    if (!first) {
      return null;
    }

    return first as DraftItem;
  }
}
