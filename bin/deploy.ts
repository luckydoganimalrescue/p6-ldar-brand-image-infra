#!/usr/bin/env node

import process from 'node:process'
import * as cdk from 'aws-cdk-lib'
import { MyStack } from '../src/stack'

// Define the environment for deployment
const env = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
}

// Initialize the CDK app
const app = new cdk.App()

// Instantiate the stack
const HOSTED_ZONE_NAME = 'p6m7g8.org'
const API_RECORD_NAME = 'api.ldar.p6m7g8.org'
const CLOUDFRONT_RECORD_NAME = `www.ldar` + `.${HOSTED_ZONE_NAME}`
const CLOUDFRONT_DOMAIN_NAME = `ldar` + `.${HOSTED_ZONE_NAME}`
const VERIFY_EMAIL = `pgollucci@${HOSTED_ZONE_NAME}`
const FROM_EMAIL = `ldar-pet-brander2@p6m7g8.com`

new MyStack(app, 'p6-ldar-brand-image', {
  env,
  hostedZoneName: HOSTED_ZONE_NAME,
  verifyEmail: VERIFY_EMAIL,
  apiRecordName: API_RECORD_NAME,
  cloudfrontRecordName: CLOUDFRONT_RECORD_NAME,
  cloudfrontDomainName: CLOUDFRONT_DOMAIN_NAME,
  fromEmail: FROM_EMAIL,
})

// Synthesize the stack
app.synth()
