import type { NormalizedBuildLogOutput } from "../lib/buildLogOutput";

interface BuildLogPromptInput {
  bullets: string[];
  targetWordCount: number;
}

const outputContract = `{
  "title": "string, concise and practical",
  "summary": "string, 1-2 sentences, <= 320 chars",
  "slug": "lowercase-kebab-case",
  "body_markdown": "markdown with these sections exactly: ## What Changed, ## Technical Notes, ## Risks and Next Steps"
}`;

export const buildLogV1Prompt = (input: BuildLogPromptInput): string => {
  const bulletLines = input.bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");

  return [
    "You are drafting a Build Log post for zacksimon.dev.",
    "",
    "Source of truth:",
    "- You may use ONLY the information present in the three bullets below.",
    "- If a detail is not in the bullets, explicitly say it is not specified.",
    "",
    "Tone requirements:",
    "- Practical, credible, systems-minded, founder-builder.",
    "- Avoid hype and marketing language.",
    "- Avoid vague startup-speak.",
    "- Do not overstate product maturity or readiness.",
    "",
    "Guardrails:",
    "- No invented claims.",
    "- No customer/revenue/usage assertions unless explicitly in bullets.",
    "- No words like revolutionary, game-changing, world-class, best-in-class, fully automated, enterprise-ready.",
    "",
    `Length target: approximately ${input.targetWordCount} words for body_markdown.`,
    "",
    "Return format:",
    "- Return one valid JSON object only.",
    "- Do not include markdown fences.",
    "- Do not include any keys beyond this contract:",
    outputContract,
    "",
    "Input bullets:",
    bulletLines
  ].join("\n");
};

export const buildLogJsonRepairPrompt = (rawModelOutput: string): string => {
  return [
    "Rewrite the following content into one valid JSON object using this exact contract:",
    outputContract,
    "",
    "Rules:",
    "- Keep meaning intact.",
    "- No extra keys.",
    "- No markdown fences.",
    "",
    "Content to repair:",
    rawModelOutput
  ].join("\n");
};

export const buildLogGuardrailRepairPrompt = (input: {
  draft: NormalizedBuildLogOutput;
  bullets: string[];
  issues: string[];
  targetWordCount: number;
}): string => {
  const bulletLines = input.bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");

  return [
    "Revise this Build Log draft to satisfy guardrails while preserving useful detail.",
    "",
    "Source-of-truth constraint:",
    "- Use only the bullet inputs below.",
    "- Remove claims not grounded in those bullets.",
    "",
    "Guardrail violations detected:",
    ...input.issues.map((issue) => `- ${issue}`),
    "",
    `Body target: approximately ${input.targetWordCount} words.`,
    "",
    "Return one valid JSON object with this exact contract:",
    outputContract,
    "",
    "Bullet inputs:",
    bulletLines,
    "",
    "Current draft JSON:",
    JSON.stringify(
      {
        title: input.draft.title,
        summary: input.draft.summary,
        slug: input.draft.slug,
        body_markdown: input.draft.bodyMarkdown
      },
      null,
      2
    )
  ].join("\n");
};
