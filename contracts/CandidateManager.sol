// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CandidateManager {
    // Struct to represent a candidate
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    // Mapping to store candidates
    mapping(uint256 => Candidate) public candidates;
    
    // Array to store candidate IDs
    uint256[] public candidateIds;
    
    // Owner of the contract
    address public owner;
    
    // Total number of candidates
    uint256 public candidatesCount;
    
    // Events
    event CandidateAdded(uint256 indexed candidateId, string name);
    event CandidateVoteCountUpdated(uint256 indexed candidateId, uint256 newVoteCount);
    
    // Modifier to ensure only owner can add candidates
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    // Modifier to ensure only authorized contracts can update vote counts
    modifier onlyAuthorized() {
        require(msg.sender == owner || isAuthorizedContract(msg.sender), "Not authorized");
        _;
    }
    
    // Mapping to track authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    constructor() {
        owner = msg.sender;
        candidatesCount = 0;
        authorizedContracts[msg.sender] = true;
    }
    
    // Function to authorize a contract to update vote counts
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
    
    // Function to add a candidate (only owner)
    function addCandidate(string memory _name) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        candidateIds.push(candidatesCount);
        emit CandidateAdded(candidatesCount, _name);
    }
    
    // Function to get candidate details
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }
    
    // Function to get all candidates
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        
        for (uint256 i = 0; i < candidatesCount; i++) {
            allCandidates[i] = candidates[i + 1];
        }
        
        return allCandidates;
    }
    
    // Function to update candidate vote count (only authorized contracts)
    function updateCandidateVoteCount(uint256 _candidateId, uint256 _newVoteCount) public onlyAuthorized {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        candidates[_candidateId].voteCount = _newVoteCount;
        emit CandidateVoteCountUpdated(_candidateId, _newVoteCount);
    }
    
    // Function to increment candidate vote count (only authorized contracts)
    function incrementCandidateVoteCount(uint256 _candidateId) public onlyAuthorized {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        candidates[_candidateId].voteCount++;
        emit CandidateVoteCountUpdated(_candidateId, candidates[_candidateId].voteCount);
    }
    
    // Function to reset all candidate vote counts (only authorized contracts)
    function resetAllVoteCounts() public onlyAuthorized {
        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
            emit CandidateVoteCountUpdated(i, 0);
        }
    }
    
    // Function to get candidate count
    function getCandidatesCount() public view returns (uint256) {
        return candidatesCount;
    }
    
    // Function to check if candidate exists
    function candidateExists(uint256 _candidateId) public view returns (bool) {
        return _candidateId > 0 && _candidateId <= candidatesCount;
    }
}
