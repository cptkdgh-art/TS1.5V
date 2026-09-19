import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      '.vercel/**',
      'node_modules/**',
      '*.tsbuildinfo',
      'capacitor.config.*',
      'vite.config.*',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-regex-spaces': 'off',
      'no-useless-assignment': 'off',
      'prefer-const': 'off',
      'preserve-caught-error': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
