const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Expo autolinking to find ./modules/sonovel-tts
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  `${__dirname}/modules`,
];

config.resolver.blockList = config.resolver.blockList || [];
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
};

module.exports = config;
