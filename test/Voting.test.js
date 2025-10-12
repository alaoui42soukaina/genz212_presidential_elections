const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract Integration Tests", function () {
  let voting;
  let candidateManager;
  let electionManager;
  let votingCore;
  let resultsAggregator;
  let owner;
  let voter1;
  let voter2;
  let voter3;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
    
    // Get references to sub-contracts for integration testing
    candidateManager = await ethers.getContractAt("CandidateManager", await voting.candidateManager());
    electionManager = await ethers.getContractAt("ElectionManager", await voting.electionManager());
    votingCore = await ethers.getContractAt("VotingCore", await voting.votingCore());
    resultsAggregator = await ethers.getContractAt("ResultsAggregator", await voting.resultsAggregator());
  });

  describe("Contract Integration Deployment", function () {
    it("Should deploy and connect all contracts correctly", async function () {
      const addresses = await voting.getContractAddresses();
      
      // Verify all contracts are deployed
      expect(addresses.candidateManagerAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.electionManagerAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.votingCoreAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.resultsAggregatorAddr).to.not.equal(ethers.ZeroAddress);
      
      // Verify cross-contract references
      expect(await voting.candidateManager()).to.equal(await candidateManager.getAddress());
      expect(await voting.electionManager()).to.equal(await electionManager.getAddress());
      expect(await voting.votingCore()).to.equal(await votingCore.getAddress());
      expect(await voting.resultsAggregator()).to.equal(await resultsAggregator.getAddress());
    });

    it("Should have proper cross-contract authorizations", async function () {
      // Check that VotingCore is authorized to interact with other contracts
      expect(await candidateManager.authorizedContracts(await votingCore.getAddress())).to.be.true;
      expect(await electionManager.authorizedContracts(await votingCore.getAddress())).to.be.true;
      expect(await resultsAggregator.authorizedContracts(await votingCore.getAddress())).to.be.true;
    });

    it("Should get all candidates through main Voting contract", async function () {
      // Add some candidates
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      
      // Test getAllCandidates function (covers line 62 in Voting.sol)
      const candidates = await voting.getAllCandidates();
      expect(candidates.length).to.equal(3);
      expect(candidates[0][1]).to.equal("Alice");
      expect(candidates[1][1]).to.equal("Bob");
      expect(candidates[2][1]).to.equal("Charlie");
      
      // Verify the function returns the same data as calling candidateManager directly
      const directCandidates = await candidateManager.getAllCandidates();
      expect(candidates.length).to.equal(directCandidates.length);
      for (let i = 0; i < candidates.length; i++) {
        expect(candidates[i][0]).to.equal(directCandidates[i][0]); // id
        expect(candidates[i][1]).to.equal(directCandidates[i][1]); // name
        expect(candidates[i][2]).to.equal(directCandidates[i][2]); // voteCount
      }
    });
  });

  describe("End-to-End Voting Workflow", function () {
    it("Should complete full voting cycle", async function () {
      // 1. Add candidates
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      expect(await voting.candidatesCount()).to.equal(3);
      
      // 2. Start election
      await voting.startElection();
      expect(await voting.isElectionActive()).to.be.true;
      expect(await voting.currentElectionRound()).to.equal(1);
      
      // 3. Cast votes
      await voting.connect(voter1).vote(1); // Alice
      await voting.connect(voter2).vote(2); // Bob
      await voting.connect(voter3).vote(1); // Alice
      
      // 4. Verify vote counts
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      const charlie = await voting.getCandidate(3);
      expect(alice[2]).to.equal(2); // Alice has 2 votes
      expect(bob[2]).to.equal(1);   // Bob has 1 vote
      expect(charlie[2]).to.equal(0); // Charlie has 0 votes
      
      // 5. Check voter status
      expect(await voting.checkVoted(voter1.address)).to.be.true;
      expect(await voting.checkVoted(voter2.address)).to.be.true;
      expect(await voting.checkVoted(voter3.address)).to.be.true;
      
      // 6. Get results
      const [winnerId, winnerName, voteCount] = await voting.getWinner();
      expect(winnerId).to.equal(1);
      expect(winnerName).to.equal("Alice");
      expect(voteCount).to.equal(2);
      
      // 7. End election
      await voting.endElection();
      expect(await voting.isElectionActive()).to.be.false;
    });

    it("Should handle multiple election rounds", async function () {
      // Setup
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      
      // Round 1
      await voting.startElection();
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      expect(await voting.currentElectionRound()).to.equal(1);
      expect(await voting.getTotalVotes()).to.equal(2);
      
      // End Round 1
      await voting.endElection();
      
      // Round 2
      await voting.startElection();
      expect(await voting.currentElectionRound()).to.equal(2);
      
      // Same voters can vote again in new round
      await voting.connect(voter1).vote(2);
      await voting.connect(voter2).vote(1);
      expect(await voting.getTotalVotes()).to.equal(2);
      
      // Verify vote counts reset and new votes counted
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      expect(alice[2]).to.equal(1); // Alice has 1 vote in round 2
      expect(bob[2]).to.equal(1);   // Bob has 1 vote in round 2
    });
  });

  describe("Cross-Contract Data Consistency", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
    });

    it("Should maintain consistent data across all contracts", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      // Check data consistency across contracts
      const mainCandidate = await voting.getCandidate(1);
      const coreCandidate = await votingCore.getCandidate(1);
      const managerCandidate = await candidateManager.getCandidate(1);
      
      expect(mainCandidate[2]).to.equal(coreCandidate[2]);
      expect(coreCandidate[2]).to.equal(managerCandidate[2]);
      
      // Check election status consistency
      expect(await voting.isElectionActive()).to.equal(await votingCore.isElectionActive());
      expect(await votingCore.isElectionActive()).to.equal(await electionManager.isElectionActive());
      
      // Check voter status consistency
      expect(await voting.checkVoted(voter1.address)).to.equal(await votingCore.checkVoted(voter1.address));
      expect(await votingCore.checkVoted(voter1.address)).to.equal(await electionManager.hasVotedInCurrentRound(voter1.address));
    });

    it("Should synchronize vote counts across contracts", async function () {
      await voting.connect(voter1).vote(1);
      
      // Check vote counts are synchronized
      const totalVotesMain = await voting.getTotalVotes();
      const totalVotesResults = await resultsAggregator.getTotalVotes();
      
      expect(totalVotesMain).to.equal(totalVotesResults);
      expect(totalVotesMain).to.equal(1);
    });
  });

  describe("Complex Voting Scenarios", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      await voting.addCandidate("David");
      await voting.startElection();
    });

    it("Should handle tie scenarios correctly", async function () {
      // Create a tie: Alice and Bob both get 2 votes
      await voting.connect(voter1).vote(1); // Alice
      await voting.connect(voter2).vote(2); // Bob
      await voting.connect(voter3).vote(1); // Alice
      
      // Add more voters for the tie
      const [voter4, voter5] = await ethers.getSigners();
      await voting.connect(voter4).vote(2); // Bob
      
      expect(await voting.hasTie()).to.be.true;
      
      const tiedCandidates = await voting.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(2);
      expect(tiedCandidates.map(Number)).to.include(1); // Alice
      expect(tiedCandidates.map(Number)).to.include(2); // Bob
    });

    it("Should calculate detailed results correctly", async function () {
      // Get fresh signers for this test
      const signers = await ethers.getSigners();
      const [v1, v2, v3, v4, v5, v6] = signers.slice(0, 6);
      
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote, David: 0 votes
      await voting.connect(v1).vote(1); // Alice
      await voting.connect(v2).vote(2); // Bob
      await voting.connect(v3).vote(1); // Alice
      await voting.connect(v4).vote(1); // Alice
      await voting.connect(v5).vote(2); // Bob
      await voting.connect(v6).vote(3); // Charlie
      
      const [candidateIds, names, voteCounts, percentages] = await voting.getDetailedResults();
      
      // Verify results
      expect(candidateIds.length).to.equal(4);
      expect(voteCounts[0]).to.equal(3); // Alice
      expect(voteCounts[1]).to.equal(2); // Bob
      expect(voteCounts[2]).to.equal(1); // Charlie
      expect(voteCounts[3]).to.equal(0); // David
      
      // Verify percentages (total: 6 votes)
      expect(percentages[0]).to.equal(50); // Alice: 3/6 = 50%
      expect(percentages[1]).to.equal(33); // Bob: 2/6 = 33%
      expect(percentages[2]).to.equal(16); // Charlie: 1/6 = 16%
      expect(percentages[3]).to.equal(0);  // David: 0/6 = 0%
      
      // Verify percentages add up to 100 (allow for rounding)
      const totalPercentage = percentages.reduce((sum, p) => sum + Number(p), 0);
      expect(totalPercentage).to.be.within(99, 100);
    });

    it("Should handle candidates sorted by vote count", async function () {
      // Get fresh signers for this test
      const signers = await ethers.getSigners();
      const [v1, v2, v3, v4, v5, v6] = signers.slice(0, 6);
      
      // Alice: 1 vote, Bob: 3 votes, Charlie: 2 votes, David: 0 votes
      await voting.connect(v1).vote(1); // Alice
      await voting.connect(v2).vote(2); // Bob
      await voting.connect(v3).vote(3); // Charlie
      await voting.connect(v4).vote(2); // Bob
      await voting.connect(v5).vote(2); // Bob
      await voting.connect(v6).vote(3); // Charlie
      
      const [candidateIds, names, voteCounts] = await voting.getCandidatesByVoteCount();
      
      // Should be sorted by vote count (descending)
      expect(candidateIds[0]).to.equal(2); // Bob (3 votes)
      expect(voteCounts[0]).to.equal(3);
      
      expect(candidateIds[1]).to.equal(3); // Charlie (2 votes)
      expect(voteCounts[1]).to.equal(2);
      
      expect(candidateIds[2]).to.equal(1); // Alice (1 vote)
      expect(voteCounts[2]).to.equal(1);
      
      expect(candidateIds[3]).to.equal(4); // David (0 votes)
      expect(voteCounts[3]).to.equal(0);
    });
  });

  describe("Comprehensive Statistics", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      await voting.startElection();
    });

    it("Should provide comprehensive voting statistics", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      const [totalCandidates, currentRound, isActive, totalVotes, hasTieResult] = await voting.getVotingStats();
      
      expect(totalCandidates).to.equal(3);
      expect(currentRound).to.equal(1);
      expect(isActive).to.be.true;
      expect(totalVotes).to.equal(2);
      expect(hasTieResult).to.be.true; // Alice and Bob both have 1 vote
    });

    it("Should track total voters correctly", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      const totalVoters = await voting.getTotalVoters();
      const totalVotes = await voting.getTotalVotes();
      
      expect(totalVoters).to.equal(totalVotes);
      expect(totalVoters).to.equal(2);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle voting before election starts", async function () {
      await voting.addCandidate("Alice");
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should handle voting after election ends", async function () {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await voting.endElection();
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should handle invalid candidate IDs", async function () {
      await voting.addCandidate("Alice");
      await voting.startElection();
      
      await expect(voting.connect(voter1).vote(0))
        .to.be.revertedWith("Invalid candidate ID");
      
      await expect(voting.connect(voter1).vote(2))
        .to.be.revertedWith("Invalid candidate ID");
    });

    it("Should handle double voting prevention", async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
      
      await voting.connect(voter1).vote(1);
      
      await expect(voting.connect(voter1).vote(2))
        .to.be.revertedWith("You have already voted in this election");
    });
  });
});
