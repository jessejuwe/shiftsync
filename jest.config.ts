/**
 * Jest configuration with separate projects for components (jsdom) and API routes (node).
 * https://jestjs.io/docs/configuration
 */

import type { Config } from "jest";

const sharedConfig: Partial<Config> = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "test-utils"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

const config: Config = {
  collectCoverage: true,
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.ts",
    "app/**/*.{ts,tsx}",
    "config/**/*.ts",
    "!**/app/api/**",
    "!**/*.test.{ts,tsx}",
    "!**/__tests__/**",
    "!**/generated/**",
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  coverageProvider: "v8",
  projects: [
    {
      ...sharedConfig,
      displayName: "components",
      testEnvironment: "jsdom",
      testMatch: ["**/components/**/*.test.{ts,tsx}", "**/hooks/**/*.test.{ts,tsx}"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
    {
      ...sharedConfig,
      displayName: "api",
      testEnvironment: "node",
      testMatch: ["**/app/api/**/*.test.ts"],
      setupFilesAfterEnv: [],
    },
  ],
};

export default config;
