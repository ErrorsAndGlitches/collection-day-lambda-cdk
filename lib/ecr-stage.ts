import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcrStack } from './ecr-stack';

export interface EcrStageProps extends cdk.StageProps {
  readonly ecrRepositoryName: string;
}

/** Deployable unit: the ECR repository, deployed ahead of the image build. */
export class EcrStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: EcrStageProps) {
    super(scope, id, props);

    new EcrStack(this, 'Ecr', {
      ecrRepositoryName: props.ecrRepositoryName,
    });
  }
}
