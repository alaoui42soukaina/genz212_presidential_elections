const hre = require("hardhat");

async function main() {
  console.log("Testing contract deployment...");

  // Get the contract factory
  const Voting = await hre.ethers.getContractFactory("Voting");

  // Deploy the contract
  const voting = await Voting.deploy();
  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();
  console.log("Contract deployed to:", contractAddress);

  // Test the contract
  try {
    const count = await voting.candidatesCount();
    console.log("Candidates count:", count.toString());
    
    // Add a candidate
    await voting.addCandidate("Test Candidate");
    
    const newCount = await voting.candidatesCount();
    console.log("New candidates count:", newCount.toString());
    
    console.log("Contract is working!");
  } catch (error) {
    console.error("Contract error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
