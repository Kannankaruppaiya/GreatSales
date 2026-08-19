const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Windows + pnpm: pnpm creates transient `*_tmp_*` folders under node_modules and
// removes them mid-install. Metro's file watcher crashes with ENOENT when a watched
// temp dir vanishes, so block that pattern from the crawl/watch.
const tmpPattern = /.*_tmp_.*/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, tmpPattern)
  : [tmpPattern];

module.exports = withNativeWind(config, { input: './src/global.css' });
