export interface ApiConfig {
  dailyInputsTable: string;
  draftsTable: string;
  postsTable: string;
  workflowRunsTable: string;
  generationStateMachineArn: string;
  publishFunctionName: string;
}

export const loadConfig = (): ApiConfig => {
  const required = {
    dailyInputsTable: process.env.DAILY_INPUTS_TABLE,
    draftsTable: process.env.DRAFTS_TABLE,
    postsTable: process.env.POSTS_TABLE,
    workflowRunsTable: process.env.WORKFLOW_RUNS_TABLE,
    generationStateMachineArn: process.env.GENERATION_STATE_MACHINE_ARN,
    publishFunctionName: process.env.PUBLISH_FUNCTION_NAME
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  return required as ApiConfig;
};
