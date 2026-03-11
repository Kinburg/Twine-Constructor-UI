import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    "rules": {
      "@typescript-eslint/no-explicit-any": "off",
      "no-control-regex": "off",
      // setState inside useEffect is intentional in several places (reset local UI state
      // on prop change, auto-expand on insert). Disabling globally is simpler than
      // scattering eslint-disable comments across unrelated files.
      "react-hooks/set-state-in-effect": "off",
      // Allow exporting constants alongside components (common pattern in Vite projects).
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
