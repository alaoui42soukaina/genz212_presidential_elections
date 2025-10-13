const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContract } = require("./helpers/testHelpers");

describe("CandidateManager Contract", function () {
  let candidateManager;
  let owner;
  let authorizedContract;
  let unauthorizedUser;

  beforeEach(async function () {
    [owner, authorizedContract, unauthorizedUser] = await ethers.getSigners();
    
    candidateManager = await deployContract("CandidateManager");
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await candidateManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero candidates", async function () {
      expect(await candidateManager.getCandidatesCount()).to.equal(0);
    });

    it("Should authorize the owner by default", async function () {
      expect(await candidateManager.authorizedContracts(owner.address)).to.be.true;
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to authorize contracts", async function () {
      await candidateManager.authorizeContract(authorizedContract.address);
      expect(await candidateManager.authorizedContracts(authorizedContract.address)).to.be.true;
    });

    it("Should allow owner to revoke authorization", async function () {
      await candidateManager.authorizeContract(authorizedContract.address);
      await candidateManager.revokeContractAuthorization(authorizedContract.address);
      expect(await candidateManager.authorizedContracts(authorizedContract.address)).to.be.false;
    });

    it("Should not allow non-owner to authorize contracts", async function () {
      await expect(
        candidateManager.connect(unauthorizedUser).authorizeContract(authorizedContract.address)
      ).to.be.revertedWith("Only the owner can perform this action");
    });
  });

  describe("Adding Candidates", function () {
    it("Should allow owner to add candidates", async function () {
      await candidateManager.addCandidate("Alice");
      expect(await candidateManager.getCandidatesCount()).to.equal(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[0]).to.equal(1); // id
      expect(candidate[1]).to.equal("Alice"); // name
      expect(candidate[2]).to.equal(0); // voteCount
    });

    it("Should emit CandidateAdded event", async function () {
      await expect(candidateManager.addCandidate("Bob"))
        .to.emit(candidateManager, "CandidateAdded")
        .withArgs(1, "Bob");
    });

    it("Should not allow non-owner to add candidates", async function () {
      await expect(
        candidateManager.connect(unauthorizedUser).addCandidate("Charlie")
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should increment candidate count correctly", async function () {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.addCandidate("Charlie");
      
      expect(await candidateManager.getCandidatesCount()).to.equal(3);
    });
  });

  describe("Getting Candidates", function () {
    beforeEach(async function () {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.addCandidate("Charlie");
    });

    it("Should return candidate details correctly", async function () {
      const candidate = await candidateManager.getCandidate(2);
      expect(candidate[0]).to.equal(2); // id
      expect(candidate[1]).to.equal("Bob"); // name
      expect(candidate[2]).to.equal(0); // voteCount
    });

    it("Should return all candidates", async function () {
      const candidates = await candidateManager.getAllCandidates();
      expect(candidates.length).to.equal(3);
      expect(candidates[0][1]).to.equal("Alice");
      expect(candidates[1][1]).to.equal("Bob");
      expect(candidates[2][1]).to.equal("Charlie");
    });

    it("Should revert for invalid candidate ID", async function () {
      await expect(candidateManager.getCandidate(0))
        .to.be.revertedWith("Invalid candidate ID");
      
      await expect(candidateManager.getCandidate(4))
        .to.be.revertedWith("Invalid candidate ID");
    });

    it("Should check if candidate exists", async function () {
      expect(await candidateManager.candidateExists(1)).to.be.true;
      expect(await candidateManager.candidateExists(3)).to.be.true;
      expect(await candidateManager.candidateExists(0)).to.be.false;
      expect(await candidateManager.candidateExists(4)).to.be.false;
    });
  });

  describe("Vote Count Management", function () {
    beforeEach(async function () {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.authorizeContract(authorizedContract.address);
    });

    it("Should allow authorized contracts to update vote count", async function () {
      await candidateManager.connect(authorizedContract).updateCandidateVoteCount(1, 5);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).to.equal(5);
    });

    it("Should allow authorized contracts to increment vote count", async function () {
      await candidateManager.connect(authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(authorizedContract).incrementCandidateVoteCount(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).to.equal(2);
    });

    it("Should emit CandidateVoteCountUpdated event", async function () {
      await expect(candidateManager.connect(authorizedContract).incrementCandidateVoteCount(1))
        .to.emit(candidateManager, "CandidateVoteCountUpdated")
        .withArgs(1, 1);
    });

    it("Should allow authorized contracts to reset all vote counts", async function () {
      // First increment some votes
      await candidateManager.connect(authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(authorizedContract).incrementCandidateVoteCount(2);
      
      // Then reset
      await candidateManager.connect(authorizedContract).resetAllVoteCounts();
      
      const candidate1 = await candidateManager.getCandidate(1);
      const candidate2 = await candidateManager.getCandidate(2);
      expect(candidate1[2]).to.equal(0);
      expect(candidate2[2]).to.equal(0);
    });

    it("Should not allow unauthorized contracts to update vote counts", async function () {
      await expect(
        candidateManager.connect(unauthorizedUser).updateCandidateVoteCount(1, 5)
      ).to.be.revertedWith("Not authorized");
      
      await expect(
        candidateManager.connect(unauthorizedUser).incrementCandidateVoteCount(1)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should revert for invalid candidate ID in vote operations", async function () {
      await expect(
        candidateManager.connect(authorizedContract).updateCandidateVoteCount(0, 5)
      ).to.be.revertedWith("Invalid candidate ID");
      
      await expect(
        candidateManager.connect(authorizedContract).incrementCandidateVoteCount(3)
      ).to.be.revertedWith("Invalid candidate ID");
    });
  });
});
