/**
 * Jest config for the mobile app. Currently scoped to pure-TypeScript unit
 * tests of platform-agnostic modules (outbox/store, live/queue). React
 * Native component tests require a heavier transform pipeline and are
 * deliberately not configured here yet — Maestro covers the UI golden
 * path.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^expo-modules-core$": "<rootDir>/src/__mocks__/empty.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          esModuleInterop: true,
          target: "es2020",
          types: ["node", "jest"],
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
        },
      },
    ],
  },
};
