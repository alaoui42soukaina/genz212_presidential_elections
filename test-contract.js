const hre = require('hardhat');

async function main() {

  // Get the contract factory
  const Voting = await hre.ethers.getContractFactory('Voting');

  // Deploy the contract
  const voting = await Voting.deploy();
  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();

  // Test the contract
  try {
    const count = await voting.candidatesCount();

    // Add a candidate
    await voting.addCandidate('Test Candidate');

    const newCount = await voting.candidatesCount();

  } catch (error) {
    console.error('Contract error:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
