module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/static/js/tests/setup.js'],
  testMatch: ['<rootDir>/static/js/tests/**/*.test.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/static/$1'
  },
  collectCoverageFrom: [
    'static/app.js',
    'static/js/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
