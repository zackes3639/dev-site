import type { Context } from "aws-lambda";
import type { DraftItem, DailyInputItem, StartGenerationWorkflowInput } from "@briefly/contracts";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createId, logError, logInfo } from "@briefly/shared";
import { buildLogV1Prompt } from "../prompts/buildLogV1";
import { ddb } from "../lib/dynamo";
import { generateMarkdown } from "../lib/model";

const toSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const requiredEnv = () => {
  const dailyInputsTable = process.env.DAILY_INPUTS_TABLE;
  const draftsTable = process.env.DRAFTS_TABLE;
  const workflowRunsTable = process.env.WORKFLOW_RUNS_TABLE;

  if (!dailyInputsTable || !draftsTable || !workflowRunsTable) {
    throw new Error("Missing DAILY_INPUTS_TABLE, DRAFTS_TABLE, or WORKFLOW_RUNS_TABLE");
  }

  return { dailyInputsTable, draftsTable, workflowRunsTable };
};

export const handler = async (event: StartGenerationWorkflowInput, _context: Context) => {
  const cfg = requiredEnv();

  try {
    const dailyInputRecord = await ddb.send(
      new GetCommand({
        TableName: cfg.dailyInputsTable,
        Key: { input_id: event.input_id }
      })
    );

    if (!dailyInputRecord.Item) {
      throw new Error(`Daily input not found: ${event.input_id}`);
    }

    const dailyInput = dailyInputRecord.Item as DailyInputItem;
    const bullets = Array.isArray(dailyInput.bullets)
      ? dailyInput.bullets.map((value) => String(value))
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
    const now = new Date().toISOString();

    const draft: DraftItem = {
      draft_id: createId("draft"),
      input_id: event.input_id,
      run_id: event.run_id,
      title,
      slug_suggestion: toSlug(title),
      summary: bullets.join(" ").slice(0, 320),
      content_md: contentMd,
      status: "pending_review",
      prompt_version: promptVersion,
      model_id: modelId,
      editor_notes: "",
      version: 1,
      created_at: now,
      updated_at: now
    };

    await ddb.send(
      new PutCommand({
        TableName: cfg.draftsTable,
        Item: draft
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: cfg.dailyInputsTable,
        Key: { input_id: event.input_id },
        UpdateExpression: "SET #status = :status, latest_run_id = :runId, updated_at = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "pending_review",
          ":runId": event.run_id,
          ":updatedAt": now
        }
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: cfg.workflowRunsTable,
        Key: { run_id: event.run_id },
        UpdateExpression:
          "SET #status = :status, ended_at = :endedAt, updated_at = :updatedAt, #result = :result",
        ExpressionAttributeNames: {
          "#status": "status",
          "#result": "result"
        },
        ExpressionAttributeValues: {
          ":status": "pending_review",
          ":endedAt": now,
          ":updatedAt": now,
          ":result": {
            draft_id: draft.draft_id,
            status: "pending_review"
          }
        }
      })
    );

    logInfo("draft_generated", {
      runId: event.run_id,
      inputId: event.input_id,
      draftId: draft.draft_id,
      modelId
    });

    return {
      ...draft,
      quality: {
        word_count: contentMd.split(/\s+/).filter(Boolean).length,
        has_three_sections: (contentMd.match(/^##\s+/gm) || []).length >= 3
      }
    };
  } catch (error) {
    const failedAt = new Date().toISOString();

    await Promise.allSettled([
      ddb.send(
        new UpdateCommand({
          TableName: cfg.workflowRunsTable,
          Key: { run_id: event.run_id },
          UpdateExpression:
            "SET #status = :status, ended_at = :endedAt, updated_at = :updatedAt, error_message = :errorMessage",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":status": "failed",
            ":endedAt": failedAt,
            ":updatedAt": failedAt,
            ":errorMessage": String(error)
          }
        })
      ),
      ddb.send(
        new UpdateCommand({
          TableName: cfg.dailyInputsTable,
          Key: { input_id: event.input_id },
          UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": "failed",
            ":updatedAt": failedAt
          }
        })
      )
    ]);

    logError("draft_generation_failed", {
      runId: event.run_id,
      inputId: event.input_id,
      error: String(error)
    });
    throw error;
  }
};
