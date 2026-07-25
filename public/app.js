(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Supabase client
  // ---------------------------------------------------------------
  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
  let supabase = null;

  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    document.getElementById('authMsg').textContent =
      'Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file and restart the server.';
  }

  const APPEARANCE_OPTIONS = ['Clear', 'Hazy', 'Water Layer at bottom'];
  const TANK_NAME_DEFAULTS = ['Petrol', 'Speed', 'Diesel'];

  // ---------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------
  const authScreen = document.getElementById('authScreen');
  const onboardScreen = document.getElementById('onboardScreen');
  const appScreen = document.getElementById('appScreen');

  const authTabs = document.querySelectorAll('.auth-tab');
  const authForm = document.getElementById('authForm');
  const authOwnerName = document.getElementById('authOwnerName');
  const authOutletName = document.getElementById('authOutletName');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authSubmit = document.getElementById('authSubmit');
  const authMsg = document.getElementById('authMsg');
  const signupOnlyFields = document.querySelectorAll('.signup-only');

  const tankCountInput = document.getElementById('tankCount');
  const generateTankRowsBtn = document.getElementById('generateTankRows');
  const onboardTankRows = document.getElementById('onboardTankRows');
  const finishOnboardingBtn = document.getElementById('finishOnboardingBtn');
  const onboardMsg = document.getElementById('onboardMsg');

  const logoutBtn = document.getElementById('logoutBtn');
  const settingsToggleBtn = document.getElementById('settingsToggleBtn');
  const topbarOutlet = document.getElementById('topbarOutlet');
  const topbarMonthYear = document.getElementById('topbarMonthYear');

  const settingsCard = document.getElementById('settingsCard');
  const outletOwnerNameInput = document.getElementById('outletOwnerName');
  const outletNameInput = document.getElementById('outletName');
  const outletMonthInput = document.getElementById('outletMonth');
  const outletYearInput = document.getElementById('outletYear');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');

  const tankManageList = document.getElementById('tankManageList');
  const newTankName = document.getElementById('newTankName');
  const newTankCapacity = document.getElementById('newTankCapacity');
  const addTankBtn = document.getElementById('addTankBtn');

  const memberManageList = document.getElementById('memberManageList');
  const newMemberName = document.getElementById('newMemberName');
  const addMemberBtn = document.getElementById('addMemberBtn');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const monsoonPanel = document.getElementById('monsoonPanel');
  const rainyPanel = document.getElementById('rainyPanel');
  const monsoonBody = document.getElementById('monsoonBody');
  const rainyBody = document.getElementById('rainyBody');

  const addMonsoonRowBtn = document.getElementById('addMonsoonRow');
  const addRainyRowBtn = document.getElementById('addRainyRow');
  const saveMonsoonBtn = document.getElementById('saveMonsoonBtn');
  const saveRainyBtn = document.getElementById('saveRainyBtn');
  const printMonsoonBtn = document.getElementById('printMonsoonBtn');
  const printRainyBtn = document.getElementById('printRainyBtn');

  const printOutletName = document.getElementById('printOutletName');
  const printSubtitle = document.getElementById('printSubtitle');

  const signatureModal = document.getElementById('signatureModal');
  const signerSelect = document.getElementById('signerSelect');
  const signatureCanvas = document.getElementById('signatureCanvas');
  const clearSigBtn = document.getElementById('clearSigBtn');
  const cancelSigBtn = document.getElementById('cancelSigBtn');
  const saveSigBtn = document.getElementById('saveSigBtn');

  const toastEl = document.getElementById('toast');

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  let currentUser = null;
  let currentSettings = null;
  let tanks = [];               // [{id,name,capacity_litres,sort_order}]
  let members = [];             // [{id,member_name}]
  let lastSelectedMemberId = null;
  let signaturePad = null;
  let signingRowId = null;

  const monsoonCache = new Map(); // rowId -> full row object
  const rainyCache = new Map();

  const rowTableMap = {};      // rowId -> 'monsoon_entries' | 'rainy_entries'
  const pendingUpdates = {};   // rowId -> { field: value, ... }
  const pendingTimers = {};    // rowId -> timeout id

  const genericPending = {};   // "table:id" -> { field: value }
  const genericTimers = {};

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtCap(n) {
    return n || n === 0 ? Number(n).toLocaleString() + ' L' : '';
  }

  let toastTimer = null;
  function showToast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.toggle('error', !!isError);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  function setRowStatus(rowId, status) {
    const card = document.querySelector(`.entry-card[data-id="${rowId}"]`);
    if (!card) return;
    const dot = card.querySelector('[data-status]');
    if (!dot) return;
    const colors = { pending: '#C97A21', saved: '#2F7D5A', error: '#B23A34' };
    dot.style.background = colors[status] || 'transparent';
    dot.title = status === 'pending' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Could not save' : '';
  }

  // ---------------------------------------------------------------
  // Generic debounced field save (tanks, members)
  // ---------------------------------------------------------------
  function debouncedUpdate(table, id, field, value, delay) {
    const key = table + ':' + id;
    genericPending[key] = genericPending[key] || {};
    genericPending[key][field] = value;
    clearTimeout(genericTimers[key]);
    genericTimers[key] = setTimeout(async () => {
      const updates = genericPending[key];
      delete genericPending[key];
      const { error } = await supabase.from(table).update(updates).eq('id', id);
      if (error) showToast('Could not save: ' + error.message, true);
    }, delay || 700);
  }

  // ---------------------------------------------------------------
  // Entry-row autosave (monsoon / rainy)
  // ---------------------------------------------------------------
  function scheduleSave(rowId, field, value) {
    pendingUpdates[rowId] = pendingUpdates[rowId] || {};
    pendingUpdates[rowId][field] = value;
    setRowStatus(rowId, 'pending');
    clearTimeout(pendingTimers[rowId]);
    pendingTimers[rowId] = setTimeout(() => flushRow(rowId), 800);
  }

  async function flushRow(rowId) {
    clearTimeout(pendingTimers[rowId]);
    const updates = pendingUpdates[rowId];
    const table = rowTableMap[rowId];
    if (!updates || !table) return;
    delete pendingUpdates[rowId];
    const { error } = await supabase.from(table).update(updates).eq('id', rowId);
    if (error) {
      setRowStatus(rowId, 'error');
      showToast('Could not save row: ' + error.message, true);
    } else {
      setRowStatus(rowId, 'saved');
    }
  }

  async function flushAll(tableName) {
    const ids = Object.keys(pendingUpdates).filter((id) => rowTableMap[id] === tableName);
    await Promise.all(ids.map((id) => flushRow(id)));
    showToast('All changes saved');
  }

  function updateReading(rowId, tankId, slot, kind, value) {
    const table = rowTableMap[rowId];
    const cache = table === 'monsoon_entries' ? monsoonCache : rainyCache;
    const row = cache.get(rowId);
    if (!row) return;
    row.readings = row.readings || {};
    row.readings[tankId] = row.readings[tankId] || {};
    const key = slot === 'single' ? kind : slot + '_' + kind;
    row.readings[tankId][key] = value;
    scheduleSave(rowId, 'readings', row.readings);
  }

  // ---------------------------------------------------------------
  // Auth screen behaviour
  // ---------------------------------------------------------------
  let authMode = 'signin';
  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      authTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      authMode = tab.dataset.mode;
      const isSignup = authMode === 'signup';
      signupOnlyFields.forEach((el) => {
        el.classList.toggle('hidden', !isSignup);
        const input = el.querySelector('input');
        if (input) input.required = isSignup;
      });
      authSubmit.textContent = isSignup ? 'Register outlet' : 'Sign in';
      authMsg.textContent = '';
      authMsg.classList.remove('success');
    });
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return;
    authMsg.textContent = '';
    authMsg.classList.remove('success');
    authSubmit.disabled = true;
    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
      if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const ownerName = authOwnerName.value.trim();
        const outletName = authOutletName.value.trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { owner_name: ownerName, outlet_name: outletName } },
        });
        if (error) throw error;
        if (!data.session) {
          authMsg.textContent = 'Account created. Check your email to confirm, then sign in.';
          authMsg.classList.add('success');
          document.querySelector('.auth-tab[data-mode="signin"]').click();
        }
        // If a session came back immediately, onAuthStateChange handles the rest.
      }
    } catch (err) {
      authMsg.textContent = err.message || 'Something went wrong.';
    } finally {
      authSubmit.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  });

  // ---------------------------------------------------------------
  // Login / logout transitions
  // ---------------------------------------------------------------
  async function ensureSettingsRow() {
    let { data, error } = await supabase
      .from('outlet_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      showToast('Could not load outlet details: ' + error.message, true);
      return null;
    }
    if (!data) {
      const meta = currentUser.user_metadata || {};
      const payload = {
        user_id: currentUser.id,
        owner_name: meta.owner_name || '',
        outlet_name: meta.outlet_name || '',
        year: String(new Date().getFullYear()),
        onboarded: false,
      };
      const { data: created, error: insErr } = await supabase
        .from('outlet_settings')
        .insert(payload)
        .select()
        .single();
      if (insErr) {
        showToast('Could not set up your outlet: ' + insErr.message, true);
        return null;
      }
      data = created;
    }
    return data;
  }

  async function loadTanks() {
    const { data, error } = await supabase
      .from('tanks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('sort_order', { ascending: true });
    if (error) {
      showToast('Could not load tanks: ' + error.message, true);
      return;
    }
    tanks = data || [];
  }

  async function loadMembers() {
    const { data, error } = await supabase
      .from('outlet_members')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('sort_order', { ascending: true });
    if (error) {
      showToast('Could not load outlet members: ' + error.message, true);
      return;
    }
    members = data || [];
  }

  async function onLogin(session) {
    currentUser = session.user;
    authScreen.classList.add('hidden');
    onboardScreen.classList.add('hidden');
    appScreen.classList.add('hidden');

    const settings = await ensureSettingsRow();
    if (!settings) return;
    currentSettings = settings;
    await loadTanks();

    if (!settings.onboarded || tanks.length === 0) {
      showOnboarding();
      return;
    }
    await enterApp();
  }

  function onLogout() {
    currentUser = null;
    currentSettings = null;
    tanks = [];
    members = [];
    monsoonCache.clear();
    rainyCache.clear();
    monsoonBody.innerHTML = '';
    rainyBody.innerHTML = '';
    appScreen.classList.add('hidden');
    onboardScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authForm.reset();
  }

  // ---------------------------------------------------------------
  // Onboarding: tank setup wizard
  // ---------------------------------------------------------------
  function showOnboarding() {
    appScreen.classList.add('hidden');
    onboardScreen.classList.remove('hidden');
    generateOnboardTankRows();
  }

  function generateOnboardTankRows() {
    const count = Math.max(1, Math.min(12, parseInt(tankCountInput.value, 10) || 1));
    onboardTankRows.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'onboard-tank-row';
      row.innerHTML = `
        <input type="text" placeholder="Tank ${i + 1} name (e.g. ${TANK_NAME_DEFAULTS[i] || 'Diesel'})" data-onboard-name />
        <input type="number" placeholder="Capacity in litres (optional)" data-onboard-capacity />
      `;
      onboardTankRows.appendChild(row);
    }
  }

  generateTankRowsBtn.addEventListener('click', generateOnboardTankRows);

  finishOnboardingBtn.addEventListener('click', async () => {
    const rows = Array.from(onboardTankRows.querySelectorAll('.onboard-tank-row'));
    if (rows.length === 0) generateOnboardTankRows();

    const payload = [];
    let hasEmpty = false;
    rows.forEach((row, idx) => {
      const name = row.querySelector('[data-onboard-name]').value.trim();
      const capRaw = row.querySelector('[data-onboard-capacity]').value;
      if (!name) hasEmpty = true;
      payload.push({
        user_id: currentUser.id,
        name: name || `Tank ${idx + 1}`,
        capacity_litres: capRaw ? Number(capRaw) : null,
        sort_order: idx,
      });
    });
    if (hasEmpty) {
      onboardMsg.textContent = 'Give every tank a name (e.g. Petrol, Speed, Diesel).';
      onboardMsg.classList.remove('success');
    }

    finishOnboardingBtn.disabled = true;
    const { data, error } = await supabase.from('tanks').insert(payload).select();
    if (error) {
      onboardMsg.textContent = error.message;
      finishOnboardingBtn.disabled = false;
      return;
    }
    const { error: settingsErr } = await supabase
      .from('outlet_settings')
      .update({ onboarded: true })
      .eq('user_id', currentUser.id);
    finishOnboardingBtn.disabled = false;
    if (settingsErr) {
      onboardMsg.textContent = settingsErr.message;
      return;
    }
    tanks = data || [];
    currentSettings.onboarded = true;
    await enterApp();
  });

  // ---------------------------------------------------------------
  // Enter the main app (after login or after onboarding completes)
  // ---------------------------------------------------------------
  async function enterApp() {
    onboardScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    populateSettingsFields(currentSettings);
    await loadMembers();
    renderTankManageList();
    renderMemberManageList();
    updateHeaders();

    await Promise.all([
      loadEntries('monsoon_entries', monsoonCache, monsoonBody, renderMonsoonRow, addMonsoonRow),
      loadEntries('rainy_entries', rainyCache, rainyBody, renderRainyRow, addRainyRow),
    ]);
  }

  // ---------------------------------------------------------------
  // Outlet settings (owner name / outlet name / month / year)
  // ---------------------------------------------------------------
  function updateHeaders() {
    const outlet = outletNameInput.value.trim() || 'Water Dip Register';
    const month = outletMonthInput.value;
    const year = outletYearInput.value;
    topbarOutlet.textContent = outlet;
    topbarMonthYear.textContent = month || year ? `${month} ${year}`.trim() : '';
    document.title = `${outlet} — Water Dip Register`;
  }

  function populateSettingsFields(settings) {
    outletOwnerNameInput.value = settings.owner_name || '';
    outletNameInput.value = settings.outlet_name || '';
    outletMonthInput.value = settings.month || '';
    outletYearInput.value = settings.year || new Date().getFullYear();
    updateHeaders();
  }

  [outletOwnerNameInput, outletNameInput, outletMonthInput, outletYearInput].forEach((el) => {
    el.addEventListener('input', updateHeaders);
  });

  settingsToggleBtn.addEventListener('click', () => {
    settingsCard.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    saveSettingsBtn.disabled = true;
    settingsStatus.textContent = 'Saving…';
    const payload = {
      owner_name: outletOwnerNameInput.value.trim(),
      outlet_name: outletNameInput.value.trim(),
      month: outletMonthInput.value,
      year: outletYearInput.value,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('outlet_settings').update(payload).eq('user_id', currentUser.id);
    saveSettingsBtn.disabled = false;
    if (error) {
      settingsStatus.textContent = '';
      showToast('Could not save outlet details: ' + error.message, true);
    } else {
      Object.assign(currentSettings, payload);
      settingsStatus.textContent = 'Saved ✓';
      updateHeaders();
      setTimeout(() => (settingsStatus.textContent = ''), 2200);
    }
  });

  // ---------------------------------------------------------------
  // Tank management
  // ---------------------------------------------------------------
  function renderTankManageList() {
    if (tanks.length === 0) {
      tankManageList.innerHTML = '<p class="panel-sub">No tanks yet — add one below.</p>';
      return;
    }
    tankManageList.innerHTML = tanks
      .map(
        (t) => `
      <div class="manage-item" data-tank-id="${t.id}">
        <input type="text" data-tank-field="name" value="${esc(t.name)}" />
        <input type="number" data-tank-field="capacity_litres" value="${t.capacity_litres ?? ''}" placeholder="Capacity" />
        <span class="unit">litres</span>
        <button type="button" class="btn-icon-danger" data-tank-action="delete" title="Remove tank">✕</button>
      </div>`
      )
      .join('');
  }

  function updateTankTileLabel(tankId, name, capacity) {
    document.querySelectorAll(`.tank-tile[data-tank-id="${tankId}"] .tank-tile-name`).forEach((el) => {
      el.innerHTML = `${esc(name)} ${capacity ? `<span class="cap">${fmtCap(capacity)}</span>` : ''}`;
    });
  }

  tankManageList.addEventListener('input', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item || !e.target.dataset.tankField) return;
    const tankId = item.dataset.tankId;
    const field = e.target.dataset.tankField;
    let value = e.target.value;
    const tank = tanks.find((t) => t.id === tankId);
    if (tank) {
      tank[field] = field === 'capacity_litres' ? (value ? Number(value) : null) : value;
      updateTankTileLabel(tankId, tank.name, tank.capacity_litres);
    }
    debouncedUpdate('tanks', tankId, field, field === 'capacity_litres' ? (value ? Number(value) : null) : value);
  });

  tankManageList.addEventListener('click', async (e) => {
    if (e.target.dataset.tankAction !== 'delete') return;
    const item = e.target.closest('.manage-item');
    const tankId = item.dataset.tankId;
    const tank = tanks.find((t) => t.id === tankId);
    if (!confirm(`Remove tank "${tank ? tank.name : ''}"? Past readings for it stay in your records but will no longer be shown.`)) return;
    const { error } = await supabase.from('tanks').delete().eq('id', tankId);
    if (error) {
      showToast('Could not remove tank: ' + error.message, true);
      return;
    }
    tanks = tanks.filter((t) => t.id !== tankId);
    renderTankManageList();
    renderAllEntryCards();
  });

  addTankBtn.addEventListener('click', async () => {
    const name = newTankName.value.trim();
    if (!name) {
      showToast('Give the tank a name first.', true);
      return;
    }
    const capRaw = newTankCapacity.value;
    const payload = {
      user_id: currentUser.id,
      name,
      capacity_litres: capRaw ? Number(capRaw) : null,
      sort_order: tanks.length,
    };
    const { data, error } = await supabase.from('tanks').insert(payload).select().single();
    if (error) {
      showToast('Could not add tank: ' + error.message, true);
      return;
    }
    tanks.push(data);
    newTankName.value = '';
    newTankCapacity.value = '';
    renderTankManageList();
    renderAllEntryCards();
  });

  // ---------------------------------------------------------------
  // Outlet member management
  // ---------------------------------------------------------------
  function renderMemberManageList() {
    if (members.length === 0) {
      memberManageList.innerHTML = '<p class="panel-sub">No members yet — add one below.</p>';
      return;
    }
    memberManageList.innerHTML = members
      .map(
        (m) => `
      <div class="manage-item" data-member-id="${m.id}">
        <input type="text" data-member-field="member_name" value="${esc(m.member_name)}" />
        <button type="button" class="btn-icon-danger" data-member-action="delete" title="Remove member">✕</button>
      </div>`
      )
      .join('');
  }

  memberManageList.addEventListener('input', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item || !e.target.dataset.memberField) return;
    const memberId = item.dataset.memberId;
    const field = e.target.dataset.memberField;
    const value = e.target.value;
    const member = members.find((m) => m.id === memberId);
    if (member) member[field] = value;
    debouncedUpdate('outlet_members', memberId, field, value);
  });

  memberManageList.addEventListener('click', async (e) => {
    if (e.target.dataset.memberAction !== 'delete') return;
    const item = e.target.closest('.manage-item');
    const memberId = item.dataset.memberId;
    if (!confirm('Remove this member? Signatures they already gave stay on past entries.')) return;
    const { error } = await supabase.from('outlet_members').delete().eq('id', memberId);
    if (error) {
      showToast('Could not remove member: ' + error.message, true);
      return;
    }
    members = members.filter((m) => m.id !== memberId);
    if (lastSelectedMemberId === memberId) lastSelectedMemberId = null;
    renderMemberManageList();
  });

  addMemberBtn.addEventListener('click', async () => {
    const name = newMemberName.value.trim();
    if (!name) {
      showToast('Enter the member\u2019s name first.', true);
      return;
    }
    const payload = { user_id: currentUser.id, member_name: name, sort_order: members.length };
    const { data, error } = await supabase.from('outlet_members').insert(payload).select().single();
    if (error) {
      showToast('Could not add member: ' + error.message, true);
      return;
    }
    members.push(data);
    newMemberName.value = '';
    renderMemberManageList();
  });

  // ---------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      monsoonPanel.classList.toggle('hidden', tab !== 'monsoon');
      rainyPanel.classList.toggle('hidden', tab !== 'rainy');
    });
  });

  // ---------------------------------------------------------------
  // Generic entries loader
  // ---------------------------------------------------------------
  async function loadEntries(table, cache, container, renderFn, addFn) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', currentUser.id)
      .order('entry_date', { ascending: true })
      .order('row_order', { ascending: true });

    cache.clear();
    container.innerHTML = '';
    if (error) {
      showToast('Could not load records: ' + error.message, true);
      return;
    }
    (data || []).forEach((row) => {
      rowTableMap[row.id] = table;
      cache.set(row.id, row);
      container.appendChild(renderFn(row));
    });
    if (!data || data.length === 0) {
      await addFn();
    }
  }

  function redrawList(cache, container, renderFn) {
    container.innerHTML = '';
    cache.forEach((row) => container.appendChild(renderFn(row)));
  }

  function renderAllEntryCards() {
    redrawList(monsoonCache, monsoonBody, renderMonsoonRow);
    redrawList(rainyCache, rainyBody, renderRainyRow);
  }

  // ---------------------------------------------------------------
  // Tank tile + appearance select builders
  // ---------------------------------------------------------------
  function appearanceSelectHTML(tankId, slot, value) {
    const opts = APPEARANCE_OPTIONS.map(
      (opt) =>
        `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt === 'Water Layer at bottom' ? 'Water layer' : opt}</option>`
    ).join('');
    return `<select class="appearance-select" data-tank="${tankId}" data-slot="${slot}" data-kind="appearance" data-val="${esc(value || '')}">
      <option value="" ${!value ? 'selected' : ''} hidden>—</option>
      ${opts}
    </select>`;
  }

  function monsoonTankTileHTML(tank, readings) {
    const r = (readings && readings[tank.id]) || {};
    return `<div class="tank-tile" data-tank-id="${tank.id}">
      <div class="tank-tile-name">${esc(tank.name)} ${tank.capacity_litres ? `<span class="cap">${fmtCap(tank.capacity_litres)}</span>` : ''}</div>
      <div class="reading-row">
        <span class="slot-label">AM</span>
        <div class="reading-pair">
          <input type="text" inputmode="decimal" class="dip-input" data-tank="${tank.id}" data-slot="morning" data-kind="dip" value="${esc(r.morning_dip)}" placeholder="mm" />
          ${appearanceSelectHTML(tank.id, 'morning', r.morning_appearance)}
        </div>
      </div>
      <div class="reading-row">
        <span class="slot-label">PM</span>
        <div class="reading-pair">
          <input type="text" inputmode="decimal" class="dip-input" data-tank="${tank.id}" data-slot="evening" data-kind="dip" value="${esc(r.evening_dip)}" placeholder="mm" />
          ${appearanceSelectHTML(tank.id, 'evening', r.evening_appearance)}
        </div>
      </div>
    </div>`;
  }

  function rainyTankTileHTML(tank, readings) {
    const r = (readings && readings[tank.id]) || {};
    return `<div class="tank-tile" data-tank-id="${tank.id}">
      <div class="tank-tile-name">${esc(tank.name)} ${tank.capacity_litres ? `<span class="cap">${fmtCap(tank.capacity_litres)}</span>` : ''}</div>
      <div class="reading-row" style="grid-template-columns: 1fr;">
        <div class="reading-pair">
          <input type="text" inputmode="decimal" class="dip-input" data-tank="${tank.id}" data-slot="single" data-kind="dip" value="${esc(r.dip)}" placeholder="mm" />
          ${appearanceSelectHTML(tank.id, 'single', r.appearance)}
        </div>
      </div>
    </div>`;
  }

  function checkedCellHTML(row) {
    if (row.checked_by_signature) {
      return `<div class="signed-chip">
        <img src="${row.checked_by_signature}" alt="signature" />
        <span class="signer-name">${esc(row.checked_by_name || '')}</span>
        <button type="button" data-action="resign">Edit</button>
      </div>`;
    }
    return `<button type="button" class="sign-btn" data-action="sign">+ Sign</button>`;
  }

  function noTanksNotice() {
    return '<div class="empty-state">No tanks configured yet — add one in Settings.</div>';
  }

  // ---------------------------------------------------------------
  // Monsoon (monthly) cards
  // ---------------------------------------------------------------
  function monsoonCardHTML(row) {
    const tilesHTML = tanks.length ? tanks.map((t) => monsoonTankTileHTML(t, row.readings)).join('') : noTanksNotice();
    return `<div class="entry-card" data-id="${row.id}">
      <div class="entry-card-header">
        <input type="date" class="date-field" data-field="entry_date" value="${row.entry_date || ''}" />
        <input type="text" class="remarks-field" data-field="remarks" value="${esc(row.remarks)}" placeholder="Remarks (optional)" />
        <span class="spacer"></span>
        <button type="button" class="btn-icon-danger" data-action="delete" title="Delete day">✕</button>
      </div>
      <div class="tank-grid">${tilesHTML}</div>
      <div class="entry-card-footer">
        <div class="footer-left">
          <span class="row-status" data-status></span>
          ${checkedCellHTML(row)}
        </div>
      </div>
    </div>`;
  }

  function renderMonsoonRow(row) {
    const wrap = document.createElement('div');
    wrap.innerHTML = monsoonCardHTML(row);
    return wrap.firstElementChild;
  }

  addMonsoonRowBtn.addEventListener('click', () => addMonsoonRow());

  async function addMonsoonRow() {
    if (!currentUser) return;
    const rowOrder = monsoonBody.children.length;
    const { data, error } = await supabase
      .from('monsoon_entries')
      .insert({ user_id: currentUser.id, entry_date: todayISO(), row_order: rowOrder, readings: {} })
      .select()
      .single();
    if (error) {
      showToast('Could not add row: ' + error.message, true);
      return;
    }
    rowTableMap[data.id] = 'monsoon_entries';
    monsoonCache.set(data.id, data);
    monsoonBody.appendChild(renderMonsoonRow(data));
  }

  saveMonsoonBtn.addEventListener('click', () => flushAll('monsoon_entries'));
  printMonsoonBtn.addEventListener('click', () => preparePrint('monsoon'));

  // ---------------------------------------------------------------
  // Rainy (hourly) cards
  // ---------------------------------------------------------------
  function rainyCardHTML(row) {
    const tilesHTML = tanks.length ? tanks.map((t) => rainyTankTileHTML(t, row.readings)).join('') : noTanksNotice();
    return `<div class="entry-card" data-id="${row.id}">
      <div class="entry-card-header">
        <input type="date" class="date-field" data-field="entry_date" value="${row.entry_date || ''}" />
        <input type="text" class="hour-field" data-field="hour_time" value="${esc(row.hour_time)}" placeholder="08:00 AM" />
        <input type="text" class="remarks-field" data-field="remarks" value="${esc(row.remarks)}" placeholder="Remarks (optional)" />
        <span class="spacer"></span>
        <button type="button" class="btn-icon-danger" data-action="delete" title="Delete reading">✕</button>
      </div>
      <div class="tank-grid">${tilesHTML}</div>
      <div class="entry-card-footer">
        <div class="footer-left">
          <span class="row-status" data-status></span>
          ${checkedCellHTML(row)}
        </div>
      </div>
    </div>`;
  }

  function renderRainyRow(row) {
    const wrap = document.createElement('div');
    wrap.innerHTML = rainyCardHTML(row);
    return wrap.firstElementChild;
  }

  addRainyRowBtn.addEventListener('click', () => addRainyRow());

  async function addRainyRow() {
    if (!currentUser) return;
    const rowOrder = rainyBody.children.length;
    const { data, error } = await supabase
      .from('rainy_entries')
      .insert({ user_id: currentUser.id, entry_date: todayISO(), row_order: rowOrder, readings: {} })
      .select()
      .single();
    if (error) {
      showToast('Could not add row: ' + error.message, true);
      return;
    }
    rowTableMap[data.id] = 'rainy_entries';
    rainyCache.set(data.id, data);
    rainyBody.appendChild(renderRainyRow(data));
  }

  saveRainyBtn.addEventListener('click', () => flushAll('rainy_entries'));
  printRainyBtn.addEventListener('click', () => preparePrint('rainy'));

  // ---------------------------------------------------------------
  // Print
  // ---------------------------------------------------------------
  function preparePrint(kind) {
    document.querySelector(`.tab-btn[data-tab="${kind}"]`).click();
    settingsCard.classList.add('hidden');
    printOutletName.textContent = outletNameInput.value.trim() || 'Water Dip Register';
    const title =
      kind === 'monsoon'
        ? 'Daily Water Dip & Appearance — Monthly Register'
        : 'Hourly Water Dip & Appearance — Rainy Days Register';
    const monthYear = `${outletMonthInput.value || ''} ${outletYearInput.value || ''}`.trim();
    printSubtitle.textContent = monthYear ? `${title} · ${monthYear}` : title;
    setTimeout(() => window.print(), 50);
  }

  // ---------------------------------------------------------------
  // Shared card event delegation (edits + delete + sign)
  // ---------------------------------------------------------------
  function wireEntryList(container) {
    container.addEventListener('input', (e) => {
      const card = e.target.closest('.entry-card');
      if (!card) return;
      const rowId = card.dataset.id;

      if (e.target.dataset.field) {
        const table = rowTableMap[rowId];
        const cache = table === 'monsoon_entries' ? monsoonCache : rainyCache;
        const row = cache.get(rowId);
        if (row) row[e.target.dataset.field] = e.target.value;
        scheduleSave(rowId, e.target.dataset.field, e.target.value);
      } else if (e.target.dataset.tank) {
        const { tank, slot, kind } = e.target.dataset;
        updateReading(rowId, tank, slot, kind, e.target.value);
      }
    });

    container.addEventListener('change', (e) => {
      if (!e.target.classList.contains('appearance-select')) return;
      e.target.dataset.val = e.target.value;
      const card = e.target.closest('.entry-card');
      const rowId = card.dataset.id;
      const { tank, slot, kind } = e.target.dataset;
      updateReading(rowId, tank, slot, kind, e.target.value);
    });

    container.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      const card = e.target.closest('.entry-card');
      const rowId = card.dataset.id;

      if (action === 'delete') {
        if (!confirm('Delete this entry? This cannot be undone.')) return;
        const table = rowTableMap[rowId];
        const { error } = await supabase.from(table).delete().eq('id', rowId);
        if (error) {
          showToast('Could not delete: ' + error.message, true);
          return;
        }
        (table === 'monsoon_entries' ? monsoonCache : rainyCache).delete(rowId);
        delete rowTableMap[rowId];
        card.remove();
        showToast('Entry deleted');
      }

      if (action === 'sign' || action === 'resign') {
        openSignatureModal(rowId);
      }
    });
  }

  wireEntryList(monsoonBody);
  wireEntryList(rainyBody);

  // ---------------------------------------------------------------
  // Signature modal (member picker + pad)
  // ---------------------------------------------------------------
  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    signatureCanvas.width = signatureCanvas.offsetWidth * ratio;
    signatureCanvas.height = signatureCanvas.offsetHeight * ratio;
    signatureCanvas.getContext('2d').scale(ratio, ratio);
    if (signaturePad) signaturePad.clear();
  }

  function openSignatureModal(rowId) {
    if (members.length === 0) {
      showToast('Add at least one outlet member in Settings before signing.', true);
      return;
    }
    signingRowId = rowId;
    signerSelect.innerHTML = members
      .map((m) => `<option value="${m.id}">${esc(m.member_name)}</option>`)
      .join('');
    const preferred = members.find((m) => m.id === lastSelectedMemberId);
    signerSelect.value = preferred ? preferred.id : members[0].id;

    signatureModal.classList.remove('hidden');
    if (!signaturePad) {
      signaturePad = new SignaturePad(signatureCanvas, { backgroundColor: 'rgba(255,255,255,1)', penColor: '#0B3556' });
    }
    resizeCanvas();
  }

  function closeSignatureModal() {
    signatureModal.classList.add('hidden');
    signingRowId = null;
  }

  clearSigBtn.addEventListener('click', () => signaturePad && signaturePad.clear());
  cancelSigBtn.addEventListener('click', closeSignatureModal);

  saveSigBtn.addEventListener('click', async () => {
    if (!signingRowId || !signaturePad) return;
    if (signaturePad.isEmpty()) {
      showToast('Please sign before saving.', true);
      return;
    }
    const dataUrl = signaturePad.toDataURL('image/png');
    const memberId = signerSelect.value;
    const member = members.find((m) => m.id === memberId);
    const memberName = member ? member.member_name : '';
    const rowId = signingRowId;
    const table = rowTableMap[rowId];

    const { error } = await supabase
      .from(table)
      .update({ checked_by_signature: dataUrl, checked_by_name: memberName, checked_by_member_id: memberId })
      .eq('id', rowId);

    if (error) {
      showToast('Could not save signature: ' + error.message, true);
      return;
    }

    const cache = table === 'monsoon_entries' ? monsoonCache : rainyCache;
    const row = cache.get(rowId);
    if (row) {
      row.checked_by_signature = dataUrl;
      row.checked_by_name = memberName;
      row.checked_by_member_id = memberId;
    }
    lastSelectedMemberId = memberId;

    const card = document.querySelector(`.entry-card[data-id="${rowId}"]`);
    const footerLeft = card.querySelector('.footer-left');
    const chip = footerLeft.querySelector('.signed-chip, .sign-btn');
    chip.outerHTML = checkedCellHTML({ checked_by_signature: dataUrl, checked_by_name: memberName });

    closeSignatureModal();
    showToast('Signature saved');
  });

  window.addEventListener('resize', () => {
    if (signatureModal && !signatureModal.classList.contains('hidden')) resizeCanvas();
  });

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  let initialized = false;
  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (!initialized) return;
      if (event === 'SIGNED_IN' && session) onLogin(session);
      if (event === 'SIGNED_OUT') onLogout();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) onLogin(data.session);
      initialized = true;
    });
  }
})();
