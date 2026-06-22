/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@hanzo/esign-tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@hanzo/esign-ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@hanzo/esign-email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
};
