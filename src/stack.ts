import type { Construct } from 'constructs'
import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwi from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdajs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'

import * as ses from 'aws-cdk-lib/aws-ses'
import * as floyd from 'cdk-iam-floyd'

const HOSTED_ZONE_NAME = 'p6m7g8.net'
const VERIFY_EMAIL = `pgollucci@${HOSTED_ZONE_NAME}`
const SUBDOMAIN_NAME = 'api.ldar'
const FROM_EMAIL = `ldar-pet-brander@p6m7g8.com`
const RECORD_NAME = `${SUBDOMAIN_NAME}.${HOSTED_ZONE_NAME}`
const CLOUDFRONT_RECORD_NAME = `www.ldar` + `.${HOSTED_ZONE_NAME}`

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props)

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: HOSTED_ZONE_NAME,
    })

    const api_certificate = new certificatemanager.Certificate(
      this,
      'Certificate',
      {
        domainName: RECORD_NAME,
        validation: certificatemanager.CertificateValidation.fromEmail({
          email: VERIFY_EMAIL,
        }),
      },
    )
    const www_certificate = new certificatemanager.Certificate(
      this,
      'WWW-Certificate',
      {
        domainName: CLOUDFRONT_RECORD_NAME,
        validation: certificatemanager.CertificateValidation.fromEmail({
          email: VERIFY_EMAIL,
        }),
      },
    )

    const domainName = new apigw.DomainName(this, 'DN', {
      domainName: RECORD_NAME,
      certificate: api_certificate,
    })

    // eslint-disable-next-line no-new
    new ses.EmailIdentity(this, 'Identity', {
      identity: ses.Identity.email(FROM_EMAIL),
    })

    const bucket = new s3.Bucket(this, 'MyBucket', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      websiteIndexDocument: 'index.html',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    })
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI')
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(bucket, {
          originAccessIdentity: oai, // If you're using an Origin Access Identity
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      domainNames: [CLOUDFRONT_RECORD_NAME],
      certificate: www_certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    })

    const presignFunc = new lambdajs.NodejsFunction(this, 'presign', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../api/src/presign.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
      },
    })
    bucket.grantPut(presignFunc)
    bucket.grantPublicAccess('*', 's3:PutObject')

    presignFunc.addEnvironment('BUCKET_NAME', bucket.bucketName)
    const brandFunc = new lambdajs.NodejsFunction(this, 'brand', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../api/src/brand.ts'),
      handler: 'handler',
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.minutes(14),
      memorySize: 4096,
      ephemeralStorageSize: cdk.Size.mebibytes(3072),
      bundling: {
        nodeModules: ['sharp'],
        externalModules: ['@aws-sdk/*'],
        minify: true,
      },
    })
    bucket.grantReadWrite(brandFunc)

    brandFunc.addEnvironment('BRAND_IMAGE_BUCKET', bucket.bucketName)
    brandFunc.addEnvironment('EMAIL_SENDER', FROM_EMAIL)
    brandFunc.addEnvironment('EMAIL_REGION', 'us-east-1')
    brandFunc.addEnvironment('FIT', 'fill')

    const policy = new floyd.Statement.Ses()
      .allow()
      .to('ses:SendEmail')
      .on('*')
    brandFunc.addToRolePolicy(policy)

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      description: 'Pet Brander API',
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(10),
      },
      defaultDomainMapping: {
        domainName,
      },
    })

    const presignIntegration = new apigwi.HttpLambdaIntegration(
      'FuncIntegration',
      presignFunc,
    )
    httpApi.addRoutes({
      path: '/presign',
      methods: [apigw.HttpMethod.POST],
      integration: presignIntegration,
    })

    const brandIntegration = new apigwi.HttpLambdaIntegration(
      'brandIntegration',
      brandFunc,
    )
    httpApi.addRoutes({
      path: '/brand',
      methods: [apigw.HttpMethod.POST],
      integration: brandIntegration,
    })

    const cloudfrontTarget = route53.RecordTarget.fromAlias(
      new route53targets.CloudFrontTarget(distribution),
    )

    // eslint-disable-next-line no-new
    new route53.ARecord(this, 'CloudfrontDnsRecord', {
      zone: hostedZone,
      recordName: CLOUDFRONT_RECORD_NAME,
      target: cloudfrontTarget,
    })

    const apiGatewayTarget = route53.RecordTarget.fromAlias(
      new route53targets.ApiGatewayv2DomainProperties(
        domainName.regionalDomainName,
        domainName.regionalHostedZoneId,
      ),
    )

    // eslint-disable-next-line no-new
    new route53.ARecord(this, 'DnsRecord', {
      zone: hostedZone,
      recordName: RECORD_NAME,
      target: apiGatewayTarget,
    })

    const sourceAsset = s3deploy.Source.asset('../website/out')

    // eslint-disable-next-line no-new
    new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [sourceAsset],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      prune: false,
    })
  }
}
