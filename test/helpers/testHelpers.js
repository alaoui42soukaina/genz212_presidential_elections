/**
 * Test Helpers for Voting Contract
 */

const { ethers } = require("hardhat");

/**
 * Deploy a contract and return the instance
 */
async function deployContract(contractName, constructorArgs = []) {
  const ContractFactory = await ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  return contract;
}

/**
 * Add multiple candidates to the voting contract
 */
async function addCandidates(votingContract, candidateNames) {
  for (const name of candidateNames) {
    await votingContract.addCandidate(name);
  }
}

/**
 * Start an election
 */
async function startElection(votingContract) {
  await votingContract.startElection();
}

/**
 * Add candidates and start election (common pattern)
 */
async function setupElectionWithCandidates(votingContract, candidateNames) {
  await addCandidates(votingContract, candidateNames);
  await startElection(votingContract);
}

/**
 * Cast votes for multiple voters
 */
async function castVotes(votingContract, votes) {
  // votes format: [{ voter: signer, candidateId: number }]
  for (const vote of votes) {
    await votingContract.connect(vote.voter).vote(vote.candidateId);
  }
}

module.exports = {
  deployContract,
  addCandidates,
  startElection,
  setupElectionWithCandidates,
  castVotes
};
