import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { statSync } from "fs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

const metrics = new Metrics({
  namespace: "benchmark",
  serviceName: "node22",
});

const stsClient = new STSClient({ region: process.env.AWS_REGION });

export const handler = async (event, context) => {
  let size, runtimeBuildDate;
  try {
    runtimeBuildDate = statSync("/var/runtime").mtime;
  } catch (e) {
    console.error("Unable to determine runtime build date", e);
  }
  try {
    size = statSync(__filename).size;
  } catch (e) {
    console.error("Unable to determine size of handler.mjs", e);
  }
  let startTime = Date.now();
  let success = 0;
  try {
    metrics.addMetadata("node", process.version);
    let coldstart = metrics.isColdStart();
    metrics.addMetadata("coldstart", coldstart);
    metrics.addMetadata("sdkVersion", process.env.sdkVersion);
    metrics.addMetadata("requestId", context.awsRequestId);
    metrics.addMetadata("size", size);
    metrics.addMetadata("runtimeBuildDate", runtimeBuildDate);
    metrics.addMetadata("version", process.env.AWS_LAMBDA_FUNCTION_VERSION);
    await stsClient.send(new GetCallerIdentityCommand());
    success = 1;
    return {
      statusCode: 200,
      body: {
        requestId: context.awsRequestId,
      },
    };
  } finally {
    metrics.addMetadata("latency", Date.now() - startTime);
    metrics.addMetric("fault", 1-success, MetricUnit.Count);
    metrics.publishStoredMetrics();
  }
};
