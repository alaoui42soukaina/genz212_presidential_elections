const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployContract,
  addCandidates,
  setupElectionWithCandidates,
  castVotes,
} = require('./helpers/testHelpers');

describe('Voting Contract Integration Tests', function () {
  let voting;
  let candidateManager;
  let electionManager;
  let votingCore;
  let resultsAggregator;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();

    voting = await deployContract('Voting');

    // Get references to sub-contracts for integration testing
    candidateManager = await ethers.getContractAt(
      'CandidateManager',
      await voting.candidateManager()
    );
    electionManager = await ethers.getContractAt(
      'ElectionManager',
      await voting.electionManager()
    );
    votingCore = await ethers.getContractAt(
      'VotingCore',
      await voting.votingCore()
    );
    resultsAggregator = await ethers.getContractAt(
      'ResultsAggregator',
      await voting.resultsAggregator()
    );
  });

  describe('Contract Integration Deployment', function () {
    it('Should deploy and connect all contracts correctly @integration', async function () {
      const addresses = await voting.getContractAddresses();

      // Verify all contracts are deployed
      expect(
        addresses.candidateManagerAddr,
        'CandidateManager contract is not deployed'
      ).to.not.equal(ethers.ZeroAddress);
      expect(
        addresses.electionManagerAddr,
        'ElectionManager contract is not deployed'
      ).to.not.equal(ethers.ZeroAddress);
      expect(
        addresses.votingCoreAddr,
        'VotingCore contract is not deployed'
      ).to.not.equal(ethers.ZeroAddress);
      expect(
        addresses.resultsAggregatorAddr,
        'ResultsAggregator contract is not deployed'
      ).to.not.equal(ethers.ZeroAddress);

      // Verify cross-contract references
      expect(
        await voting.candidateManager(),
        'CandidateManager contract reference is not correct'
      ).to.equal(await candidateManager.getAddress());
      expect(
        await voting.electionManager(),
        'ElectionManager contract reference is not correct'
      ).to.equal(await electionManager.getAddress());
      expect(
        await voting.votingCore(),
        'VotingCore contract reference is not correct'
      ).to.equal(await votingCore.getAddress());
      expect(
        await voting.resultsAggregator(),
        'ResultsAggregator contract reference is not correct'
      ).to.equal(await resultsAggregator.getAddress());
    });

    it('Should have proper cross-contract authorizations @integration', async function () {
      // Check that VotingCore is authorized to interact with other contracts
      expect(
        await candidateManager.authorizedContracts(
          await votingCore.getAddress()
        ),
        'CandidateManager is not authorized to interact with VotingCore'
      ).to.be.true;
      expect(
        await electionManager.authorizedContracts(
          await votingCore.getAddress()
        ),
        'ElectionManager is not authorized to interact with VotingCore'
      ).to.be.true;
      expect(
        await resultsAggregator.authorizedContracts(
          await votingCore.getAddress()
        ),
        'ResultsAggregator is not authorized to interact with VotingCore'
      ).to.be.true;
    });
  });

  describe('Cross-Contract Data Consistency', function () {
    beforeEach(async function () {
      await setupElectionWithCandidates(voting, ['Alice', 'Bob']);
    });

    it('Should maintain consistent data across all contracts @integration', async function () {
      await castVotes(voting, [
        { voter: voter1, candidateId: 1 },
        { voter: voter2, candidateId: 2 },
      ]);

      // Check candidate vote count consistency
      const mainCandidate = await voting.getCandidate(1);
      const coreCandidate = await votingCore.getCandidate(1);
      const managerCandidate = await candidateManager.getCandidate(1);

      expect(
        mainCandidate[2],
        'Main candidate vote count should match VotingCore candidate vote count'
      ).to.equal(coreCandidate[2]);
      expect(
        coreCandidate[2],
        'VotingCore candidate vote count should match CandidateManager candidate vote count'
      ).to.equal(managerCandidate[2]);

      // Check election status consistency
      expect(
        await voting.isElectionActive(),
        'Election status should match VotingCore election status'
      ).to.equal(await votingCore.isElectionActive());
      expect(
        await votingCore.isElectionActive(),
        'VotingCore election status should match ElectionManager election status'
      ).to.equal(await electionManager.isElectionActive());

      // Check voter status consistency
      expect(
        await voting.checkVoted(voter1.address),
        'Voter 1 status should match VotingCore voter status'
      ).to.equal(await votingCore.checkVoted(voter1.address));
      expect(
        await votingCore.checkVoted(voter1.address),
        'VotingCore voter status should match ElectionManager voter status'
      ).to.equal(await electionManager.hasVotedInCurrentRound(voter1.address));
    });

    it('Should synchronize vote counts across contracts @integration', async function () {
      const numberOfVotes = 1;
      await voting.connect(voter1).vote(numberOfVotes);

      // Check vote counts are synchronized
      const totalVotesMain = await voting.getTotalVotes();
      const totalVotesResults = await resultsAggregator.getTotalVotes();

      try {
        expect(totalVotesMain).to.equal(totalVotesResults);
      } catch (err) {
        throw new Error(
          `Total votes should be equal. ` +
            `Main contract: ${totalVotesMain}, ResultsAggregator contract: ${
              totalVotesResults
            }\n${err.message}`
        );
      }

      try {
        expect(totalVotesMain).to.equal(numberOfVotes);
      } catch (err) {
        throw new Error(
          `Total votes should be ${numberOfVotes}, ` +
            `votes returned in main contract: ${totalVotesMain}\n${err.message}`
        );
      }
    });
  });

  describe('Error Handling and Edge Cases', function () {
    it('Should prohibit voting before election starts @integration', async function () {
      await addCandidates(voting, ['Alice']);

      await expect(voting.connect(voter1).vote(1)).to.be.revertedWith(
        'Election is not active'
      );
    });

    it('Should prohibit voting after election ends @integration', async function () {
      await setupElectionWithCandidates(voting, ['Alice']);
      await voting.connect(owner).endElection();

      await expect(voting.connect(voter1).vote(1)).to.be.revertedWith(
        'Election is not active'
      );
    });

    it('Should prohibit voting for invalid candidate IDs @integration', async function () {
      const invalidCandidateIds = [0, 2];
      await setupElectionWithCandidates(voting, ['Alice']);

      for (const candidateID of invalidCandidateIds) {
        try {
          await expect(
            voting.connect(voter1).vote(candidateID)
          ).to.be.revertedWith('Invalid candidate ID');
        } catch (err) {
          throw new Error(
            `Voter should not be able to vote for invalid candidate ID : ${
              candidateID
            }\n${err}`
          );
        }
      }
    });

    it('Should prohibit double voting @integration', async function () {
      await setupElectionWithCandidates(voting, ['Alice', 'Bob']);

      await voting.connect(voter1).vote(1);

      await expect(voting.connect(voter1).vote(2)).to.be.revertedWith(
        'You have already voted in this election'
      );
    });

    it('Should not allow non-owner to start election @integration', async function () {
      await expect(voting.connect(voter1).startElection()).to.be.revertedWith(
        'Only the owner can perform this action'
      );
    });

    it('Should not allow non-owner to end election @integration', async function () {
      await setupElectionWithCandidates(voting, ['Alice']);
      await expect(voting.connect(voter1).endElection()).to.be.revertedWith(
        'Only the owner can perform this action'
      );
    });
  });
});
