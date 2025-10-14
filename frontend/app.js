// Voting DApp Application Logic
let CONTRACT_ADDRESS = '';
const CONTRACT_ABI = [
  // Original functions (backward compatibility)
  'function candidatesCount() view returns (uint256)',
  'function getCandidate(uint256 _candidateId) view returns (uint256, string memory, uint256)',
  'function vote(uint256 _candidateId)',
  'function checkVoted(address _voter) view returns (bool)',
  'function addCandidate(string memory _name)',
  'function getAllCandidates() view returns (tuple(uint256,string,uint256)[])',
  'function getTotalVotes() view returns (uint256)',
  'function getTotalVoters() view returns (uint256)',
  'function isElectionActive() view returns (bool)',
  'function startElection()',
  'function endElection()',
  'function owner() view returns (address)',
  'function currentElectionRound() view returns (uint256)',

  // New results and statistics functions
  'function getWinner() view returns (uint256 candidateId, string memory name, uint256 voteCount)',
  'function getCandidatesByVoteCount() view returns (uint256[] candidateIds, string[] names, uint256[] voteCounts)',
  'function getDetailedResults() view returns (uint256[] candidateIds, string[] names, uint256[] voteCounts, uint256[] percentages)',
  'function hasTie() view returns (bool)',
  'function getTiedCandidates() view returns (uint256[])',
  'function getVotingStats() view returns (uint256 totalCandidates, uint256 currentRound, bool isActive, uint256 totalVotes, bool hasTieResult)',

  // Contract management functions
  'function getContractAddresses() view returns (address candidateManagerAddr, address electionManagerAddr, address votingCoreAddr, address resultsAggregatorAddr)',
  'function candidateManager() view returns (address)',
  'function electionManager() view returns (address)',
  'function votingCore() view returns (address)',
  'function resultsAggregator() view returns (address)',
];

let ACCOUNTS = [];

let provider, signer, contract, userAddress;
let readOnlyProvider, readOnlyContract;
let CANDIDATES_CONFIG = { candidates: [] };
let NETWORK_CONFIG;

// Load deployment info (contract address)
async function loadDeploymentInfo() {
  try {
    const response = await fetch('../config/deployment.json');
    const deploymentInfo = await response.json();
    CONTRACT_ADDRESS = deploymentInfo.contractAddress;
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

// Load network config
async function loadNetworkConfig() {
  try {
    const response = await fetch('../config/network.json');
    NETWORK_CONFIG = await response.json();
  } catch (error) {
    console.error('Failed to load network config.', error);
  }
}

// Initialize read-only connection on page load
async function initializeReadOnly() {
  try {
    await loadDeploymentInfo();
    await loadAccounts();
    await loadConfig();
    await loadNetworkConfig();

    if (!CONTRACT_ADDRESS) {
      throw new Error('No contract address available');
    }

    if (!NETWORK_CONFIG || !NETWORK_CONFIG.rpcUrl) {
      throw new Error('Network configuration not available');
    }

    readOnlyProvider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    readOnlyContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      readOnlyProvider
    );

    // Test the connection by trying to get the owner
    try {
      await readOnlyContract.owner();
    } catch (testError) {
      console.error('Contract connection test failed:', testError);
      throw new Error(
        'Cannot connect to contract. Make sure the local blockchain is running.'
      );
    }

    await loadCandidatesReadOnly();
  } catch (error) {
    console.error('Read-only connection failed:', error.message);
    // Show a user-friendly message
    const candidatesList = document.getElementById('candidatesList');
    if (candidatesList) {
      candidatesList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <h3>Connection Error</h3>
                    <p>${error.message}</p>
                    <p>Please make sure:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>The local blockchain is running (npx hardhat node)</li>
                        <li>The contract is deployed</li>
                        <li>You refresh the page</li>
                    </ul>
                </div>
            `;
    }
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
    throw new Error('Error loading candidates (read-only):', error.message);
  }
}

// Initialize on page load
initializeReadOnly();

document
  .getElementById('connectAccount')
  .addEventListener('click', async function () {
    try {
      const accountId = parseInt(
        document.getElementById('accountSelect').value
      );
      const selectedAccount = ACCOUNTS.find(acc => acc.id === accountId);

      if (!selectedAccount) {
        throw new Error('Selected account not found');
      }

      if (!CONTRACT_ADDRESS) {
        throw new Error(
          'Contract address not loaded. Please refresh the page.'
        );
      }

      if (!NETWORK_CONFIG || !NETWORK_CONFIG.rpcUrl) {
        throw new Error(
          'Network configuration not loaded. Please refresh the page.'
        );
      }

      provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
      signer = new ethers.Wallet(selectedAccount.privateKey, provider);
      userAddress = selectedAccount.address;
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Test connection by checking if we can get the owner
      let isOwner = false;
      try {
        const owner = await contract.owner();
        isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      } catch (ownerError) {
        console.error('Error checking contract owner:', ownerError);
        throw new Error(
          'Failed to connect to contract. Make sure the local blockchain is running and the contract is deployed.'
        );
      }

      document.getElementById('accountAddress').textContent =
        `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
      document.getElementById('accountNumber').textContent =
        `Account #${selectedAccount.id}${isOwner ? ' (Owner)' : ''}`;
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
      console.error('Connection error details:', error);
      alert(`Connection error: ${error.message}`);
    }
  });

document
  .getElementById('disconnectAccount')
  .addEventListener('click', function () {
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
    alert(`Error loading candidates: ${error.message}`);
  }
}

// Load voter statistics
async function loadVoterStats() {
  try {
    if (readOnlyContract) {
      const totalVoters = await readOnlyContract.getTotalVoters();
      document.getElementById('totalVoters').textContent =
        totalVoters.toString();
    } else if (contract) {
      const totalVoters = await contract.getTotalVoters();
      document.getElementById('totalVoters').textContent =
        totalVoters.toString();
    }
  } catch (error) {
    console.error('Error loading voter stats:', error);
  }
}

document.getElementById('refreshStats').addEventListener('click', function () {
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

document
  .getElementById('startElection')
  .addEventListener('click', async function () {
    try {
      const tx = await contract.startElection();
      await tx.wait();
      alert(
        'Election started successfully! All previous results have been reset.'
      );

      // Hide final results section when starting new election
      document.getElementById('resultsSection').style.display = 'none';

      await loadAdminElectionStatus();
      await loadCandidates(); // Refresh main view
    } catch (error) {
      alert(`Error starting election: ${error.message}`);
    }
  });

document
  .getElementById('endElection')
  .addEventListener('click', async function () {
    try {
      const tx = await contract.endElection();
      await tx.wait();
      alert('Election ended successfully! Results are now visible.');
      await loadAdminElectionStatus();
      await loadCandidates(); // Refresh main view
      await showFinalResults(); // Show results after election ends
    } catch (error) {
      alert(`Error ending election: ${error.message}`);
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
