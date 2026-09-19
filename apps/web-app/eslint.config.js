import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Issue 003: tracing added to diagnose a hang outlived the investigation by
      // two months. `warn` and `error` stay allowed — the worker's catch blocks
      // log the Error object itself, which carries a stack the UI message does not.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
])
