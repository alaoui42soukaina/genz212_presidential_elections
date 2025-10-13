module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    mocha: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: [
    'coverage/',
    'artifacts/',
    'cache/',
    'node_modules/',
    'test-results/',
  ],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      env: {
        mocha: true,
      },
      rules: {
        'no-unused-expressions': 'off', // Allow chai assertions
        'no-console': 'off', // Allow console statements in tests
      },
    },
    {
      files: ['hardhat.config.js', 'scripts/**/*.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['frontend/**/*.js'],
      env: {
        browser: true,
      },
      globals: {
        ethers: 'readonly',
      },
      rules: {
        'no-console': 'off', // Allow console statements in frontend
      },
    },
  ],
};
