module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    plugins: [
      ['module-resolver', {
        alias: {
          '@': './src',
        },
      }],
      // Reanimated plugin PHẢI ở cuối mảng plugins
      'react-native-reanimated/plugin',
    ],
  };
};
