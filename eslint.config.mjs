// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: [
      'src/**/*.ts',
      'test/**/*.ts',
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
      '@stylistic': stylistic,
    },
    rules: {
      // ── TypeScript (logic rules — not stylistic) ─────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',

      // ── Quotes ───────────────────────────────────────────────────────────
      '@stylistic/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],

      // ── Indentation (2 spaces, TypeScript-aware) ─────────────────────────
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
        },
      ],

      // ── Newline at end of file ────────────────────────────────────────────
      '@stylistic/eol-last': [
        'error',
        'always',
      ],

      // ── Line endings (LF only) ────────────────────────────────────────────
      '@stylistic/linebreak-style': [
        'error',
        'unix',
      ],

      // ── Semicolons ────────────────────────────────────────────────────────
      '@stylistic/semi': [
        'error',
        'always',
      ],

      // ── Trailing commas ───────────────────────────────────────────────────
      '@stylistic/comma-dangle': [
        'error',
        'always-multiline',
      ],

      // ── Spacing ───────────────────────────────────────────────────────────
      '@stylistic/object-curly-spacing': [
        'error',
        'always',
      ],
      '@stylistic/array-bracket-spacing': [
        'error',
        'never',
      ],
      '@stylistic/space-in-parens': [
        'error',
        'never',
      ],
      '@stylistic/comma-spacing': [
        'error',
        {
          before: false,
          after: true,
        },
      ],
      '@stylistic/key-spacing': [
        'error',
        {
          beforeColon: false,
          afterColon: true,
        },
      ],
      '@stylistic/space-before-blocks': [
        'error',
        'always',
      ],
      '@stylistic/keyword-spacing': [
        'error',
        {
          before: true,
          after: true,
        },
      ],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/operator-linebreak': [
        'error',
        'after',
        {
          overrides: {
            '=': 'none',
          },
        },
      ],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
        },
      ],
      // Require newlines inside every block body (functions, if, for, try, …)
      '@stylistic/curly-newline': [
        'error',
        'always',
      ],

      // ── Array formatting ──────────────────────────────────────────────────
      '@stylistic/array-bracket-newline': [
        'error',
        {
          minItems: 2,
        },
      ],
      '@stylistic/array-element-newline': [
        'error',
        {
          minItems: 2,
        },
      ],

      // ── Object formatting ─────────────────────────────────────────────────
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            minProperties: 1,
          },
          ObjectPattern: {
            minProperties: 1,
          },
          ImportDeclaration: {
            minProperties: 5,
            consistent: true,
          },
          ExportDeclaration: {
            minProperties: 3,
            consistent: true,
          },
        },
      ],
      '@stylistic/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false,
        },
      ],

      // ── Blank lines ───────────────────────────────────────────────────────
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: 'import',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'import',
          next: 'import',
        },
      ],
    },
  },
  {
    // JavaScript config files (no TS parser/plugin)
    files: ['*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      '@stylistic/indent': [
        'error',
        2,
      ],
      '@stylistic/eol-last': [
        'error',
        'always',
      ],
      '@stylistic/linebreak-style': [
        'error',
        'unix',
      ],
      '@stylistic/semi': [
        'error',
        'always',
      ],
      '@stylistic/comma-dangle': [
        'error',
        'always-multiline',
      ],
      '@stylistic/object-curly-spacing': [
        'error',
        'always',
      ],
      '@stylistic/array-bracket-spacing': [
        'error',
        'never',
      ],
      '@stylistic/comma-spacing': [
        'error',
        {
          before: false,
          after: true,
        },
      ],
      '@stylistic/key-spacing': [
        'error',
        {
          beforeColon: false,
          afterColon: true,
        },
      ],
      '@stylistic/space-before-blocks': [
        'error',
        'always',
      ],
      '@stylistic/keyword-spacing': [
        'error',
        {
          before: true,
          after: true,
        },
      ],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/operator-linebreak': [
        'error',
        'after',
        {
          overrides: {
            '=': 'none',
          },
        },
      ],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
        },
      ],
      // Require newlines inside every block body (functions, if, for, try, …)
      '@stylistic/curly-newline': [
        'error',
        'always',
      ],
      // Break array brackets and elements when 2+ items
      '@stylistic/array-bracket-newline': [
        'error',
        {
          minItems: 2,
        },
      ],
      '@stylistic/array-element-newline': [
        'error',
        {
          minItems: 2,
        },
      ],
      // Break object braces always
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            minProperties: 1,
          },
          ObjectPattern: {
            minProperties: 1,
          },
          ImportDeclaration: {
            minProperties: 5,
            consistent: true,
          },
          ExportDeclaration: {
            minProperties: 3,
            consistent: true,
          },
        },
      ],
      '@stylistic/object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: false,
        },
      ],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
    ],
  },
];
