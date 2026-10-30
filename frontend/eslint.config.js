import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'e2e-report', 'e2e-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Components are used in JSX, which core ESLint doesn't count as "used"
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Data loading goes through TanStack Query (src/services/queries.js), not useEffect + setState
      'react-hooks/set-state-in-effect': 'error',
    },
  },
  {
    // Config files and Playwright tests run in Node, not the browser
    files: ['*.config.js', 'e2e/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
