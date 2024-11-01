import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '.github/',
    '.pnpm-store/',
    '.mergify.yml',
    '.vscode/settings.json',
    '*.md',
    'cdk.json',
    'package.json',
    'tsconfig.json',
  ],
  plugins: {
  },
  languageOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-new': 'off',
  },
  settings: {
  },
})
