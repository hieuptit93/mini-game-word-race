import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Repack from '@callstack/repack';
import { ReanimatedPlugin } from '@callstack/repack-plugin-reanimated';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rspack config for Module Federation remote.
 *
 * This bundles your mini-game as a remote that can be loaded
 * by the Pika host app at runtime.
 */
export default Repack.defineRspackConfig((env) => {
  const { mode, platform } = env;

  return {
    mode,
    context: __dirname,
    entry: './index.js',
    output: {
      path: `${__dirname}/build/outputs/${platform}/remotes`,
      uniqueName: 'word_racer',
      // IMPORTANT: publicPath must be set explicitly for React Native
      // - Local dev: http://localhost:9000/ (default)
      // - Production: Set MF_PUBLIC_PATH before build
      // Example: MF_PUBLIC_PATH=https://your-game.vercel.app/ios/ npm run build:ios
      publicPath: process.env.MF_PUBLIC_PATH || 'http://localhost:9000/',
    },
    resolve: {
      ...Repack.getResolveOptions({ enablePackageExports: true }),
    },
    module: {
      rules: [
        {
          test: /\.[cm]?[jt]sx?$/,
          type: 'javascript/auto',
          use: {
            loader: '@callstack/repack/babel-swc-loader',
            parallel: true,
            options: {},
          },
        },
        ...Repack.getAssetTransformRules({
          svg: 'svgr',
          // Images are loaded via `<Image source={require(...)} />` from
          // WITHIN a Module Federation remote — without `remote.publicPath`
          // set, Re.Pack resolves asset require() calls assuming they're
          // embedded in the host app / served by the host's own Metro dev
          // server, which is wrong here since this remote is served
          // separately (localhost:9000 in dev). This caused every image to
          // silently fail to load (blank screen, HUD text still rendered
          // since Text doesn't depend on this).
          remote: {
            enabled: true,
            publicPath: process.env.MF_PUBLIC_PATH || 'http://localhost:9000/',
          },
        }),
      ],
    },
    plugins: [
      new Repack.RepackPlugin({
        extraChunks: [
          {
            include: /.*/,
            type: 'remote',
            outputPath: `build/outputs/${platform}/remotes`,
          },
        ],
      }),
      new ReanimatedPlugin({ unstable_disableTransform: true }),
      new Repack.plugins.ModuleFederationPluginV2({
        name: 'word_racer',
        filename: 'word_racer.container.js.bundle',
        dts: false,
        exposes: {
          './App': './src/App.tsx',
        },
        shared: {
          // eager: false = load from host's share scope (smaller bundle)
          // Requires building with pika-build.sh to ensure correct paths
          react: { singleton: true, eager: false, requiredVersion: '18.3.1' },
          'react-native': { singleton: true, eager: false, requiredVersion: '0.77.0' },
          'react-native-reanimated': { singleton: true, eager: false },
          'react-native-gesture-handler': { singleton: true, eager: false },
          'react-native-safe-area-context': { singleton: true, eager: false },
          'react-native-screens': { singleton: true, eager: false },
          'react-native-svg': { singleton: true, eager: false },
        },
      }),
    ],
    ignoreWarnings: [
      (warning) =>
        /Critical dependency: require function is used/.test(warning.message) &&
        /react-native-reanimated/.test(warning.module?.resource ?? ''),
    ],
  };
});
