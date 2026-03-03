// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: [
      'src/**/*.ts',
      'test/**/*.ts'
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // ── Quotes ──────────────────────────────────────────────────────────
      'quotes': [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],

      // ── Indentation (2 spaces) ───────────────────────────────────────────
      'indent': [
        'error',
        2,
        {
          SwitchCase: 1
        }
      ],

      // ── Newline at end of file ───────────────────────────────────────────
      'eol-last': [
        'error',
        'always'
      ],

      // ── Line endings (LF only) ───────────────────────────────────────────
      'linebreak-style': [
        'error',
        'unix'
      ],

      // ── Array formatting ─────────────────────────────────────────────────
      // Break array brackets when 2+ elements are present
      'array-bracket-newline': [
        'error',
        {
          minItems: 2
        }
      ],
      // Each element on its own line when the array is broken
      'array-element-newline': [
        'error',
        {
          minItems: 2
        }
      ],

      // ── Object formatting ────────────────────────────────────────────────
      // Break object expressions/patterns with 2+ properties across lines
      'object-curly-newline': [
        'error', {
          ObjectExpression: {
            minProperties: 2,
            consistent: false
          },
          ObjectPattern: {
            minProperties: 2,
            consistent: false
          },
          // Keep import/export braces on one line unless they get very wide
          ImportDeclaration: {
            minProperties: 6,
            consistent: true
          },
          ExportDeclaration: {
            minProperties: 6, consistent: true
          },
        }],
      // Each property on its own line when the object is broken
      'object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false
        }
      ],

      // ── Blank line before return ─────────────────────────────────────────
      'padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: 'return'
        },
        {
          blankLine: 'always',
          prev: 'import',
          next: '*'
        },
        {
          blankLine: 'any',
          prev: 'import',
          next: 'import'
        },
      ],

      // ── TypeScript ───────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_'

        }

      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Disable base rule in favour of TS-aware version
      'no-unused-vars': 'off',
    },
  },
  {
    // Ignore compiled output
    ignores: [
      'dist/**',
      'node_modules/**'

    ],
  },
];
