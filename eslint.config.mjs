// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'src/types/global.d.ts'],
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
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
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
    files: ['src/config/env.ts', 'test/jest-setup.ts', 'prisma.config.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
