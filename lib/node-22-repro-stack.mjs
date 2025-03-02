import { Stack, RemovalPolicy, CfnOutput, Duration } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { readFileSync } from "fs";
const NAME = "Node22Benchmark";

export class Node22ReproStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      logGroupName: `/aws/lambda/${NAME}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const func = new NodejsFunction(this, `${NAME}Function`, {
      functionName: NAME,
      description: "Benchmark function for Node22",
      entry: "src/handler.mjs",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      awsSdkConnectionReuse: false,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(5),
      memorySize: 1769,
      bundling: {
        bundle: true,
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        bundleAwsSDK: true,
        minify: false,
        // update to true and run npx cdk synth if you want to analyze the bundle with https://esbuild.github.io/analyze/
        metafile: false,
        // rip out non-essential credential provider stuff
        externalModules: [
          "@aws-sdk/client-sso",
          "@aws-sdk/client-sso-oidc",
          "@smithy/credential-provider-imds",
          "@aws-sdk/credential-provider-ini",
          "@aws-sdk/credential-provider-http",
          "@aws-sdk/credential-provider-process",
          "@aws-sdk/credential-provider-sso",
          "@aws-sdk/credential-provider-web-identity",
          "@aws-sdk/token-providers",
        ],
        define: {
          "process.env.sdkVersion": JSON.stringify(
            JSON.parse(
              readFileSync("node_modules/@aws-sdk/client-sts/package.json")
            ).version
          ),
        },
        banner:
          "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
      },
    });

    // add an alias to the lambda function
    const alias = new lambda.Alias(this, "FunctionAlias", {
      aliasName: "prod",
      version: func.currentVersion,
    });

    let url = alias.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // Output the URL of the Lambda Function
    new CfnOutput(this, "FunctionUrl", {
      value: url.url,
      description: "The URL of the Lambda Function",
    });
  }
}
