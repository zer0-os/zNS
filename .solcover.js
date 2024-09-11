module.exports = {
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  },
  skipFiles: [
    'utils/StringUtils.sol',
    'token/mocks',
    'upgrade-test-mocks'
  ]
};
