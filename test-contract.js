const hre = require('hardhat');

async function main() {
  // Get the contract factory
  const Voting = await hre.ethers.getContractFactory('Voting');

  // Deploy the contract
  const voting = await Voting.deploy();
  await voting.waitForDeployment();

  await voting.getAddress();

  // Test the contract
  try {
    await voting.candidatesCount();

    // Add a candidate
    await voting.addCandidate('Test Candidate');

    await voting.candidatesCount();
  } catch (error) {
    throw new Error('Contract error:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
