# Voting DApp - GENZ212 2025

A decentralized voting dApp to organise the 2025 presidential elections for the Moroccan youth led GENZ212 movement.

## 🎁 Features

- 🗳️ **Decentralized Voting** : Vote securely on the blockchain
- 🛡️ **Vote protection** : Prevents duplicate votes and voting outside election periods
- 🔒 **Admin controls** : Only admin can start or end elections
- 📊 **Results Tracking** : Live vote tracking and detailed election results
- 🎨 **Modern UI** : Clean and responsive design

## 📝 Prerequisites

- Node.js (v16 or higher)

## ⚙️ Installation

1. Clone the repository:

```bash
git clone https://github.com/alaoui42soukaina/genz212_presidential_elections.git
cd genz212_presidential_elections
```

2. Install dependencies:

```bash
npm install
```

## 🧩 Project Structure

```
├── .github/                    # Github workflow for automated testing on code changes
├── config/                     # Configuration files for accounts, candidates, deployment, and network
├── contracts/                  # Smart contracts for the voting system
├── frontend/                   # Web interface with HTML, CSS, and JavaScript
├── scripts/                    # Deployment script
├── test/
│   ├── helpers/
│   │   └── testHelpers.js      # Helpers for testing scripts
│   ├── unitTests/              # Unit tests for individual contracts
│   │   ├── CandidateManager.test.js
│   │   ├── ElectionManager.test.js
│   │   ├── ResultsAggregator.test.js
│   │   └── VotingCore.test.js
│   ├── Voting_E2E.test.js      # End-to-end tests
│   └── Voting_Integration.test.js # Integration tests
├── test-results/               # Test reports and coverage
├── ...                         # Other files (hardhat.config.js, package.json, etc.)
└── README.md                   # You are here 📍
```

## 🚀 Usage

### 1. Start Local Blockchain

```bash
npm run start
```

This will start a local Hardhat network on `http://localhost:8545`

The frontend UI will be available at `http://localhost:3000`

### 2. Start Voting!

> ⚠️ **Note:** Blockchain transactions (starting/ending election and voting) may take a few seconds to process. Please wait for confirmations before proceeding.

1. Select admin account from the dropdown
2. Click "Connect Account"
3. Click "Start Election"
4. Vote for your preferred candidate
5. Use "Disconnect" and switch to another account to connect and vote again
6. Connect back to Admin account
7. Click "End Election"
8. See results displayed

## 🔧 Troubleshooting

- Make sure Hardhat node is running on port 8545
- Make sure port 3000 isn't already occupied

## 🧪 Testing

Run all tests (unit, integration, e2e):

```bash
npx hardhat test
```

Run only integration tests :

```bash
npx hardhat test --grep @integration
```

Run only E2E test :

```bash
npx hardhat test --grep @e2e
```

Run tests designed to fail to demonstrate error handling :

```bash
git checkout failing-tests
npx hardhat test --grep @fail
```

Open test report :

```bash
npm report:open
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write a `feedback.md` for Soukaïna
4. Schedule with her the next rounds of interviews
5. Make an offer 🫶

---

Built with 💖 using Hardhat, Solidity, and Ethers.js
