const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Windows + pnpm: block transient tmp folders
const tmpPattern = /.*_tmp_.*/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, tmpPattern)
  : [tmpPattern];

module.exports = withNativeWind(config, { input: './src/global.css' });
