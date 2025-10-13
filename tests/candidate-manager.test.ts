import { test } from '@playwright/test';
import { ContractTestHelper, expect } from '../test-helpers/contract-test-helper';

test.describe('CandidateManager Contract', () => {
  let candidateManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    candidateManager = await ContractTestHelper.deployCandidateManager();
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect.toBe(await candidateManager.owner(), signers.owner.address);
    });

    test('Should initialize with zero candidates', async () => {
      expect.toBe(await candidateManager.getCandidatesCount(), 0);
    });

    test('Should authorize the owner by default', async () => {
      expect.toBe(await candidateManager.authorizedContracts(signers.owner.address), true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await candidateManager.authorizeContract(signers.authorizedContract.address);
      expect.toBe(await candidateManager.authorizedContracts(signers.authorizedContract.address), true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await candidateManager.authorizeContract(signers.authorizedContract.address);
      await candidateManager.revokeContractAuthorization(signers.authorizedContract.address);
      expect.toBe(await candidateManager.authorizedContracts(signers.authorizedContract.address), false);
    });

    test('Should not allow non-owner to authorize contracts', async () => {
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.unauthorizedUser).authorizeContract(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
    });
  });

  test.describe('Adding Candidates', () => {
    test('Should allow owner to add candidates', async () => {
      await candidateManager.addCandidate("Alice");
      expect.toBe(await candidateManager.getCandidatesCount(), 1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect.toBe(candidate[0], 1); // id
      expect.toBe(candidate[1], "Alice"); // name
      expect.toBe(candidate[2], 0); // voteCount
    });

    test('Should emit CandidateAdded event', async () => {
      await ContractTestHelper.expectEvent(
        candidateManager.addCandidate("Bob"),
        candidateManager,
        "CandidateAdded",
        [1, "Bob"]
      );
    });

    test('Should not allow non-owner to add candidates', async () => {
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.unauthorizedUser).addCandidate("Charlie"),
        "Only the owner can perform this action"
      );
    });

    test('Should increment candidate count correctly', async () => {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.addCandidate("Charlie");
      
      expect.toBe(await candidateManager.getCandidatesCount(), 3);
    });
  });

  test.describe('Getting Candidates', () => {
    test.beforeEach(async () => {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.addCandidate("Charlie");
    });

    test('Should return candidate details correctly', async () => {
      const candidate = await candidateManager.getCandidate(2);
      expect.toBe(candidate[0], 2); // id
      expect.toBe(candidate[1], "Bob"); // name
      expect.toBe(candidate[2], 0); // voteCount
    });

    test('Should return all candidates', async () => {
      const candidates = await candidateManager.getAllCandidates();
      expect.toBe(candidates.length, 3);
      expect.toBe(candidates[0][1], "Alice");
      expect.toBe(candidates[1][1], "Bob");
      expect.toBe(candidates[2][1], "Charlie");
    });

    test('Should revert for invalid candidate ID', async () => {
      await ContractTestHelper.expectRevert(
        candidateManager.getCandidate(0),
        "Invalid candidate ID"
      );
      
      await ContractTestHelper.expectRevert(
        candidateManager.getCandidate(4),
        "Invalid candidate ID"
      );
    });

    test('Should check if candidate exists', async () => {
      expect.toBe(await candidateManager.candidateExists(1), true);
      expect.toBe(await candidateManager.candidateExists(3), true);
      expect.toBe(await candidateManager.candidateExists(0), false);
      expect.toBe(await candidateManager.candidateExists(4), false);
    });
  });

  test.describe('Vote Count Management', () => {
    test.beforeEach(async () => {
      await candidateManager.addCandidate("Alice");
      await candidateManager.addCandidate("Bob");
      await candidateManager.authorizeContract(signers.authorizedContract.address);
    });

    test('Should allow authorized contracts to update vote count', async () => {
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 5);
      
      const candidate = await candidateManager.getCandidate(1);
      expect.toBe(candidate[2], 5);
    });

    test('Should allow authorized contracts to increment vote count', async () => {
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect.toBe(candidate[2], 2);
    });

    test('Should emit CandidateVoteCountUpdated event', async () => {
      await ContractTestHelper.expectEvent(
        candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1),
        candidateManager,
        "CandidateVoteCountUpdated",
        [1, 1]
      );
    });

    test('Should allow authorized contracts to reset all vote counts', async () => {
      // First increment some votes
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(2);
      
      // Then reset
      await candidateManager.connect(signers.authorizedContract).resetAllVoteCounts();
      
      const candidate1 = await candidateManager.getCandidate(1);
      const candidate2 = await candidateManager.getCandidate(2);
      expect.toBe(candidate1[2], 0);
      expect.toBe(candidate2[2], 0);
    });

    test('Should not allow unauthorized contracts to update vote counts', async () => {
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.unauthorizedUser).updateCandidateVoteCount(1, 5),
        "Not authorized"
      );
      
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.unauthorizedUser).incrementCandidateVoteCount(1),
        "Not authorized"
      );
    });

    test('Should revert for invalid candidate ID in vote operations', async () => {
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(0, 5),
        "Invalid candidate ID"
      );
      
      await ContractTestHelper.expectRevert(
        candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(3),
        "Invalid candidate ID"
      );
    });
  });
});