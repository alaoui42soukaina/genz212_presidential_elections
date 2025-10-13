const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContract } = require("./helpers/testHelpers");

describe("ElectionManager Contract", function () {
  let electionManager;
  let owner;
  let authorizedContract;
  let unauthorizedUser;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, authorizedContract, unauthorizedUser, voter1, voter2] = await ethers.getSigners();
    
    electionManager = await deployContract("ElectionManager");
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await electionManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with election inactive", async function () {
      expect(await electionManager.isElectionActive()).to.be.false;
    });

    it("Should initialize with round 0", async function () {
      expect(await electionManager.getCurrentElectionRound()).to.equal(0);
    });

    it("Should authorize the owner by default", async function () {
      expect(await electionManager.authorizedContracts(owner.address)).to.be.true;
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to authorize contracts", async function () {
      await electionManager.authorizeContract(authorizedContract.address);
      expect(await electionManager.authorizedContracts(authorizedContract.address)).to.be.true;
    });

    it("Should allow owner to revoke authorization", async function () {
      await electionManager.authorizeContract(authorizedContract.address);
      await electionManager.revokeContractAuthorization(authorizedContract.address);
      expect(await electionManager.authorizedContracts(authorizedContract.address)).to.be.false;
    });

    it("Should not allow non-owner to authorize contracts", async function () {
      await expect(
        electionManager.connect(unauthorizedUser).authorizeContract(authorizedContract.address)
      ).to.be.revertedWith("Only the owner can perform this action");
    });
  });

  describe("Election Lifecycle", function () {
    it("Should allow owner to start election", async function () {
      await electionManager.startElection();
      expect(await electionManager.isElectionActive()).to.be.true;
      expect(await electionManager.getCurrentElectionRound()).to.equal(1);
    });

    it("Should emit ElectionStarted event", async function () {
      await expect(electionManager.startElection())
        .to.emit(electionManager, "ElectionStarted")
        .withArgs(1);
    });

    it("Should not allow starting election when already active", async function () {
      await electionManager.startElection();
      await expect(electionManager.startElection())
        .to.be.revertedWith("Election is already active");
    });

    it("Should not allow non-owner to start election", async function () {
      await expect(
        electionManager.connect(unauthorizedUser).startElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should allow owner to end election", async function () {
      await electionManager.startElection();
      await electionManager.endElection();
      expect(await electionManager.isElectionActive()).to.be.false;
    });

    it("Should emit ElectionStopped event", async function () {
      await electionManager.startElection();
      await expect(electionManager.endElection())
        .to.emit(electionManager, "ElectionStopped");
    });

    it("Should not allow ending election when not active", async function () {
      await expect(electionManager.endElection())
        .to.be.revertedWith("Election is not active");
    });

    it("Should not allow non-owner to end election", async function () {
      await electionManager.startElection();
      await expect(
        electionManager.connect(unauthorizedUser).endElection()
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should increment election round on each start", async function () {
      await electionManager.startElection();
      expect(await electionManager.getCurrentElectionRound()).to.equal(1);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect(await electionManager.getCurrentElectionRound()).to.equal(2);
    });
  });

  describe("Voter Registration", function () {
    beforeEach(async function () {
      await electionManager.authorizeContract(authorizedContract.address);
      await electionManager.startElection();
    });

    it("Should allow authorized contracts to register voters", async function () {
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });

    it("Should emit VoterRegistered event", async function () {
      await expect(electionManager.connect(authorizedContract).registerVoter(voter1.address))
        .to.emit(electionManager, "VoterRegistered")
        .withArgs(voter1.address, 1);
    });

    it("Should not allow registering same voter twice in same round", async function () {
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      await expect(
        electionManager.connect(authorizedContract).registerVoter(voter1.address)
      ).to.be.revertedWith("Voter already registered for this round");
    });

    it("Should not allow unauthorized contracts to register voters", async function () {
      await expect(
        electionManager.connect(unauthorizedUser).registerVoter(voter1.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should not allow registering voters when election is not active", async function () {
      await electionManager.endElection();
      await expect(
        electionManager.connect(authorizedContract).registerVoter(voter1.address)
      ).to.be.revertedWith("Election is not active");
    });

    it("Should allow registering voters in different rounds", async function () {
      // Register in round 1
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to register again in new round
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });
  });

  describe("Voter Status Checks", function () {
    beforeEach(async function () {
      await electionManager.authorizeContract(authorizedContract.address);
      await electionManager.startElection();
    });

    it("Should correctly check if voter has voted in current round", async function () {
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.false;
      
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });

    it("Should return correct voter election round", async function () {
      expect(await electionManager.getVoterElectionRound(voter1.address)).to.equal(0);
      
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.getVoterElectionRound(voter1.address)).to.equal(1);
    });

    it("Should correctly check if voter can vote", async function () {
      expect(await electionManager.canVote(voter1.address)).to.be.true;
      
      await electionManager.connect(authorizedContract).registerVoter(voter1.address);
      expect(await electionManager.canVote(voter1.address)).to.be.false;
    });

    it("Should not allow voting when election is not active", async function () {
      await electionManager.endElection();
      expect(await electionManager.canVote(voter1.address)).to.be.false;
    });

    it("Should return 0 for total voters in current round", async function () {
      // This function is not fully implemented, so it should return 0
      expect(await electionManager.getTotalVotersInCurrentRound()).to.equal(0);
    });
  });
});
