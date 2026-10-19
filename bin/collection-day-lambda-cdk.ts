#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { configFromContext } from '../lib/config';

const app = new cdk.App();
const config = configFromContext((key) => app.node.tryGetContext(key));

new PipelineStack(app, 'CollectionDayLambdaPipeline', config);

app.synth();
