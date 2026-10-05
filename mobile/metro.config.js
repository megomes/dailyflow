// Shares the pure domain logic with the web app (web/src/lib): same time, plan and snapshot rules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, '../web/src/lib');
config.watchFolders = [shared];
config.resolver.extraNodeModules = { '@shared': shared };
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
