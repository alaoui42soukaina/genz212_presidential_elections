// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CandidateManager.sol";
import "./ElectionManager.sol";
import "./VotingCore.sol";
import "./ResultsAggregator.sol";

contract Voting {
    // Owner of the contract
    address public owner;
    
    // Contract references
    CandidateManager public candidateManager;
    ElectionManager public electionManager;
    VotingCore public votingCore;
    ResultsAggregator public resultsAggregator;
    
    // Events (for backward compatibility)
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event ElectionStarted(uint256 indexed round);
    event ElectionStopped();
    
    // Modifier to ensure only owner can perform admin functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        
        // Deploy all sub-contracts
        candidateManager = new CandidateManager();
        electionManager = new ElectionManager();
        votingCore = new VotingCore(address(candidateManager), address(electionManager));
        resultsAggregator = new ResultsAggregator(address(candidateManager));
        
        // Set up cross-contract authorizations
        candidateManager.authorizeContract(address(votingCore));
        candidateManager.authorizeContract(address(resultsAggregator));
        electionManager.authorizeContract(address(votingCore));
        resultsAggregator.authorizeContract(address(votingCore));
    }
    
    // ========== CANDIDATE MANAGEMENT ==========
    
    // Function to add a candidate (only owner)
    function addCandidate(string memory _name) public onlyOwner {
        candidateManager.addCandidate(_name);
        emit CandidateAdded(candidateManager.getCandidatesCount(), _name);
    }
    
    // Function to get candidate details
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256) {
        return candidateManager.getCandidate(_candidateId);
    }
    
    // Function to get all candidates
    function getAllCandidates() public view returns (CandidateManager.Candidate[] memory) {
        return candidateManager.getAllCandidates();
    }
    
    // Function to get candidates count
    function candidatesCount() public view returns (uint256) {
        return candidateManager.getCandidatesCount();
    }
    
    // ========== VOTING FUNCTIONALITY ==========
    
    // Function to vote for a candidate
    function vote(uint256 _candidateId) public {
        votingCore.vote(_candidateId, msg.sender);
        emit VoteCast(msg.sender, _candidateId);
    }
    
    // Function to check if an address has voted in current election
    function checkVoted(address _voter) public view returns (bool) {
        return votingCore.checkVoted(_voter);
    }
    
    // ========== ELECTION MANAGEMENT ==========
    
    // Function to start election (only owner)
    function startElection() public onlyOwner {
        // Reset vote counts before starting new election
        votingCore.resetVotingData();
        electionManager.startElection();
        emit ElectionStarted(electionManager.getCurrentElectionRound());
    }
    
    // Function to end election (only owner)
    function endElection() public onlyOwner {
        electionManager.endElection();
        emit ElectionStopped();
    }
    
    // Function to check election status
    function isElectionActive() public view returns (bool) {
        return votingCore.isElectionActive();
    }
    
    // Function to get current election round
    function currentElectionRound() public view returns (uint256) {
        return votingCore.getCurrentElectionRound();
    }
    
    // ========== RESULTS AND STATISTICS ==========
    
    // Function to get total votes cast
    function getTotalVotes() public view returns (uint256) {
        return resultsAggregator.getTotalVotes();
    }
    
    // Function to get total number of voters
    function getTotalVoters() public view returns (uint256) {
        return resultsAggregator.getTotalVoters();
    }
    
    // Function to get winner
    function getWinner() public view returns (uint256 candidateId, string memory name, uint256 voteCount) {
        return resultsAggregator.getWinner();
    }
    
    // Function to get candidates sorted by vote count
    function getCandidatesByVoteCount() public view returns (
        uint256[] memory candidateIds,
        string[] memory names,
        uint256[] memory voteCounts
    ) {
        return resultsAggregator.getCandidatesByVoteCount();
    }
    
    // Function to get detailed results
    function getDetailedResults() public view returns (
        uint256[] memory candidateIds,
        string[] memory names,
        uint256[] memory voteCounts,
        uint256[] memory percentages
    ) {
        return resultsAggregator.getDetailedResults();
    }
    
    // Function to check if there's a tie
    function hasTie() public view returns (bool) {
        return resultsAggregator.hasTie();
    }
    
    // Function to get tied candidates
    function getTiedCandidates() public view returns (uint256[] memory) {
        return resultsAggregator.getTiedCandidates();
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    // Function to get contract addresses (for debugging/admin)
    function getContractAddresses() public view returns (
        address candidateManagerAddr,
        address electionManagerAddr,
        address votingCoreAddr,
        address resultsAggregatorAddr
    ) {
        return (
            address(candidateManager),
            address(electionManager),
            address(votingCore),
            address(resultsAggregator)
        );
    }
    
    // Function to get comprehensive voting statistics
    function getVotingStats() public view returns (
        uint256 totalCandidates,
        uint256 currentRound,
        bool isActive,
        uint256 totalVotes,
        bool hasTieResult
    ) {
        (totalCandidates, currentRound, isActive, totalVotes) = votingCore.getVotingStats();
        hasTieResult = resultsAggregator.hasTie();
        
        return (totalCandidates, currentRound, isActive, totalVotes, hasTieResult);
    }
}
