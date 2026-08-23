import nextConfig from 'eslint-config-next';

import noPolishLiteral from './eslint-rules/no-polish-literal.mjs';

const localPlugin = {
  rules: {
    'no-polish-literal': noPolishLiteral,
  },
};

/**
 * Two project-specific rules on top of Next's own config, both from
 * ARCHITECTURE.md §2.1/§4:
 *
 *  1. No `@mui/material` import anywhere under `(marketing)` or `(shop)` —
 *     those route groups are Server Components; MUI is confined to
 *     `src/ui/islands` (and friends) and rendered in as children.
 *  2. No Polish string literal under `src/app` or `src/ui` — Polish content
 *     lives in `src/content/pl`, full stop, `src/content/pl` itself excepted.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...nextConfig,
  {
    ignores: ['src/generated/**', '.next/**', 'node_modules/**'],
  },
  {
    files: ['src/app/(marketing)/**/*.{ts,tsx}', 'src/app/(shop)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mui/material', '@mui/material/**'],
              message:
                'No @mui/material in (marketing)/(shop) server components (ARCHITECTURE.md §2.1). Put the interactive part in src/ui/islands and render it as a child.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    ignores: ['src/content/pl/**'],
    plugins: { local: localPlugin },
    rules: {
      'local/no-polish-literal': 'error',
    },
  },
];
