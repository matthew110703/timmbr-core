// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['src/**'],
              message: "Use the '@/' alias instead of 'src/' prefix (e.g. '@/config/env').",
            },
            {
              regex: '^(\\.\\./){3,}',
              message: "Avoid deep relative imports (3+ levels up). Use the '@/' alias instead.",
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name="process"][property.name="env"]',
          message:
            'Do not access process.env directly. Import from src/config/env.ts instead.',
        },
      ],
    },
  },
  {
    files: ['src/config/env.ts', 'test/jest-setup.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
