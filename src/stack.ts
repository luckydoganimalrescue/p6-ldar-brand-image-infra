import type { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwi from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdajs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53Patterns from 'aws-cdk-lib/aws-route53-patterns'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ses from 'aws-cdk-lib/aws-ses'
import * as floyd from 'cdk-iam-floyd'

export interface IStackProps extends cdk.StackProps {
  hostedZoneName: string
  verifyEmail: string
  apiRecordName: string
  fromEmail: string
  cloudfrontRecordName: string
  cloudfrontDomainName: string
}

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id, props)

    // Lookup for the hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneName,
    })

    // Create the certificate for the domain
    const certificate = new certificatemanager.Certificate(this, 'WWWCertificate', {
      domainName: props.cloudfrontRecordName,
      validation: certificatemanager.CertificateValidation.fromEmail({
        email: props.verifyEmail,
      }),
    })

    // Define the S3 bucket for website hosting
    const site_bucket = new s3.Bucket(this, 'MyBucket', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      publicReadAccess: true, // Required for static website hosting to work with CloudFront
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
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // Allows public access via bucket policy
    })

    const logBucket = new s3.Bucket(this, 'LogBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      publicReadAccess: false,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE, // Enable ACLs for CloudFront logging
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // Allow ACLs for logging while blocking public access
    })

    // Grant CloudFront permission to write logs to the log bucket
    logBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [logBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/*`,
        },
      },
    }))

    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      defaultTtl: cdk.Duration.days(1),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.days(365),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      comment: props.cloudfrontRecordName,
      enabled: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames: [props.cloudfrontRecordName], // Use only one domain to avoid conflicts
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new cloudfront_origins.S3StaticWebsiteOrigin(site_bucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy,
      },
      enableLogging: true,
      logBucket,
      logIncludesCookies: true,
    })

    const cloudfrontTarget = route53.RecordTarget.fromAlias(
      new route53targets.CloudFrontTarget(distribution),
    )

    // Create both A (IPv4) and AAAA (IPv6) DNS records for www.ldar.p6m7g8.org (cloudfrontRecordName)
    new route53.ARecord(this, 'CloudfrontDnsRecordWWW', {
      zone: hostedZone,
      recordName: props.cloudfrontRecordName,
      target: cloudfrontTarget,
    })

    new route53.AaaaRecord(this, 'CloudfrontDnsRecordAAAAWWW', {
      zone: hostedZone,
      recordName: props.cloudfrontRecordName,
      target: cloudfrontTarget,
    })

    // Use HttpsRedirect for redirecting root domain (hostedZoneName) to www
    new route53Patterns.HttpsRedirect(this, 'Redirect', {
      recordNames: [props.cloudfrontDomainName], // Redirect root domain
      targetDomain: props.cloudfrontRecordName, // Redirect to www
      zone: hostedZone,
    })

    // -----------------------------------------------------------------------

    const api_certificate = new certificatemanager.Certificate(
      this,
      'APICertificate',
      {
        domainName: props.apiRecordName,
        validation: certificatemanager.CertificateValidation.fromEmail({
          email: props.verifyEmail,
        }),
      },
    )

    new ses.EmailIdentity(this, 'Identity', {
      identity: ses.Identity.email(props.fromEmail),
    })

    const bucket = new s3.Bucket(this, 'ImageBucket', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
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

    const presignFunc = new lambdajs.NodejsFunction(this, 'presign', {
      runtime: lambda.Runtime.NODEJS_20_X,
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
    brandFunc.addEnvironment('EMAIL_SENDER', props.fromEmail)
    brandFunc.addEnvironment('EMAIL_REGION', this.region)
    brandFunc.addEnvironment('FIT', 'fill')

    const policy = new floyd.Statement.Ses()
      .allow()
      .to('ses:SendEmail')
      .on('*')
    brandFunc.addToRolePolicy(policy)

    const domainName = new apigw.DomainName(this, 'DN', {
      domainName: props.apiRecordName,
      certificate: api_certificate,
    })

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

    const apiGatewayTarget = route53.RecordTarget.fromAlias(
      new route53targets.ApiGatewayv2DomainProperties(
        domainName.regionalDomainName,
        domainName.regionalHostedZoneId,
      ),
    )

    new route53.ARecord(this, 'DnsRecord', {
      zone: hostedZone,
      recordName: props.apiRecordName,
      target: apiGatewayTarget,
    })
  }
}
