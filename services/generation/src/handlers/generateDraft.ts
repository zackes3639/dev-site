import type { Context } from "aws-lambda";
import type { DraftItem, DailyInputItem, StartGenerationWorkflowInput } from "@briefly/contracts";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createId, logError, logInfo } from "@briefly/shared";
import {
  buildFallbackBuildLogOutput,
  collectGuardrailIssues,
  normalizeBuildLogOutput,
  parseBuildLogStructuredOutput,
  type ParsedBuildLogOutput,
  type NormalizedBuildLogOutput
} from "../lib/buildLogOutput";
import { ddb } from "../lib/dynamo";
import { generateModelText } from "../lib/model";
import {
  buildLogGuardrailRepairPrompt,
  buildLogJsonRepairPrompt,
  buildLogV1Prompt
} from "../prompts/buildLogV1";

const requiredEnv = () => {
  const dailyInputsTable = process.env.DAILY_INPUTS_TABLE;
  const draftsTable = process.env.DRAFTS_TABLE;
  const workflowRunsTable = process.env.WORKFLOW_RUNS_TABLE;

  if (!dailyInputsTable || !draftsTable || !workflowRunsTable) {
    throw new Error("Missing DAILY_INPUTS_TABLE, DRAFTS_TABLE, or WORKFLOW_RUNS_TABLE");
  }

  return { dailyInputsTable, draftsTable, workflowRunsTable };
};

interface CompositionResult {
  output: NormalizedBuildLogOutput;
  formatRepairUsed: boolean;
  guardrailRepairUsed: boolean;
  deterministicFallbackUsed: boolean;
  guardrailIssues: string[];
}

const composeBuildLogDraft = async (input: {
  bullets: string[];
  modelId: string;
  targetWordCount: number;
}): Promise<CompositionResult> => {
  let formatRepairUsed = false;
  let guardrailRepairUsed = false;
  let deterministicFallbackUsed = false;

  try {
    const primaryPrompt = buildLogV1Prompt({
      bullets: input.bullets,
      targetWordCount: input.targetWordCount
    });

    const primaryRaw = await generateModelText({
      modelId: input.modelId,
      prompt: primaryPrompt,
      temperature: 0.15,
      maxTokens: 2200
    });

    let parsed: ParsedBuildLogOutput;

    try {
      parsed = parseBuildLogStructuredOutput(primaryRaw);
    } catch {
      formatRepairUsed = true;
      const repairRaw = await generateModelText({
        modelId: input.modelId,
        prompt: buildLogJsonRepairPrompt(primaryRaw),
        temperature: 0,
        maxTokens: 2000
      });
      parsed = parseBuildLogStructuredOutput(repairRaw);
    }

    let normalized = normalizeBuildLogOutput(parsed, input.bullets, input.targetWordCount);
    let guardrailIssues = collectGuardrailIssues(normalized, input.bullets);

    if (guardrailIssues.length > 0) {
      guardrailRepairUsed = true;
      const guardrailRepairRaw = await generateModelText({
        modelId: input.modelId,
        prompt: buildLogGuardrailRepairPrompt({
          draft: normalized,
          bullets: input.bullets,
          issues: guardrailIssues,
          targetWordCount: input.targetWordCount
        }),
        temperature: 0.1,
        maxTokens: 2200
      });

      const repairedParsed = parseBuildLogStructuredOutput(guardrailRepairRaw);
      normalized = normalizeBuildLogOutput(repairedParsed, input.bullets, input.targetWordCount);
      guardrailIssues = collectGuardrailIssues(normalized, input.bullets);

      if (guardrailIssues.length > 0) {
        deterministicFallbackUsed = true;
        normalized = buildFallbackBuildLogOutput(input.bullets);
        guardrailIssues = collectGuardrailIssues(normalized, input.bullets);
      }
    }

    return {
      output: normalized,
      formatRepairUsed,
      guardrailRepairUsed,
      deterministicFallbackUsed,
      guardrailIssues
    };
  } catch (error) {
    deterministicFallbackUsed = true;
    const fallbackOutput = buildFallbackBuildLogOutput(input.bullets);
    const guardrailIssues = collectGuardrailIssues(fallbackOutput, input.bullets);

    logError("draft_generation_structured_path_failed", {
      error: String(error),
      fallback: "deterministic"
    });

    return {
      output: fallbackOutput,
      formatRepairUsed,
      guardrailRepairUsed,
      deterministicFallbackUsed,
      guardrailIssues
    };
  }
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
      ? dailyInput.bullets.map((value) => String(value).trim())
      : [];

    if (bullets.length !== 3 || bullets.some((bullet) => bullet.length === 0)) {
      throw new Error("Daily input does not contain exactly 3 non-empty bullets");
    }

    const modelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";
    const targetWordCount = event.target_word_count ?? 500;
    const promptVersion = "build_log_v1.1.0";

    const composition = await composeBuildLogDraft({
      bullets,
      modelId,
      targetWordCount
    });

    const now = new Date().toISOString();

    const draft: DraftItem = {
      draft_id: createId("draft"),
      input_id: event.input_id,
      run_id: event.run_id,
      title: composition.output.title,
      slug_suggestion: composition.output.slug,
      summary: composition.output.summary,
      content_md: composition.output.bodyMarkdown,
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
      modelId,
      formatRepairUsed: composition.formatRepairUsed,
      guardrailRepairUsed: composition.guardrailRepairUsed,
      deterministicFallbackUsed: composition.deterministicFallbackUsed,
      remainingGuardrailIssues: composition.guardrailIssues
    });

    return {
      ...draft,
      quality: {
        word_count: draft.content_md.split(/\s+/).filter(Boolean).length,
        has_three_sections:
          draft.content_md.includes("## What Changed") &&
          draft.content_md.includes("## Technical Notes") &&
          draft.content_md.includes("## Risks and Next Steps"),
        format_repair_used: composition.formatRepairUsed,
        guardrail_repair_used: composition.guardrailRepairUsed,
        deterministic_fallback_used: composition.deterministicFallbackUsed,
        guardrail_issues_remaining: composition.guardrailIssues
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
