# Product Guidelines & Standards

## Code Style
- **Language**: TypeScript (Strict mode enabled in `tsconfig.json`).
- **Linting**: ESLint must pass (`pnpm lint`).
- **Formatting**: Adhere to project Prettier/EditorConfig settings.

## CDK Conventions
- **Constructs**: Define new resources within `src/` (or subfolders if complexity grows).
- **Naming**: Use clear, descriptive IDs for CDK constructs.
- **Environment**: Configuration (account/region) is handled in `bin/deploy.ts`.

## Testing
- **Unit Tests**: Required for CDK stacks and Lambda logic (`src/**/*.test.ts` or `test/`).
- **Infrastructure Tests**: Use `aws-cdk-lib/assertions` to verify CloudFormation templates.

## Security
- **IAM**: Grant only necessary permissions. Avoid wildcards (`*`) in IAM policies where possible.
- **Public Access**: S3 buckets should generally block public access unless serving public website content via CloudFront.
