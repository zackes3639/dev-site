import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});

interface GenerateModelTextInput {
  modelId: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export const generateModelText = async (input: GenerateModelTextInput): Promise<string> => {
  const command = new InvokeModelCommand({
    modelId: input.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: input.maxTokens ?? 1800,
      temperature: input.temperature ?? 0.2,
      messages: [{ role: "user", content: [{ type: "text", text: input.prompt }] }]
    })
  });

  const response = await client.send(command);
  const bodyRaw = response.body ? Buffer.from(response.body).toString("utf-8") : "{}";
  const parsed = JSON.parse(bodyRaw) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = parsed.content?.find((chunk) => chunk.type === "text")?.text;
  if (!text) {
    throw new Error("Bedrock response missing text content");
  }

  return text;
};
