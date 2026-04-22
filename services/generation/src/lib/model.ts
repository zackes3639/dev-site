import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});

export const generateMarkdown = async (input: {
  modelId: string;
  prompt: string;
  temperature?: number;
}) => {
  const command = new InvokeModelCommand({
    modelId: input.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      temperature: input.temperature ?? 0.4,
      messages: [{ role: "user", content: [{ type: "text", text: input.prompt }] }]
    })
  });

  const response = await client.send(command);
  const bodyRaw = response.body ? Buffer.from(response.body).toString("utf-8") : "{}";
  const parsed = JSON.parse(bodyRaw) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = parsed.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    throw new Error("Bedrock response missing text content");
  }

  return text;
};
