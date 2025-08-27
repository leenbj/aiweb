const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'test-ok', timestamp: new Date().toISOString() });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});
