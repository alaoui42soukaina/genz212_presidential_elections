import { test } from '@playwright/test';
import { ContractTestHelper, expect } from '../test-helpers/contract-test-helper';

test.describe('ElectionManager Contract', () => {
  let electionManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    electionManager = await ContractTestHelper.deployElectionManager();
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect.toBe(await electionManager.owner(), signers.owner.address);
    });

    test('Should initialize with election inactive', async () => {
      expect.toBe(await electionManager.isElectionActive(), false);
    });

    test('Should initialize with round 0', async () => {
      expect.toBe(await electionManager.getCurrentElectionRound(), 0);
    });

    test('Should authorize the owner by default', async () => {
      expect.toBe(await electionManager.authorizedContracts(signers.owner.address), true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      expect.toBe(await electionManager.authorizedContracts(signers.authorizedContract.address), true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.revokeContractAuthorization(signers.authorizedContract.address);
      expect.toBe(await electionManager.authorizedContracts(signers.authorizedContract.address), false);
    });

    test('Should not allow non-owner to authorize contracts', async () => {
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.unauthorizedUser).authorizeContract(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
    });
  });

  test.describe('Election Lifecycle', () => {
    test('Should allow owner to start election', async () => {
      await electionManager.startElection();
      expect.toBe(await electionManager.isElectionActive(), true);
      expect.toBe(await electionManager.getCurrentElectionRound(), 1);
    });

    test('Should emit ElectionStarted event', async () => {
      await ContractTestHelper.expectEvent(
        electionManager.startElection(),
        electionManager,
        "ElectionStarted",
        [1]
      );
    });

    test('Should not allow starting election when already active', async () => {
      await electionManager.startElection();
      await ContractTestHelper.expectRevert(
        electionManager.startElection(),
        "Election is already active"
      );
    });

    test('Should not allow non-owner to start election', async () => {
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.unauthorizedUser).startElection(),
        "Only the owner can perform this action"
      );
    });

    test('Should allow owner to end election', async () => {
      await electionManager.startElection();
      await electionManager.endElection();
      expect.toBe(await electionManager.isElectionActive(), false);
    });

    test('Should emit ElectionStopped event', async () => {
      await electionManager.startElection();
      await ContractTestHelper.expectEvent(
        electionManager.endElection(),
        electionManager,
        "ElectionStopped"
      );
    });

    test('Should not allow ending election when not active', async () => {
      await ContractTestHelper.expectRevert(
        electionManager.endElection(),
        "Election is not active"
      );
    });

    test('Should not allow non-owner to end election', async () => {
      await electionManager.startElection();
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.unauthorizedUser).endElection(),
        "Only the owner can perform this action"
      );
    });

    test('Should increment election round on each start', async () => {
      await electionManager.startElection();
      expect.toBe(await electionManager.getCurrentElectionRound(), 1);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect.toBe(await electionManager.getCurrentElectionRound(), 2);
    });
  });

  test.describe('Voter Registration', () => {
    test.beforeEach(async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.startElection();
    });

    test('Should allow authorized contracts to register voters', async () => {
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
    });

    test('Should emit VoterRegistered event', async () => {
      await ContractTestHelper.expectEvent(
        electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address),
        electionManager,
        "VoterRegistered",
        [signers.voter1.address, 1]
      );
    });

    test('Should not allow registering same voter twice in same round', async () => {
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address),
        "Voter already registered for this round"
      );
    });

    test('Should not allow unauthorized contracts to register voters', async () => {
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.unauthorizedUser).registerVoter(signers.voter1.address),
        "Not authorized"
      );
    });

    test('Should not allow registering voters when election is not active', async () => {
      await electionManager.endElection();
      await ContractTestHelper.expectRevert(
        electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address),
        "Election is not active"
      );
    });

    test('Should allow registering voters in different rounds', async () => {
      // Register in round 1
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to register again in new round
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
    });
  });

  test.describe('Voter Status Checks', () => {
    test.beforeEach(async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.startElection();
    });

    test('Should correctly check if voter has voted in current round', async () => {
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), false);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address), true);
    });

    test('Should return correct voter election round', async () => {
      expect.toBe(await electionManager.getVoterElectionRound(signers.voter1.address), 0);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.getVoterElectionRound(signers.voter1.address), 1);
    });

    test('Should correctly check if voter can vote', async () => {
      expect.toBe(await electionManager.canVote(signers.voter1.address), true);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect.toBe(await electionManager.canVote(signers.voter1.address), false);
    });

    test('Should not allow voting when election is not active', async () => {
      await electionManager.endElection();
      expect.toBe(await electionManager.canVote(signers.voter1.address), false);
    });

    test('Should return 0 for total voters in current round', async () => {
      // This function is not fully implemented, so it should return 0
      expect.toBe(await electionManager.getTotalVotersInCurrentRound(), 0);
    });
  });
});