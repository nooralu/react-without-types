import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { defineConfig } from "vite";
import babelPlugin from "vite-plugin-babel";

const REACT_SOURCE_DIR = '.'

const aliasList = [
  ['react', 'react'],
  ['react-dom', 'react-dom'],
  ['scheduler', 'scheduler'],
  ['shared', 'shared'],
  ['react-dom-bindings', 'react-dom-bindings'],
  ['react-reconciler', 'react-reconciler'],
  ['react-client', 'react-client'],
].flatMap(([pkg, dir]) => [
  {
    find: new RegExp(`^${pkg}$`),
    replacement: path.resolve(REACT_SOURCE_DIR, `packages/${dir}`),
  },
  {
    find: new RegExp(`^${pkg}/(.*)$`),
    replacement: path.resolve(REACT_SOURCE_DIR, `packages/${dir}/$1`),
  },
]);


/**
 * 修复 fiber 配置文件错误
 * 
 * react 项目是在 rollup 打包时替换 /scripts/rollup/forks.js
 */
function replaceRelativeImportPlugin() {
  return {
    name: 'replace-relative-reactfiberconfig',
    enforce: 'pre',
    transform(code, id) {
      if (
        id.includes('react-reconciler') &&
        id.endsWith('.js') &&
        code.includes('./ReactFiberConfig')
      ) {
        return {
          code: code.replace(
            /(['"])\.\/ReactFiberConfig\1/g,
            // 替换成 DOM 配置
            "$1./forks/ReactFiberConfig.dom$1"
          ),
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [
    replaceRelativeImportPlugin(),
    babelPlugin({
      loader: "jsx",
      babelConfig: {
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        inputSourceMap: true,
        presets: ["@babel/preset-flow"],
        plugins: ["babel-plugin-syntax-hermes-parser"],
      }
    }),
    react(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: aliasList,
  },
  optimizeDeps: {
    include: ["shared/ReactSharedInternals"],
    exclude: ["react"],
  },
  define: {
    __DEV__: true,
    __EXPERIMENTAL__: true,
    __EXTENSION__: false,
    __PROFILE__: false,
    __TEST__: false,
    __IS_CHROME__: false,
    __IS_FIREFOX__: false,
    __IS_EDGE__: false,
    __IS_NATIVE__: false,
  },
  build: {
    sourcemap: "inline"
  },
});
