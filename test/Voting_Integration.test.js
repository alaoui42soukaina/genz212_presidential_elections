const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContract, addCandidates, startElection, setupElectionWithCandidates, castVotes } = require("./helpers/testHelpers");

describe("Voting Contract Integration Tests", function () {
  this.timeout(30000);
  
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
    this.timeout(10000);
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    
    voting = await deployContract("Voting");
    
    // Get references to sub-contracts for integration testing
    candidateManager = await ethers.getContractAt("CandidateManager", await voting.candidateManager());
    electionManager = await ethers.getContractAt("ElectionManager", await voting.electionManager());
    votingCore = await ethers.getContractAt("VotingCore", await voting.votingCore());
    resultsAggregator = await ethers.getContractAt("ResultsAggregator", await voting.resultsAggregator());
  });

  describe("Contract Integration Deployment", function () {
    it("Should deploy and connect all contracts correctly @pass @integration", async function () {
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

    it("Should have proper cross-contract authorizations @pass @integration", async function () {
      // Check that VotingCore is authorized to interact with other contracts
      expect(await candidateManager.authorizedContracts(await votingCore.getAddress()), "CandidateManager is not authorized to interact with VotingCore").to.be.true;
      expect(await electionManager.authorizedContracts(await votingCore.getAddress()), "ElectionManager is not authorized to interact with VotingCore").to.be.true;
      expect(await resultsAggregator.authorizedContracts(await votingCore.getAddress()), "ResultsAggregator is not authorized to interact with VotingCore").to.be.true;
    });

  });

  describe("Cross-Contract Data Consistency", function () {
    beforeEach(async function () {
      await setupElectionWithCandidates(voting, ["Alice", "Bob"]);
    });

    it("Should maintain consistent data across all contracts @pass @integration", async function () {
      await castVotes(voting, [
        { voter: voter1, candidateId: 1 },
        { voter: voter2, candidateId: 2 }
      ]);
      
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

    it("Should synchronize vote counts across contracts @fail @integration", async function () {
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
      let candidateCount = 1;

      for (const candidateName of addedCandidates) {
        // Verify candidate is added
        try {
          await expect(voting.addCandidate(candidateName))
            .to.emit(voting, "CandidateAdded")
            .withArgs(candidateCount, candidateName);
          candidateCount++;
        } catch (err) {
          throw new Error(
            "Candidate should be added. " +
            "Expected candidate count: " + candidateCount +
            ", Expected name: " + candidateName +
            "\n" + err.message
          );
        }

        // Verify candidate count and name
        const candidatesCount = await voting.candidatesCount();
        expect(candidatesCount, `Candidates count should match. Expected: ${candidateCount-1}, Got: ${candidatesCount}`).to.equal(candidateCount-1);
        const candidate = await voting.getCandidate(candidateCount - 1);
        expect(candidate[1], `Candidate name should match. Expected: ${candidateName}, Got: ${candidate[1]}`).to.equal(candidateName);
        expect(candidate[2], "Candidate vote count should be 0").to.equal(0);
      }
      
      // 2. Start election
      const currentRound = 1;
      try {
        await expect(voting.startElection())
        .to.emit(voting, "ElectionStarted")
        .withArgs(currentRound);
      } catch (err) {
        throw new Error(
          "Election should be started. " +
          "Expected round: " + currentRound +
          "\n" + err.message
        );
      }
      expect(await voting.isElectionActive(), "Election should be active").to.be.true;
      expect(await voting.currentElectionRound(), "Current election round should be " + currentRound).to.equal(currentRound);
      
      // 3. Cast votes
      const voters = [voter1, voter2, voter3];
      const candidatesToVoteFor = [1, 2, 1]; // Alice, Bob, Alice
      for (let i = 0; i < voters.length; i++) {
        try {
          await expect(voting.connect(voters[i]).vote(candidatesToVoteFor[i]))
            .to.emit(voting, "VoteCast")
            .withArgs(voters[i].address, candidatesToVoteFor[i]);
        } catch (err) {
          throw new Error(
            "Voter " + voters[i].address + " should be able to vote for candidate " + candidatesToVoteFor[i] + "\n" + err.message
          );
        }
      }
      
      // 4. Verify vote counts
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      const charlie = await voting.getCandidate(3);
      expect(alice[2], "Alice should have 2 votes").to.equal(2);
      expect(bob[2], "Bob should have 1 vote").to.equal(1);
      expect(charlie[2], "Charlie should have 0 votes").to.equal(0);
      
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
      await expect(voting.endElection())
        .to.emit(voting, "ElectionStopped");
      expect(await voting.isElectionActive(), "Election should be inactive").to.be.false;
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should prohibit voting before election starts @pass @integration", async function () {
      await addCandidates(voting, ["Alice"]);
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should prohibit voting after election ends @pass @integration", async function () {
      await setupElectionWithCandidates(voting, ["Alice"]);
      await voting.endElection();
      
      await expect(voting.connect(voter1).vote(1))
        .to.be.revertedWith("Election is not active");
    });

    it("Should prohibit voting for invalid candidate IDs @fail @integration", async function () {
      const invalidCandidateIds = [0, 1]; // injected bug, correction : const invalidCandidateIds = [0, 2];
      await setupElectionWithCandidates(voting, ["Alice"]);
      
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

    it("Should prohibit double voting @pass @integration", async function () {
      await setupElectionWithCandidates(voting, ["Alice", "Bob"]);
      
      await voting.connect(voter1).vote(1);
      
      await expect(voting.connect(voter1).vote(2))
        .to.be.revertedWith("You have already voted in this election");
    });

    it("Should not allow non-owner to start election @pass @integration", async function () {
      await expect(
        voting.connect(voter1).startElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should not allow non-owner to end election @pass @integration", async function () {
      await setupElectionWithCandidates(voting, ["Alice"]);
      await expect(
        voting.connect(voter1).endElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should not allow owner to end election @fail @integration", async function () {
      await setupElectionWithCandidates(voting, ["Alice"]);
      await expect(
        //injected bug, correction : connect(voter1)
        voting.connect(owner).endElection()).to.be.revertedWith("Only the owner can perform this action");
    });
  });
});
