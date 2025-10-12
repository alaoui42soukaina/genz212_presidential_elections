const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const candidatesConfig = require("../config/candidates.json");

async function main() {
  console.log("Deploying Voting contract...");

  // Get the contract factory
  const Voting = await hre.ethers.getContractFactory("Voting");

  // Deploy the contract
  const voting = await Voting.deploy();

  // Wait for deployment to finish
  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();
  console.log("Voting contract deployed to:", contractAddress);

  // Save deployment info to config file
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };
  
  const deploymentPath = path.join(__dirname, "../config/deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to config/deployment.json");

  // Add candidates from config
  console.log("Adding candidates from config...");
  for (const candidateName of candidatesConfig.candidates) {
    await voting.addCandidate(candidateName);
  }
  
  console.log("Candidates added successfully!");
  console.log("Contract ready for voting!");
  console.log("Note: Use the admin panel to start the election before users can vote.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
