// Voting DApp Application Logic
let CONTRACT_ADDRESS = "";
const CONTRACT_ABI = [
    "function candidatesCount() view returns (uint256)",
    "function getCandidate(uint256 _candidateId) view returns (uint256, string memory, uint256)",
    "function vote(uint256 _candidateId)",
    "function checkVoted(address _voter) view returns (bool)",
    "function addCandidate(string memory _name)",
    "function getAllCandidates() view returns (tuple(uint256,string,uint256)[])",
    "function getTotalVotes() view returns (uint256)",
    "function getTotalVoters() view returns (uint256)",
    "function isElectionActive() view returns (bool)",
    "function startElection()",
    "function endElection()",
    "function owner() view returns (address)",
    "function currentElectionRound() view returns (uint256)"
];

let ACCOUNTS = [];

let provider, signer, contract, userAddress;
let readOnlyProvider, readOnlyContract;
let CANDIDATES_CONFIG = { candidates: [] };

// Load deployment info (contract address)
async function loadDeploymentInfo() {
    try {
        const response = await fetch('../config/deployment.json');
        const deploymentInfo = await response.json();
        CONTRACT_ADDRESS = deploymentInfo.contractAddress;
        console.log('Loaded contract address:', CONTRACT_ADDRESS);
    } catch (error) {
        console.error('Failed to load deployment info:', error);
    }
}

// Load accounts config
async function loadAccounts() {
    try {
        const response = await fetch('../config/accounts.json');
        const accountsConfig = await response.json();
        ACCOUNTS = accountsConfig.accounts;
        
        // Populate account dropdown
        const accountSelect = document.getElementById('accountSelect');
        accountSelect.innerHTML = '';
        
        ACCOUNTS.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            const shortAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
            const adminLabel = account.isAdmin ? ' - ADMIN' : '';
            const adminIcon = account.isAdmin ? '🔧 ' : '';
            option.textContent = `${adminIcon}Account #${account.id} (${shortAddress})${adminLabel}`;
            accountSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Failed to load accounts config:', error);
        alert('Failed to load accounts. Please refresh the page.');
    }
}

// Load candidates config
async function loadConfig() {
    try {
        const response = await fetch('../config/candidates.json');
        CANDIDATES_CONFIG = await response.json();
    } catch (error) {
        console.error('Failed to load candidates config:', error);
    }
}

// Initialize read-only connection on page load
async function initializeReadOnly() {
    try {
        await loadDeploymentInfo();
        await loadAccounts();
        await loadConfig();
        
        if (!CONTRACT_ADDRESS) {
            throw new Error('No contract address available');
        }
        
        readOnlyProvider = new ethers.JsonRpcProvider(process.env.SERVER_ADRESS);
        readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readOnlyProvider);
        await loadCandidatesReadOnly();
    } catch (error) {
        console.log('Read-only connection failed:', error.message);
    }
}

// Load candidates in read-only mode
async function loadCandidatesReadOnly() {
    try {
        const candidatesCount = await readOnlyContract.candidatesCount();
        const candidatesList = document.getElementById('candidatesList');
        
        // Check election status
        const isElectionActive = await readOnlyContract.isElectionActive();
        const statusDisplay = document.getElementById('electionStatusDisplay');
        
        if (isElectionActive) {
            statusDisplay.textContent = 'ACTIVE';
            statusDisplay.className = 'status-indicator active';
        } else {
            statusDisplay.textContent = 'INACTIVE';
            statusDisplay.className = 'status-indicator inactive';
        }
        
        candidatesList.innerHTML = '';
        
        for (let i = 1; i <= candidatesCount; i++) {
            const candidate = await readOnlyContract.getCandidate(i);
            
            // Voting section (disabled when not connected or election inactive)
            const candidateCard = document.createElement('div');
            candidateCard.className = 'candidate-card';
            candidateCard.innerHTML = `
                <div class="candidate-name">${candidate[1]}</div>
                <button class="btn btn-vote" disabled>
                    ${!isElectionActive ? 'Election Not Active' : 'Connect Account to Vote'}
                </button>
            `;
            candidatesList.appendChild(candidateCard);
        }
        
        // Load voter stats
        await loadVoterStats();
        
    } catch (error) {
        console.log('Error loading candidates (read-only):', error.message);
    }
}

// Initialize on page load
initializeReadOnly();

document.getElementById('connectAccount').addEventListener('click', async function() {
    try {
        const accountId = parseInt(document.getElementById('accountSelect').value);
        const selectedAccount = ACCOUNTS.find(acc => acc.id === accountId);
        
        provider = new ethers.JsonRpcProvider(process.env.SERVER_ADRESS);
        signer = new ethers.Wallet(selectedAccount.privateKey, provider);
        userAddress = selectedAccount.address;
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Check if user is the owner
        const owner = await contract.owner();
        const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
        
        document.getElementById('accountAddress').textContent = 
            `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        document.getElementById('accountNumber').textContent = `Account #${selectedAccount.id}${isOwner ? ' (Owner)' : ''}`;
        document.getElementById('accountInfo').style.display = 'block';
        document.getElementById('connectAccount').style.display = 'none';
        
        // Show admin section if user is owner
        if (isOwner) {
            document.getElementById('adminSection').style.display = 'block';
            document.getElementById('startElection').disabled = false;
            document.getElementById('endElection').disabled = false;
            await loadAdminElectionStatus();
        }
        
        await addSampleCandidates();
        await loadCandidates();
        
    } catch (error) {
        alert('Connection error: ' + error.message);
    }
});

document.getElementById('disconnectAccount').addEventListener('click', function() {
    provider = null;
    signer = null;
    contract = null;
    userAddress = null;
    
    document.getElementById('accountInfo').style.display = 'none';
    document.getElementById('connectAccount').style.display = 'block';
    document.getElementById('adminSection').style.display = 'none';
    
    // Go back to read-only mode
    loadCandidatesReadOnly();
});

async function addSampleCandidates() {
    try {
        const candidatesCount = await contract.candidatesCount();
        if (candidatesCount.toString() === '0') {
            for (const candidateName of CANDIDATES_CONFIG.candidates) {
                await contract.addCandidate(candidateName);
            }
        }
    } catch (error) {
        // Silent fail
    }
}

async function loadCandidates() {
    try {
        const candidatesCount = await contract.candidatesCount();
        const candidatesList = document.getElementById('candidatesList');
        
        // Check election status
        const isElectionActive = await contract.isElectionActive();
        const statusDisplay = document.getElementById('electionStatusDisplay');
        
        if (isElectionActive) {
            statusDisplay.textContent = 'ACTIVE';
            statusDisplay.className = 'status-indicator active';
        } else {
            statusDisplay.textContent = 'INACTIVE';
            statusDisplay.className = 'status-indicator inactive';
        }
        
        candidatesList.innerHTML = '';
        
        const hasVoted = await contract.checkVoted(userAddress);
        
        for (let i = 1; i <= candidatesCount; i++) {
            const candidate = await contract.getCandidate(i);
            
            const candidateCard = document.createElement('div');
            candidateCard.className = 'candidate-card';
            
            let buttonText = 'Vote';
            let buttonDisabled = false;
            
            if (hasVoted) {
                buttonText = 'Already Voted';
                buttonDisabled = true;
            } else if (!isElectionActive) {
                buttonText = 'Election Not Active';
                buttonDisabled = true;
            }
            
            candidateCard.innerHTML = `
                <div class="candidate-name">${candidate[1]}</div>
                <button class="btn btn-vote" onclick="vote(${candidate[0].toString()})" 
                        ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;
            candidatesList.appendChild(candidateCard);
        }
        
        // Load voter stats
        await loadVoterStats();
        
    } catch (error) {
        alert('Error loading candidates: ' + error.message);
    }
}

async function vote(candidateId) {
    try {
        const tx = await contract.vote(candidateId);
        await tx.wait();
        
        // Get candidate name for confirmation
        const candidate = await contract.getCandidate(candidateId);
        const candidateName = candidate[1];
        
        alert(`✅ Vote submitted successfully!\n\nYou voted for: ${candidateName}`);
        await loadCandidates();
    } catch (error) {
        alert('Error voting: ' + error.message);
    }
}

// Load voter statistics
async function loadVoterStats() {
    try {
        if (readOnlyContract) {
            const totalVoters = await readOnlyContract.getTotalVoters();
            document.getElementById('totalVoters').textContent = totalVoters.toString();
        } else if (contract) {
            const totalVoters = await contract.getTotalVoters();
            document.getElementById('totalVoters').textContent = totalVoters.toString();
        }
    } catch (error) {
        console.error('Error loading voter stats:', error);
    }
}

document.getElementById('refreshStats').addEventListener('click', function() {
    loadVoterStats();
});

// Admin functions
async function loadAdminElectionStatus() {
    try {
        const isActive = await contract.isElectionActive();
        const statusElement = document.getElementById('adminElectionStatus');
        const startBtn = document.getElementById('startElection');
        const endBtn = document.getElementById('endElection');
        
        if (isActive) {
            statusElement.textContent = 'ACTIVE';
            statusElement.className = 'status-indicator active';
            startBtn.disabled = true;
            endBtn.disabled = false;
        } else {
            statusElement.textContent = 'INACTIVE';
            statusElement.className = 'status-indicator inactive';
            startBtn.disabled = false;
            endBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error loading admin election status:', error);
    }
}

document.getElementById('startElection').addEventListener('click', async function() {
    try {
        const tx = await contract.startElection();
        await tx.wait();
        alert('Election started successfully! All previous results have been reset.');
        
        // Hide final results section when starting new election
        document.getElementById('resultsSection').style.display = 'none';
        
        await loadAdminElectionStatus();
        await loadCandidates(); // Refresh main view
    } catch (error) {
        alert('Error starting election: ' + error.message);
    }
});

document.getElementById('endElection').addEventListener('click', async function() {
    try {
        const tx = await contract.endElection();
        await tx.wait();
        alert('Election ended successfully! Results are now visible.');
        await loadAdminElectionStatus();
        await loadCandidates(); // Refresh main view
        await showFinalResults(); // Show results after election ends
    } catch (error) {
        alert('Error ending election: ' + error.message);
    }
});

// Show final results when election ends
async function showFinalResults() {
    try {
        const candidatesCount = await contract.candidatesCount();
        const resultsList = document.getElementById('resultsList');
        const resultsSection = document.getElementById('resultsSection');
        
        resultsList.innerHTML = '';
        
        for (let i = 1; i <= candidatesCount; i++) {
            const candidate = await contract.getCandidate(i);
            
            const resultCard = document.createElement('div');
            resultCard.className = 'candidate-card';
            resultCard.innerHTML = `
                <div class="candidate-name">${candidate[1]}</div>
                <div class="vote-count">${candidate[2].toString()}</div>
                <div class="candidate-votes">votes</div>
            `;
            resultsList.appendChild(resultCard);
        }
        
        resultsSection.style.display = 'block';
    } catch (error) {
        console.error('Error loading final results:', error);
    }
}
