const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const candidatesConfig = require('../config/candidates.json');

async function main() {
  // Get the contract factory
  const Voting = await hre.ethers.getContractFactory('Voting');

  // Deploy the contract
  const voting = await Voting.deploy();

  // Wait for deployment to finish
  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();

  // Save deployment info to config file
  const deploymentInfo = {
    contractAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, '../config/deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  // Add candidates from config
  for (const candidateName of candidatesConfig.candidates) {
    await voting.addCandidate(candidateName);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
