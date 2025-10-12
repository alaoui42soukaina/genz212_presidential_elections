// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ElectionManager {
    // Owner of the contract
    address public owner;
    
    // Election state
    bool public electionActive;
    uint256 public currentElectionRound;
    
    // Mapping to track which election round each voter voted in
    mapping(address => uint256) public voterElectionRound;
    
    // Events
    event ElectionStarted(uint256 indexed round);
    event ElectionStopped();
    event VoterRegistered(address indexed voter, uint256 indexed round);
    
    // Modifier to ensure only owner can control elections
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }
    
    // Modifier to ensure only authorized contracts can register voters
    modifier onlyAuthorized() {
        require(msg.sender == owner || isAuthorizedContract(msg.sender), "Not authorized");
        _;
    }
    
    // Mapping to track authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    constructor() {
        owner = msg.sender;
        electionActive = false;
        currentElectionRound = 0;
        authorizedContracts[msg.sender] = true;
    }
    
    // Function to authorize a contract to register voters
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
    
    // Function to start election (only owner)
    function startElection() public onlyOwner {
        require(!electionActive, "Election is already active");
        
        // Start new election round (this effectively resets all voter records)
        currentElectionRound++;
        
        electionActive = true;
        emit ElectionStarted(currentElectionRound);
    }
    
    // Function to end election (only owner)
    function endElection() public onlyOwner {
        require(electionActive, "Election is not active");
        electionActive = false;
        emit ElectionStopped();
    }
    
    // Function to check election status
    function isElectionActive() public view returns (bool) {
        return electionActive;
    }
    
    // Function to register a voter for current election round (only authorized contracts)
    function registerVoter(address _voter) public onlyAuthorized {
        require(electionActive, "Election is not active");
        require(voterElectionRound[_voter] != currentElectionRound, "Voter already registered for this round");
        
        voterElectionRound[_voter] = currentElectionRound;
        emit VoterRegistered(_voter, currentElectionRound);
    }
    
    // Function to check if an address has voted in current election
    function hasVotedInCurrentRound(address _voter) public view returns (bool) {
        return voterElectionRound[_voter] == currentElectionRound;
    }
    
    // Function to get the election round a voter participated in
    function getVoterElectionRound(address _voter) public view returns (uint256) {
        return voterElectionRound[_voter];
    }
    
    // Function to get current election round
    function getCurrentElectionRound() public view returns (uint256) {
        return currentElectionRound;
    }
    
    // Function to check if voter can vote (hasn't voted in current round)
    function canVote(address _voter) public view returns (bool) {
        return electionActive && voterElectionRound[_voter] != currentElectionRound;
    }
    
    // Function to get total voters in current round
    function getTotalVotersInCurrentRound() public pure returns (uint256) {
        // This would require additional tracking, for now return 0
        // In a full implementation, you might want to track this separately
        return 0;
    }
}
