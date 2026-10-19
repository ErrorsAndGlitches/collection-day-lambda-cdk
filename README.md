# collection-day-lambda-cdk

CDK Pipelines application that builds and deploys the
[collection-day-lambda](https://github.com/ErrorsAndGlitches/collection-day-lambda)
Rust function.

## What it provisions

- A private ECR repository for the Lambda container image.
- A self-mutating CodePipeline with two sources: this repository (which drives
  self-mutation) and the Lambda source repository.
- A CodeBuild project that builds the arm64 Rust image and pushes it to ECR,
  tagged with the Lambda source commit SHA, recording that tag in SSM.
- The Lambda function (run from the ECR image), its SNS publish permission, and
  an EventBridge schedule that invokes it weekly.

The function has no inbound network surface: it is invoked only by EventBridge.
The ECR repository is private and the Lambda role is limited to `sns:Publish`.

## Configuration

Values are read from CDK context (`cdk.json` or `-c key=value`). Replace the
`REPLACE_WITH_*` placeholders in `cdk.json` before deploying:

| Key | Meaning |
| --- | --- |
| `account` | Target AWS account ID |
| `region` | Target region |
| `connectionArn` | CodeConnections (CodeStar) ARN for GitHub |
| `cdkRepo` / `cdkBranch` | This repo and branch |
| `lambdaRepo` / `lambdaBranch` | The Lambda source repo and branch |
| `ecrRepositoryName` | Name for the private ECR repository |
| `address` | Street address to look up collections for |
| `phoneNumbers` | Comma-separated E.164 phone numbers for SMS |

## One-time bootstrap

The pipeline cannot deploy itself from nothing, so two commands are run once by
a human with credentials for the target account:

```bash
npm ci
npm run build

# 1. Provision the CDK toolkit (S3 bucket, ECR, roles) in the account.
npx cdk bootstrap aws://<account>/<region>

# 2. Deploy the pipeline once.
npx cdk deploy CollectionDayLambdaPipeline
```

The GitHub CodeConnections connection must be created once in the console (it
requires an OAuth handshake) and its ARN placed in `connectionArn`.

After this, the pipeline is self-mutating: push to this repository and it
updates itself before deploying. No further manual `cdk deploy` is needed.
