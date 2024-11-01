# Tech Stack

## Infrastructure as Code
- **Framework**: AWS CDK (Cloud Development Kit)
- **Language**: TypeScript
- **State Management**: CDK CloudFormation Stacks

## Compute & Application Logic
- **Serverless**: AWS Lambda (Node.js runtime)
- **API**: AWS API Gateway (HTTP API)
- **Image Processing**: `sharp` library (for resizing and watermarking)

## Storage & Content Delivery
- **Object Storage**: Amazon S3 (Website hosting, raw image storage, processed image storage)
- **CDN**: Amazon CloudFront (Global content delivery for the static site)

## Networking & Security
- **DNS**: Amazon Route53
- **Certificates**: AWS Certificate Manager (ACM)
- **Email**: Amazon SES (Simple Email Service)
- **IAM**: Least privilege roles for Lambda execution and bucket access.

## CI/CD & Development
- **Pipeline**: GitHub Actions
- **Linting**: ESLint
- **Testing**: Jest
- **Package Manager**: pnpm
