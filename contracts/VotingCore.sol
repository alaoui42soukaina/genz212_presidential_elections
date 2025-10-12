// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CandidateManager.sol";
import "./ElectionManager.sol";

contract VotingCore {
    // Owner of the contract
    address public owner;
    
    // References to other contracts
    CandidateManager public candidateManager;
    ElectionManager public electionManager;
    
    // Events
    event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 indexed electionRound);
    event VoteInvalidated(address indexed voter, string reason);
    
    // Modifier to ensure only owner can perform admin functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    // Modifier to ensure only authorized contracts can perform actions
    modifier onlyAuthorized() {
        require(msg.sender == owner || isAuthorizedContract(msg.sender), "Not authorized");
        _;
    }
    
    // Mapping to track authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    constructor(address _candidateManagerAddress, address _electionManagerAddress) {
        owner = msg.sender;
        candidateManager = CandidateManager(_candidateManagerAddress);
        electionManager = ElectionManager(_electionManagerAddress);
        authorizedContracts[msg.sender] = true;
    }
    
    // Function to authorize a contract
    function authorizeContract(address _contract) public onlyOwner {
        authorizedContracts[_contract] = true;
    }
    
    // Function to revoke authorization
    function revokeContractAuthorization(address _contract) public onlyOwner {
        authorizedContracts[_contract] = false;
    }
    
    // Internal function to check if address is authorized
    function isAuthorizedContract(address _address) internal view returns (bool) {
        return authorizedContracts[_address];
    }
    
    // Core voting function
    function vote(uint256 _candidateId, address _voter) public onlyAuthorized {
        // Check if election is active
        require(electionManager.isElectionActive(), "Election is not active");
        
        // Check if candidate exists
        require(candidateManager.candidateExists(_candidateId), "Invalid candidate ID");
        
        // Check if voter can vote (hasn't voted in current round)
        require(electionManager.canVote(_voter), "You have already voted in this election");
        
        // Register the voter for current election round
        electionManager.registerVoter(_voter);
        
        // Increment candidate vote count
        candidateManager.incrementCandidateVoteCount(_candidateId);
        
        // Emit vote event
        emit VoteCast(_voter, _candidateId, electionManager.getCurrentElectionRound());
    }
    
    // Convenience function for direct voting (for backward compatibility)
    function voteDirect(uint256 _candidateId) public {
        // Check if election is active
        require(electionManager.isElectionActive(), "Election is not active");
        
        // Check if candidate exists
        require(candidateManager.candidateExists(_candidateId), "Invalid candidate ID");
        
        // Check if voter can vote (hasn't voted in current round)
        require(electionManager.canVote(msg.sender), "You have already voted in this election");
        
        // Register the voter for current election round
        electionManager.registerVoter(msg.sender);
        
        // Increment candidate vote count
        candidateManager.incrementCandidateVoteCount(_candidateId);
        
        // Emit vote event
        emit VoteCast(msg.sender, _candidateId, electionManager.getCurrentElectionRound());
    }
    
    // Function to check if an address has voted in current election
    function checkVoted(address _voter) public view returns (bool) {
        return electionManager.hasVotedInCurrentRound(_voter);
    }
    
    // Function to validate vote eligibility
    function canVote(address _voter) public view returns (bool) {
        return electionManager.canVote(_voter);
    }
    
    // Function to get voter's election round
    function getVoterElectionRound(address _voter) public view returns (uint256) {
        return electionManager.getVoterElectionRound(_voter);
    }
    
    // Function to get current election round
    function getCurrentElectionRound() public view returns (uint256) {
        return electionManager.getCurrentElectionRound();
    }
    
    // Function to check election status
    function isElectionActive() public view returns (bool) {
        return electionManager.isElectionActive();
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
    function getCandidatesCount() public view returns (uint256) {
        return candidateManager.getCandidatesCount();
    }
    
    // Function to check if candidate exists
    function candidateExists(uint256 _candidateId) public view returns (bool) {
        return candidateManager.candidateExists(_candidateId);
    }
    
    // Emergency function to invalidate a vote (only owner)
    function invalidateVote(address _voter, string memory _reason) public onlyOwner {
        // This would require additional tracking to implement properly
        // For now, just emit an event
        emit VoteInvalidated(_voter, _reason);
    }
    
    // Function to get voting statistics
    function getVotingStats() public view returns (
        uint256 totalCandidates,
        uint256 currentElectionRound,
        bool electionActive,
        uint256 totalVotes
    ) {
        totalCandidates = candidateManager.getCandidatesCount();
        currentElectionRound = electionManager.getCurrentElectionRound();
        electionActive = electionManager.isElectionActive();
        
        // Calculate total votes
        totalVotes = 0;
        for (uint256 i = 1; i <= totalCandidates; i++) {
            (, , uint256 voteCount) = candidateManager.getCandidate(i);
            totalVotes += voteCount;
        }
        
        return (totalCandidates, currentElectionRound, electionActive, totalVotes);
    }
    
    // Function to reset voting data for new election (only authorized)
    function resetVotingData() public onlyAuthorized {
        candidateManager.resetAllVoteCounts();
    }
    
    // Function to update contract references (only owner)
    function updateCandidateManager(address _newCandidateManager) public onlyOwner {
        candidateManager = CandidateManager(_newCandidateManager);
    }
    
    // Function to update contract references (only owner)
    function updateElectionManager(address _newElectionManager) public onlyOwner {
        electionManager = ElectionManager(_newElectionManager);
    }
}
