import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
  CodeBuildStep,
} from 'aws-cdk-lib/pipelines';
import { DeploymentConfig } from './config';
import { EcrStage } from './ecr-stage';
import { ApplicationStage } from './application-stage';

/** SSM parameter name holding the most recently built image's commit-SHA tag. */
const IMAGE_TAG_PARAMETER_NAME = '/collection-day-lambda/image-tag';

/**
 * The self-mutating delivery pipeline.
 *
 * Deployed once by hand; thereafter it updates itself from the CDK source on
 * every push. Each run deploys the ECR repository, builds and pushes the arm64
 * Lambda image tagged with the Lambda source commit SHA, records that tag in
 * SSM, then deploys the application to run the newly built image.
 */
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: DeploymentConfig) {
    super(scope, id, {
      env: { account: config.account, region: config.region },
    });

    const cdkSource = CodePipelineSource.connection(config.cdkRepo, config.cdkBranch, {
      connectionArn: config.connectionArn,
    });
    const lambdaSource = CodePipelineSource.connection(config.lambdaRepo, config.lambdaBranch, {
      connectionArn: config.connectionArn,
    });

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'collection-day-lambda',
      synth: new ShellStep('Synth', {
        input: cdkSource,
        additionalInputs: { '../lambda-src': lambdaSource },
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    pipeline.addStage(
      new EcrStage(this, 'Ecr', {
        env: { account: config.account, region: config.region },
        ecrRepositoryName: config.ecrRepositoryName,
      }),
    );

    const registry = `${config.account}.dkr.ecr.${config.region}.amazonaws.com`;
    const imageUri = `${registry}/${config.ecrRepositoryName}`;

    const imageBuild = new CodeBuildStep('BuildLambdaImage', {
      input: lambdaSource,
      buildEnvironment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        privileged: true,
      },
      env: {
        IMAGE_URI: imageUri,
        AWS_REGION: config.region,
        IMAGE_TAG_PARAMETER_NAME: IMAGE_TAG_PARAMETER_NAME,
      },
      commands: [
        'IMAGE_TAG="${CODEBUILD_RESOLVED_SOURCE_VERSION}"',
        'aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${IMAGE_URI%/*}"',
        'docker build -t "${IMAGE_URI}:${IMAGE_TAG}" .',
        'docker push "${IMAGE_URI}:${IMAGE_TAG}"',
        'aws ssm put-parameter --name "${IMAGE_TAG_PARAMETER_NAME}" --type String --overwrite --value "${IMAGE_TAG}"',
      ],
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:InitiateLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:CompleteLayerUpload',
            'ecr:PutImage',
          ],
          resources: [
            `arn:aws:ecr:${config.region}:${config.account}:repository/${config.ecrRepositoryName}`,
          ],
        }),
        new iam.PolicyStatement({
          actions: ['ssm:PutParameter'],
          resources: [
            `arn:aws:ssm:${config.region}:${config.account}:parameter${IMAGE_TAG_PARAMETER_NAME}`,
          ],
        }),
      ],
    });

    pipeline.addWave('BuildImage', { post: [imageBuild] });

    pipeline.addStage(
      new ApplicationStage(this, 'Deploy', {
        env: { account: config.account, region: config.region },
        ecrRepositoryName: config.ecrRepositoryName,
        imageTagParameterName: IMAGE_TAG_PARAMETER_NAME,
        address: config.address,
        phoneNumbers: config.phoneNumbers,
      }),
    );
  }
}
