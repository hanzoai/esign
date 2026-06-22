import linguiMacro from '@lingui/babel-plugin-lingui-macro';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import path from 'node:path';

/** @type {import('rollup').RollupOptions} */
const config = {
  /**
   * We specifically target router.ts (the Hono app) instead of the entry point
   * so rollup doesn't go through the already-prebuilt RR7 server files.
   *
   * zap/http-api.ts is a SECOND input: the raw-copied server/main.js imports
   * `serveZapHttpApi` (and, via its re-export, `serveZap`) from the bundled
   * ./hono/server/zap/http-api.js — but router.ts never references http-api, so
   * without listing it here it never lands in the bundle (the runtime
   * ERR_MODULE_NOT_FOUND for @hanzo/esign-trpc/zap/server). Listing it makes
   * rollup bundle the whole esign ZAP server layer (resolveOnly @hanzo/esign-*)
   * into build/server/hono/server/zap/http-api.js, leaving only real registry
   * deps (@zap-proto/web, @hono/node-server) external — those resolve at runtime.
   */
  input: ['server/router.ts', 'server/zap/http-api.ts'],
  output: {
    dir: 'build/server/hono',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: '.',
  },
  external: [/node_modules/],
  plugins: [
    typescript({
      noEmitOnError: true,
      moduleResolution: 'bundler',
      include: ['server/**/*', '../../packages/**/*', '../../packages/lib/translations/**/*'],
      jsx: 'preserve',
    }),
    resolve({
      rootDir: path.join(process.cwd(), '../..'),
      preferBuiltins: true,
      resolveOnly: [
        '@hanzo/esign-api/*',
        '@hanzo/esign-auth/*',
        '@hanzo/esign-lib/*',
        '@hanzo/esign-trpc/*',
        '@hanzo/esign-email/*',
      ],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    }),
    json(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.tsx'],
      presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
      plugins: [linguiMacro],
    }),
  ],
};

export default config;
