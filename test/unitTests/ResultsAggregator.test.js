const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployContract, addCandidates } = require('../helpers/testHelpers');

describe('ResultsAggregator Contract', function () {
  let resultsAggregator;
  let candidateManager;
  let owner;
  let authorizedContract;
  let unauthorizedUser;

  beforeEach(async function () {
    [owner, authorizedContract, unauthorizedUser] = await ethers.getSigners();

    // Deploy CandidateManager
    candidateManager = await deployContract('CandidateManager');

    // Deploy ResultsAggregator
    resultsAggregator = await deployContract('ResultsAggregator', [
      await candidateManager.getAddress(),
    ]);

    // Add some candidates
    await addCandidates(candidateManager, ['Alice', 'Bob', 'Charlie']);

    // Set up authorizations
    await candidateManager.authorizeContract(authorizedContract.address);
    await resultsAggregator.authorizeContract(authorizedContract.address);
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await resultsAggregator.owner()).to.equal(owner.address);
    });

    it('Should set correct candidate manager reference', async function () {
      expect(await resultsAggregator.candidateManager()).to.equal(
        await candidateManager.getAddress()
      );
    });

    it('Should authorize the owner by default', async function () {
      expect(await resultsAggregator.authorizedContracts(owner.address)).to.be
        .true;
    });
  });

  describe('Authorization', function () {
    it('Should allow owner to authorize contracts', async function () {
      await resultsAggregator.authorizeContract(authorizedContract.address);
      expect(
        await resultsAggregator.authorizedContracts(authorizedContract.address)
      ).to.be.true;
    });

    it('Should allow owner to revoke authorization', async function () {
      await resultsAggregator.authorizeContract(authorizedContract.address);
      await resultsAggregator.revokeContractAuthorization(
        authorizedContract.address
      );
      expect(
        await resultsAggregator.authorizedContracts(authorizedContract.address)
      ).to.be.false;
    });

    it('Should not allow non-owner to authorize contracts', async function () {
      await expect(
        resultsAggregator
          .connect(unauthorizedUser)
          .authorizeContract(authorizedContract.address)
      ).to.be.revertedWith('Only the owner can perform this action');
    });
  });

  describe('Total Votes Calculation', function () {
    it('Should return zero votes initially', async function () {
      expect(await resultsAggregator.getTotalVotes()).to.equal(0);
    });

    it('Should calculate total votes correctly', async function () {
      // Add some votes
      await candidateManager
        .connect(authorizedContract)
        .incrementCandidateVoteCount(1);
      await candidateManager
        .connect(authorizedContract)
        .incrementCandidateVoteCount(1);
      await candidateManager
        .connect(authorizedContract)
        .incrementCandidateVoteCount(2);

      expect(await resultsAggregator.getTotalVotes()).to.equal(3);
    });

    it('Should return same value for total voters', async function () {
      await candidateManager
        .connect(authorizedContract)
        .incrementCandidateVoteCount(1);
      await candidateManager
        .connect(authorizedContract)
        .incrementCandidateVoteCount(2);

      const totalVotes = await resultsAggregator.getTotalVotes();
      const totalVoters = await resultsAggregator.getTotalVoters();
      expect(totalVoters).to.equal(totalVotes);
    });
  });

  describe('Winner Detection', function () {
    it('Should return first candidate as winner when no votes', async function () {
      const [winnerId, winnerName, voteCount] =
        await resultsAggregator.getWinner();
      expect(Number(winnerId)).to.equal(1);
      expect(winnerName).to.equal('Alice');
      expect(voteCount).to.equal(0);
    });

    it('Should return candidate with most votes as winner', async function () {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 3);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const [winnerId, winnerName, voteCount] =
        await resultsAggregator.getWinner();
      expect(winnerId).to.equal(1);
      expect(winnerName).to.equal('Alice');
      expect(voteCount).to.equal(3);
    });

    it('Should handle ties correctly', async function () {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const [winnerId, winnerName, voteCount] =
        await resultsAggregator.getWinner();
      // Should return the first candidate with max votes (Alice)
      expect(winnerId).to.equal(1);
      expect(winnerName).to.equal('Alice');
      expect(voteCount).to.equal(2);
    });
  });

  describe('Candidates by Vote Count', function () {
    it('Should return candidates sorted by vote count (descending)', async function () {
      // Alice: 1 vote, Bob: 3 votes, Charlie: 2 votes
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 1);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 3);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 2);

      const [candidateIds, names, voteCounts] =
        await resultsAggregator.getCandidatesByVoteCount();

      // Should be sorted: Bob (3), Charlie (2), Alice (1)
      expect(candidateIds[0]).to.equal(2); // Bob
      expect(names[0]).to.equal('Bob');
      expect(voteCounts[0]).to.equal(3);

      expect(candidateIds[1]).to.equal(3); // Charlie
      expect(names[1]).to.equal('Charlie');
      expect(voteCounts[1]).to.equal(2);

      expect(candidateIds[2]).to.equal(1); // Alice
      expect(names[2]).to.equal('Alice');
      expect(voteCounts[2]).to.equal(1);
    });

    it('Should handle equal vote counts correctly', async function () {
      // All candidates have 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 1);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 1);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const [candidateIds, , voteCounts] =
        await resultsAggregator.getCandidatesByVoteCount();

      // Should maintain original order when votes are equal
      expect(candidateIds[0]).to.equal(1);
      expect(candidateIds[1]).to.equal(2);
      expect(candidateIds[2]).to.equal(3);

      expect(voteCounts[0]).to.equal(1);
      expect(voteCounts[1]).to.equal(1);
      expect(voteCounts[2]).to.equal(1);
    });
  });

  describe('Vote Percentage Calculation', function () {
    it('Should return 0% when no votes', async function () {
      expect(await resultsAggregator.getVotePercentage(1)).to.equal(0);
    });

    it('Should calculate percentages correctly', async function () {
      // Alice: 2 votes, Bob: 1 vote, Charlie: 1 vote (total: 4)
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 1);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      expect(await resultsAggregator.getVotePercentage(1)).to.equal(50); // 2/4 * 100
      expect(await resultsAggregator.getVotePercentage(2)).to.equal(25); // 1/4 * 100
      expect(await resultsAggregator.getVotePercentage(3)).to.equal(25); // 1/4 * 100
    });

    it('Should handle 100% vote for one candidate', async function () {
      // Only Alice has votes
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 5);

      expect(await resultsAggregator.getVotePercentage(1)).to.equal(100);
      expect(await resultsAggregator.getVotePercentage(2)).to.equal(0);
      expect(await resultsAggregator.getVotePercentage(3)).to.equal(0);
    });
  });

  describe('Detailed Results', function () {
    it('Should return detailed results with percentages', async function () {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote (total: 6)
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 3);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const [candidateIds, names, voteCounts, percentages] =
        await resultsAggregator.getDetailedResults();

      expect(candidateIds.length).to.equal(3);
      expect(names.length).to.equal(3);
      expect(voteCounts.length).to.equal(3);
      expect(percentages.length).to.equal(3);

      // Check Alice (50%)
      expect(candidateIds[0]).to.equal(1);
      expect(names[0]).to.equal('Alice');
      expect(voteCounts[0]).to.equal(3);
      expect(percentages[0]).to.equal(50);

      // Check Bob (33.33% -> 33% due to integer division)
      expect(candidateIds[1]).to.equal(2);
      expect(names[1]).to.equal('Bob');
      expect(voteCounts[1]).to.equal(2);
      expect(percentages[1]).to.equal(33);

      // Check Charlie (16.66% -> 16% due to integer division)
      expect(candidateIds[2]).to.equal(3);
      expect(names[2]).to.equal('Charlie');
      expect(voteCounts[2]).to.equal(1);
      expect(percentages[2]).to.equal(16);
    });

    it('Should handle zero total votes', async function () {
      const [candidateIds, , , percentages] =
        await resultsAggregator.getDetailedResults();

      expect(candidateIds.length).to.equal(3);
      expect(percentages[0]).to.equal(0);
      expect(percentages[1]).to.equal(0);
      expect(percentages[2]).to.equal(0);
    });
  });

  describe('Tie Detection', function () {
    it('Should return false when no ties', async function () {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 3);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      expect(await resultsAggregator.hasTie()).to.be.false;
    });

    it("Should return true when there's a tie for first place", async function () {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      expect(await resultsAggregator.hasTie()).to.be.true;
    });

    it('Should return false when all candidates have zero votes', async function () {
      expect(await resultsAggregator.hasTie()).to.be.false;
    });

    it('Should return true for three-way tie', async function () {
      // All candidates have 2 votes
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 2);

      expect(await resultsAggregator.hasTie()).to.be.true;
    });
  });

  describe('Tied Candidates', function () {
    it('Should return empty array when no ties', async function () {
      // Alice: 3 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 3);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(0);
    });

    it('Should return tied candidates', async function () {
      // Alice: 2 votes, Bob: 2 votes, Charlie: 1 vote
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 1);

      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(2);
      expect(tiedCandidates.map(Number)).to.include(1); // Alice
      expect(tiedCandidates.map(Number)).to.include(2); // Bob
      expect(tiedCandidates).to.not.include(3); // Charlie
    });

    it('Should return all candidates in three-way tie', async function () {
      // All candidates have 2 votes
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(1, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(2, 2);
      await candidateManager
        .connect(authorizedContract)
        .updateCandidateVoteCount(3, 2);

      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(3);
      expect(tiedCandidates.map(Number)).to.include(1);
      expect(tiedCandidates.map(Number)).to.include(2);
      expect(tiedCandidates.map(Number)).to.include(3);
    });

    it('Should return empty array when all candidates have zero votes', async function () {
      const tiedCandidates = await resultsAggregator.getTiedCandidates();
      expect(tiedCandidates.length).to.equal(0);
    });
  });
});
