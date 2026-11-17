// SDK 52+ configures monorepo watchFolders / nodeModulesPaths automatically
// via expo/metro-config. Keep this file minimal.
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
