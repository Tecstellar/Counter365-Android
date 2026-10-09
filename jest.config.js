module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-contacts(.*)$': '<rootDir>/__mocks__/expo-contacts.js',
  },
  testTimeout: 30000,
};
