require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.19',
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: process.env.HARDHAT_NETWORK_URL,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    reporter: 'mochawesome',
    parallel: false,
    reporterOptions: {
      reportDir: './test-results',
      reportFilename: 'mochawesome-report',
      reportTitle: 'Smart Contract Test Results',
      reportPageTitle: 'Voting DApp Test Suite',
      embeddedScreenshots: true,
      inlineAssets: true,
      saveAllAttempts: false,
      quiet: false,
      html: true,
      json: true,
      overwrite: true,
      timestamp: 'longDate',
    },
  },
};
