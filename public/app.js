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

  const APPEARANCE_OPTIONS = [
    { value: 'Clear', label: 'Clear', color: '#2F7D5A' },
    { value: 'Hazy', label: 'Hazy', color: '#C97A21' },
    { value: 'Water Layer at bottom', label: 'Water layer at bottom', color: '#B23A34' },
  ];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const TANK_NAME_DEFAULTS = ['Petrol', 'Speed', 'Diesel'];

  // ---------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------
  const authScreen = document.getElementById('authScreen');
  const recoveryScreen = document.getElementById('recoveryScreen');
  const onboardScreen = document.getElementById('onboardScreen');
  const appScreen = document.getElementById('appScreen');

  const authTabsWrap = document.getElementById('authTabsWrap');
  const authTabs = document.querySelectorAll('.auth-tab');
  const authForm = document.getElementById('authForm');
  const authOwnerName = document.getElementById('authOwnerName');
  const authOutletName = document.getElementById('authOutletName');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authSubmit = document.getElementById('authSubmit');
  const authMsg = document.getElementById('authMsg');
  const authNote = document.querySelector('.auth-note');
  const signupOnlyFields = document.querySelectorAll('.signup-only');
  const signinOnlyEls = document.querySelectorAll('.signin-only');

  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const resetRequestBlock = document.getElementById('resetRequestBlock');
  const resetEmail = document.getElementById('resetEmail');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const backToSigninLink = document.getElementById('backToSigninLink');

  const recoveryPassword = document.getElementById('recoveryPassword');
  const recoveryPasswordConfirm = document.getElementById('recoveryPasswordConfirm');
  const recoverySaveBtn = document.getElementById('recoverySaveBtn');
  const recoveryMsg = document.getElementById('recoveryMsg');

  const tankCountInput = document.getElementById('tankCount');
  const generateTankRowsBtn = document.getElementById('generateTankRows');
  const onboardTankRows = document.getElementById('onboardTankRows');
  const finishOnboardingBtn = document.getElementById('finishOnboardingBtn');
  const onboardMsg = document.getElementById('onboardMsg');

  const topbarOutlet = document.getElementById('topbarOutlet');
  const topbarMonthYear = document.getElementById('topbarMonthYear');
  const roleBadge = document.getElementById('roleBadge');

  const outletOwnerNameInput = document.getElementById('outletOwnerName');
  const outletNameInput = document.getElementById('outletName');
  const outletMonthBtn = document.getElementById('outletMonthBtn');
  const outletMonthLabel = document.getElementById('outletMonthLabel');
  const outletYearInput = document.getElementById('outletYear');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const staffOutletInfo = document.getElementById('staffOutletInfo');

  const tankManageList = document.getElementById('tankManageList');
  const newTankName = document.getElementById('newTankName');
  const newTankCapacity = document.getElementById('newTankCapacity');
  const addTankBtn = document.getElementById('addTankBtn');

  const staffManageList = document.getElementById('staffManageList');
  const newStaffName = document.getElementById('newStaffName');
  const newStaffEmail = document.getElementById('newStaffEmail');
  const newStaffPassword = document.getElementById('newStaffPassword');
  const addStaffBtn = document.getElementById('addStaffBtn');

  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const changePasswordModal = document.getElementById('changePasswordModal');
  const newPasswordInput = document.getElementById('newPassword');
  const newPasswordConfirmInput = document.getElementById('newPasswordConfirm');
  const changePasswordMsg = document.getElementById('changePasswordMsg');
  const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
  const savePasswordBtn = document.getElementById('savePasswordBtn');

  const navBtns = document.querySelectorAll('.nav-btn');
  const monsoonPanel = document.getElementById('monsoonPanel');
  const rainyPanel = document.getElementById('rainyPanel');
  const contamPanel = document.getElementById('contamPanel');
  const settingsScreen = document.getElementById('settingsScreen');

  const monsoonThead = document.getElementById('monsoonThead');
  const monsoonBody = document.getElementById('monsoonBody');
  const rainyThead = document.getElementById('rainyThead');
  const rainyBody = document.getElementById('rainyBody');
  const contamBody = document.getElementById('contamBody');

  const printMonsoonBtn = document.getElementById('printMonsoonBtn');
  const printRainyBtn = document.getElementById('printRainyBtn');
  const printContamBtn = document.getElementById('printContamBtn');
  const fabAddBtn = document.getElementById('fabAddBtn');

  const printOutletName = document.getElementById('printOutletName');
  const printSubtitle = document.getElementById('printSubtitle');

  const entryModal = document.getElementById('entryModal');
  const entryModalBody = document.getElementById('entryModalBody');
  const entryModalActions = document.getElementById('entryModalActions');

  const toastEl = document.getElementById('toast');

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  let currentUser = null;
  let role = null;              // 'owner' | 'staff'
  let ownerId = null;            // the id all outlet data is scoped to
  let currentSettings = null;
  let currentStaffRow = null;
  let displayName = '';
  let tanks = [];
  let staffList = [];
  let activeTab = 'monsoon';
  let outletMonthValue = '';

  let monsoonRows = [];
  let rainyRows = [];
  let contamRows = [];

  let entryModalKind = null;
  let entryModalRowId = null;
  let entryModalSignaturePad = null;

  const genericPending = {};
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

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }

  function appearanceLabel(val) {
    if (!val) return 'Select';
    return val === 'Water Layer at bottom' ? 'Water layer at bottom' : val;
  }

  let toastTimer = null;
  function showToast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.toggle('error', !!isError);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  // ---------------------------------------------------------------
  // Password show/hide toggles (generic, works for every pw field)
  // ---------------------------------------------------------------
  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggleFor);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? '<svg><use href="#icon-eye"/></svg>' : '<svg><use href="#icon-eye-off"/></svg>';
    });
  });

  // ---------------------------------------------------------------
  // Bottom sheet (custom picker — replaces every native <select>)
  // ---------------------------------------------------------------
  function openActionSheet(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet-card">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${esc(opts.title)}</div>
        <div class="sheet-options">
          ${opts.options
            .map(
              (o) => `<button type="button" class="sheet-option ${o.value === opts.selectedValue ? 'selected' : ''}" data-value="${esc(o.value)}">
              ${o.color ? `<span class="dot" style="background:${o.color}"></span>` : ''}
              <span class="opt-label">${esc(o.label)}</span>
              ${o.value === opts.selectedValue ? '<svg class="check"><use href="#icon-check"/></svg>' : ''}
            </button>`
            )
            .join('')}
        </div>
        <button type="button" class="sheet-cancel">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.sheet-cancel').addEventListener('click', close);
    overlay.querySelectorAll('.sheet-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        opts.onSelect(btn.dataset.value);
        close();
      });
    });
  }

  // ---------------------------------------------------------------
  // Generic debounced field save (tanks, staff names)
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
      signinOnlyEls.forEach((el) => el.classList.toggle('hidden', isSignup));
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
      }
    } catch (err) {
      authMsg.textContent = err.message || 'Something went wrong.';
    } finally {
      authSubmit.disabled = false;
    }
  });

  // ---------------------------------------------------------------
  // Forgot password / recovery / change password
  // ---------------------------------------------------------------
  forgotPasswordLink.addEventListener('click', () => {
    authTabsWrap.classList.add('hidden');
    authForm.classList.add('hidden');
    authNote.classList.add('hidden');
    resetRequestBlock.classList.remove('hidden');
    resetEmail.value = authEmail.value;
    authMsg.textContent = '';
  });

  backToSigninLink.addEventListener('click', () => {
    resetRequestBlock.classList.add('hidden');
    authTabsWrap.classList.remove('hidden');
    authForm.classList.remove('hidden');
    authNote.classList.remove('hidden');
    authMsg.textContent = '';
  });

  sendResetBtn.addEventListener('click', async () => {
    if (!supabase) return;
    const email = resetEmail.value.trim();
    if (!email) {
      authMsg.textContent = 'Enter your email first.';
      authMsg.classList.remove('success');
      return;
    }
    sendResetBtn.disabled = true;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    sendResetBtn.disabled = false;
    if (error) {
      authMsg.textContent = error.message;
      authMsg.classList.remove('success');
    } else {
      authMsg.textContent = 'Check your email for a password reset link.';
      authMsg.classList.add('success');
    }
  });

  recoverySaveBtn.addEventListener('click', async () => {
    if (!supabase) return;
    const p1 = recoveryPassword.value;
    const p2 = recoveryPasswordConfirm.value;
    if (p1.length < 6) {
      recoveryMsg.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (p1 !== p2) {
      recoveryMsg.textContent = 'Passwords do not match.';
      return;
    }
    recoverySaveBtn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: p1 });
    recoverySaveBtn.disabled = false;
    if (error) {
      recoveryMsg.textContent = error.message;
      return;
    }
    recoveryMsg.textContent = 'Password updated. Taking you in…';
    recoveryMsg.classList.add('success');
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      recoveryScreen.classList.add('hidden');
      onLogin(data.session);
    }
  });

  changePasswordBtn.addEventListener('click', () => {
    newPasswordInput.value = '';
    newPasswordConfirmInput.value = '';
    changePasswordMsg.textContent = '';
    changePasswordModal.classList.remove('hidden');
  });
  cancelPasswordBtn.addEventListener('click', () => changePasswordModal.classList.add('hidden'));

  savePasswordBtn.addEventListener('click', async () => {
    const p1 = newPasswordInput.value;
    const p2 = newPasswordConfirmInput.value;
    if (p1.length < 6) {
      changePasswordMsg.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (p1 !== p2) {
      changePasswordMsg.textContent = 'Passwords do not match.';
      return;
    }
    savePasswordBtn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: p1 });
    savePasswordBtn.disabled = false;
    if (error) {
      changePasswordMsg.textContent = error.message;
      return;
    }
    changePasswordModal.classList.add('hidden');
    showToast('Password updated');
  });

  logoutBtn.addEventListener('click', async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  });

  // ---------------------------------------------------------------
  // Login / logout — figures out whether this login is the owner
  // or a staff sub-user, and scopes all data to the right owner id
  // ---------------------------------------------------------------
  async function createInitialOwnerSettings() {
    const meta = currentUser.user_metadata || {};
    const payload = {
      user_id: currentUser.id,
      owner_name: meta.owner_name || '',
      outlet_name: meta.outlet_name || '',
      year: String(new Date().getFullYear()),
      onboarded: false,
    };
    const { data, error } = await supabase.from('outlet_settings').insert(payload).select().single();
    if (error) {
      showToast('Could not set up your outlet: ' + error.message, true);
      return null;
    }
    return data;
  }

  async function loadTanks() {
    const { data, error } = await supabase
      .from('tanks')
      .select('*')
      .eq('user_id', ownerId)
      .order('sort_order', { ascending: true });
    if (error) {
      showToast('Could not load tanks: ' + error.message, true);
      return;
    }
    tanks = data || [];
  }

  async function onLogin(session) {
    currentUser = session.user;
    authScreen.classList.add('hidden');
    recoveryScreen.classList.add('hidden');
    onboardScreen.classList.add('hidden');
    appScreen.classList.add('hidden');

    const { data: ownerRow, error: ownerErr } = await supabase
      .from('outlet_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (ownerErr) {
      showToast('Could not load your account: ' + ownerErr.message, true);
      return;
    }

    if (ownerRow) {
      role = 'owner';
      ownerId = currentUser.id;
      currentSettings = ownerRow;
      displayName = ownerRow.owner_name || currentUser.email;
    } else {
      const { data: staffRow, error: staffErr } = await supabase
        .from('outlet_staff')
        .select('*')
        .eq('staff_user_id', currentUser.id)
        .maybeSingle();
      if (staffErr) {
        showToast('Could not load your account: ' + staffErr.message, true);
        return;
      }
      if (staffRow) {
        role = 'staff';
        ownerId = staffRow.owner_user_id;
        currentStaffRow = staffRow;
        displayName = staffRow.staff_name || currentUser.email;
        const { data: settingsForStaff } = await supabase
          .from('outlet_settings')
          .select('*')
          .eq('user_id', ownerId)
          .maybeSingle();
        currentSettings = settingsForStaff || {};
      } else {
        role = 'owner';
        ownerId = currentUser.id;
        currentSettings = await createInitialOwnerSettings();
        if (!currentSettings) return;
        displayName = currentSettings.owner_name || currentUser.email;
      }
    }

    await loadTanks();

    if (role === 'owner' && (!currentSettings.onboarded || tanks.length === 0)) {
      showOnboarding();
      return;
    }
    await enterApp();
  }

  function onLogout() {
    currentUser = null;
    role = null;
    ownerId = null;
    currentSettings = null;
    currentStaffRow = null;
    displayName = '';
    tanks = [];
    staffList = [];
    monsoonRows = [];
    rainyRows = [];
    contamRows = [];
    appScreen.classList.add('hidden');
    onboardScreen.classList.add('hidden');
    recoveryScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authForm.reset();
    resetRequestBlock.classList.add('hidden');
    authTabsWrap.classList.remove('hidden');
    authForm.classList.remove('hidden');
    authNote.classList.remove('hidden');
  }

  // ---------------------------------------------------------------
  // Onboarding: tank setup wizard (owner only)
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
        <input type="number" placeholder="Qty in litres (optional)" data-onboard-capacity />
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
        user_id: ownerId,
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
      .eq('user_id', ownerId);
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
  // Enter the main app
  // ---------------------------------------------------------------
  async function enterApp() {
    onboardScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    applyRoleVisibility();
    if (role === 'owner') {
      populateSettingsFields(currentSettings);
      renderTankManageList();
      await loadStaffList();
      renderStaffManageList();
    }
    updateHeaders();
    switchTab('monsoon');

    await Promise.all([loadMonsoon(), loadRainy(), loadContam()]);
  }

  function applyRoleVisibility() {
    document.querySelectorAll('.settings-owner-only').forEach((el) => el.classList.toggle('hidden', role !== 'owner'));
    document.querySelectorAll('.settings-staff-only').forEach((el) => el.classList.toggle('hidden', role !== 'staff'));
    if (role === 'staff') {
      staffOutletInfo.textContent = `${(currentSettings && currentSettings.outlet_name) || 'This outlet'} — owned by ${
        (currentSettings && currentSettings.owner_name) || 'the owner'
      }. You're signed in as staff.`;
    }
    roleBadge.textContent = role === 'owner' ? 'Owner' : `Staff · ${displayName}`;
  }

  // ---------------------------------------------------------------
  // Outlet settings (owner only)
  // ---------------------------------------------------------------
  function updateHeaders() {
    const outlet = (currentSettings && currentSettings.outlet_name) || 'Water Dip Register';
    topbarOutlet.textContent = outlet;
    const my = `${(currentSettings && currentSettings.month) || ''} ${(currentSettings && currentSettings.year) || ''}`.trim();
    topbarMonthYear.textContent = my;
    document.title = `${outlet} — Water Dip Register`;
  }

  function populateSettingsFields(settings) {
    outletOwnerNameInput.value = settings.owner_name || '';
    outletNameInput.value = settings.outlet_name || '';
    outletMonthValue = settings.month || '';
    outletMonthLabel.textContent = outletMonthValue || 'Select month';
    outletYearInput.value = settings.year || new Date().getFullYear();
  }

  outletMonthBtn.addEventListener('click', () => {
    openActionSheet({
      title: 'Select month',
      options: MONTHS.map((m) => ({ value: m, label: m })),
      selectedValue: outletMonthValue,
      onSelect: (val) => {
        outletMonthValue = val;
        outletMonthLabel.textContent = val;
      },
    });
  });

  saveSettingsBtn.addEventListener('click', async () => {
    if (!ownerId) return;
    saveSettingsBtn.disabled = true;
    settingsStatus.textContent = 'Saving…';
    const payload = {
      owner_name: outletOwnerNameInput.value.trim(),
      outlet_name: outletNameInput.value.trim(),
      month: outletMonthValue,
      year: outletYearInput.value,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('outlet_settings').update(payload).eq('user_id', ownerId);
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
  // Tank management (owner only)
  // ---------------------------------------------------------------
  function renderTankManageList() {
    if (tanks.length === 0) {
      tankManageList.innerHTML = '<p class="block-sub">No tanks yet — add one below.</p>';
      return;
    }
    tankManageList.innerHTML = tanks
      .map(
        (t) => `
      <div class="manage-item" data-tank-id="${t.id}">
        <input type="text" data-tank-field="name" value="${esc(t.name)}" />
        <input type="number" data-tank-field="capacity_litres" value="${t.capacity_litres ?? ''}" placeholder="Litres" />
        <button type="button" class="btn-icon-danger" data-tank-action="delete" title="Remove tank">✕</button>
      </div>`
      )
      .join('');
  }

  tankManageList.addEventListener('input', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item || !e.target.dataset.tankField) return;
    const tankId = item.dataset.tankId;
    const field = e.target.dataset.tankField;
    const value = e.target.value;
    const tank = tanks.find((t) => t.id === tankId);
    const stored = field === 'capacity_litres' ? (value ? Number(value) : null) : value;
    if (tank) tank[field] = stored;
    debouncedUpdate('tanks', tankId, field, stored);
    refreshAllTables();
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
    refreshAllTables();
  });

  addTankBtn.addEventListener('click', async () => {
    const name = newTankName.value.trim();
    if (!name) {
      showToast('Give the tank a name first.', true);
      return;
    }
    const capRaw = newTankCapacity.value;
    const payload = {
      user_id: ownerId,
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
    refreshAllTables();
  });

  // ---------------------------------------------------------------
  // Staff accounts (owner only) — via server admin endpoints
  // ---------------------------------------------------------------
  async function loadStaffList() {
    const { data, error } = await supabase
      .from('outlet_staff')
      .select('*')
      .eq('owner_user_id', ownerId)
      .order('created_at', { ascending: true });
    if (error) {
      showToast('Could not load staff: ' + error.message, true);
      return;
    }
    staffList = data || [];
  }

  function renderStaffManageList() {
    if (staffList.length === 0) {
      staffManageList.innerHTML = '<p class="block-sub">No staff accounts yet — add one below.</p>';
      return;
    }
    staffManageList.innerHTML = staffList
      .map(
        (s) => `
      <div class="manage-item" data-staff-id="${s.id}" data-staff-user-id="${s.staff_user_id}">
        <input type="text" data-staff-field="staff_name" value="${esc(s.staff_name)}" />
        <span class="item-email">${esc(s.staff_email || '')}</span>
        <button type="button" class="btn-icon-danger" data-staff-action="delete" title="Remove staff account">✕</button>
      </div>`
      )
      .join('');
  }

  staffManageList.addEventListener('input', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item || !e.target.dataset.staffField) return;
    const id = item.dataset.staffId;
    const field = e.target.dataset.staffField;
    const value = e.target.value;
    const s = staffList.find((x) => x.id === id);
    if (s) s[field] = value;
    debouncedUpdate('outlet_staff', id, field, value);
  });

  staffManageList.addEventListener('click', async (e) => {
    if (e.target.dataset.staffAction !== 'delete') return;
    const item = e.target.closest('.manage-item');
    const staffUserId = item.dataset.staffUserId;
    const s = staffList.find((x) => x.staff_user_id === staffUserId);
    if (!confirm(`Remove staff account for "${s ? s.staff_name : ''}"? They will no longer be able to log in.`)) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/staff/${staffUserId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to remove staff account');
      staffList = staffList.filter((x) => x.staff_user_id !== staffUserId);
      renderStaffManageList();
      showToast('Staff account removed');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  addStaffBtn.addEventListener('click', async () => {
    const name = newStaffName.value.trim();
    const email = newStaffEmail.value.trim();
    const password = newStaffPassword.value;
    if (!name || !email || !password) {
      showToast('Fill in name, email, and password.', true);
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', true);
      return;
    }
    addStaffBtn.disabled = true;
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add staff account');
      staffList.push(json.staff);
      newStaffName.value = '';
      newStaffEmail.value = '';
      newStaffPassword.value = '';
      renderStaffManageList();
      showToast('Staff account created');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      addStaffBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------
  // Bottom navigation / screen switching
  // ---------------------------------------------------------------
  function switchTab(tab) {
    activeTab = tab;
    navBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    monsoonPanel.classList.toggle('hidden', tab !== 'monsoon');
    rainyPanel.classList.toggle('hidden', tab !== 'rainy');
    contamPanel.classList.toggle('hidden', tab !== 'contam');
    settingsScreen.classList.toggle('hidden', tab !== 'settings');
    fabAddBtn.classList.toggle('hidden', tab === 'settings');
  }

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  fabAddBtn.addEventListener('click', () => {
    if (activeTab === 'monsoon') openEntryModal('monsoon', null);
    else if (activeTab === 'rainy') openEntryModal('rainy', null);
    else if (activeTab === 'contam') openEntryModal('contam', null);
  });

  // ---------------------------------------------------------------
  // Loading registers
  // ---------------------------------------------------------------
  async function loadMonsoon() {
    const { data, error } = await supabase
      .from('monsoon_entries')
      .select('*')
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: true })
      .order('row_order', { ascending: true });
    if (error) {
      showToast('Could not load monthly register: ' + error.message, true);
      return;
    }
    monsoonRows = data || [];
    renderMonsoonTable();
  }

  async function loadRainy() {
    const { data, error } = await supabase
      .from('rainy_entries')
      .select('*')
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: true })
      .order('row_order', { ascending: true });
    if (error) {
      showToast('Could not load hourly register: ' + error.message, true);
      return;
    }
    rainyRows = data || [];
    renderRainyTable();
  }

  async function loadContam() {
    const { data, error } = await supabase
      .from('contamination_log')
      .select('*')
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: true })
      .order('row_order', { ascending: true });
    if (error) {
      showToast('Could not load contamination log: ' + error.message, true);
      return;
    }
    contamRows = data || [];
    renderContamTable();
  }

  function refreshAllTables() {
    renderMonsoonTable();
    renderRainyTable();
    renderContamTable();
  }

  function emptyRowHTML(colCount, msg) {
    return `<tr class="table-empty-row"><td colspan="${colCount}">${esc(msg)}</td></tr>`;
  }

  // ---------------------------------------------------------------
  // Excel-style grid: Monthly (monsoon) register
  // ---------------------------------------------------------------
  function buildMonsoonThead() {
    const row1 = ['<th rowspan="2">Date</th>'];
    const row2 = [];
    tanks.forEach((t) => {
      row1.push(`<th colspan="2">${esc(t.name)} — Morning</th>`);
      row1.push(`<th colspan="2">${esc(t.name)} — Evening</th>`);
      row2.push('<th>Dip (mm)</th><th>Appearance</th>');
      row2.push('<th>Dip (mm)</th><th>Appearance</th>');
    });
    row1.push('<th rowspan="2">Remarks</th>');
    row1.push('<th rowspan="2">Checked By</th>');
    monsoonThead.innerHTML = `<tr>${row1.join('')}</tr><tr>${row2.join('')}</tr>`;
  }

  function appearanceCellHTML(val) {
    if (!val) return '<td>—</td>';
    const cls = val.replace(/\s+/g, '_');
    return `<td class="cell-appearance val-${cls}">${esc(appearanceLabel(val))}</td>`;
  }

  function signedCellHTML(signature, name, at, unsignedLabel) {
    if (signature) {
      return `<td><div class="cell-signed"><img src="${signature}" alt="signature" /><div class="sig-meta"><span class="sig-name">${esc(
        name || ''
      )}</span><span class="sig-time">${esc(fmtTime(at))}</span></div></div></td>`;
    }
    return `<td class="cell-unsigned">${esc(unsignedLabel)}</td>`;
  }

  function monsoonRowHTML(row) {
    const cells = [`<td>${esc(row.entry_date) || '—'}</td>`];
    tanks.forEach((t) => {
      const r = (row.readings && row.readings[t.id]) || {};
      cells.push(`<td>${esc(r.morning_dip) || '—'}</td>`);
      cells.push(appearanceCellHTML(r.morning_appearance));
      cells.push(`<td>${esc(r.evening_dip) || '—'}</td>`);
      cells.push(appearanceCellHTML(r.evening_appearance));
    });
    cells.push(`<td class="cell-text">${esc(row.remarks)}</td>`);
    cells.push(signedCellHTML(row.checked_by_signature, row.checked_by_name, row.checked_by_at, 'Not signed'));
    return `<tr data-id="${row.id}">${cells.join('')}</tr>`;
  }

  function renderMonsoonTable() {
    buildMonsoonThead();
    monsoonBody.innerHTML = monsoonRows.length
      ? monsoonRows.map(monsoonRowHTML).join('')
      : emptyRowHTML(tanks.length * 4 + 3, "No entries yet — tap the + button to add today's reading.");
  }

  monsoonBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openEntryModal('monsoon', tr.dataset.id);
  });

  printMonsoonBtn.addEventListener('click', () => preparePrint('monsoon'));

  // ---------------------------------------------------------------
  // Excel-style grid: Hourly (rainy) register
  // ---------------------------------------------------------------
  function buildRainyThead() {
    const row1 = ['<th rowspan="2">Date</th>', '<th rowspan="2">Hour/Time</th>'];
    const row2 = [];
    tanks.forEach((t) => {
      row1.push(`<th colspan="2">${esc(t.name)}</th>`);
      row2.push('<th>Dip (mm)</th><th>Appearance</th>');
    });
    row1.push('<th rowspan="2">Remarks</th>');
    row1.push('<th rowspan="2">Checked By</th>');
    rainyThead.innerHTML = `<tr>${row1.join('')}</tr><tr>${row2.join('')}</tr>`;
  }

  function rainyRowHTML(row) {
    const cells = [`<td>${esc(row.entry_date) || '—'}</td>`, `<td>${esc(row.hour_time) || '—'}</td>`];
    tanks.forEach((t) => {
      const r = (row.readings && row.readings[t.id]) || {};
      cells.push(`<td>${esc(r.dip) || '—'}</td>`);
      cells.push(appearanceCellHTML(r.appearance));
    });
    cells.push(`<td class="cell-text">${esc(row.remarks)}</td>`);
    cells.push(signedCellHTML(row.checked_by_signature, row.checked_by_name, row.checked_by_at, 'Not signed'));
    return `<tr data-id="${row.id}">${cells.join('')}</tr>`;
  }

  function renderRainyTable() {
    buildRainyThead();
    rainyBody.innerHTML = rainyRows.length
      ? rainyRows.map(rainyRowHTML).join('')
      : emptyRowHTML(tanks.length * 2 + 4, 'No entries yet — tap the + button to add an hourly reading.');
  }

  rainyBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openEntryModal('rainy', tr.dataset.id);
  });

  printRainyBtn.addEventListener('click', () => preparePrint('rainy'));

  // ---------------------------------------------------------------
  // Excel-style grid: Contamination log
  // ---------------------------------------------------------------
  function contamRowHTML(row, idx) {
    const tank = tanks.find((t) => t.id === row.tank_id);
    const tankNo = tank ? tanks.indexOf(tank) + 1 : '—';
    const product = tank ? tank.name : '—';
    const confirmedLabel = row.contamination_confirmed === 'Y' ? 'Yes' : row.contamination_confirmed === 'N' ? 'No' : '—';
    return `<tr data-id="${row.id}">
      <td>${idx + 1}</td>
      <td>${esc(row.entry_date) || '—'}</td>
      <td>${tankNo}</td>
      <td class="cell-text">${esc(product)}</td>
      <td>${esc(row.water_found_mm) || '—'}</td>
      ${appearanceCellHTML(row.appearance)}
      <td>${esc(confirmedLabel)}</td>
      <td class="cell-text">${esc(row.immediate_action)}</td>
      <td>${row.qty_decanted_litres ?? '—'}</td>
      <td class="cell-text">${esc(row.reported_to)}</td>
      <td class="cell-text">${esc(row.corrective_action)}</td>
      ${signedCellHTML(row.verified_by_signature, row.verified_by_name, row.verified_at, 'Not verified')}
      <td class="cell-text">${esc(row.remarks)}</td>
    </tr>`;
  }

  function renderContamTable() {
    contamBody.innerHTML = contamRows.length
      ? contamRows.map((row, idx) => contamRowHTML(row, idx)).join('')
      : emptyRowHTML(13, 'No contamination instances logged — tap the + button to log one.');
  }

  contamBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) openEntryModal('contam', tr.dataset.id);
  });

  printContamBtn.addEventListener('click', () => preparePrint('contam'));

  // ---------------------------------------------------------------
  // Print
  // ---------------------------------------------------------------
  function preparePrint(kind) {
    switchTab(kind);
    printOutletName.textContent = (currentSettings && currentSettings.outlet_name) || 'Water Dip Register';
    const titles = {
      monsoon: 'Daily Water Dip & Appearance — Monthly Register',
      rainy: 'Hourly Water Dip & Appearance — Rainy Days Register',
      contam: 'Water Contamination Instance Log',
    };
    const monthYear = `${(currentSettings && currentSettings.month) || ''} ${(currentSettings && currentSettings.year) || ''}`.trim();
    printSubtitle.textContent = monthYear ? `${titles[kind]} · ${monthYear}` : titles[kind];
    setTimeout(() => window.print(), 50);
  }

  // ---------------------------------------------------------------
  // Entry popup — shared vertical form for all three registers
  // ---------------------------------------------------------------
  function findRow(kind, id) {
    const list = kind === 'monsoon' ? monsoonRows : kind === 'rainy' ? rainyRows : contamRows;
    return list.find((r) => r.id === id) || null;
  }

  function buildSignSection(label, existingName, existingAt, existingSig) {
    const already = existingSig
      ? `<div class="signed-as-meta">Previously ${esc(label.toLowerCase())} by ${esc(existingName || '')} at ${esc(fmtTime(existingAt))}</div>`
      : '';
    return `
      <div class="sign-section">
        <div class="sign-section-title">${esc(label)}</div>
        <div class="signed-as-row">
          <div class="signed-as-avatar">${esc(initials(displayName).toUpperCase())}</div>
          <div class="signed-as-text">
            <span class="signed-as-name">${esc(displayName)}</span>
            <span class="signed-as-meta">${already ? 'Sign again to update' : "Signing now — time is captured automatically"}</span>
          </div>
        </div>
        ${already}
        <div class="sig-wrap"><canvas class="sig-canvas" id="ef_sigCanvas"></canvas></div>
        <div class="sig-actions"><button type="button" class="link-btn" id="ef_clearSig">Clear signature</button></div>
      </div>`;
  }

  function buildMonsoonForm(row) {
    const dateVal = row ? row.entry_date : todayISO();
    const remarksVal = row ? row.remarks || '' : '';
    const tankBlocks = tanks.length
      ? tanks
          .map((t) => {
            const r = (row && row.readings && row.readings[t.id]) || {};
            return `
        <div class="tank-section" data-tank-id="${t.id}">
          <div class="tank-section-title">${esc(t.name)} ${t.capacity_litres ? `<span class="cap">${fmtCap(t.capacity_litres)}</span>` : ''}</div>
          <div class="slot-block">
            <div class="slot-heading">Morning</div>
            <div class="sub-row"><label>Water dip (mm)</label><input type="text" inputmode="decimal" data-field="dip" data-slot="morning" value="${esc(r.morning_dip)}" placeholder="0.0" /></div>
            <div class="sub-row"><label>Appearance</label>
              <button type="button" class="picker-btn appearance-field" data-slot="morning" data-val="${esc(r.morning_appearance || '')}">
                <span class="val-label">${esc(appearanceLabel(r.morning_appearance))}</span>
                <svg class="chev"><use href="#icon-chevron"/></svg>
              </button>
            </div>
          </div>
          <div class="slot-block">
            <div class="slot-heading">Evening</div>
            <div class="sub-row"><label>Water dip (mm)</label><input type="text" inputmode="decimal" data-field="dip" data-slot="evening" value="${esc(r.evening_dip)}" placeholder="0.0" /></div>
            <div class="sub-row"><label>Appearance</label>
              <button type="button" class="picker-btn appearance-field" data-slot="evening" data-val="${esc(r.evening_appearance || '')}">
                <span class="val-label">${esc(appearanceLabel(r.evening_appearance))}</span>
                <svg class="chev"><use href="#icon-chevron"/></svg>
              </button>
            </div>
          </div>
        </div>`;
          })
          .join('')
      : '<p class="block-sub">No tanks configured yet — add one in Settings.</p>';

    return `
      <h3 class="entry-modal-title">${row ? 'Edit day' : 'New day'}</h3>
      <label class="field"><span>Date</span><input type="date" id="ef_date" value="${dateVal}" /></label>
      ${tankBlocks}
      <label class="field"><span>Remarks</span><input type="text" id="ef_remarks" value="${esc(remarksVal)}" placeholder="Optional" /></label>
      ${buildSignSection('Checked by', row ? row.checked_by_name : null, row ? row.checked_by_at : null, row ? row.checked_by_signature : null)}
    `;
  }

  function buildRainyForm(row) {
    const dateVal = row ? row.entry_date : todayISO();
    const hourVal = row ? row.hour_time || '' : '';
    const remarksVal = row ? row.remarks || '' : '';
    const tankBlocks = tanks.length
      ? tanks
          .map((t) => {
            const r = (row && row.readings && row.readings[t.id]) || {};
            return `
        <div class="tank-section" data-tank-id="${t.id}">
          <div class="tank-section-title">${esc(t.name)} ${t.capacity_litres ? `<span class="cap">${fmtCap(t.capacity_litres)}</span>` : ''}</div>
          <div class="sub-row"><label>Water dip (mm)</label><input type="text" inputmode="decimal" data-field="dip" data-slot="single" value="${esc(r.dip)}" placeholder="0.0" /></div>
          <div class="sub-row"><label>Appearance</label>
            <button type="button" class="picker-btn appearance-field" data-slot="single" data-val="${esc(r.appearance || '')}">
              <span class="val-label">${esc(appearanceLabel(r.appearance))}</span>
              <svg class="chev"><use href="#icon-chevron"/></svg>
            </button>
          </div>
        </div>`;
          })
          .join('')
      : '<p class="block-sub">No tanks configured yet — add one in Settings.</p>';

    return `
      <h3 class="entry-modal-title">${row ? 'Edit reading' : 'New reading'}</h3>
      <label class="field"><span>Date</span><input type="date" id="ef_date" value="${dateVal}" /></label>
      <label class="field"><span>Hour / time</span><input type="text" id="ef_hour" value="${esc(hourVal)}" placeholder="e.g. 08:00 AM" /></label>
      ${tankBlocks}
      <label class="field"><span>Remarks</span><input type="text" id="ef_remarks" value="${esc(remarksVal)}" placeholder="Optional" /></label>
      ${buildSignSection('Checked by', row ? row.checked_by_name : null, row ? row.checked_by_at : null, row ? row.checked_by_signature : null)}
    `;
  }

  function buildContamForm(row) {
    const dateVal = row ? row.entry_date : todayISO();
    const tankId = row ? row.tank_id : tanks[0] ? tanks[0].id : '';
    const tank = tanks.find((t) => t.id === tankId);
    return `
      <h3 class="entry-modal-title">${row ? 'Edit contamination record' : 'New contamination record'}</h3>
      <label class="field"><span>Date</span><input type="date" id="cf_date" value="${dateVal}" /></label>
      <label class="field"><span>Tank</span>
        <button type="button" class="picker-btn" id="cf_tank_btn" data-val="${esc(tankId || '')}">
          <span id="cf_tank_label">${tank ? esc(tank.name) : 'Select tank'}</span>
          <svg class="chev"><use href="#icon-chevron"/></svg>
        </button>
      </label>
      <label class="field"><span>Water found (mm)</span><input type="text" inputmode="decimal" id="cf_water" value="${esc(row ? row.water_found_mm : '')}" placeholder="0.0" /></label>
      <label class="field"><span>Appearance</span>
        <button type="button" class="picker-btn" id="cf_appearance_btn" data-val="${esc(row ? row.appearance : '') || ''}">
          <span id="cf_appearance_label">${esc(appearanceLabel(row ? row.appearance : ''))}</span>
          <svg class="chev"><use href="#icon-chevron"/></svg>
        </button>
      </label>
      <label class="field"><span>Contamination confirmed?</span>
        <button type="button" class="picker-btn" id="cf_confirmed_btn" data-val="${esc(row ? row.contamination_confirmed : '') || ''}">
          <span id="cf_confirmed_label">${row && row.contamination_confirmed ? (row.contamination_confirmed === 'Y' ? 'Yes' : 'No') : 'Select'}</span>
          <svg class="chev"><use href="#icon-chevron"/></svg>
        </button>
      </label>
      <label class="field"><span>Immediate action taken</span><textarea id="cf_immediate">${esc(row ? row.immediate_action : '')}</textarea></label>
      <label class="field"><span>Qty decanted / removed (litres)</span><input type="number" id="cf_qty" value="${row && row.qty_decanted_litres != null ? row.qty_decanted_litres : ''}" /></label>
      <label class="field"><span>Reported to (name &amp; designation)</span><input type="text" id="cf_reported" value="${esc(row ? row.reported_to : '')}" /></label>
      <label class="field"><span>Corrective action taken</span><textarea id="cf_corrective">${esc(row ? row.corrective_action : '')}</textarea></label>
      <label class="field"><span>Remarks</span><input type="text" id="cf_remarks" value="${esc(row ? row.remarks : '')}" /></label>
      ${buildSignSection('Verified by', row ? row.verified_by_name : null, row ? row.verified_at : null, row ? row.verified_by_signature : null)}
    `;
  }

  function buildEntryActionsHTML(rowId) {
    return `
      <div class="left-actions">${rowId ? '<button type="button" class="btn btn-danger-text" id="ef_delete">Delete</button>' : ''}</div>
      <div class="right-actions">
        <button type="button" class="btn btn-ghost" id="ef_cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="ef_save">Save</button>
      </div>`;
  }

  function resizeSigCanvas(canvas) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
  }

  function wireAppearanceButtons() {
    entryModalBody.querySelectorAll('.appearance-field').forEach((btn) => {
      btn.addEventListener('click', () => {
        openActionSheet({
          title: 'Appearance',
          options: APPEARANCE_OPTIONS,
          selectedValue: btn.dataset.val,
          onSelect: (val) => {
            btn.dataset.val = val;
            btn.querySelector('.val-label').textContent = appearanceLabel(val);
          },
        });
      });
    });
  }

  function wireContamPickers() {
    const tankBtn = document.getElementById('cf_tank_btn');
    tankBtn.addEventListener('click', () => {
      openActionSheet({
        title: 'Select tank',
        options: tanks.map((t) => ({ value: t.id, label: t.name })),
        selectedValue: tankBtn.dataset.val,
        onSelect: (val) => {
          tankBtn.dataset.val = val;
          const t = tanks.find((x) => x.id === val);
          document.getElementById('cf_tank_label').textContent = t ? t.name : 'Select tank';
        },
      });
    });
    const apBtn = document.getElementById('cf_appearance_btn');
    apBtn.addEventListener('click', () => {
      openActionSheet({
        title: 'Appearance',
        options: APPEARANCE_OPTIONS,
        selectedValue: apBtn.dataset.val,
        onSelect: (val) => {
          apBtn.dataset.val = val;
          document.getElementById('cf_appearance_label').textContent = appearanceLabel(val);
        },
      });
    });
    const confBtn = document.getElementById('cf_confirmed_btn');
    confBtn.addEventListener('click', () => {
      openActionSheet({
        title: 'Contamination confirmed?',
        options: [{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }],
        selectedValue: confBtn.dataset.val,
        onSelect: (val) => {
          confBtn.dataset.val = val;
          document.getElementById('cf_confirmed_label').textContent = val === 'Y' ? 'Yes' : 'No';
        },
      });
    });
  }

  function openEntryModal(kind, rowId) {
    entryModalKind = kind;
    entryModalRowId = rowId;
    const row = rowId ? findRow(kind, rowId) : null;

    let formHTML;
    if (kind === 'monsoon') formHTML = buildMonsoonForm(row);
    else if (kind === 'rainy') formHTML = buildRainyForm(row);
    else formHTML = buildContamForm(row);

    entryModalBody.innerHTML = formHTML;
    entryModalActions.innerHTML = buildEntryActionsHTML(rowId);

    wireAppearanceButtons();
    if (kind === 'contam') wireContamPickers();

    document.getElementById('ef_cancel').addEventListener('click', closeEntryModal);
    if (rowId) document.getElementById('ef_delete').addEventListener('click', () => handleEntryDelete(kind, rowId));
    document.getElementById('ef_save').addEventListener('click', () => handleEntrySave(kind, rowId));

    entryModal.classList.remove('hidden');

    const canvas = document.getElementById('ef_sigCanvas');
    entryModalSignaturePad = new SignaturePad(canvas, { backgroundColor: 'rgba(255,255,255,1)', penColor: '#0B3556' });
    requestAnimationFrame(() => resizeSigCanvas(canvas));
    document.getElementById('ef_clearSig').addEventListener('click', () => entryModalSignaturePad.clear());
  }

  function closeEntryModal() {
    entryModal.classList.add('hidden');
    entryModalKind = null;
    entryModalRowId = null;
    entryModalSignaturePad = null;
  }

  window.addEventListener('resize', () => {
    if (!entryModal.classList.contains('hidden')) {
      const canvas = document.getElementById('ef_sigCanvas');
      if (canvas) resizeSigCanvas(canvas);
    }
  });

  function applySignatureToPayload(payload, nameField, sigField, atField, userField) {
    if (entryModalSignaturePad && !entryModalSignaturePad.isEmpty()) {
      payload[sigField] = entryModalSignaturePad.toDataURL('image/png');
      payload[nameField] = displayName;
      payload[atField] = new Date().toISOString();
      payload[userField] = currentUser.id;
    }
  }

  async function upsertRow(table, rowId, payload, rowsArray, rowOrderBase) {
    if (rowId) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', rowId).select().single();
      if (error) {
        showToast('Could not save: ' + error.message, true);
        return false;
      }
      const idx = rowsArray.findIndex((r) => r.id === rowId);
      if (idx > -1) rowsArray[idx] = data;
      return true;
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ user_id: ownerId, row_order: rowOrderBase, ...payload })
      .select()
      .single();
    if (error) {
      showToast('Could not save: ' + error.message, true);
      return false;
    }
    rowsArray.push(data);
    return true;
  }

  async function handleEntrySave(kind, rowId) {
    const saveBtn = document.getElementById('ef_save');
    saveBtn.disabled = true;
    try {
      if (kind === 'monsoon') {
        const readings = {};
        entryModalBody.querySelectorAll('.tank-section').forEach((sec) => {
          const tid = sec.dataset.tankId;
          readings[tid] = {
            morning_dip: sec.querySelector('input[data-slot="morning"]').value.trim(),
            morning_appearance: sec.querySelector('.appearance-field[data-slot="morning"]').dataset.val || '',
            evening_dip: sec.querySelector('input[data-slot="evening"]').value.trim(),
            evening_appearance: sec.querySelector('.appearance-field[data-slot="evening"]').dataset.val || '',
          };
        });
        const payload = {
          entry_date: document.getElementById('ef_date').value,
          remarks: document.getElementById('ef_remarks').value.trim(),
          readings,
        };
        applySignatureToPayload(payload, 'checked_by_name', 'checked_by_signature', 'checked_by_at', 'checked_by_user_id');
        const ok = await upsertRow('monsoon_entries', rowId, payload, monsoonRows, monsoonRows.length);
        if (!ok) return;
        renderMonsoonTable();
      } else if (kind === 'rainy') {
        const readings = {};
        entryModalBody.querySelectorAll('.tank-section').forEach((sec) => {
          const tid = sec.dataset.tankId;
          readings[tid] = {
            dip: sec.querySelector('input[data-slot="single"]').value.trim(),
            appearance: sec.querySelector('.appearance-field[data-slot="single"]').dataset.val || '',
          };
        });
        const payload = {
          entry_date: document.getElementById('ef_date').value,
          hour_time: document.getElementById('ef_hour').value.trim(),
          remarks: document.getElementById('ef_remarks').value.trim(),
          readings,
        };
        applySignatureToPayload(payload, 'checked_by_name', 'checked_by_signature', 'checked_by_at', 'checked_by_user_id');
        const ok = await upsertRow('rainy_entries', rowId, payload, rainyRows, rainyRows.length);
        if (!ok) return;
        renderRainyTable();
      } else {
        const qtyRaw = document.getElementById('cf_qty').value;
        const payload = {
          entry_date: document.getElementById('cf_date').value,
          tank_id: document.getElementById('cf_tank_btn').dataset.val || null,
          water_found_mm: document.getElementById('cf_water').value.trim(),
          appearance: document.getElementById('cf_appearance_btn').dataset.val || '',
          contamination_confirmed: document.getElementById('cf_confirmed_btn').dataset.val || '',
          immediate_action: document.getElementById('cf_immediate').value.trim(),
          qty_decanted_litres: qtyRaw ? Number(qtyRaw) : null,
          reported_to: document.getElementById('cf_reported').value.trim(),
          corrective_action: document.getElementById('cf_corrective').value.trim(),
          remarks: document.getElementById('cf_remarks').value.trim(),
        };
        applySignatureToPayload(payload, 'verified_by_name', 'verified_by_signature', 'verified_at', 'verified_by_user_id');
        const ok = await upsertRow('contamination_log', rowId, payload, contamRows, contamRows.length);
        if (!ok) return;
        renderContamTable();
      }
      closeEntryModal();
      showToast('Saved');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function handleEntryDelete(kind, rowId) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const table = kind === 'monsoon' ? 'monsoon_entries' : kind === 'rainy' ? 'rainy_entries' : 'contamination_log';
    const rowsArray = kind === 'monsoon' ? monsoonRows : kind === 'rainy' ? rainyRows : contamRows;
    const { error } = await supabase.from(table).delete().eq('id', rowId);
    if (error) {
      showToast('Could not delete: ' + error.message, true);
      return;
    }
    const idx = rowsArray.findIndex((r) => r.id === rowId);
    if (idx > -1) rowsArray.splice(idx, 1);
    if (kind === 'monsoon') renderMonsoonTable();
    else if (kind === 'rainy') renderRainyTable();
    else renderContamTable();
    closeEntryModal();
    showToast('Entry deleted');
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  let initialized = false;
  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        authScreen.classList.add('hidden');
        onboardScreen.classList.add('hidden');
        appScreen.classList.add('hidden');
        recoveryScreen.classList.remove('hidden');
        return;
      }
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
