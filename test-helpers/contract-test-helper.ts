import { ethers } from 'hardhat';
import { expect as playwrightExpect } from '@playwright/test';

/**
 * Custom expect function that handles BigInt conversions
 * @param actual - The actual value to compare
 * @param expected - The expected value to compare
 * @returns The result of the comparison
 */
export const expect = {
  toBe: (actual: any, expected: any) => {
    const convertedActual = ContractTestHelper.convertBigIntToNumber(actual);
    const convertedExpected = ContractTestHelper.convertBigIntToNumber(expected);
    return playwrightExpect(convertedActual).toBe(convertedExpected);
  },
  toEqual: (actual: any, expected: any) => {
    const convertedActual = ContractTestHelper.convertBigIntToNumber(actual);
    const convertedExpected = ContractTestHelper.convertBigIntToNumber(expected);
    return playwrightExpect(convertedActual).toEqual(convertedExpected);
  },
  toBeTruthy: (actual: any) => {
    return playwrightExpect(actual).toBeTruthy();
  },
  toBeFalsy: (actual: any) => {
    return playwrightExpect(actual).toBeFalsy();
  },
  toContain: (actual: any, expected: any) => {
    return playwrightExpect(actual).toContain(expected);
  },
  not: {
    toContain: (actual: any, expected: any) => {
      return playwrightExpect(actual).not.toContain(expected);
    }
  }
};

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
    expectedArgs?: any[]
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

    playwrightExpect(event, `Event ${eventName} should be emitted`).toBeTruthy();
    
    if (expectedArgs && event) {
      const parsedLog = contract.interface.parseLog(event);
      // Convert BigInt values to numbers for comparison
      const convertedArgs = this.convertBigIntToNumber(parsedLog.args);
      playwrightExpect(convertedArgs, `Event ${eventName} should have correct arguments`).toEqual(expectedArgs);
    }
  }

  static async expectRevert(txPromise: Promise<any>, expectedMessage?: string): Promise<void> {
    try {
      await txPromise;
      playwrightExpect(false).toBeTruthy();
    } catch (error: any) {
      if (expectedMessage) {
        playwrightExpect(error.message).toContain(expectedMessage);
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
