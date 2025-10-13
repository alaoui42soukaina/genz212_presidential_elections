import { test, expect } from '@playwright/test';
import { ContractTestHelper } from '../test-helpers/contract-test-helper';

test.describe('VotingCore Contract', () => {
  let votingCore: any;
  let candidateManager: any;
  let electionManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    
    // Deploy sub-contracts
    candidateManager = await ContractTestHelper.deployCandidateManager();
    electionManager = await ContractTestHelper.deployElectionManager();
    
    // Deploy VotingCore
    votingCore = await ContractTestHelper.deployVotingCore(
      await candidateManager.getAddress(),
      await electionManager.getAddress()
    );
    
    // Set up authorizations
    await candidateManager.authorizeContract(await votingCore.getAddress());
    await electionManager.authorizeContract(await votingCore.getAddress());
    await votingCore.authorizeContract(signers.authorizedContract.address);
    
    // Add some candidates
    await ContractTestHelper.addTestCandidates(candidateManager, ["Alice", "Bob"]);
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect(await votingCore.owner()).toBe(signers.owner.address);
    });

    test('Should set correct contract references', async () => {
      expect(await votingCore.candidateManager()).toBe(await candidateManager.getAddress());
      expect(await votingCore.electionManager()).toBe(await electionManager.getAddress());
    });

    test('Should authorize the owner by default', async () => {
      expect(await votingCore.authorizedContracts(signers.owner.address)).toBe(true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await votingCore.authorizeContract(signers.authorizedContract.address);
      expect(await votingCore.authorizedContracts(signers.authorizedContract.address)).toBe(true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await votingCore.authorizeContract(signers.authorizedContract.address);
      await votingCore.revokeContractAuthorization(signers.authorizedContract.address);
      expect(await votingCore.authorizedContracts(signers.authorizedContract.address)).toBe(false);
    });

    test('Should not allow non-owner to authorize contracts', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).authorizeContract(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
    });
  });

  test.describe('Voting Functionality', () => {
    test.beforeEach(async () => {
      await electionManager.startElection();
    });

    test('Should allow authorized contracts to vote for users', async () => {
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).toBe(1n); // vote count
      
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
    });

    test('Should emit VoteCast event', async () => {
      await ContractTestHelper.expectEvent(
        votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address),
        votingCore,
        "VoteCast",
        [signers.voter1.address, 1, 1]
      );
    });

    test('Should allow direct voting (backward compatibility)', async () => {
      await votingCore.connect(signers.voter1).voteDirect(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).toBe(1n);
      
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
    });

    test('Should not allow voting when election is not active', async () => {
      await electionManager.endElection();
      
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address),
        "Election is not active"
      );
    });

    test('Should not allow voting for invalid candidate', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.authorizedContract).vote(0, signers.voter1.address),
        "Invalid candidate ID"
      );
      
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.authorizedContract).vote(3, signers.voter1.address),
        "Invalid candidate ID"
      );
    });

    test('Should not allow voting twice in same round', async () => {
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.authorizedContract).vote(2, signers.voter1.address),
        "You have already voted in this election"
      );
    });

    test('Should not allow unauthorized contracts to vote', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).vote(1, signers.voter1.address),
        "Not authorized"
      );
    });

    test('Should allow voting in different rounds', async () => {
      // Vote in round 1
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to vote again in new round
      await votingCore.connect(signers.authorizedContract).vote(2, signers.voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
    });
  });

  test.describe('Voter Status Checks', () => {
    test.beforeEach(async () => {
      await electionManager.startElection();
    });

    test('Should correctly check if voter has voted', async () => {
      expect(await votingCore.checkVoted(signers.voter1.address)).toBe(false);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect(await votingCore.checkVoted(signers.voter1.address)).toBe(true);
    });

    test('Should correctly check if voter can vote', async () => {
      expect(await votingCore.canVote(signers.voter1.address)).toBe(true);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect(await votingCore.canVote(signers.voter1.address)).toBe(false);
    });

    test('Should return correct voter election round', async () => {
      expect(await votingCore.getVoterElectionRound(signers.voter1.address)).toBe(0n);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect(await votingCore.getVoterElectionRound(signers.voter1.address)).toBe(1n);
    });

    test('Should return current election round', async () => {
      expect(await votingCore.getCurrentElectionRound()).toBe(1n);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect(await votingCore.getCurrentElectionRound()).toBe(2n);
    });

    test('Should check election status', async () => {
      expect(await votingCore.isElectionActive()).toBe(true);
      
      await electionManager.endElection();
      expect(await votingCore.isElectionActive()).toBe(false);
    });
  });

  test.describe('Candidate Information', () => {
    test('Should get candidate details', async () => {
      const candidate = await votingCore.getCandidate(1);
      expect(candidate[0]).toBe(1n); // id
      expect(candidate[1]).toBe("Alice"); // name
      expect(candidate[2]).toBe(0n); // voteCount
    });

    test('Should get all candidates', async () => {
      const candidates = await votingCore.getAllCandidates();
      expect(candidates.length).toBe(2);
      expect(candidates[0][1]).toBe("Alice");
      expect(candidates[1][1]).toBe("Bob");
    });

    test('Should get candidates count', async () => {
      expect(await votingCore.getCandidatesCount()).toBe(2n);
    });

    test('Should check if candidate exists', async () => {
      expect(await votingCore.candidateExists(1)).toBe(true);
      expect(await votingCore.candidateExists(2)).toBe(true);
      expect(await votingCore.candidateExists(0)).toBe(false);
      expect(await votingCore.candidateExists(3)).toBe(false);
    });
  });

  test.describe('Voting Statistics', () => {
    test.beforeEach(async () => {
      await electionManager.startElection();
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter2.address);
    });

    test('Should return correct voting statistics', async () => {
      const [totalCandidates, currentRound, isActive, totalVotes] = await votingCore.getVotingStats();
      
      expect(totalCandidates).toBe(2n);
      expect(currentRound).toBe(1n);
      expect(isActive).toBe(true);
      expect(totalVotes).toBe(2n);
    });
  });

  test.describe('Admin Functions', () => {
    test('Should allow owner to invalidate votes', async () => {
      await ContractTestHelper.expectEvent(
        votingCore.invalidateVote(signers.voter1.address, "Test reason"),
        votingCore,
        "VoteInvalidated",
        [signers.voter1.address, "Test reason"]
      );
    });

    test('Should not allow non-owner to invalidate votes', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).invalidateVote(signers.voter1.address, "Test reason"),
        "Only the owner can perform this action"
      );
    });

    test('Should allow authorized contracts to reset voting data', async () => {
      await electionManager.startElection();
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      
      // Check vote count before reset
      const candidateBefore = await candidateManager.getCandidate(1);
      expect(candidateBefore[2]).toBe(1n);
      
      // Reset voting data
      await votingCore.connect(signers.authorizedContract).resetVotingData();
      
      // Check vote count after reset
      const candidateAfter = await candidateManager.getCandidate(1);
      expect(candidateAfter[2]).toBe(0n);
    });

    test('Should not allow unauthorized contracts to reset voting data', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).resetVotingData(),
        "Not authorized"
      );
    });

    test('Should allow owner to update contract references', async () => {
      // Deploy new contracts
      const newCandidateManager = await ContractTestHelper.deployCandidateManager();
      const newElectionManager = await ContractTestHelper.deployElectionManager();
      
      // Update references
      await votingCore.updateCandidateManager(await newCandidateManager.getAddress());
      await votingCore.updateElectionManager(await newElectionManager.getAddress());
      
      expect(await votingCore.candidateManager()).toBe(await newCandidateManager.getAddress());
      expect(await votingCore.electionManager()).toBe(await newElectionManager.getAddress());
    });

    test('Should not allow non-owner to update contract references', async () => {
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).updateCandidateManager(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
      
      await ContractTestHelper.expectRevert(
        votingCore.connect(signers.unauthorizedUser).updateElectionManager(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
    });
  });
});