import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface EcrStackProps extends cdk.StackProps {
  readonly ecrRepositoryName: string;
}

/**
 * Owns the private ECR repository the Lambda image is pushed to and pulled
 * from. Deployed ahead of the image build so the push target exists.
 *
 * The repository is private (the default): images are not publicly pullable.
 * A lifecycle rule bounds image retention so old commit-tagged images expire.
 */
export class EcrStack extends cdk.Stack {
  public readonly repositoryName: string;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, 'Repository', {
      repositoryName: props.ecrRepositoryName,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      emptyOnDelete: false,
      lifecycleRules: [
        {
          description: 'Keep only the 10 most recent images',
          maxImageCount: 10,
        },
      ],
    });

    this.repositoryName = repository.repositoryName;
  }
}
