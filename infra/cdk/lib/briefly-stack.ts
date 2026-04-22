import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";

export interface BrieflyStackProps extends cdk.StackProps {
  stage: "dev";
  resourcePrefix: string;
  bedrockModelId: string;
  adminAllowedOrigins: string[];
  enableBasicAlarms: boolean;
}

export class BrieflyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BrieflyStackProps) {
    super(scope, id, props);

    const repoRoot = path.resolve(__dirname, "../../..");
    const baseTsConfig = path.join(repoRoot, "tsconfig.base.json");
    const stage = props.stage;
    const prefix = props.resourcePrefix.trim().replace(/[^a-zA-Z0-9-]/g, "-");
    const name = (suffix: string) => `${prefix}-${suffix}`;

    const dailyInputs = new dynamodb.Table(this, "DailyInputsTable", {
      tableName: `${prefix}_daily_inputs`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "input_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
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
      tableName: `${prefix}_drafts`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "draft_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
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
      tableName: `${prefix}_posts`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "post_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
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
      tableName: `${prefix}_workflow_runs`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "run_id", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
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
      userPoolName: name("admin-users"),
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
      generateSecret: false,
      authFlows: {
        userPassword: true,
        adminUserPassword: true
      }
    });

    const createNodeLambda = (id: string, entry: string, environment: Record<string, string>, timeout = 30) => {
      const functionSuffix = id
        .replace(/^Briefly/, "")
        .replace(/Lambda$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase();
      const functionName = name(functionSuffix);
      const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      });

      return new lambdaNode.NodejsFunction(this, id, {
        functionName,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(repoRoot, entry),
        handler: "handler",
        timeout: cdk.Duration.seconds(timeout),
        memorySize: 512,
        environment,
        logGroup,
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
        BEDROCK_MODEL_ID: props.bedrockModelId,
        DAILY_INPUTS_TABLE: dailyInputs.tableName,
        DRAFTS_TABLE: drafts.tableName,
        WORKFLOW_RUNS_TABLE: workflowRuns.tableName
      },
      90
    );

    generationLambda.addEnvironment("NODE_OPTIONS", "--enable-source-maps");

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

    const stateMachineLogs = new logs.LogGroup(this, "GenerationStateMachineLogs", {
      logGroupName: `/aws/vendedlogs/states/${name("generation-workflow")}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const generationWorkflow = new sfn.StateMachine(this, "GenerationStateMachine", {
      stateMachineName: name("generation-workflow"),
      definitionBody: sfn.DefinitionBody.fromChainable(generationTask),
      timeout: cdk.Duration.minutes(5),
      logs: {
        destination: stateMachineLogs,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true
      }
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
    drafts.grantReadData(getDraftLambda);
    drafts.grantReadWriteData(updateDraftLambda);

    dailyInputs.grantReadWriteData(startGenerationLambda);
    workflowRuns.grantReadWriteData(startGenerationLambda);
    generationWorkflow.grantStartExecution(startGenerationLambda);

    publishingLambda.grantInvoke(publishDraftLambda);

    const api = new apigwv2.HttpApi(this, "BrieflyApi", {
      apiName: name("api"),
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PUT],
        allowOrigins: props.adminAllowedOrigins
      }
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

    if (props.enableBasicAlarms) {
      new cloudwatch.Alarm(this, "GenerationLambdaErrorsAlarm", {
        alarmName: name("generation-lambda-errors"),
        metric: generationLambda.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: "sum"
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });

      new cloudwatch.Alarm(this, "PublishingLambdaErrorsAlarm", {
        alarmName: name("publishing-lambda-errors"),
        metric: publishingLambda.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: "sum"
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });

      new cloudwatch.Alarm(this, "GenerationStateMachineFailuresAlarm", {
        alarmName: name("generation-workflow-failures"),
        metric: generationWorkflow.metricFailed({
          period: cdk.Duration.minutes(5),
          statistic: "sum"
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
    }

    const region = cdk.Stack.of(this).region;
    const jwtIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}`;

    new cdk.CfnOutput(this, "BrieflyStage", { value: stage });
    new cdk.CfnOutput(this, "BrieflyApiBaseUrl", { value: api.url ?? "" });
    new cdk.CfnOutput(this, "BrieflyJwtIssuer", { value: jwtIssuer });
    new cdk.CfnOutput(this, "BrieflyUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "BrieflyUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "BrieflyDailyInputsTableName", { value: dailyInputs.tableName });
    new cdk.CfnOutput(this, "BrieflyDraftsTableName", { value: drafts.tableName });
    new cdk.CfnOutput(this, "BrieflyPostsTableName", { value: posts.tableName });
    new cdk.CfnOutput(this, "BrieflyWorkflowRunsTableName", { value: workflowRuns.tableName });
    new cdk.CfnOutput(this, "BrieflyGenerationStateMachineArn", { value: generationWorkflow.stateMachineArn });
    new cdk.CfnOutput(this, "BrieflyGenerationStateMachineName", {
      value: generationWorkflow.stateMachineName
    });
    new cdk.CfnOutput(this, "BrieflyPublishingLambdaName", { value: publishingLambda.functionName });
  }
}
