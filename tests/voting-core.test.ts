import { test } from '@playwright/test';
import { ContractTestHelper, expect } from '../test-helpers/contract-test-helper';

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
      expect.toBe(await votingCore.owner(), signers.owner.address);
    });

    test('Should set correct contract references', async () => {
      expect.toBe(await votingCore.candidateManager(), await candidateManager.getAddress());
      expect.toBe(await votingCore.electionManager(), await electionManager.getAddress());
    });

    test('Should authorize the owner by default', async () => {
      expect.toBe(await votingCore.authorizedContracts(signers.owner.address), true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await votingCore.authorizeContract(signers.authorizedContract.address);
      expect.toBe(await votingCore.authorizedContracts(signers.authorizedContract.address), true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await votingCore.authorizeContract(signers.authorizedContract.address);
      await votingCore.revokeContractAuthorization(signers.authorizedContract.address);
      expect.toBe(await votingCore.authorizedContracts(signers.authorizedContract.address), false);
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
      expect.toBe(candidate[2], 1); // vote count
      
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
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
      expect.toBe(candidate[2], 1);
      
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
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
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to vote again in new round
      await votingCore.connect(signers.authorizedContract).vote(2, signers.voter1.address);
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
    });
  });

  test.describe('Voter Status Checks', () => {
    test.beforeEach(async () => {
      await electionManager.startElection();
    });

    test('Should correctly check if voter has voted', async () => {
      expect.toBe(await votingCore.checkVoted(signers.voter1.address), false);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect.toBe(await votingCore.checkVoted(signers.voter1.address), true);
    });

    test('Should correctly check if voter can vote', async () => {
      expect.toBe(await votingCore.canVote(signers.voter1.address), true);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect.toBe(await votingCore.canVote(signers.voter1.address), false);
    });

    test('Should return correct voter election round', async () => {
      expect.toBe(await votingCore.getVoterElectionRound(signers.voter1.address), 0);
      
      await votingCore.connect(signers.authorizedContract).vote(1, signers.voter1.address);
      expect.toBe(await votingCore.getVoterElectionRound(signers.voter1.address), 1);
    });

    test('Should return current election round', async () => {
      expect.toBe(await votingCore.getCurrentElectionRound(), 1);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect.toBe(await votingCore.getCurrentElectionRound(), 2);
    });

    test('Should check election status', async () => {
      expect.toBe(await votingCore.isElectionActive(), true);
      
      await electionManager.endElection();
      expect.toBe(await votingCore.isElectionActive(), false);
    });
  });

  test.describe('Candidate Information', () => {
    test('Should get candidate details', async () => {
      const candidate = await votingCore.getCandidate(1);
      expect.toBe(candidate[0], 1); // id
      expect.toBe(candidate[1], "Alice"); // name
      expect.toBe(candidate[2], 0); // voteCount
    });

    test('Should get all candidates', async () => {
      const candidates = await votingCore.getAllCandidates();
      expect.toBe(candidates.length, 2);
      expect.toBe(candidates[0][1], "Alice");
      expect.toBe(candidates[1][1], "Bob");
    });

    test('Should get candidates count', async () => {
      expect.toBe(await votingCore.getCandidatesCount(), 2);
    });

    test('Should check if candidate exists', async () => {
      expect.toBe(await votingCore.candidateExists(1), true);
      expect.toBe(await votingCore.candidateExists(2), true);
      expect.toBe(await votingCore.candidateExists(0), false);
      expect.toBe(await votingCore.candidateExists(3), false);
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
      
      expect.toBe(totalCandidates, 2);
      expect.toBe(currentRound, 1);
      expect.toBe(isActive, true);
      expect.toBe(totalVotes, 2);
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
      expect.toBe(candidateBefore[2], 1);
      
      // Reset voting data
      await votingCore.connect(signers.authorizedContract).resetVotingData();
      
      // Check vote count after reset
      const candidateAfter = await candidateManager.getCandidate(1);
      expect.toBe(candidateAfter[2], 0);
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
      
      expect.toBe(await votingCore.candidateManager(), await newCandidateManager.getAddress());
      expect.toBe(await votingCore.electionManager(), await newElectionManager.getAddress());
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