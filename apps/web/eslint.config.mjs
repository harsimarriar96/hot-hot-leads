import base from '@hothotleads/config/eslint/base.mjs';

export default [
  ...base,
  {
    files: ['**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
