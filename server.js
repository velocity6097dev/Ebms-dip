require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// The Supabase URL + anon key are safe to expose to the browser (this is how
// every Supabase front end works) — real protection comes from Row Level
// Security policies in the database, not from hiding these values.
// This route injects them from your .env file at request time so you never
// have to hardcode secrets inside public/app.js.
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(
    `window.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || '')};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};\n`
  );
});

// Single page app fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Water Dip Monitoring app running at http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY are not set in .env — login will not work until you add them.');
  }
});
