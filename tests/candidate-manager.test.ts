import { test, expect } from '@playwright/test';
import { ContractTestHelper } from '../test-helpers/contract-test-helper';

test.describe('CandidateManager Contract', () => {
  let candidateManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    candidateManager = await ContractTestHelper.deployCandidateManager();
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect(await candidateManager.owner()).toBe(signers.owner.address);
    });

    test('Should initialize with zero candidates', async () => {
      expect(await candidateManager.getCandidatesCount()).toBe(0n);
    });

    test('Should authorize the owner by default', async () => {
      expect(await candidateManager.authorizedContracts(signers.owner.address)).toBe(true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await candidateManager.authorizeContract(signers.authorizedContract.address);
      expect(await candidateManager.authorizedContracts(signers.authorizedContract.address)).toBe(true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await candidateManager.authorizeContract(signers.authorizedContract.address);
      await candidateManager.revokeContractAuthorization(signers.authorizedContract.address);
      expect(await candidateManager.authorizedContracts(signers.authorizedContract.address)).toBe(false);
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
      expect(await candidateManager.getCandidatesCount()).toBe(1n);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[0]).toBe(1n); // id
      expect(candidate[1]).toBe("Alice"); // name
      expect(candidate[2]).toBe(0n); // voteCount
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
      
      expect(await candidateManager.getCandidatesCount()).toBe(3n);
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
      expect(candidate[0]).toBe(2n); // id
      expect(candidate[1]).toBe("Bob"); // name
      expect(candidate[2]).toBe(0n); // voteCount
    });

    test('Should return all candidates', async () => {
      const candidates = await candidateManager.getAllCandidates();
      expect(candidates.length).toBe(3);
      expect(candidates[0][1]).toBe("Alice");
      expect(candidates[1][1]).toBe("Bob");
      expect(candidates[2][1]).toBe("Charlie");
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
      expect(await candidateManager.candidateExists(1)).toBe(true);
      expect(await candidateManager.candidateExists(3)).toBe(true);
      expect(await candidateManager.candidateExists(0)).toBe(false);
      expect(await candidateManager.candidateExists(4)).toBe(false);
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
      expect(candidate[2]).toBe(5n);
    });

    test('Should allow authorized contracts to increment vote count', async () => {
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      
      const candidate = await candidateManager.getCandidate(1);
      expect(candidate[2]).toBe(2n);
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
      expect(candidate1[2]).toBe(0n);
      expect(candidate2[2]).toBe(0n);
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