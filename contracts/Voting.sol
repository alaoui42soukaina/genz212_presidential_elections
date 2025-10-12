// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
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
    
    // Election state
    bool public electionActive;
    uint256 public currentElectionRound;
    
    // Mapping to track which election round each voter voted in
    mapping(address => uint256) public voterElectionRound;
    
    // Events
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event ElectionStarted(uint256 indexed round);
    event ElectionStopped();
    
    // Modifier to ensure only owner can add candidates
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    // Constructor
    constructor() {
        owner = msg.sender;
        candidatesCount = 0;
        electionActive = false;
        currentElectionRound = 0;
    }
    
    // Function to add a candidate (only owner)
    function addCandidate(string memory _name) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        candidateIds.push(candidatesCount);
        emit CandidateAdded(candidatesCount, _name);
    }
    
    // Function to vote for a candidate
    function vote(uint256 _candidateId) public {
        require(electionActive, "Election is not active");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(voterElectionRound[msg.sender] != currentElectionRound, "You have already voted in this election");
        
        voterElectionRound[msg.sender] = currentElectionRound;
        candidates[_candidateId].voteCount++;
        
        emit VoteCast(msg.sender, _candidateId);
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
    
    // Function to check if an address has voted in current election
    function checkVoted(address _voter) public view returns (bool) {
        return voterElectionRound[_voter] == currentElectionRound;
    }
    
    // Function to get total votes cast
    function getTotalVotes() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            total += candidates[i].voteCount;
        }
        return total;
    }
    
    // Function to get total number of voters
    function getTotalVoters() public view returns (uint256) {
        return getTotalVotes(); // Same as total votes since each voter can only vote once
    }
    
    // Admin functions to control election state
    function startElection() public onlyOwner {
        require(!electionActive, "Election is already active");
        
        // Reset all vote data
        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }
        
        // Start new election round (this effectively resets all voter records)
        currentElectionRound++;
        
        electionActive = true;
        emit ElectionStarted(currentElectionRound);
    }
    
    function endElection() public onlyOwner {
        require(electionActive, "Election is not active");
        electionActive = false;
        emit ElectionStopped();
    }
    
    // Function to check election status
    function isElectionActive() public view returns (bool) {
        return electionActive;
    }
}
