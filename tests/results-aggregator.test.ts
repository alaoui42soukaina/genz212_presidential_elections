import { test, expect } from '@playwright/test';
import { ContractTestHelper } from '../test-helpers/contract-test-helper';

test.describe('ResultsAggregator Contract', () => {
  let resultsAggregator: any;
  let candidateManager: any;
  let signers: any;

  test.beforeEach(async () => {
    signers = await ContractTestHelper.getSigners();
    
    // Deploy CandidateManager
    candidateManager = await ContractTestHelper.deployCandidateManager();
    
    // Deploy ResultsAggregator
    resultsAggregator = await ContractTestHelper.deployResultsAggregator(await candidateManager.getAddress());
    
    // Add some candidates
    await ContractTestHelper.addTestCandidates(candidateManager);
    
    // Set up authorizations
    await candidateManager.authorizeContract(signers.authorizedContract.address);
    await resultsAggregator.authorizeContract(signers.authorizedContract.address);
  });

  test.describe('Deployment', () => {
    test('Should set the right owner', async () => {
      expect(await resultsAggregator.owner()).toBe(signers.owner.address);
    });

    test('Should set correct candidate manager reference', async () => {
      expect(await resultsAggregator.candidateManager()).toBe(await candidateManager.getAddress());
    });

    test('Should authorize the owner by default', async () => {
      expect(await resultsAggregator.authorizedContracts(signers.owner.address)).toBe(true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await resultsAggregator.authorizeContract(signers.authorizedContract.address);
      expect(await resultsAggregator.authorizedContracts(signers.authorizedContract.address)).toBe(true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await resultsAggregator.authorizeContract(signers.authorizedContract.address);
      await resultsAggregator.revokeContractAuthorization(signers.authorizedContract.address);
      expect(await resultsAggregator.authorizedContracts(signers.authorizedContract.address)).toBe(false);
    });

    test('Should not allow non-owner to authorize contracts', async () => {
      await ContractTestHelper.expectRevert(
        resultsAggregator.connect(signers.unauthorizedUser).authorizeContract(signers.authorizedContract.address),
        "Only the owner can perform this action"
      );
    });
  });

  test.describe('Total Votes Calculation', () => {
    test('Should return zero votes initially', async () => {
      expect(await resultsAggregator.getTotalVotes()).toBe(0n);
    });

    test('Should calculate total votes correctly', async () => {
      // Add some votes
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(2);
      
      expect(await resultsAggregator.getTotalVotes()).toBe(3n);
    });

    test('Should return same value for total voters', async () => {
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(2);
      
      const totalVotes = await resultsAggregator.getTotalVotes();
      const totalVoters = await resultsAggregator.getTotalVoters();
      expect(totalVoters).toBe(totalVotes);
    });
  });

  test.describe('Winner Detection', () => {
    test('Should return first candidate as winner when no votes', async () => {
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      expect(Number(winnerId)).toBe(1);
      expect(winnerName).toBe("Alice");
      expect(voteCount).toBe(0n);
    });

    test('Should return candidate with most votes as winner', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      expect(winnerId).toBe(1n);
      expect(winnerName).toBe("Alice");
      expect(voteCount).toBe(3n);
    });

    test('Should handle ties correctly', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      // Should return the first candidate with max votes (Alice)
      expect(winnerId).toBe(1n);
      expect(winnerName).toBe("Alice");
      expect(voteCount).toBe(2n);
    });
  });

  test.describe('Candidates by Vote Count', () => {
    test('Should return candidates sorted by vote count (descending)', async () => {
      // Alice: 1 vote, Bob: 3 votes, Charlie: 2 votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 2);
      
      const [candidateIds, names, voteCounts] = await resultsAggregator.getCandidatesByVoteCount();
      
      // Should be sorted: Bob (3), Charlie (2), Alice (1)
      expect(candidateIds[0]).toBe(2n); // Bob
      expect(names[0]).toBe("Bob");
      expect(voteCounts[0]).toBe(3n);
      
      expect(candidateIds[1]).toBe(3n); // Charlie
      expect(names[1]).toBe("Charlie");
      expect(voteCounts[1]).toBe(2n);
      
      expect(candidateIds[2]).toBe(1n); // Alice
      expect(names[2]).toBe("Alice");
      expect(voteCounts[2]).toBe(1n);
    });

    test('Should handle equal vote counts correctly', async () => {
      // All candidates have 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [candidateIds, names, voteCounts] = await resultsAggregator.getCandidatesByVoteCount();
      
      // Should maintain original order when votes are equal
      expect(candidateIds[0]).toBe(1n);
      expect(candidateIds[1]).toBe(2n);
      expect(candidateIds[2]).toBe(3n);
      
      expect(voteCounts[0]).toBe(1n);
      expect(voteCounts[1]).toBe(1n);
      expect(voteCounts[2]).toBe(1n);
    });
  });

  test.describe('Vote Percentage Calculation', () => {
    test('Should return 0% when no votes', async () => {
      expect(await resultsAggregator.getVotePercentage(1)).toBe(0n);
    });

    test('Should calculate percentages correctly', async () => {
      // Alice: 2 votes, Bob: 1 vote, Charlie: 1 vote (total: 4)
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect(await resultsAggregator.getVotePercentage(1)).toBe(50n); // 2/4 * 100
      expect(await resultsAggregator.getVotePercentage(2)).toBe(25n); // 1/4 * 100
      expect(await resultsAggregator.getVotePercentage(3)).toBe(25n); // 1/4 * 100
    });

    test('Should handle 100% vote for one candidate', async () => {
      // Only Alice has votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 5);
      
      expect(await resultsAggregator.getVotePercentage(1)).toBe(100n);
      expect(await resultsAggregator.getVotePercentage(2)).toBe(0n);
      expect(await resultsAggregator.getVotePercentage(3)).toBe(0n);
    });
  });

  test.describe('Detailed Results', () => {
    test('Should return detailed results with percentages', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote (total: 6)
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [candidateIds, names, voteCounts, percentages] = await resultsAggregator.getDetailedResults();
      
      expect(candidateIds.length).toBe(3);
      expect(names.length).toBe(3);
      expect(voteCounts.length).toBe(3);
      expect(percentages.length).toBe(3);
      
      // Check Alice (50%)
      expect(candidateIds[0]).toBe(1n);
      expect(names[0]).toBe("Alice");
      expect(voteCounts[0]).toBe(3n);
      expect(percentages[0]).toBe(50n);
      
      // Check Bob (33.33% -> 33% due to integer division)
      expect(candidateIds[1]).toBe(2n);
      expect(names[1]).toBe("Bob");
      expect(voteCounts[1]).toBe(2n);
      expect(percentages[1]).toBe(33n);
      
      // Check Charlie (16.66% -> 16% due to integer division)
      expect(candidateIds[2]).toBe(3n);
      expect(names[2]).toBe("Charlie");
      expect(voteCounts[2]).toBe(1n);
      expect(percentages[2]).toBe(16n);
    });

    test('Should handle zero total votes', async () => {
      const [candidateIds, names, voteCounts, percentages] = await resultsAggregator.getDetailedResults();
      
      expect(candidateIds.length).toBe(3);
      expect(percentages[0]).toBe(0n);
      expect(percentages[1]).toBe(0n);
      expect(percentages[2]).toBe(0n);
    });
  });

  test.describe('Tie Detection', () => {
    test('Should return false when no ties', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect(await resultsAggregator.hasTie()).toBe(false);
    });

    test('Should return true when there\'s a tie for first place', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect(await resultsAggregator.hasTie()).toBe(true);
    });

    test('Should return false when all candidates have zero votes', async () => {
      expect(await resultsAggregator.hasTie()).toBe(false);
    });

    test('Should return true for three-way tie', async () => {
      // All candidates have 2 votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 2);
      
      expect(await resultsAggregator.hasTie()).toBe(true);
    });
  });

  test.describe('Tied Candidates', () => {
    test('Should return empty array when no ties', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).toBe(0);
    });

    test('Should return tied candidates', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).toBe(2);
      expect(tiedCandidates.map(Number)).toContain(1); // Alice
      expect(tiedCandidates.map(Number)).toContain(2); // Bob
      expect(tiedCandidates.map(Number)).not.toContain(3); // Charlie
    });

    test('Should return all candidates in three-way tie', async () => {
      // All candidates have 2 votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 2);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).toBe(3);
      expect(tiedCandidates.map(Number)).toContain(1);
      expect(tiedCandidates.map(Number)).toContain(2);
      expect(tiedCandidates.map(Number)).toContain(3);
    });

    test('Should return empty array when all candidates have zero votes', async () => {
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).toBe(0);
    });
  });
});