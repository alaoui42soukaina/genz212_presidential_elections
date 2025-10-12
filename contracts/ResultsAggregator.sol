// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CandidateManager.sol";

contract ResultsAggregator {
    // Owner of the contract
    address public owner;
    
    // Reference to CandidateManager contract
    CandidateManager public candidateManager;
    
    // Events
    event ResultsCalculated(uint256 indexed electionRound, uint256 totalVotes);
    event WinnerDeclared(uint256 indexed candidateId, string name, uint256 voteCount);
    
    // Modifier to ensure only owner can perform admin functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    
    // Mapping to track authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    constructor(address _candidateManagerAddress) {
        owner = msg.sender;
        candidateManager = CandidateManager(_candidateManagerAddress);
        authorizedContracts[msg.sender] = true;
    }
    
    // Function to authorize a contract to access results
    function authorizeContract(address _contract) public onlyOwner {
        authorizedContracts[_contract] = true;
    }
    
    // Function to revoke authorization
    function revokeContractAuthorization(address _contract) public onlyOwner {
        authorizedContracts[_contract] = false;
    }
    
    
    // Function to get total votes cast across all candidates
    function getTotalVotes() public view returns (uint256) {
        uint256 total = 0;
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, , uint256 voteCount) = candidateManager.getCandidate(i);
            total += voteCount;
        }
        
        return total;
    }
    
    // Function to get total number of voters (same as total votes since each voter votes once)
    function getTotalVoters() public view returns (uint256) {
        return getTotalVotes();
    }
    
    // Function to get candidate with most votes (winner)
    function getWinner() public view returns (uint256 candidateId, string memory name, uint256 voteCount) {
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        require(candidatesCount > 0, "No candidates available");
        
        uint256 maxVotes = 0;
        uint256 winnerId = 1; // Default to first candidate
        string memory winnerName = "";
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, string memory candidateName, uint256 votes) = candidateManager.getCandidate(i);
            if (votes > maxVotes) {
                maxVotes = votes;
                winnerId = i;
                winnerName = candidateName;
            }
        }
        
        // If no votes were found, return first candidate
        if (bytes(winnerName).length == 0) {
            (, winnerName, ) = candidateManager.getCandidate(1);
        }
        
        return (winnerId, winnerName, maxVotes);
    }
    
    // Function to get all candidates sorted by vote count (descending)
    function getCandidatesByVoteCount() public view returns (
        uint256[] memory candidateIds,
        string[] memory names,
        uint256[] memory voteCounts
    ) {
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        
        candidateIds = new uint256[](candidatesCount);
        names = new string[](candidatesCount);
        voteCounts = new uint256[](candidatesCount);
        
        // Fill arrays with candidate data
        for (uint256 i = 0; i < candidatesCount; i++) {
            (uint256 id, string memory name, uint256 votes) = candidateManager.getCandidate(i + 1);
            candidateIds[i] = id;
            names[i] = name;
            voteCounts[i] = votes;
        }
        
        // Simple bubble sort by vote count (descending)
        for (uint256 i = 0; i < candidatesCount - 1; i++) {
            for (uint256 j = 0; j < candidatesCount - i - 1; j++) {
                if (voteCounts[j] < voteCounts[j + 1]) {
                    // Swap vote counts
                    uint256 tempVotes = voteCounts[j];
                    voteCounts[j] = voteCounts[j + 1];
                    voteCounts[j + 1] = tempVotes;
                    
                    // Swap candidate IDs
                    uint256 tempId = candidateIds[j];
                    candidateIds[j] = candidateIds[j + 1];
                    candidateIds[j + 1] = tempId;
                    
                    // Swap names
                    string memory tempName = names[j];
                    names[j] = names[j + 1];
                    names[j + 1] = tempName;
                }
            }
        }
        
        return (candidateIds, names, voteCounts);
    }
    
    // Function to get vote percentage for a candidate
    function getVotePercentage(uint256 _candidateId) public view returns (uint256) {
        uint256 totalVotes = getTotalVotes();
        if (totalVotes == 0) return 0;
        
        (, , uint256 candidateVotes) = candidateManager.getCandidate(_candidateId);
        return (candidateVotes * 100) / totalVotes;
    }
    
    // Function to get detailed results for all candidates
    function getDetailedResults() public view returns (
        uint256[] memory candidateIds,
        string[] memory names,
        uint256[] memory voteCounts,
        uint256[] memory percentages
    ) {
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        uint256 totalVotes = getTotalVotes();
        
        candidateIds = new uint256[](candidatesCount);
        names = new string[](candidatesCount);
        voteCounts = new uint256[](candidatesCount);
        percentages = new uint256[](candidatesCount);
        
        for (uint256 i = 0; i < candidatesCount; i++) {
            (uint256 id, string memory name, uint256 votes) = candidateManager.getCandidate(i + 1);
            candidateIds[i] = id;
            names[i] = name;
            voteCounts[i] = votes;
            percentages[i] = totalVotes > 0 ? (votes * 100) / totalVotes : 0;
        }
        
        return (candidateIds, names, voteCounts, percentages);
    }
    
    // Function to check if there's a tie for first place
    function hasTie() public view returns (bool) {
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        if (candidatesCount < 2) return false;
        
        uint256 maxVotes = 0;
        uint256 maxVoteCount = 0;
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, , uint256 votes) = candidateManager.getCandidate(i);
            if (votes > maxVotes) {
                maxVotes = votes;
                maxVoteCount = 1;
            } else if (votes == maxVotes && votes > 0) {
                maxVoteCount++;
            }
        }
        
        return maxVoteCount > 1;
    }
    
    // Function to get all candidates tied for first place
    function getTiedCandidates() public view returns (uint256[] memory) {
        uint256 candidatesCount = candidateManager.getCandidatesCount();
        uint256 maxVotes = 0;
        uint256 tieCount = 0;
        
        // First pass: find max votes
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, , uint256 votes) = candidateManager.getCandidate(i);
            if (votes > maxVotes) {
                maxVotes = votes;
            }
        }
        
        // Second pass: count ties
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, , uint256 votes) = candidateManager.getCandidate(i);
            if (votes == maxVotes && votes > 0) {
                tieCount++;
            }
        }
        
        // Only return tied candidates if there's actually a tie (more than 1 candidate with max votes)
        if (tieCount <= 1) {
            return new uint256[](0);
        }
        
        // Third pass: collect tied candidates
        uint256[] memory tiedCandidates = new uint256[](tieCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            (, , uint256 votes) = candidateManager.getCandidate(i);
            if (votes == maxVotes && votes > 0) {
                tiedCandidates[index] = i;
                index++;
            }
        }
        
        return tiedCandidates;
    }
}
