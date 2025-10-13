import { test, expect } from '@playwright/test';
import { ContractTestHelper } from '../test-helpers/contract-test-helper';
import { ethers } from 'ethers';

test.describe('Voting Contract Integration Tests', () => {
  let voting: any;
  let candidateManager: any;
  let electionManager: any;
  let votingCore: any;
  let resultsAggregator: any;
  let signers: any;

  test.beforeEach(async () => {
    const setup = await ContractTestHelper.setupIntegrationTest();
    voting = setup.voting;
    candidateManager = setup.candidateManager;
    electionManager = setup.electionManager;
    votingCore = setup.votingCore;
    resultsAggregator = setup.resultsAggregator;
    signers = setup.signers;
  });

  test.describe('Contract Integration Deployment', () => {
    test('Should deploy and connect all contracts correctly @pass @integration', async () => {
      const addresses = await ContractTestHelper.getContractAddresses(voting);
      
      // Verify all contracts are deployed
      expect(addresses.candidateManager, "CandidateManager contract is not deployed").not.toBe(ethers.ZeroAddress);
      expect(addresses.electionManager, "ElectionManager contract is not deployed").not.toBe(ethers.ZeroAddress);
      expect(addresses.votingCore, "VotingCore contract is not deployed").not.toBe(ethers.ZeroAddress);
      expect(addresses.resultsAggregator, "ResultsAggregator contract is not deployed").not.toBe(ethers.ZeroAddress);
      
      // Verify cross-contract references
      expect(await voting.candidateManager(), "CandidateManager contract reference is not correct").toBe(await candidateManager.getAddress());
      expect(await voting.electionManager(), "ElectionManager contract reference is not correct").toBe(await electionManager.getAddress());
      expect(await voting.votingCore(), "VotingCore contract reference is not correct").toBe(await votingCore.getAddress());
      expect(await voting.resultsAggregator(), "ResultsAggregator contract reference is not correct").toBe(await resultsAggregator.getAddress());
    });

    test('Should have proper cross-contract authorizations @pass @integration', async () => {
      // Check that VotingCore is authorized to interact with other contracts
      expect(await candidateManager.authorizedContracts(await votingCore.getAddress()), "CandidateManager is not authorized to interact with VotingCore").toBe(true);
      expect(await electionManager.authorizedContracts(await votingCore.getAddress()), "ElectionManager is not authorized to interact with VotingCore").toBe(true);
      expect(await resultsAggregator.authorizedContracts(await votingCore.getAddress()), "ResultsAggregator is not authorized to interact with VotingCore").toBe(true);
    });
  });

  test.describe('Cross-Contract Data Consistency', () => {
    test.beforeEach(async () => {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
    });

    test('Should maintain consistent data across all contracts @pass @integration', async () => {
      await voting.connect(signers.voter1).vote(1);
      await voting.connect(signers.voter2).vote(2);
      
      // Check candidate vote count consistency
      const mainCandidate = await voting.getCandidate(1);
      const coreCandidate = await votingCore.getCandidate(1);
      const managerCandidate = await candidateManager.getCandidate(1);
      
      expect(mainCandidate[2], "Main candidate vote count should match VotingCore candidate vote count").toBe(coreCandidate[2]);
      expect(coreCandidate[2], "VotingCore candidate vote count should match CandidateManager candidate vote count").toBe(managerCandidate[2]);
      
      // Check election status consistency
      expect(await voting.isElectionActive(), "Election status should match VotingCore election status").toBe(await votingCore.isElectionActive());
      expect(await votingCore.isElectionActive(), "VotingCore election status should match ElectionManager election status").toBe(await electionManager.isElectionActive());

      // Check voter status consistency
      expect(await voting.checkVoted(signers.voter1.address), "Voter 1 status should match VotingCore voter status").toBe(await votingCore.checkVoted(signers.voter1.address));
      expect(await votingCore.checkVoted(signers.voter1.address), "VotingCore voter status should match ElectionManager voter status").toBe(await electionManager.hasVotedInCurrentRound(signers.voter1.address));
    });

    test('Should synchronize vote counts across contracts @fail @integration', async () => {
      const numberOfVotes = 1;
      await voting.connect(signers.voter1).vote(numberOfVotes);
      
      // Check vote counts are synchronized
      const totalVotesMain = await voting.getTotalVotes() + 1n; // injected bug, correction : await voting.getTotalVotes();
      const totalVotesResults = await resultsAggregator.getTotalVotes();
      
      try {
        expect(totalVotesMain, "Total votes should be equal between main contract and ResultsAggregator").toBe(totalVotesResults);
      } catch (err) {
        throw new Error(
          "Total votes should be equal. " +
          "Main contract: " + totalVotesMain +
          ", ResultsAggregator contract: " + totalVotesResults +
          "\n" + (err as Error).message
        );
      }
      
      try {
        expect(totalVotesMain, `Total votes should be ${numberOfVotes}`).toBe(numberOfVotes);
      } catch (err) {
        throw new Error(
          "Total votes should be " + numberOfVotes + ", " +
          "votes returned in main contract: " + totalVotesMain +
          "\n" + (err as Error).message
        );
      }
    });
  });

  test.describe('End-to-End Voting Workflow', () => {
    test('Should complete full voting cycle @pass @e2e', async () => {
      // 1. Add candidates
      const addedCandidates = ["Alice", "Bob", "Charlie"];
      let candidateCount = 1;

      for (const candidateName of addedCandidates) {
        // check on chain event
        try {
          await ContractTestHelper.expectEvent(
            voting.addCandidate(candidateName),
            voting,
            "CandidateAdded",
            [Number(candidateCount), candidateName],
            `Candidate ${candidateName} should be added with count ${candidateCount}`
          );
          candidateCount++;
        } catch (err) {
          throw new Error(
            "Candidate should be added. " +
            "Expected candidate count: " + candidateCount +
            ", Expected name: " + candidateName +
            "\n" + (err as Error).message
          );
        }

        // check on chain state
        const candidatesCount = await voting.candidatesCount();
        expect(candidatesCount, `Candidates count should match. Expected: ${candidateCount-1}, Got: ${candidatesCount}`).toBe(BigInt(candidateCount-1));
        const candidate = await voting.getCandidate(candidateCount - 1);
        expect(candidate[1], `Candidate name should match. Expected: ${candidateName}, Got: ${candidate[1]}`).toBe(candidateName);
        expect(candidate[2], "Candidate vote count should be 0").toBe(0n);
      }
      
      // 2. Start election
      const currentRound = 1n;
      try {
        await ContractTestHelper.expectEvent(
          voting.startElection(),
          voting,
          "ElectionStarted",
          [Number(currentRound)],
          `Election should be started with round ${currentRound}`
        );
      } catch (err) {
        throw new Error(
          "Election should be started. " +
          "Expected round: " + currentRound +
          "\n" + (err as Error).message
        );
      }
      expect(await voting.isElectionActive(), "Election should be active").toBe(true);
      expect(await voting.currentElectionRound(), "Current election round should be " + currentRound).toBe(currentRound);
      
      // 3. Cast votes
      const voters = [signers.voter1, signers.voter2, signers.voter3];
      const candidatesToVoteFor = [1, 2, 1]; // Alice, Bob, Alice
      for (let i = 0; i < voters.length; i++) {
        try {
          await ContractTestHelper.expectEvent(
            voting.connect(voters[i]).vote(candidatesToVoteFor[i]),
            voting,
            "VoteCast",
            [voters[i].address, candidatesToVoteFor[i]],
            `Voter ${voters[i].address} should be able to vote for candidate ${candidatesToVoteFor[i]}`
          );
        } catch (err) {
          throw new Error(
            "Voter " + voters[i].address + " should be able to vote for candidate " + candidatesToVoteFor[i] + "\n" + (err as Error).message
          );
        }
      }
      
      // 4. Verify vote counts
      const alice = await voting.getCandidate(1);
      const bob = await voting.getCandidate(2);
      const charlie = await voting.getCandidate(3);
      expect(alice[2], "Alice should have 2 votes").toBe(2n);
      expect(bob[2], "Bob should have 1 vote").toBe(1n);
      expect(charlie[2], "Charlie should have 0 votes").toBe(0n);
      
      // 5. Check voter status
      expect(await voting.checkVoted(signers.voter1.address), "Voter 1 should have voted").toBe(true);
      expect(await voting.checkVoted(signers.voter2.address), "Voter 2 should have voted").toBe(true);
      expect(await voting.checkVoted(signers.voter3.address), "Voter 3 should have voted").toBe(true);
      
      // 6. Get results
      const [winnerId, winnerName, voteCount] = await voting.getWinner();
      expect(winnerId, "Winner ID should be 1").toBe(1n);
      expect(winnerName, "Winner name should be Alice").toBe("Alice");
      expect(voteCount, "Winner vote count should be 2").toBe(2n);
      
      // 7. End election
      await ContractTestHelper.expectEvent(
        voting.endElection(),
        voting,
        "ElectionStopped",
        undefined,
        "Election should be stopped"
      );
      expect(await voting.isElectionActive(), "Election should be inactive").toBe(false);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('Should prohibit voting before election starts @pass @integration', async () => {
      await voting.addCandidate("Alice");
      
      await ContractTestHelper.expectRevert(
        voting.connect(signers.voter1).vote(1),
        "Election is not active",
        "Voting should be prohibited before election starts"
      );
    });

    test('Should prohibit voting after election ends @pass @integration', async () => {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await voting.endElection();
      
      await ContractTestHelper.expectRevert(
        voting.connect(signers.voter1).vote(1),
        "Election is not active",
        "Voting should be prohibited after election ends"
      );
    });

    test('Should prohibit voting for invalid candidate IDs @fail @integration', async () => {
      const invalidCandidateIds = [0, 1]; // injected bug, correction : const invalidCandidateIds = [0, 2];
      await voting.addCandidate("Alice");
      await voting.startElection();
      
      for (const candidateID of invalidCandidateIds) {
        try {
          await ContractTestHelper.expectRevert(
            voting.connect(signers.voter1).vote(candidateID),
            "Invalid candidate ID",
            `Voter should not be able to vote for invalid candidate ID: ${candidateID}`
          );
        } catch (err) {
          throw new Error(
            "Voter should not be able to vote for invalid candidate ID : " +
            candidateID + "\n" + err
          );
        }
      }      
    });

    test('Should prohibit double voting @pass @integration', async () => {
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.startElection();
      
      await voting.connect(signers.voter1).vote(1);
      
      await ContractTestHelper.expectRevert(
        voting.connect(signers.voter1).vote(2),
        "You have already voted in this election",
        "Double voting should be prohibited"
      );
    });

    test('Should not allow non-owner to start election @pass @integration', async () => {
      await ContractTestHelper.expectRevert(
        voting.connect(signers.voter1).startElection(),
        "Only the owner can perform this action",
        "Non-owner should not be able to start election"
      );
    });

    test('Should not allow non-owner to end election @pass @integration', async () => {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await ContractTestHelper.expectRevert(
        voting.connect(signers.voter1).endElection(),
        "Only the owner can perform this action",
        "Non-owner should not be able to end election"
      );
    });

    test('Should not allow owner to end election @fail @integration', async () => {
      await voting.addCandidate("Alice");
      await voting.startElection();
      await ContractTestHelper.expectRevert(
        //injected bug, correction : connect(voter1)
        voting.connect(signers.owner).endElection(),
        "Only the owner can perform this action",
        "Owner should not be able to end election (injected bug test)"
      );
    });
  });
});