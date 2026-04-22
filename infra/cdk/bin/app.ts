#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BrieflyStack } from "../lib/briefly-stack";

const app = new cdk.App();
const stage = (app.node.tryGetContext("brieflyStage") ?? process.env.BRIEFLY_STAGE ?? "dev") as string;

if (stage !== "dev") {
  throw new Error(`Unsupported brieflyStage "${stage}". Only "dev" is supported right now.`);
}

const resourcePrefix =
  process.env.BRIEFLY_RESOURCE_PREFIX ?? String(app.node.tryGetContext("brieflyResourcePrefix") ?? "briefly-dev");
const bedrockModelId =
  process.env.BRIEFLY_BEDROCK_MODEL_ID ??
  String(app.node.tryGetContext("brieflyBedrockModelId") ?? "anthropic.claude-3-5-sonnet-20240620-v1:0");

const allowedOriginsContext = app.node.tryGetContext("brieflyAdminAllowedOrigins");
const allowedOrigins =
  process.env.BRIEFLY_ADMIN_ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0) ??
  (Array.isArray(allowedOriginsContext)
    ? allowedOriginsContext.map((value) => String(value))
    : ["http://localhost:5174"]);

const enableBasicAlarms =
  (process.env.BRIEFLY_ENABLE_ALARMS ?? String(app.node.tryGetContext("brieflyEnableAlarms") ?? "true")) !== "false";

const env: cdk.Environment = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION ?? "us-east-2"
    }
  : {
      region: process.env.CDK_DEFAULT_REGION ?? "us-east-2"
    };

new BrieflyStack(app, "BrieflyV1DevStack", {
  env,
  stage: "dev",
  resourcePrefix,
  bedrockModelId,
  adminAllowedOrigins: allowedOrigins,
  enableBasicAlarms
});
