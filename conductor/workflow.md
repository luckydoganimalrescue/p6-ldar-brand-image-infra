# Workflow

## Development Flow
1.  **Local Development**:
    - Clone the repository.
    - Install dependencies: `pnpm install`.
    - Run tests: `pnpm test`.
    - Synthesize CloudFormation template: `pnpm cdk synth`.

2.  **Pull Requests**:
    - Create a feature branch.
    - Submit a PR to `main`.
    - **CI Checks**:
        - `pull-request-lint.yml`: Enforces conventional commit messages or PR title standards.
        - `build.yml`: Runs `pnpm build`, `pnpm lint`, and `pnpm test`.

3.  **Deployment**:
    - **Trigger**: Merge to `main`.
    - **Action**: `deploy.yml`.
    - **Process**: Uses `cdk deploy` to update the AWS infrastructure.

## Key Files
- `src/stack.ts`: Main CDK stack definition.
- `src/stack.brand.ts`: Lambda function for image branding.
- `src/stack.presign.ts`: Lambda function for pre-signed URL generation.
- `bin/deploy.ts`: CDK app entry point.

## Automation
- **Dependabot/Renovate**: `auto-approve.yml` suggests automated dependency updates are enabled and auto-merged for trusted authors.
