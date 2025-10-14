const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve config files
app.use('/config', express.static(path.join(__dirname, 'config')));

app.listen(PORT, () => {});
