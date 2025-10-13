require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    reporter: 'mochawesome',
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
      timestamp: 'longDate'
    }
  }
};
