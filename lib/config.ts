/**
 * Deployment configuration, resolved from CDK context (cdk.json or `-c` flags)
 * in the app entrypoint. Keeping it in one typed shape avoids scattering
 * `tryGetContext` calls through the stacks.
 */
export interface DeploymentConfig {
  /** Target account for the pipeline and the application. */
  readonly account: string;
  /** Target region. */
  readonly region: string;

  /** CodeConnections (CodeStar) ARN for GitHub access (created once, via OAuth). */
  readonly connectionArn: string;

  /** owner/repo and branch for the CDK app (drives pipeline self-mutation). */
  readonly cdkRepo: string;
  readonly cdkBranch: string;

  /** owner/repo and branch for the Rust Lambda source. */
  readonly lambdaRepo: string;
  readonly lambdaBranch: string;

  /** Private ECR repository name for the Lambda image. */
  readonly ecrRepositoryName: string;

  /** Application runtime configuration. */
  readonly address: string;
  readonly phoneNumbers: string[];
}

export function configFromContext(tryGetContext: (key: string) => unknown): DeploymentConfig {
  const required = (key: string): string => {
    const value = tryGetContext(key);
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        `Missing required context value "${key}". Pass it in cdk.json or with -c ${key}=...`,
      );
    }
    return value;
  };

  const phoneNumbersRaw = tryGetContext('phoneNumbers');
  const phoneNumbers =
    typeof phoneNumbersRaw === 'string' && phoneNumbersRaw.length > 0
      ? phoneNumbersRaw.split(',').map((s) => s.trim())
      : [];

  return {
    account: required('account'),
    region: required('region'),
    connectionArn: required('connectionArn'),
    cdkRepo: required('cdkRepo'),
    cdkBranch: (tryGetContext('cdkBranch') as string) ?? 'master',
    lambdaRepo: required('lambdaRepo'),
    lambdaBranch: (tryGetContext('lambdaBranch') as string) ?? 'master',
    ecrRepositoryName: required('ecrRepositoryName'),
    address: required('address'),
    phoneNumbers,
  };
}
