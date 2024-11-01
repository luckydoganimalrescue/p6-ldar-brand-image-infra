#!/usr/bin/env node

import process from 'node:process'
import * as cdk from 'aws-cdk-lib'
import { MyStack } from '../src/stack'

// Define the environment for deployment
const theEnv = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
}

// Initialize the CDK app
const app = new cdk.App()

// Instantiate the stack
// eslint-disable-next-line no-new
new MyStack(app, 'p6-ldar-cdk-pnp-brand-image', { env: theEnv })

// Synthesize the stack
app.synth()
