const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployContract } = require('./helpers/testHelpers');

describe('Voting Contract E2E Test', function () {
  let voting;
  let owner;
  let voter1;
  let voter2;
  let voter3;

  describe('End-to-End Voting Workflow', function () {
    it('Should complete full voting cycle @e2e', async function () {
      [owner, voter1, voter2, voter3] = await ethers.getSigners();
      voting = await deployContract('Voting');

      // 1. Add candidates
      const addedCandidates = ['Alice', 'Bob', 'Charlie'];
      let candidateCount = 1;

      for (const candidateName of addedCandidates) {
        // Verify candidate is added
        try {
          await expect(voting.addCandidate(candidateName))
            .to.emit(voting, 'CandidateAdded')
            .withArgs(candidateCount, candidateName);
          candidateCount++;
        } catch (err) {
          throw new Error(
            `Candidate should be added. ` +
              `Expected candidate count: ${candidateCount}, Expected name: ${
                candidateName
              }\n${err.message}`
          );
        }

        // Verify candidate count and name
        const candidatesCount = await voting.candidatesCount();
        expect(
          candidatesCount,
          `Candidates count should match. Expected: ${candidateCount - 1}, Got: ${candidatesCount}`
        ).to.equal(candidateCount - 1);
        const candidate = await voting.getCandidate(candidateCount - 1);
        expect(
          candidate[1],
          `Candidate name should match. Expected: ${candidateName}, Got: ${candidate[1]}`
        ).to.equal(candidateName);
        expect(candidate[2], 'Candidate vote count should be 0').to.equal(0);
      }

      // 2. Start election
      const currentRound = 1;
      try {
        await expect(voting.connect(owner).startElection())
          .to.emit(voting, 'ElectionStarted')
          .withArgs(currentRound);
      } catch (err) {
        throw new Error(
          `Election should be started. ` +
            `Expected round: ${currentRound}\n${err.message}`
        );
      }
      expect(await voting.isElectionActive(), 'Election should be active').to.be
        .true;
      expect(
        await voting.currentElectionRound(),
        `Current election round should be ${currentRound}`
      ).to.equal(currentRound);

      // 3. Cast votes
      const voters = [voter1, voter2, voter3];
      const candidatesToVoteFor = [1, 2, 1]; // Alice, Bob, Alice
      for (let i = 0; i < voters.length; i++) {
        try {
          await expect(voting.connect(voters[i]).vote(candidatesToVoteFor[i]))
            .to.emit(voting, 'VoteCast')
            .withArgs(voters[i].address, candidatesToVoteFor[i]);
        } catch (err) {
          throw new Error(
            `Voter ${voters[i].address} should be able to vote for candidate ${
              candidatesToVoteFor[i]
            }\n${err.message}`
          );
        }
      }

      // 4. Verify vote counts
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      const charlie = await voting.getCandidate(3);
      expect(alice[2], 'Alice should have 2 votes').to.equal(2);
      expect(bob[2], 'Bob should have 1 vote').to.equal(1);
      expect(charlie[2], 'Charlie should have 0 votes').to.equal(0);

      // 5. Check voter status
      expect(
        await voting.checkVoted(voter1.address),
        'Voter 1 should have voted'
      ).to.be.true;
      expect(
        await voting.checkVoted(voter2.address),
        'Voter 2 should have voted'
      ).to.be.true;
      expect(
        await voting.checkVoted(voter3.address),
        'Voter 3 should have voted'
      ).to.be.true;

      // 6. Get results
      const [winnerId, winnerName, voteCount] = await voting.getWinner();
      expect(winnerId, 'Winner ID should be 1').to.equal(1);
      expect(winnerName, 'Winner name should be Alice').to.equal('Alice');
      expect(voteCount, 'Winner vote count should be 2').to.equal(2);

      // 7. End election
      await expect(voting.endElection()).to.emit(voting, 'ElectionStopped');
      expect(await voting.isElectionActive(), 'Election should be inactive').to
        .be.false;
    });
  });
});
