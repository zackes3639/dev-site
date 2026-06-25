import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});

export const generateMarkdown = async (input: {
  modelId: string;
  prompt: string;
  temperature?: number;
}) => {
  const command = new ConverseCommand({
    modelId: input.modelId,
    messages: [{ role: "user", content: [{ text: input.prompt }] }],
    inferenceConfig: {
      maxTokens: 1500,
      temperature: input.temperature ?? 0.4
    }
  });

  const response = await client.send(command);
  const text = response.output?.message?.content?.find((block) => typeof block.text === "string")?.text;
  if (!text) {
    throw new Error("Bedrock response missing text content");
  }

  return text;
};
