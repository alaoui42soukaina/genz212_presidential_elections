const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
  let voting;
  let candidateManager;
  let electionManager;
  let votingCore;
  let resultsAggregator;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();
    
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
    
    // Get references to sub-contracts
    candidateManager = await ethers.getContractAt("CandidateManager", await voting.candidateManager());
    electionManager = await ethers.getContractAt("ElectionManager", await voting.electionManager());
    votingCore = await ethers.getContractAt("VotingCore", await voting.votingCore());
    resultsAggregator = await ethers.getContractAt("ResultsAggregator", await voting.resultsAggregator());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await voting.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero candidates", async function () {
      expect(await voting.candidatesCount()).to.equal(0);
    });

    it("Should deploy all sub-contracts", async function () {
      const addresses = await voting.getContractAddresses();
      expect(addresses.candidateManagerAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.electionManagerAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.votingCoreAddr).to.not.equal(ethers.ZeroAddress);
      expect(addresses.resultsAggregatorAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have proper contract references", async function () {
      expect(await voting.candidateManager()).to.equal(await candidateManager.getAddress());
      expect(await voting.electionManager()).to.equal(await electionManager.getAddress());
      expect(await voting.votingCore()).to.equal(await votingCore.getAddress());
      expect(await voting.resultsAggregator()).to.equal(await resultsAggregator.getAddress());
    });
  });

  describe("Adding Candidates", function () {
    it("Should allow owner to add candidates", async function () {
      await voting.addCandidate("Alice");
      expect(await voting.candidatesCount()).to.equal(1);
      
      const candidate = await voting.getCandidate(1);
      expect(candidate[1]).to.equal("Alice");
      expect(candidate[2]).to.equal(0);
    });

    it("Should not allow non-owner to add candidates", async function () {
      await expect(voting.connect(voter1).addCandidate("Bob"))
        .to.be.revertedWith("Only the owner can perform this action");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection(); // Start election before voting
    });

    it("Should allow users to vote", async function () {
      await voting.connect(voter1).vote(1);
      
      const candidate = await voting.getCandidate(1);
      expect(candidate[2]).to.equal(1);
      
      const hasVoted = await voting.checkVoted(voter1.address);
      expect(hasVoted).to.be.true;
    });

    it("Should not allow users to vote twice", async function () {
      await voting.connect(voter1).vote(1);
      
      await expect(voting.connect(voter1).vote(2))
        .to.be.revertedWith("You have already voted in this election");
    });

    it("Should not allow voting for invalid candidate", async function () {
      await expect(voting.connect(voter1).vote(0))
        .to.be.revertedWith("Invalid candidate ID");
      
      await expect(voting.connect(voter1).vote(3))
        .to.be.revertedWith("Invalid candidate ID");
    });

    it("Should track multiple votes correctly", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(1);
      
      const candidate = await voting.getCandidate(1);
      expect(candidate[2]).to.equal(2);
    });
  });

  describe("Getting Results", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Carol");
      await voting.startElection(); // Start election before voting
    });

    it("Should return all candidates", async function () {
      const candidates = await voting.getAllCandidates();
      expect(candidates.length).to.equal(3);
      expect(candidates[0][1]).to.equal("Alice");
      expect(candidates[1][1]).to.equal("Bob");
      expect(candidates[2][1]).to.equal("Carol");
    });

    it("Should calculate total votes correctly", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      const totalVotes = await voting.getTotalVotes();
      expect(totalVotes).to.equal(2);
    });

    it("Should get winner correctly", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(1);
      
      const [winnerId, winnerName, voteCount] = await voting.getWinner();
      expect(winnerId).to.equal(1);
      expect(winnerName).to.equal("Alice");
      expect(voteCount).to.equal(2);
    });

    it("Should detect ties", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      const hasTie = await voting.hasTie();
      expect(hasTie).to.be.true;
      
      const tiedCandidates = await voting.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(2);
    });

    it("Should get detailed results", async function () {
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      
      const [candidateIds, names, voteCounts, percentages] = await voting.getDetailedResults();
      expect(candidateIds.length).to.equal(3);
      expect(names.length).to.equal(3);
      expect(voteCounts.length).to.equal(3);
      expect(percentages.length).to.equal(3);
      
      // Check that percentages add up to 100
      const totalPercentage = percentages.reduce((sum, p) => sum + Number(p), 0);
      expect(totalPercentage).to.equal(100);
    });

    it("Should get comprehensive voting stats", async function () {
      await voting.connect(voter1).vote(1);
      
      const [totalCandidates, currentRound, isActive, totalVotes, hasTieResult] = await voting.getVotingStats();
      expect(totalCandidates).to.equal(3);
      expect(currentRound).to.equal(1);
      expect(isActive).to.be.true;
      expect(totalVotes).to.equal(1);
      expect(hasTieResult).to.be.false;
    });
  });
});
