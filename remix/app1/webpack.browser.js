import * as path from 'node:path';

import { readConfig } from '@remix-run/dev/dist/config.js';
import { EsbuildPlugin } from 'esbuild-loader';
import { default as Enhanced } from '@module-federation/enhanced';
import { getRoutes, routeSet } from './utils/get-routes.js';
import { RemixAssetsManifestPlugin } from './utils/RemixAssetsManifestPlugin.js';
import { HoistContainerReferences } from './utils/HoistContainerReferencesPlugin.js';
const { ModuleFederationPlugin, AsyncBoundaryPlugin } = Enhanced;

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const remixConfig = await readConfig();

/**
 * @type {import('webpack').Configuration}
 */
const config = {
  name: 'browser',
  mode,
  devtool: mode === 'development' ? 'inline-cheap-source-map' : undefined,
  entry: {
    'entry.client': remixConfig.entryClientFilePath,
    ...getRoutes(remixConfig),
  },
  externalsType: 'module',
  experiments: {
    outputModule: true,
    topLevelAwait: true,
  },
  output: {
    environment: {
      module: true,
    },
    path: remixConfig.assetsBuildDirectory,
    publicPath: 'auto',
    module: true,
    library: { type: 'module' },
    chunkFormat: 'module',
    chunkLoading: 'import',
    assetModuleFilename: '_assets/[name]-[contenthash][ext]',
    cssChunkFilename: '_assets/[name]-[contenthash][ext]',
    filename: '[name]-[contenthash].js',
    chunkFilename: '[name]-[contenthash].js',
  },
  module: {
    rules: [
      {
        include: input => routeSet.has(input),
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [['eliminator', { namedExports: ['action', 'loader'] }]],
            },
          },
          {
            loader: 'esbuild-loader',
            options: {
              target: 'es2019',
              jsx: 'automatic',
            },
          },
        ],
      },
      {
        test: /\.[jt]sx?$/,
        exclude: input => routeSet.has(input),
        use: [
          {
            loader: 'esbuild-loader',
            options: {
              target: 'es2019',
              jsx: 'automatic',
            },
          },
        ],
      },
    ],
  },
  cache: false,
  optimization: {
    moduleIds: 'named',
    runtimeChunk: 'single',
    chunkIds: 'named',
    // treeshake unused code in development
    // needed so that browser build does not pull in server code
    usedExports: true,
    innerGraph: true,
    splitChunks: {
      chunks: 'async',
    },
    minimize: mode === 'production',
    minimizer: [new EsbuildPlugin({ target: 'es2019' })],
  },
  plugins: [
    new HoistContainerReferences(),
    new AsyncBoundaryPlugin({
      excludeChunk: chunk => {
        return chunk.name === 'app1';
      },
    }),
    new ModuleFederationPlugin({
      runtime: false,
      name: 'app1',
      filename: 'remoteEntry.js',
      library: {
        type: 'module',
      },
      remoteType: 'module',
      remotes: {
        app2: 'http://localhost:3001/build/remoteEntry.js',
      },
      exposes: {
        './button': './components/Button.jsx',
      },
      shared: {
        'react/': {
          singleton: true,
        },
        react: {
          singleton: true,
        },
        'react-dom/': {
          singleton: true,
        },
        'react-dom': {
          singleton: true,
        },
        'react-router-dom': {
          singleton: true,
        },
        'react-router-dom/': {
          singleton: true,
        },
        '@remix-run/router': {
          singleton: true,
        },
        '@remix-run/router/': {
          singleton: true,
        },
        '@remix-run/react/': {
          singleton: true,
        },
        '@remix-run/': {
          singleton: true,
        },
      },
    }),
    new RemixAssetsManifestPlugin(remixConfig),
  ],
};

export default config;
