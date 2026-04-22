import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";

export class BrieflyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repoRoot = path.resolve(__dirname, "../../..");
    const baseTsConfig = path.join(repoRoot, "tsconfig.base.json");

    const dailyInputs = new dynamodb.Table(this, "DailyInputsTable", {
      tableName: "briefly_daily_inputs",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "input_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    dailyInputs.addGlobalSecondaryIndex({
      indexName: "by_date",
      partitionKey: { name: "input_date", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING }
    });

    dailyInputs.addGlobalSecondaryIndex({
      indexName: "by_status",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updated_at", type: dynamodb.AttributeType.STRING }
    });

    const drafts = new dynamodb.Table(this, "DraftsTable", {
      tableName: "briefly_drafts",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "draft_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    drafts.addGlobalSecondaryIndex({
      indexName: "by_input",
      partitionKey: { name: "input_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING }
    });

    drafts.addGlobalSecondaryIndex({
      indexName: "by_status",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updated_at", type: dynamodb.AttributeType.STRING }
    });

    const posts = new dynamodb.Table(this, "PostsTable", {
      tableName: "briefly_posts",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "post_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    posts.addGlobalSecondaryIndex({
      indexName: "by_slug",
      partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "published_at", type: dynamodb.AttributeType.STRING }
    });

    posts.addGlobalSecondaryIndex({
      indexName: "by_published",
      partitionKey: { name: "published_partition", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "published_at", type: dynamodb.AttributeType.STRING }
    });

    const workflowRuns = new dynamodb.Table(this, "WorkflowRunsTable", {
      tableName: "briefly_workflow_runs",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "run_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: "ttl"
    });

    workflowRuns.addGlobalSecondaryIndex({
      indexName: "by_entity",
      partitionKey: { name: "entity_ref", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING }
    });

    workflowRuns.addGlobalSecondaryIndex({
      indexName: "by_status",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updated_at", type: dynamodb.AttributeType.STRING }
    });

    const userPool = new cognito.UserPool(this, "BrieflyAdminUserPool", {
      userPoolName: "briefly-admin-users",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false }
      },
      passwordPolicy: {
        minLength: 14,
        requireDigits: true,
        requireSymbols: true,
        requireUppercase: true,
        requireLowercase: true
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, "BrieflyAdminClient", {
      userPool,
      generateSecret: false
    });

    const createNodeLambda = (id: string, entry: string, environment: Record<string, string>, timeout = 30) => {
      return new lambdaNode.NodejsFunction(this, id, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(repoRoot, entry),
        handler: "handler",
        timeout: cdk.Duration.seconds(timeout),
        environment,
        bundling: {
          target: "node20",
          tsconfig: baseTsConfig
        }
      });
    };

    const generationLambda = createNodeLambda(
      "BrieflyGenerationLambda",
      "services/generation/src/handlers/generateDraft.ts",
      {
        BEDROCK_MODEL_ID: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        DAILY_INPUTS_TABLE: dailyInputs.tableName,
        DRAFTS_TABLE: drafts.tableName,
        WORKFLOW_RUNS_TABLE: workflowRuns.tableName
      },
      90
    );

    generationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: ["*"]
      })
    );

    dailyInputs.grantReadWriteData(generationLambda);
    drafts.grantReadWriteData(generationLambda);
    workflowRuns.grantReadWriteData(generationLambda);

    const generationTask = new tasks.LambdaInvoke(this, "GenerateDraftTask", {
      lambdaFunction: generationLambda,
      payloadResponseOnly: true
    });

    const generationWorkflow = new sfn.StateMachine(this, "GenerationStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(generationTask),
      timeout: cdk.Duration.minutes(5)
    });

    const publishingLambda = createNodeLambda(
      "BrieflyPublishingLambda",
      "services/publishing/src/handlers/publishDraft.ts",
      {
        DRAFTS_TABLE: drafts.tableName,
        POSTS_TABLE: posts.tableName
      }
    );

    drafts.grantReadWriteData(publishingLambda);
    posts.grantReadWriteData(publishingLambda);

    const apiEnv = {
      DAILY_INPUTS_TABLE: dailyInputs.tableName,
      DRAFTS_TABLE: drafts.tableName,
      POSTS_TABLE: posts.tableName,
      WORKFLOW_RUNS_TABLE: workflowRuns.tableName,
      GENERATION_STATE_MACHINE_ARN: generationWorkflow.stateMachineArn,
      PUBLISH_FUNCTION_NAME: publishingLambda.functionName
    };

    const healthLambda = createNodeLambda(
      "BrieflyApiHealthLambda",
      "services/api/src/handlers/health.ts",
      apiEnv
    );
    const createDailyInputLambda = createNodeLambda(
      "BrieflyApiCreateDailyInputLambda",
      "services/api/src/handlers/createDailyInput.ts",
      apiEnv
    );
    const startGenerationLambda = createNodeLambda(
      "BrieflyApiStartGenerationLambda",
      "services/api/src/handlers/startGeneration.ts",
      apiEnv
    );
    const getWorkflowRunLambda = createNodeLambda(
      "BrieflyApiGetWorkflowRunLambda",
      "services/api/src/handlers/getWorkflowRun.ts",
      apiEnv
    );
    const getDailyInputDraftLambda = createNodeLambda(
      "BrieflyApiGetDailyInputDraftLambda",
      "services/api/src/handlers/getDailyInputDraft.ts",
      apiEnv
    );
    const getDraftLambda = createNodeLambda(
      "BrieflyApiGetDraftLambda",
      "services/api/src/handlers/getDraft.ts",
      apiEnv
    );
    const updateDraftLambda = createNodeLambda(
      "BrieflyApiUpdateDraftLambda",
      "services/api/src/handlers/updateDraft.ts",
      apiEnv
    );
    const publishDraftLambda = createNodeLambda(
      "BrieflyApiPublishDraftLambda",
      "services/api/src/handlers/publishDraft.ts",
      apiEnv
    );

    dailyInputs.grantReadWriteData(createDailyInputLambda);
    dailyInputs.grantReadData(getDailyInputDraftLambda);
    drafts.grantReadData(getDailyInputDraftLambda);
    workflowRuns.grantReadData(getWorkflowRunLambda);
    drafts.grantReadWriteData(getDraftLambda);
    drafts.grantReadWriteData(updateDraftLambda);

    dailyInputs.grantReadWriteData(startGenerationLambda);
    workflowRuns.grantReadWriteData(startGenerationLambda);
    generationWorkflow.grantStartExecution(startGenerationLambda);

    publishingLambda.grantInvoke(publishDraftLambda);

    const api = new apigwv2.HttpApi(this, "BrieflyApi", {
      apiName: "briefly-v1"
    });

    const auth = new apigwv2.CfnAuthorizer(this, "BrieflyJwtAuthorizer", {
      apiId: api.apiId,
      authorizerType: "JWT",
      identitySource: ["$request.header.Authorization"],
      jwtConfiguration: {
        audience: [userPoolClient.userPoolClientId],
        issuer: `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`
      },
      name: "briefly-admin-jwt"
    });

    api.addRoutes({
      path: "/v1/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("HealthIntegration", healthLambda)
    });

    const addJwtRoute = (
      routeId: string,
      pathValue: string,
      methods: apigwv2.HttpMethod[],
      integration: integrations.HttpLambdaIntegration
    ) => {
      const routes = api.addRoutes({
        path: pathValue,
        methods,
        integration
      });

      const route = routes[0];
      if (!route) {
        throw new Error(`Failed to create route: ${routeId}`);
      }

      const cfnRoute = route.node.defaultChild as apigwv2.CfnRoute;
      cfnRoute.authorizationType = "JWT";
      cfnRoute.authorizerId = auth.ref;
      cfnRoute.node.addDependency(auth);
      return cfnRoute;
    };

    addJwtRoute(
      "CreateDailyInputRoute",
      "/v1/daily-inputs",
      [apigwv2.HttpMethod.POST],
      new integrations.HttpLambdaIntegration("CreateDailyInputIntegration", createDailyInputLambda)
    );

    addJwtRoute(
      "StartGenerationRoute",
      "/v1/daily-inputs/{inputId}/generate",
      [apigwv2.HttpMethod.POST],
      new integrations.HttpLambdaIntegration("StartGenerationIntegration", startGenerationLambda)
    );

    addJwtRoute(
      "GetWorkflowRunRoute",
      "/v1/workflow-runs/{runId}",
      [apigwv2.HttpMethod.GET],
      new integrations.HttpLambdaIntegration("GetWorkflowRunIntegration", getWorkflowRunLambda)
    );

    addJwtRoute(
      "GetDailyInputDraftRoute",
      "/v1/daily-inputs/{inputId}/draft",
      [apigwv2.HttpMethod.GET],
      new integrations.HttpLambdaIntegration("GetDailyInputDraftIntegration", getDailyInputDraftLambda)
    );

    addJwtRoute(
      "GetDraftRoute",
      "/v1/drafts/{draftId}",
      [apigwv2.HttpMethod.GET],
      new integrations.HttpLambdaIntegration("GetDraftIntegration", getDraftLambda)
    );

    addJwtRoute(
      "UpdateDraftRoute",
      "/v1/drafts/{draftId}",
      [apigwv2.HttpMethod.PUT],
      new integrations.HttpLambdaIntegration("UpdateDraftIntegration", updateDraftLambda)
    );

    addJwtRoute(
      "PublishDraftRoute",
      "/v1/drafts/{draftId}/publish",
      [apigwv2.HttpMethod.POST],
      new integrations.HttpLambdaIntegration("PublishDraftIntegration", publishDraftLambda)
    );

    new cdk.CfnOutput(this, "BrieflyApiUrl", { value: api.url ?? "" });
    new cdk.CfnOutput(this, "BrieflyUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "BrieflyUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "GenerationStateMachineArn", { value: generationWorkflow.stateMachineArn });
    new cdk.CfnOutput(this, "PublishingLambdaName", { value: publishingLambda.functionName });
  }
}
