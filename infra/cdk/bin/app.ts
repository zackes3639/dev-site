#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BrieflyStack } from "../lib/briefly-stack";

const app = new cdk.App();
const env: cdk.Environment = process.env.CDK_DEFAULT_ACCOUNT
  ? {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION ?? "us-east-2"
    }
  : {
      region: process.env.CDK_DEFAULT_REGION ?? "us-east-2"
    };

new BrieflyStack(app, "BrieflyV1Stack", {
  env
});
