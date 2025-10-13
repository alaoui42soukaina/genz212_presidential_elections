import { test, expect } from '@playwright/test';
import { ContractTestHelper } from '../test-helpers/contract-test-helper';

test.describe('ElectionManager Contract', () => {
  let electionManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    electionManager = await ContractTestHelper.deployElectionManager();
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect(await electionManager.owner()).toBe(signers.owner.address);
    });

    test('Should initialize with election inactive', async () => {
      expect(await electionManager.isElectionActive()).toBe(false);
    });

    test('Should initialize with round 0', async () => {
      expect(await electionManager.getCurrentElectionRound()).toBe(0n);
    });

    test('Should authorize the owner by default', async () => {
      expect(await electionManager.authorizedContracts(signers.owner.address)).toBe(true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      expect(await electionManager.authorizedContracts(signers.authorizedContract.address)).toBe(true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.revokeContractAuthorization(signers.authorizedContract.address);
      expect(await electionManager.authorizedContracts(signers.authorizedContract.address)).toBe(false);
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
      expect(await electionManager.isElectionActive()).toBe(true);
      expect(await electionManager.getCurrentElectionRound()).toBe(1n);
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
      expect(await electionManager.isElectionActive()).toBe(false);
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
      expect(await electionManager.getCurrentElectionRound()).toBe(1n);
      
      await electionManager.endElection();
      await electionManager.startElection();
      expect(await electionManager.getCurrentElectionRound()).toBe(2n);
    });
  });

  test.describe('Voter Registration', () => {
    test.beforeEach(async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.startElection();
    });

    test('Should allow authorized contracts to register voters', async () => {
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
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
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
      
      // End and start new round
      await electionManager.endElection();
      await electionManager.startElection();
      
      // Should be able to register again in new round
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
    });
  });

  test.describe('Voter Status Checks', () => {
    test.beforeEach(async () => {
      await electionManager.authorizeContract(signers.authorizedContract.address);
      await electionManager.startElection();
    });

    test('Should correctly check if voter has voted in current round', async () => {
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(false);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect(await electionManager.hasVotedInCurrentRound(signers.voter1.address)).toBe(true);
    });

    test('Should return correct voter election round', async () => {
      expect(await electionManager.getVoterElectionRound(signers.voter1.address)).toBe(0n);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect(await electionManager.getVoterElectionRound(signers.voter1.address)).toBe(1n);
    });

    test('Should correctly check if voter can vote', async () => {
      expect(await electionManager.canVote(signers.voter1.address)).toBe(true);
      
      await electionManager.connect(signers.authorizedContract).registerVoter(signers.voter1.address);
      expect(await electionManager.canVote(signers.voter1.address)).toBe(false);
    });

    test('Should not allow voting when election is not active', async () => {
      await electionManager.endElection();
      expect(await electionManager.canVote(signers.voter1.address)).toBe(false);
    });

    test('Should return 0 for total voters in current round', async () => {
      // This function is not fully implemented, so it should return 0
      expect(await electionManager.getTotalVotersInCurrentRound()).toBe(0n);
    });
  });
});