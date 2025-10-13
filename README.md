# Voting DApp - Presidential Elections 2024

A minimal decentralized voting application built with Hardhat, Solidity, and vanilla JavaScript.

## Features

- 🗳️ **Decentralized Voting**: Vote securely on the blockchain
- 🔒 **One Vote Per Address**: Prevents double voting
- 📊 **Live Results**: Real-time vote counting
- 🎨 **Modern UI**: Clean and responsive design
- ⚡ **Fast & Lightweight**: Minimal dependencies

## Smart Contract Features

- Add candidates (owner only)
- Vote for candidates
- Prevent double voting
- Track vote counts
- Get live results
- Events for transparency

## Prerequisites

- Node.js (v14 or higher)
- Git

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd genz212_presidential_elections
```

2. Install dependencies:

```bash
npm install
```

## Usage

### 1. Start Local Blockchain

```bash
npm run node
```

This will start a local Hardhat network on `http://127.0.0.1:8545`

### 2. Deploy Contract

In a new terminal:

```bash
npm run deploy
```

This will deploy the contract and add sample candidates (Alice Johnson, Bob Smith, Carol Davis).

### 3. Open Frontend

Open `frontend/index.html` in your browser.

### 4. Start Voting!

1. Select an account from the dropdown (20 test accounts available)
2. Click "Connect Account"
3. Vote for your preferred candidate
4. Use "Disconnect" to switch to another account and vote again
5. Watch live results update in real-time

## Testing

Run the test suite:

```bash
npm test
```

## Project Structure

```
├── contracts/
│   └── Voting.sol          # Main voting contract
├── scripts/
│   └── deploy.js           # Deployment script
├── test/
│   └── Voting.test.js      # Contract tests
├── frontend/
│   ├── index.html          # Main HTML file (includes all frontend logic)
│   └── style.css           # Styling
├── hardhat.config.js       # Hardhat configuration
└── package.json            # Dependencies
```

## Smart Contract Functions

### Owner Functions

- `addCandidate(string name)` - Add a new candidate

### Public Functions

- `vote(uint256 candidateId)` - Vote for a candidate
- `getCandidate(uint256 candidateId)` - Get candidate details
- `getAllCandidates()` - Get all candidates
- `checkVoted(address voter)` - Check if address has voted
- `getTotalVotes()` - Get total votes cast

## Security Features

- Only contract owner can add candidates
- One vote per address enforced
- Input validation for candidate IDs
- Events for transparency

## Customization

### Adding More Candidates

Connect to the contract as owner and call:

```javascript
await voting.addCandidate('New Candidate Name');
```

### Styling

Modify `frontend/style.css` to customize the appearance.

### Contract Logic

Edit `contracts/Voting.sol` to modify voting rules or add new features.

## Troubleshooting

### Connection Issues

- Make sure Hardhat node is running on port 8545
- Check that the contract is deployed

### Transaction Failures

- Check you have enough ETH for gas
- Ensure you haven't already voted
- Verify candidate ID is valid

## License

MIT License - feel free to use this project as a starting point for your own voting dApp!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

Built with ❤️ using Hardhat, Solidity, and vanilla JavaScript
