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

      // ── Function call / definition formatting ────────────────────────────
      // Break parens when 2+ arguments are present (mirrors array-bracket-newline)
      'function-paren-newline': [
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
            consistent: true
          },
          ObjectPattern: {
            minProperties: 2,
            consistent: true
          },
          // Keep import/export braces on one line unless they get very wide
          ImportDeclaration: {
            minProperties: 5,
            consistent: true
          },
          ExportDeclaration: {
            minProperties: 3,
            consistent: true
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

      // ── Semicolons ───────────────────────────────────────────────────────
      'semi': [
        'error',
        'always'
      ],

      // ── Trailing commas ──────────────────────────────────────────────────
      'comma-dangle': [
        'error',
        'always-multiline'
      ],

      // ── Spacing ──────────────────────────────────────────────────────────
      // Space inside object braces: { a: 1 }
      'object-curly-spacing': [
        'error',
        'always'
      ],
      // No spaces inside array brackets: [1, 2]
      'array-bracket-spacing': [
        'error',
        'never'
      ],
      // No spaces inside parens: fn(a, b)
      'space-in-parens': [
        'error',
        'never'
      ],
      // Space after comma: a, b
      'comma-spacing': [
        'error',
        {
          before: false,
          after: true
        }
      ],
      // Space around colon in object literals: { a: 1 }
      'key-spacing': [
        'error',
        {
          beforeColon: false,
          afterColon: true
        }
      ],
      // Space before block braces: if (x) {
      'space-before-blocks': [
        'error',
        'always'
      ],
      // Space around keywords: if, for, return…
      'keyword-spacing': [
        'error',
        {
          before: true,
          after: true
        }
      ],
      // Space around infix operators: a + b, x = 1
      'space-infix-ops': 'error',
      // No trailing whitespace on any line
      'no-trailing-spaces': 'error',
      // No multiple blank lines
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0
        }
      ],
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
