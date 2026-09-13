import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Lint for the web console.
 *
 * This workspace had no lint at all while `api` and `mobile` both did — and
 * this is the workspace where every React hook in the product lives. The gap
 * cost a real bug: a detail modal returned `null` for a missing record BEFORE
 * its hooks ran, so React saw a different number of hooks on the render where
 * the row arrived and threw out the component's state. `tsc` and vitest both
 * pass on that code; only this rule catches it.
 *
 * So the ruleset is deliberately narrow. It is a correctness gate, not a style
 * regime: adding the plugin's full React-Compiler ruleset here would bury the
 * two rules that matter under hundreds of advisory findings, and a check
 * nobody can keep green stops being a check.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // The defect class above. Never a warning — a component that breaks this
      // is already losing state at runtime.
      'react-hooks/rules-of-hooks': 'error',

      // A stale closure is a real bug, but the fix is sometimes a deliberate
      // omission with a reason written at the call site, so this informs rather
      // than blocks.
      'react-hooks/exhaustive-deps': 'warn',

      // `catch {}` with the reason written above it is a pattern used
      // throughout this codebase, where the error is surfaced from mutation
      // state instead. Leave the rest of the recommended set alone.
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
