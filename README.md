# AWS Javascript SDK v3 Lambda Node 22 Benchmark

This is to repro demonstrating the coldstart performance regression of Node 22 with the AWS Javascript SDK [SDK #6914](https://github.com/aws/aws-sdk-js-v3/issues/6914). Compared to Node 20, the coldstart time is ~50 ms slower. It appears related to the SDK unnecessarily loading the http `Request` bits similar to the root cause on [SDK #6144](https://github.com/aws/aws-sdk-js-v3/issues/6144).

## Code notes
The lambda function makes a `GetCallerIdentity` call to STS using https and logs some metadata [src/handler.mjs](src/handler.mjs).  It is fronted by a Lambda Function url.

The CDK stack uses esbuild to bundle the function and marks a few unnecessary packages as external. It doesn't do any minification. [lib/node-22-repro-stack.mjs](lib/node-22-repro-stack.mjs).

[The SDK patch](patches/@smithy+node-http-handler+4.0.3.patch) is a hack job to remove the http Request/http Agent bits. The real fix is probably to use lazy loading, but since I'm using https only, this is enough to demonstrate the latency that it adds.

## Benchmarks

1. Runs 1 and 2 show the baseline without the AWS SDK. 
2. Runs 3 and 4 show the difference between Node 20 and Node 22 with the AWS SDK. 
3. Runs 5 and 6 show the difference between Node 20 and Node 22 with a patched AWS SDK. 

These are samples from my runs, but the results were repeatable.

---
| run | node version | @initDuration | notes |
| --- | --- | --- | --- |
| 1 | 20.18 | 142.79 | No AWS V3 SDK |
| 2 | 22.11 | 142.26 | No AWS V3 SDK |
| 3 | 20.18 | 204.23 | With AWS V3 SDK |
| 4 | 22.11 | 255.26 | With AWS V3 SDK |
| 5 | 20.18 | 200.42 | With patched AWS V3 SDK |
| 6 | 22.11 | 203.62 | With patched AWS V3 SDK |
---

## Deployment

Run this once:

`npm install`

### To deploy without patching the SDK on Node 22:
`npx cdk deploy`

Hit the url to trigger a coldstart.

### To patch and deploy the SDK on Node 22:

```
npx patch-package
npx cdk deploy
```

### To remove the patch:

```
npx patch-package --reverse
npx cdk deploy
```

### To change the runtime to Node 20

There shouldn't be any need to do this since I've benchmarked it for you, but if you want to see it for yourself, modify the [`lib/node-22-repro-stack.mjs` line 22](https://github.com/perpil/node-22-lambda-latency-repro/blob/1c4a28e8533af4759049bf432aafcae41a0a8566/lib/node-22-repro-stack.mjs#L22) to `NODEJS_20_X`.  Then `npx cdk deploy`.

## Triggering a coldstart

Once you've deployed the stack you can trigger a coldstart by hitting the url in the stack output.  You'll need to patch or unpatch the code and deploy to trigger a new coldstart, multiple invocations of the same version won't necessarily trigger a coldstart.

## Collating the results
Run the following CloudWatch Insights Query on `/aws/lambda/Node22Benchmark` to collate the results:

```
filter @message like /REPORT|_aws/ 
| stats latest(@initDuration) as initDuration, sortslast(node) as nodeVersion, sortslast(version) as swVersion by coalesce(@requestId,requestId)|
 filter ispresent(initDuration) |
 display initDuration, nodeVersion, swVersion
 | order by initDuration
```

## Cleaning up

`npx cdk destroy`
