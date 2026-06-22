/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@hanzo/esign-tailwind-config');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './primitives/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
};
