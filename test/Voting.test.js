const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
  let voting;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();
    
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await voting.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero candidates", async function () {
      expect(await voting.candidatesCount()).to.equal(0);
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
        .to.be.revertedWith("You have already voted");
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
  });
});
