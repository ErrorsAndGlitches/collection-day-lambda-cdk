import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplicationStack } from './application-stack';

export interface ApplicationStageProps extends cdk.StageProps {
  readonly ecrRepositoryName: string;
  readonly imageTagParameterName: string;
  readonly address: string;
  readonly phoneNumbers: string[];
}

/** Deployable unit: the collection-day Lambda application. */
export class ApplicationStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: ApplicationStageProps) {
    super(scope, id, props);

    new ApplicationStack(this, 'CollectionDayLambda', {
      ecrRepositoryName: props.ecrRepositoryName,
      imageTagParameterName: props.imageTagParameterName,
      address: props.address,
      phoneNumbers: props.phoneNumbers,
    });
  }
}
