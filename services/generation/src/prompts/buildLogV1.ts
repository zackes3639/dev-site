export const buildLogV1Prompt = (bullets: string[], targetWordCount: number): string => {
  return [
    "You are writing a polished Build Log post for zacksimon.dev.",
    "Requirements:",
    "- Keep the tone practical and specific.",
    "- Use markdown with clear section headings.",
    "- Include what changed, challenges, and next steps.",
    `- Target approximately ${targetWordCount} words.`,
    "Source bullets:",
    ...bullets.map((b, i) => `${i + 1}. ${b}`),
    "Return only markdown body content."
  ].join("\n");
};
