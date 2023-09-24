/** @type {import('@remix-run/dev').AppConfig} */
export default {
  tailwind: true,
  ignoredRouteFiles: ['**/.*'],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",
  serverDependenciesToBundle: [
    'conf',
    'dot-prop',
    'env-paths',
    'atomically',
    'debounce-fn',
    'stubborn-fs',
    'when-exit',
    'mimic-fn'
  ],
  serverModuleFormat: 'esm'
}
