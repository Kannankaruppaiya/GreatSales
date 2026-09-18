// Monorepo-aware Metro config: watch the workspace root so `@greatsales/shared`
// resolves from source, and resolve modules from both the app and the root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Pin `pretty-format` to its CommonJS build.
//
// The workspace root hoists pretty-format 30 (Jest's copy). With package
// exports on, Metro takes that package's "import" condition and bundles
// `build/index.mjs`, whose interop leaves `default` undefined. React Native's
// dev-only HMR client reads `prettyFormat.default.default`, throws before the
// app mounts, and `expo start --web` serves a white screen — while
// `expo export` is fine, because the HMR client is not in a production bundle.
//
// Normally react-native's own nested pretty-format 29 would be picked instead,
// but `disableHierarchicalLookup` above (which keeps a single copy of React in
// the graph) means nested installs are never consulted. So resolve this one
// package to its CJS entry, which both versions expose correctly.
const prettyFormatCjs = require.resolve("pretty-format/package.json", {
  paths: config.resolver.nodeModulesPaths,
});
const prettyFormatMain = path.join(
  path.dirname(prettyFormatCjs),
  "build/index.js",
);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "pretty-format") {
    return { type: "sourceFile", filePath: prettyFormatMain };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
