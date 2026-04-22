import type { Context } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createId, logError, logInfo } from "@briefly/shared";
import { buildLogV1Prompt } from "../prompts/buildLogV1";
import { generateMarkdown } from "../lib/model";
import { ddb } from "../lib/dynamo";

interface GenerateDraftEvent {
  run_id: string;
  input_id: string;
  style_preset?: "build_log_v1";
  target_word_count?: number;
}

const toSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const handler = async (event: GenerateDraftEvent, _context: Context) => {
  try {
    const dailyInputsTable = process.env.DAILY_INPUTS_TABLE;
    const draftsTable = process.env.DRAFTS_TABLE;
    const workflowRunsTable = process.env.WORKFLOW_RUNS_TABLE;
    if (!dailyInputsTable || !draftsTable || !workflowRunsTable) {
      throw new Error("Missing DAILY_INPUTS_TABLE, DRAFTS_TABLE, or WORKFLOW_RUNS_TABLE");
    }

    const dailyInputRecord = await ddb.send(
      new GetCommand({
        TableName: dailyInputsTable,
        Key: { input_id: event.input_id }
      })
    );

    if (!dailyInputRecord.Item) {
      throw new Error(`Daily input not found: ${event.input_id}`);
    }

    const bullets = Array.isArray(dailyInputRecord.Item.bullets)
      ? dailyInputRecord.Item.bullets.map((value) => String(value))
      : [];

    if (bullets.length !== 3) {
      throw new Error("Daily input does not contain exactly 3 bullets");
    }

    const modelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";
    const targetWordCount = event.target_word_count ?? 500;
    const promptVersion = "build_log_v1.0.0";
    const prompt = buildLogV1Prompt(bullets, targetWordCount);

    const contentMd = await generateMarkdown({
      modelId,
      prompt,
      temperature: 0.4
    });

    const firstHeading = contentMd
      .split("\n")
      .find((line) => line.startsWith("# "))
      ?.replace(/^#\s+/, "")
      .trim();

    const title = firstHeading || `Build Log - ${new Date().toISOString().slice(0, 10)}`;

    const draft = {
      draft_id: createId("draft"),
      input_id: event.input_id,
      run_id: event.run_id,
      title,
      slug_suggestion: toSlug(title),
      summary: bullets.join(" ").slice(0, 180),
      content_md: contentMd,
      status: "pending_review",
      prompt_version: promptVersion,
      model_id: modelId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await ddb.send(
      new PutCommand({
        TableName: draftsTable,
        Item: draft
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: dailyInputsTable,
        Key: { input_id: event.input_id },
        UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "pending_review",
          ":updatedAt": new Date().toISOString()
        }
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: workflowRunsTable,
        Key: { run_id: event.run_id },
        UpdateExpression:
          "SET #status = :status, ended_at = :endedAt, updated_at = :updatedAt, result_draft_id = :draftId",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "pending_review",
          ":endedAt": new Date().toISOString(),
          ":updatedAt": new Date().toISOString(),
          ":draftId": draft.draft_id
        }
      })
    );

    logInfo("draft_generated", { runId: event.run_id, inputId: event.input_id, modelId });

    return {
      ...draft,
      quality: {
        word_count: contentMd.split(/\s+/).filter(Boolean).length,
        has_three_sections: (contentMd.match(/^##\s+/gm) || []).length >= 3
      }
    };
  } catch (error) {
    logError("draft_generation_failed", {
      runId: event.run_id,
      inputId: event.input_id,
      error: String(error)
    });
    throw error;
  }
};
