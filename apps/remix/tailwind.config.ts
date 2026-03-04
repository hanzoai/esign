/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@hanzo/sign-tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@hanzo/sign-ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/sign-email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
};
