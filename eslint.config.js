// Adapted from AstroWind's flat ESLint configuration.
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default [
  {
    ignores: [
      'node_modules/**',
      '.astro/**',
      'dist/**',
      'artifact/**',
      'qa/**',
      'release/**',
      'scripts/**',
      'playwright-report/**',
      'test-results/**',
      '.github/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
];
