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
    it("Should deploy and connect all contracts correctly @pass", async function () {
      const addresses = await voting.getContractAddresses();
      
      // Verify all contracts are deployed
      expect(addresses.candidateManagerAddr, "CandidateManager contract is not deployed").to.not.equal(ethers.ZeroAddress);
      expect(addresses.electionManagerAddr, "ElectionManager contract is not deployed").to.not.equal(ethers.ZeroAddress);
      expect(addresses.votingCoreAddr, "VotingCore contract is not deployed").to.not.equal(ethers.ZeroAddress);
      expect(addresses.resultsAggregatorAddr, "ResultsAggregator contract is not deployed").to.not.equal(ethers.ZeroAddress);
      
      // Verify cross-contract references
      expect(await voting.candidateManager(), "CandidateManager contract reference is not correct").to.equal(await candidateManager.getAddress());
      expect(await voting.electionManager(), "ElectionManager contract reference is not correct").to.equal(await electionManager.getAddress());
      expect(await voting.votingCore(), "VotingCore contract reference is not correct").to.equal(await votingCore.getAddress());
      expect(await voting.resultsAggregator(), "ResultsAggregator contract reference is not correct").to.equal(await resultsAggregator.getAddress());
    });

    it("Should have proper cross-contract authorizations @pass", async function () {
      // Check that VotingCore is authorized to interact with other contracts
      expect(await candidateManager.authorizedContracts(await votingCore.getAddress()), "CandidateManager is not authorized to interact with VotingCore").to.be.true;
      expect(await electionManager.authorizedContracts(await votingCore.getAddress()), "ElectionManager is not authorized to interact with VotingCore").to.be.true;
      expect(await resultsAggregator.authorizedContracts(await votingCore.getAddress()), "ResultsAggregator is not authorized to interact with VotingCore").to.be.true;
    });

    it("Should get all candidates through main Voting contract @pass", async function () {
      const addedCandidates = ["Alice", "Bob", "Charlie"];

      // Add candidates
      for (const candidate of addedCandidates) {
        await voting.addCandidate(candidate);
      }
      
      // Fetch all candidates
      const candidates = await voting.getAllCandidates();
      
      // Check length first
      expect(candidates.length, "Number of added candidates and fetched candidates from Voting contract should match").to.equal(addedCandidates.length);
      
      // verify each candidate name
      candidates.forEach((candidate, index) => {
        const candidateName = candidate[1];
        expect(candidateName, `Added candidate name should match fetched candidate name from Voting contract`)
          .to.equal(addedCandidates[index]);
      });
    });
  });

  describe("Cross-Contract Data Consistency", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
    });

    it("Should maintain consistent data across all contracts @pass", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      // Check candidate vote count consistency
      const mainCandidate = await voting.getCandidate(1);
      const coreCandidate = await votingCore.getCandidate(1);
      const managerCandidate = await candidateManager.getCandidate(1);
      
      expect(mainCandidate[2], "Main candidate vote count should match VotingCore candidate vote count").to.equal(coreCandidate[2]);
      expect(coreCandidate[2], "VotingCore candidate vote count should match CandidateManager candidate vote count").to.equal(managerCandidate[2]);
      
      // Check election status consistency
      expect(await voting.isElectionActive(), "Election status should match VotingCore election status").to.equal(await votingCore.isElectionActive());
      expect(await votingCore.isElectionActive(), "VotingCore election status should match ElectionManager election status").to.equal(await electionManager.isElectionActive());

      // Check voter status consistency
      expect(await voting.checkVoted(voter1.address), "Voter 1 status should match VotingCore voter status").to.equal(await votingCore.checkVoted(voter1.address));
      expect(await votingCore.checkVoted(voter1.address), "VotingCore voter status should match ElectionManager voter status").to.equal(await electionManager.hasVotedInCurrentRound(voter1.address));
    });

    it("Should synchronize vote counts across contracts @fail", async function () {
      const numberOfVotes = 1;
      await voting.connect(voter1).vote(numberOfVotes);
      
      // Check vote counts are synchronized
      const totalVotesMain = await voting.getTotalVotes() + 1n; // injected bug, correction : await voting.getTotalVotes();
      const totalVotesResults = await resultsAggregator.getTotalVotes();
      
      try {
        expect(totalVotesMain).to.equal(totalVotesResults);
      } catch (err) {
        throw new Error(
          "Total votes should be equal. " +
          "Main contract: " + totalVotesMain +
          ", ResultsAggregator contract: " + totalVotesResults +
          "\n" + err.message
        );
      }
      
      try {
        expect(totalVotesMain).to.equal(numberOfVotes);
      } catch (err) {
        throw new Error(
          "Total votes should be " + numberOfVotes + ", " +
          "votes returned in main contract: " + totalVotesMain +
          "\n" + err.message
        );
      }
    });
  });

  describe("End-to-End Voting Workflow", function () {
    it("Should complete full voting cycle @pass @e2e", async function () {
      // 1. Add candidates
      const addedCandidates = ["Alice", "Bob", "Charlie"];

      for (const candidate of addedCandidates) {
        await voting.addCandidate(candidate);
      }
      // verify candidates count
      const candidatesCount = await voting.candidatesCount();
      expect(
        await voting.candidatesCount(),
        `Number of added candidates (${addedCandidates.length}) and fetched candidates (${candidatesCount}) from Voting contract should match`
      ).to.equal(addedCandidates.length);
      
      // 2. Start election
      await voting.startElection();
      expect(await voting.isElectionActive(), "Election should be active").to.be.true;
      expect(await voting.currentElectionRound(), "Current election round should be 1").to.equal(1);
      
      // 3. Cast votes
      await voting.connect(voter1).vote(1); // Alice
      await voting.connect(voter2).vote(2); // Bob
      await voting.connect(voter3).vote(1); // Alice
      
      // 4. Verify vote counts
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      const charlie = await voting.getCandidate(3);
      expect(alice[2], "Alice should have 2 votes").to.equal(2); // Alice has 2 votes
      expect(bob[2], "Bob should have 1 vote").to.equal(1);   // Bob has 1 vote
      expect(charlie[2], "Charlie should have 0 votes").to.equal(0); // Charlie has 0 votes
      
      // 5. Check voter status
      expect(await voting.checkVoted(voter1.address), "Voter 1 should have voted").to.be.true;
      expect(await voting.checkVoted(voter2.address), "Voter 2 should have voted").to.be.true;
      expect(await voting.checkVoted(voter3.address), "Voter 3 should have voted").to.be.true;
      
      // 6. Get results
      const [winnerId, winnerName, voteCount] = await voting.getWinner();
      expect(winnerId, "Winner ID should be 1").to.equal(1);
      expect(winnerName, "Winner name should be Alice").to.equal("Alice");
      expect(voteCount, "Winner vote count should be 2").to.equal(2);
      
      // 7. End election
      await voting.endElection();
      expect(await voting.isElectionActive(), "Election should be inactive").to.be.false;
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should prohibit voting before election starts @pass", async function () {
      await voting.addCandidate("Alice");
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should prohibit voting after election ends @pass", async function () {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await voting.endElection();
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should prohibit voting for invalid candidate IDs @fail", async function () {
      const invalidCandidateIds = [0, 1]; // injected bug, correction : const invalidCandidateIds = [0, 2];
      await voting.addCandidate("Alice");
      await voting.startElection();
      
      for (const candidateID of invalidCandidateIds) {
        try {
          await expect(voting.connect(voter1).vote(candidateID))
            .to.be.revertedWith("Invalid candidate ID");
        } catch (err) {
          throw new Error(
            "Voter should not be able to vote for invalid candidate ID : " +
            candidateID + "\n" + err
          );
        }
      }      
    });

    it("Should prohibit double voting @pass", async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
      
      await voting.connect(voter1).vote(1);
      
      await expect(voting.connect(voter1).vote(2))
        .to.be.revertedWith("You have already voted in this election");
    });

    it("Should not allow non-owner to start election @pass", async function () {
      await expect(
        voting.connect(voter1).startElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should not allow non-owner to end election @pass", async function () {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await expect(
        voting.connect(voter1).endElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should not allow owner to end election @fail", async function () {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await expect(
        //injected bug, correction : connect(voter1)
        voting.connect(owner).endElection()).to.be.revertedWith("Only the owner can perform this action");
    });
  });
});
