import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface ApplicationStackProps extends cdk.StackProps {
  /** Name of the ECR repository holding the Lambda image. */
  readonly ecrRepositoryName: string;
  /** SSM parameter name holding the commit-SHA image tag to deploy. */
  readonly imageTagParameterName: string;
  /** Street address to look up collections for. */
  readonly address: string;
  /** Phone numbers to send SMS reminders to, in +1XXXXXXXXXX form. */
  readonly phoneNumbers: string[];
  /** Cron schedule for the reminder. Defaults to weekly, Wed 18:00 UTC. */
  readonly scheduleExpression?: events.Schedule;
}

/**
 * The deployed application: the collection-day Lambda (run from an ECR image),
 * its SNS send permission, and the schedule that triggers it.
 *
 * The function has no inbound network surface — no Function URL, no API
 * Gateway. It is invoked only by EventBridge, so there is nothing to
 * authenticate or expose. The ECR repository is private.
 *
 * The image tag is read at deploy time from an SSM parameter that the
 * image-build step writes with the commit-SHA tag it just pushed. This keeps
 * build and deploy in lockstep without baking a tag into the synthesized
 * template.
 */
export class ApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const imageTag = ssm.StringParameter.valueForStringParameter(
      this,
      props.imageTagParameterName,
    );

    const repository = ecr.Repository.fromRepositoryName(
      this,
      'LambdaImageRepo',
      props.ecrRepositoryName,
    );

    const fn = new lambda.DockerImageFunction(this, 'CollectionDayFunction', {
      functionName: 'collection-day-lambda',
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: imageTag,
      }),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      environment: {
        ADDRESS: props.address,
        PHONE_NUMBERS: props.phoneNumbers.join(','),
      },
    });

    // Least privilege: publish SMS via SNS only. SMS to a phone number is not
    // scoped to a topic resource, so the resource is '*' with the action
    // narrowed to Publish — this is the documented shape for SMS publishing.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: ['*'],
      }),
    );

    const schedule =
      props.scheduleExpression ??
      events.Schedule.cron({ weekDay: 'WED', hour: '18', minute: '0' });

    new events.Rule(this, 'WeeklyReminder', {
      schedule,
      targets: [new targets.LambdaFunction(fn)],
    });
  }
}
