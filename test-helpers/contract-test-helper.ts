import { expect } from '@playwright/test';

const { ethers } = require('hardhat');

export interface ContractSigners {
  owner: any;
  authorizedContract: any;
  unauthorizedUser: any;
  voter1: any;
  voter2: any;
  voter3: any;
}

export interface ContractAddresses {
  candidateManager: string;
  electionManager: string;
  votingCore: string;
  resultsAggregator: string;
}

export class ContractTestHelper {
  static convertBigIntToNumber(value: any): any {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (Array.isArray(value)) {
      return value.map(item => this.convertBigIntToNumber(item));
    }
    if (value && typeof value === 'object') {
      const converted: any = {};
      for (const key in value) {
        converted[key] = this.convertBigIntToNumber(value[key]);
      }
      return converted;
    }
    return value;
  }

  static async getSigners(): Promise<ContractSigners> {
    const [owner, authorizedContract, unauthorizedUser, voter1, voter2, voter3] = await ethers.getSigners();
    return {
      owner,
      authorizedContract,
      unauthorizedUser,
      voter1,
      voter2,
      voter3
    };
  }

  static async deployCandidateManager(): Promise<any> {
    const CandidateManager = await ethers.getContractFactory("CandidateManager");
    const candidateManager = await CandidateManager.deploy();
    await candidateManager.waitForDeployment();
    return candidateManager;
  }

  static async deployElectionManager(): Promise<any> {
    const ElectionManager = await ethers.getContractFactory("ElectionManager");
    const electionManager = await ElectionManager.deploy();
    await electionManager.waitForDeployment();
    return electionManager;
  }

  static async deployResultsAggregator(candidateManagerAddress: string): Promise<any> {
    const ResultsAggregator = await ethers.getContractFactory("ResultsAggregator");
    const resultsAggregator = await ResultsAggregator.deploy(candidateManagerAddress);
    await resultsAggregator.waitForDeployment();
    return resultsAggregator;
  }

  static async deployVotingCore(candidateManagerAddress: string, electionManagerAddress: string): Promise<any> {
    const VotingCore = await ethers.getContractFactory("VotingCore");
    const votingCore = await VotingCore.deploy(candidateManagerAddress, electionManagerAddress);
    await votingCore.waitForDeployment();
    return votingCore;
  }

  static async deployVoting(): Promise<any> {
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy();
    await voting.waitForDeployment();
    return voting;
  }

  static async setupContractAuthorizations(
    candidateManager: any,
    electionManager: any,
    votingCore: any,
    resultsAggregator: any,
    authorizedContract: any
  ): Promise<void> {
    await candidateManager.authorizeContract(await votingCore.getAddress());
    await electionManager.authorizeContract(await votingCore.getAddress());
    await votingCore.authorizeContract(authorizedContract.address);
    await resultsAggregator.authorizeContract(authorizedContract.address);
  }

  static async addTestCandidates(candidateManager: any, candidates: string[] = ["Alice", "Bob", "Charlie"]): Promise<void> {
    for (const candidateName of candidates) {
      await candidateManager.addCandidate(candidateName);
    }
  }

  static async expectEvent(
    txPromise: Promise<any>,
    contract: any,
    eventName: string,
    expectedArgs?: any[],
    customMessage?: string
  ): Promise<void> {
    const tx = await txPromise;
    const receipt = await tx.wait();
    
    const event = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog.name === eventName;
      } catch {
        return false;
      }
    });

    const message = customMessage || `Event ${eventName} should be emitted`;
    expect(event, message).toBeTruthy();
    
    if (expectedArgs && event) {
      const parsedLog = contract.interface.parseLog(event);
      // Convert BigInt values to numbers for comparison
      const convertedArgs = this.convertBigIntToNumber(parsedLog.args);
      const argsMessage = customMessage || `Event ${eventName} should have correct arguments`;
      expect(convertedArgs, argsMessage).toEqual(expectedArgs);
    }
  }

  static async expectRevert(txPromise: Promise<any>, expectedMessage?: string, customMessage?: string): Promise<void> {
    try {
      await txPromise;
      const message = customMessage || "Transaction should have reverted";
      expect(false, message).toBeTruthy();
    } catch (error: any) {
      if (expectedMessage) {
        const revertMessage = customMessage || `Transaction should revert with message containing: ${expectedMessage}`;
        expect(error.message, revertMessage).toContain(expectedMessage);
      }
    }
  }

  static async getContractAddresses(voting: any): Promise<ContractAddresses> {
    const addresses = await voting.getContractAddresses();
    return {
      candidateManager: addresses.candidateManagerAddr,
      electionManager: addresses.electionManagerAddr,
      votingCore: addresses.votingCoreAddr,
      resultsAggregator: addresses.resultsAggregatorAddr
    };
  }

  static async getContractAt(contractName: string, address: string): Promise<any> {
    return await ethers.getContractAt(contractName, address);
  }

  static async setupIntegrationTest(): Promise<{
    voting: any;
    candidateManager: any;
    electionManager: any;
    votingCore: any;
    resultsAggregator: any;
    signers: ContractSigners;
  }> {
    const signers = await this.getSigners();
    
    const voting = await this.deployVoting();
    await voting.waitForDeployment();
    
    const candidateManager = await this.getContractAt("CandidateManager", await voting.candidateManager());
    const electionManager = await this.getContractAt("ElectionManager", await voting.electionManager());
    const votingCore = await this.getContractAt("VotingCore", await voting.votingCore());
    const resultsAggregator = await this.getContractAt("ResultsAggregator", await voting.resultsAggregator());

    return {
      voting,
      candidateManager,
      electionManager,
      votingCore,
      resultsAggregator,
      signers
    };
  }
}
