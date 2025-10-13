import { test } from '@playwright/test';
import { ContractTestHelper, expect } from '../test-helpers/contract-test-helper';

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
      expect.toBe(await resultsAggregator.owner(), signers.owner.address);
    });

    test('Should set correct candidate manager reference', async () => {
      expect.toBe(await resultsAggregator.candidateManager(), await candidateManager.getAddress());
    });

    test('Should authorize the owner by default', async () => {
      expect.toBe(await resultsAggregator.authorizedContracts(signers.owner.address), true);
    });
  });

  test.describe('Authorization', () => {
    test('Should allow owner to authorize contracts', async () => {
      await resultsAggregator.authorizeContract(signers.authorizedContract.address);
      expect.toBe(await resultsAggregator.authorizedContracts(signers.authorizedContract.address), true);
    });

    test('Should allow owner to revoke authorization', async () => {
      await resultsAggregator.authorizeContract(signers.authorizedContract.address);
      await resultsAggregator.revokeContractAuthorization(signers.authorizedContract.address);
      expect.toBe(await resultsAggregator.authorizedContracts(signers.authorizedContract.address), false);
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
      expect.toBe(await resultsAggregator.getTotalVotes(), 0);
    });

    test('Should calculate total votes correctly', async () => {
      // Add some votes
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(2);
      
      expect.toBe(await resultsAggregator.getTotalVotes(), 3);
    });

    test('Should return same value for total voters', async () => {
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(1);
      await candidateManager.connect(signers.authorizedContract).incrementCandidateVoteCount(2);
      
      const totalVotes = await resultsAggregator.getTotalVotes();
      const totalVoters = await resultsAggregator.getTotalVoters();
      expect.toBe(totalVoters, totalVotes);
    });
  });

  test.describe('Winner Detection', () => {
    test('Should return first candidate as winner when no votes', async () => {
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      expect.toBe(Number(winnerId), 1);
      expect.toBe(winnerName, "Alice");
      expect.toBe(voteCount, 0);
    });

    test('Should return candidate with most votes as winner', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      expect.toBe(winnerId, 1);
      expect.toBe(winnerName, "Alice");
      expect.toBe(voteCount, 3);
    });

    test('Should handle ties correctly', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [winnerId, winnerName, voteCount] = await resultsAggregator.getWinner();
      // Should return the first candidate with max votes (Alice)
      expect.toBe(winnerId, 1);
      expect.toBe(winnerName, "Alice");
      expect.toBe(voteCount, 2);
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
      expect.toBe(candidateIds[0], 2); // Bob
      expect.toBe(names[0], "Bob");
      expect.toBe(voteCounts[0], 3);
      
      expect.toBe(candidateIds[1], 3); // Charlie
      expect.toBe(names[1], "Charlie");
      expect.toBe(voteCounts[1], 2);
      
      expect.toBe(candidateIds[2], 1); // Alice
      expect.toBe(names[2], "Alice");
      expect.toBe(voteCounts[2], 1);
    });

    test('Should handle equal vote counts correctly', async () => {
      // All candidates have 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [candidateIds, names, voteCounts] = await resultsAggregator.getCandidatesByVoteCount();
      
      // Should maintain original order when votes are equal
      expect.toBe(candidateIds[0], 1);
      expect.toBe(candidateIds[1], 2);
      expect.toBe(candidateIds[2], 3);
      
      expect.toBe(voteCounts[0], 1);
      expect.toBe(voteCounts[1], 1);
      expect.toBe(voteCounts[2], 1);
    });
  });

  test.describe('Vote Percentage Calculation', () => {
    test('Should return 0% when no votes', async () => {
      expect.toBe(await resultsAggregator.getVotePercentage(1), 0);
    });

    test('Should calculate percentages correctly', async () => {
      // Alice: 2 votes, Bob: 1 vote, Charlie: 1 vote (total: 4)
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 1);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect.toBe(await resultsAggregator.getVotePercentage(1), 50); // 2/4 * 100
      expect.toBe(await resultsAggregator.getVotePercentage(2), 25); // 1/4 * 100
      expect.toBe(await resultsAggregator.getVotePercentage(3), 25); // 1/4 * 100
    });

    test('Should handle 100% vote for one candidate', async () => {
      // Only Alice has votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 5);
      
      expect.toBe(await resultsAggregator.getVotePercentage(1), 100);
      expect.toBe(await resultsAggregator.getVotePercentage(2), 0);
      expect.toBe(await resultsAggregator.getVotePercentage(3), 0);
    });
  });

  test.describe('Detailed Results', () => {
    test('Should return detailed results with percentages', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote (total: 6)
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const [candidateIds, names, voteCounts, percentages] = await resultsAggregator.getDetailedResults();
      
      expect.toBe(candidateIds.length, 3);
      expect.toBe(names.length, 3);
      expect.toBe(voteCounts.length, 3);
      expect.toBe(percentages.length, 3);
      
      // Check Alice (50%)
      expect.toBe(candidateIds[0], 1);
      expect.toBe(names[0], "Alice");
      expect.toBe(voteCounts[0], 3);
      expect.toBe(percentages[0], 50);
      
      // Check Bob (33.33% -> 33% due to integer division)
      expect.toBe(candidateIds[1], 2);
      expect.toBe(names[1], "Bob");
      expect.toBe(voteCounts[1], 2);
      expect.toBe(percentages[1], 33);
      
      // Check Charlie (16.66% -> 16% due to integer division)
      expect.toBe(candidateIds[2], 3);
      expect.toBe(names[2], "Charlie");
      expect.toBe(voteCounts[2], 1);
      expect.toBe(percentages[2], 16);
    });

    test('Should handle zero total votes', async () => {
      const [candidateIds, names, voteCounts, percentages] = await resultsAggregator.getDetailedResults();
      
      expect.toBe(candidateIds.length, 3);
      expect.toBe(percentages[0], 0);
      expect.toBe(percentages[1], 0);
      expect.toBe(percentages[2], 0);
    });
  });

  test.describe('Tie Detection', () => {
    test('Should return false when no ties', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect.toBe(await resultsAggregator.hasTie(), false);
    });

    test('Should return true when there\'s a tie for first place', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      expect.toBe(await resultsAggregator.hasTie(), true);
    });

    test('Should return false when all candidates have zero votes', async () => {
      expect.toBe(await resultsAggregator.hasTie(), false);
    });

    test('Should return true for three-way tie', async () => {
      // All candidates have 2 votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 2);
      
      expect.toBe(await resultsAggregator.hasTie(), true);
    });
  });

  test.describe('Tied Candidates', () => {
    test('Should return empty array when no ties', async () => {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 3);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect.toBe(tiedCandidates.length, 0);
    });

    test('Should return tied candidates', async () => {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 1);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect.toBe(tiedCandidates.length, 2);
      expect.toContain(tiedCandidates.map(Number), 1); // Alice
      expect.toContain(tiedCandidates.map(Number), 2); // Bob
      expect.not.toContain(tiedCandidates, 3); // Charlie
    });

    test('Should return all candidates in three-way tie', async () => {
      // All candidates have 2 votes
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(1, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(2, 2);
      await candidateManager.connect(signers.authorizedContract).updateCandidateVoteCount(3, 2);
      
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect.toBe(tiedCandidates.length, 3);
      expect.toContain(tiedCandidates.map(Number), 1);
      expect.toContain(tiedCandidates.map(Number), 2);
      expect.toContain(tiedCandidates.map(Number), 3);
    });

    test('Should return empty array when all candidates have zero votes', async () => {
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect.toBe(tiedCandidates.length, 0);
    });
  });
});