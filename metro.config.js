const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve the symlinked rent-right-shared package
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];
config.watchFolders = [
  path.resolve(__dirname, '../rent-right-shared'),
];

module.exports = config;
