const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve config files
app.use('/config', express.static(path.join(__dirname, 'config')));

app.listen(PORT, () => {
    console.log(`Frontend server running at http://localhost:${PORT}`);
    console.log('Make sure your Hardhat node is running on port 8545');
});
