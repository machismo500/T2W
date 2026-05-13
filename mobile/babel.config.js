module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === "production";
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    plugins: [
      // Strip console.* in production bundles. Keep console.warn / .error
      // so genuine warnings still land in Sentry breadcrumbs. Dev builds
      // (including sideload) keep everything for easy debugging.
      isProd ? ["transform-remove-console", { exclude: ["warn", "error"] }] : null,
      "react-native-reanimated/plugin",
    ].filter(Boolean),
  };
};
