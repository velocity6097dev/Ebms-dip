require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Admin client — uses the SERVICE ROLE key, which can bypass Row Level
// Security and create/delete auth users. This must NEVER be sent to the
// browser; it only ever lives here on the server.
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Give the browser the public (safe-to-expose) Supabase config.
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(
    `window.SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};\n`
  );
});

// ---------------------------------------------------------------
// Helper: verify the request's bearer token belongs to a real,
// currently-valid Supabase user, and that this user is an outlet
// OWNER (has a row in outlet_settings). Returns the owner's user id,
// or null (and sends an error response) if verification fails.
// ---------------------------------------------------------------
async function requireOwner(req, res) {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY in .env' });
    return null;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return null;
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
  const ownerId = userData.user.id;
  const { data: settingsRow, error: settingsErr } = await supabaseAdmin
    .from('outlet_settings')
    .select('user_id')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (settingsErr || !settingsRow) {
    res.status(403).json({ error: 'Only the outlet owner can manage staff accounts' });
    return null;
  }
  return ownerId;
}

// ---------------------------------------------------------------
// POST /api/create-staff  { email, password, name }
// Creates a real Supabase login for a staff member and links them
// to the calling owner's outlet.
// ---------------------------------------------------------------
app.post('/api/create-staff', async (req, res) => {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;

  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are all required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
    user_metadata: { role: 'staff', owner_user_id: ownerId, staff_name: String(name).trim() },
  });
  if (createErr) {
    return res.status(400).json({ error: createErr.message });
  }

  const { data: staffRow, error: linkErr } = await supabaseAdmin
    .from('outlet_staff')
    .insert({
      owner_user_id: ownerId,
      staff_user_id: created.user.id,
      staff_name: String(name).trim(),
      staff_email: String(email).trim(),
    })
    .select()
    .single();
  if (linkErr) {
    // Roll back the auth user if we couldn't link it, so we don't leave an orphan login.
    await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return res.status(400).json({ error: linkErr.message });
  }

  res.json({ staff: staffRow });
});

// ---------------------------------------------------------------
// DELETE /api/staff/:staffUserId
// Removes a staff member's login entirely (and their outlet_staff
// link, via cascade).
// ---------------------------------------------------------------
app.delete('/api/staff/:staffUserId', async (req, res) => {
  const ownerId = await requireOwner(req, res);
  if (!ownerId) return;

  const staffUserId = req.params.staffUserId;
  const { data: staffRow, error: findErr } = await supabaseAdmin
    .from('outlet_staff')
    .select('*')
    .eq('owner_user_id', ownerId)
    .eq('staff_user_id', staffUserId)
    .maybeSingle();
  if (findErr || !staffRow) {
    return res.status(404).json({ error: 'Staff member not found for this outlet' });
  }

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(staffUserId);
  if (delErr) {
    return res.status(400).json({ error: delErr.message });
  }
  res.json({ ok: true });
});

// Single page app fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Water Dip Monitoring app running at http://localhost:${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY are not set in .env — login will not work until you add them.');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set in .env — creating/removing staff accounts will not work until you add it.');
  }
});
