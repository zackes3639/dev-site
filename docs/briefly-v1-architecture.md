# Briefly v1 Architecture

This document captures the v1 scaffold for Briefly on top of zacksimon.dev.

## Selected stack

- Monorepo + TypeScript
- API Gateway + Lambda
- DynamoDB
- Bedrock
- Human review before publish

## Workflow

1. Admin submits daily 3-bullet input.
2. Generation workflow creates a draft.
3. Draft is reviewed/edited by human.
4. Human explicitly publishes to Build Log.
5. Posts become source corpus for future Briefly summarization features.
