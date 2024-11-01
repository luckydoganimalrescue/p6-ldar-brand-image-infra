import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '.github/',
    '.pnpm-store/',
    '.vscode/',
    '.mergify.yml',
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
