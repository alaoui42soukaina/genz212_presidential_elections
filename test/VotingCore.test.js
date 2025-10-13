const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContract, addCandidates } = require("./helpers/testHelpers");

describe("VotingCore Contract", function () {
  let votingCore;
  let candidateManager;
  let electionManager;
  let owner;
  let authorizedContract;
  let unauthorizedUser;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, authorizedContract, unauthorizedUser, voter1, voter2] = await ethers.getSigners();
    
    // Deploy sub-contracts
    candidateManager = await deployContract("CandidateManager");
    electionManager = await deployContract("ElectionManager");
    
    // Deploy VotingCore
    votingCore = await deployContract("VotingCore", [
      await candidateManager.getAddress(),
      await electionManager.getAddress()
    ]);
    
    // Set up authorizations
    await candidateManager.authorizeContract(await votingCore.getAddress());
    await electionManager.authorizeContract(await votingCore.getAddress());
    await votingCore.authorizeContract(authorizedContract.address);
    
    // Add some candidates
    await addCandidates(candidateManager, ["Alice", "Bob"]);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await votingCore.owner()).to.equal(owner.address);
    });

    it("Should set correct contract references", async function () {
      expect(await votingCore.candidateManager()).to.equal(await candidateManager.getAddress());
      expect(await votingCore.electionManager()).to.equal(await electionManager.getAddress());
    });

    it("Should authorize the owner by default", async function () {
      expect(await votingCore.authorizedContracts(owner.address)).to.be.true;
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to authorize contracts", async function () {
      await votingCore.authorizeContract(authorizedContract.address);
      expect(await votingCore.authorizedContracts(authorizedContract.address)).to.be.true;
    });

    it("Should allow owner to revoke authorization", async function () {
      await votingCore.authorizeContract(authorizedContract.address);
      await votingCore.revokeContractAuthorization(authorizedContract.address);
      expect(await votingCore.authorizedContracts(authorizedContract.address)).to.be.false;
    });

    it("Should not allow non-owner to authorize contracts", async function () {
      await expect(
        votingCore.connect(unauthorizedUser).authorizeContract(authorizedContract.address)
      ).to.be.revertedWith("Only the owner can perform this action");
    });
  });

  describe("Voting Functionality", function () {
    beforeEach(async function () {
      await electionManager.startElection();
    });

    it("Should allow authorized contracts to vote for users", async function () {
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).to.equal(1); // vote count
      
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });

    it("Should emit VoteCast event", async function () {
      await expect(votingCore.connect(authorizedContract).vote(1, voter1.address))
        .to.emit(votingCore, "VoteCast")
        .withArgs(voter1.address, 1, 1);
    });

    it("Should allow direct voting (backward compatibility)", async function () {
      await votingCore.connect(voter1).voteDirect(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).to.equal(1);
      
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });

    it("Should not allow voting when election is not active", async function () {
      await electionManager.endElection();
      
      await expect(
        votingCore.connect(authorizedContract).vote(1, voter1.address)
      ).to.be.revertedWith("Election is not active");
    });

    it("Should not allow voting for invalid candidate", async function () {
      await expect(
        votingCore.connect(authorizedContract).vote(0, voter1.address)
      ).to.be.revertedWith("Invalid candidate ID");
      
      await expect(
        votingCore.connect(authorizedContract).vote(3, voter1.address)
      ).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should not allow voting twice in same round", async function () {
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      
      await expect(
        votingCore.connect(authorizedContract).vote(2, voter1.address)
      ).to.be.revertedWith("You have already voted in this election");
    });

    it("Should not allow unauthorized contracts to vote", async function () {
      await expect(
        votingCore.connect(unauthorizedUser).vote(1, voter1.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should allow voting in different rounds", async function () {
      // Vote in round 1
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to vote again in new round
      await votingCore.connect(authorizedContract).vote(2, voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(voter1.address)).to.be.true;
    });
  });

  describe("Voter Status Checks", function () {
    beforeEach(async function () {
      await electionManager.startElection();
    });

    it("Should correctly check if voter has voted", async function () {
      expect(await votingCore.checkVoted(voter1.address)).to.be.false;
      
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      expect(await votingCore.checkVoted(voter1.address)).to.be.true;
    });

    it("Should correctly check if voter can vote", async function () {
      expect(await votingCore.canVote(voter1.address)).to.be.true;
      
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      expect(await votingCore.canVote(voter1.address)).to.be.false;
    });

    it("Should return correct voter election round", async function () {
      expect(await votingCore.getVoterElectionRound(voter1.address)).to.equal(0);
      
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      expect(await votingCore.getVoterElectionRound(voter1.address)).to.equal(1);
    });

    it("Should return current election round", async function () {
      expect(await votingCore.getCurrentElectionRound()).to.equal(1);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect(await votingCore.getCurrentElectionRound()).to.equal(2);
    });

    it("Should check election status", async function () {
      expect(await votingCore.isElectionActive()).to.be.true;
      
      await electionManager.endElection();
      expect(await votingCore.isElectionActive()).to.be.false;
    });
  });

  describe("Candidate Information", function () {
    it("Should get candidate details", async function () {
      const candidate = await votingCore.getCandidate(1);
      expect(candidate[0]).to.equal(1); // id
      expect(candidate[1]).to.equal("Alice"); // name
      expect(candidate[2]).to.equal(0); // voteCount
    });

    it("Should get all candidates", async function () {
      const candidates = await votingCore.getAllCandidates();
      expect(candidates.length).to.equal(2);
      expect(candidates[0][1]).to.equal("Alice");
      expect(candidates[1][1]).to.equal("Bob");
    });

    it("Should get candidates count", async function () {
      expect(await votingCore.getCandidatesCount()).to.equal(2);
    });

    it("Should check if candidate exists", async function () {
      expect(await votingCore.candidateExists(1)).to.be.true;
      expect(await votingCore.candidateExists(2)).to.be.true;
      expect(await votingCore.candidateExists(0)).to.be.false;
      expect(await votingCore.candidateExists(3)).to.be.false;
    });
  });

  describe("Voting Statistics", function () {
    beforeEach(async function () {
      await electionManager.startElection();
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      await votingCore.connect(authorizedContract).vote(1, voter2.address);
    });

    it("Should return correct voting statistics", async function () {
      const [totalCandidates, currentRound, isActive, totalVotes] = await votingCore.getVotingStats();
      
      expect(totalCandidates).to.equal(2);
      expect(currentRound).to.equal(1);
      expect(isActive).to.be.true;
      expect(totalVotes).to.equal(2);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to invalidate votes", async function () {
      await expect(votingCore.invalidateVote(voter1.address, "Test reason"))
        .to.emit(votingCore, "VoteInvalidated")
        .withArgs(voter1.address, "Test reason");
    });

    it("Should not allow non-owner to invalidate votes", async function () {
      await expect(
        votingCore.connect(unauthorizedUser).invalidateVote(voter1.address, "Test reason")
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should allow authorized contracts to reset voting data", async function () {
      await electionManager.startElection();
      await votingCore.connect(authorizedContract).vote(1, voter1.address);
      
      // Check vote count before reset
      const candidateBefore = await candidateManager.getCandidate(1);
      expect(candidateBefore[2]).to.equal(1);
      
      // Reset voting data
      await votingCore.connect(authorizedContract).resetVotingData();
      
      // Check vote count after reset
      const candidateAfter = await candidateManager.getCandidate(1);
      expect(candidateAfter[2]).to.equal(0);
    });

    it("Should not allow unauthorized contracts to reset voting data", async function () {
      await expect(
        votingCore.connect(unauthorizedUser).resetVotingData()
      ).to.be.revertedWith("Not authorized");
    });

    it("Should allow owner to update contract references", async function () {
      // Deploy new contracts
      const newCandidateManager = await deployContract("CandidateManager");
      const newElectionManager = await deployContract("ElectionManager");
      
      // Update references
      await votingCore.updateCandidateManager(await newCandidateManager.getAddress());
      await votingCore.updateElectionManager(await newElectionManager.getAddress());
      
      expect(await votingCore.candidateManager()).to.equal(await newCandidateManager.getAddress());
      expect(await votingCore.electionManager()).to.equal(await newElectionManager.getAddress());
    });

    it("Should not allow non-owner to update contract references", async function () {
      await expect(
        votingCore.connect(unauthorizedUser).updateCandidateManager(authorizedContract.address)
      ).to.be.revertedWith("Only the owner can perform this action");
      
      await expect(
        votingCore.connect(unauthorizedUser).updateElectionManager(authorizedContract.address)
      ).to.be.revertedWith("Only the owner can perform this action");
    });
  });
});
