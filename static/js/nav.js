if (typeof LOGO === 'undefined') {
  var LOGO = '/images/logo.png';
}

// ============================================================
//  TOP NAV
// ============================================================
function renderTopNav() {
  var user = state.user;
  var activeView = state.view || 'home';
  var onSettingsPage = activeView === 'customer-dashboard';
  var onEventsPage = activeView === 'home' || activeView === 'detail';

  return '' +
  '<header style="position:sticky;top:0;z-index:1000;background:rgba(10,10,30,0.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);" class="top-nav-header">' +
    '<div style="max-width:1280px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;">' +

      '<div style="display:flex;align-items:center;gap:16px;">' +
        '<button onclick="navigate(\'home\')" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;">' +
          '<img src="' + LOGO + '" alt="logo" style="width:72px;height:72px;object-fit:contain;display:block;" />' +
        '</button>' +

        '<nav style="display:flex;align-items:center;gap:10px;">' +
          '<button onclick="navigate(\'home\')" style="background:' + (onEventsPage ? 'rgba(155,16,64,0.12)' : 'rgba(255,255,255,0.04)') + ';border:1px solid ' + (onEventsPage ? 'rgba(155,16,64,0.2)' : 'rgba(255,255,255,0.10)') + ';color:var(--text);padding:8px 14px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Events</button>' +
          '<button onclick="goToSettingsPage()" style="background:' + (onSettingsPage ? 'rgba(155,16,64,0.12)' : 'rgba(255,255,255,0.04)') + ';border:1px solid ' + (onSettingsPage ? 'rgba(155,16,64,0.2)' : 'rgba(255,255,255,0.10)') + ';color:var(--text);padding:8px 14px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Settings</button>' +
        '</nav>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        (user && user.is_admin ? '<button class="btn-ghost" onclick="navigate(\'admin-organizers\')">Organizer Requests</button>' : '') +
        '<button id="theme-btn" class="icon-btn" style="position:relative;z-index:2000;" onclick="toggleTheme()" title="Toggle theme">' + (document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙') + '</button>' +

        (user
          ? '<div style="display:flex;align-items:center;gap:8px;">' +
              '<div class="top-user-chip" onclick="goToUserMainPage()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(255,255,255,0.10);border-radius:999px;background:rgba(255,255,255,0.04);cursor:pointer;">' +
                '<div class="top-user-avatar" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#9B1040,#D49A35);color:#fff;font-weight:800;">' +
                  ((user.name || 'U').charAt(0).toUpperCase()) +
                '</div>' +
                '<div style="line-height:1.1;">' +
                  '<div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:12px;color:#fff;">' + (user.name || 'User') + '</div>' +
                  '<div style="font-size:11px;color:var(--muted);text-transform:capitalize;">' + (user.role || '') + '</div>' +
                '</div>' +
              '</div>' +
              '<button class="btn-ghost" onclick="logout()">Logout</button>' +
            '</div>'
          : '<button class="btn-ghost" onclick="navigate(\'login\')">Login</button>' +
            '<button class="btn-primary" onclick="navigate(\'signup\')">Sign Up</button>') +
      '</div>' +

    '</div>' +
  '</header>';
}


function goToSettingsPage() {
  if (!state.user) {
    state.loginRole = 'customer';
    navigate('login');
    return;
  }

  if (state.user.role === 'organizer') {
    navigate('dashboard');
  } else if (state.user.role === 'entry_staff') {
    navigate('scan');
  } else {
    navigate('customer-dashboard');
  }
}
window.goToSettingsPage = goToSettingsPage;

function scrollToEvents() {
  if (state.view !== 'home') {
    navigate('home');
    setTimeout(function() {
      var el = document.getElementById('events-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  } else {
    var el = document.getElementById('events-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}
window.scrollToEvents = scrollToEvents;

function goToUserMainPage() {
  if (!state.user) {
    navigate('home');
    return;
  }

  if (state.user.is_admin && state.user.role !== 'organizer') {
    navigate('admin-organizers');
  } else if (state.user.role === 'organizer') {
    navigate('dashboard');
  } else if (state.user.role === 'entry_staff') {
    navigate('scan');
  } else {
    navigate('customer-dashboard');
  }
}
window.goToUserMainPage = goToUserMainPage;
function logout() {
  if (typeof firebaseSignOut === 'function') firebaseSignOut();
  if (typeof clearAuthUser === 'function') {
    clearAuthUser();
  } else {
    state.user = null;
  }
  navigate('home');

  setTimeout(function () {
    if (typeof loadEvents === 'function') {
      loadEvents();
    }
  }, 50);
}
window.logout = logout;

// ============================================================
//  ORGANIZER SIDEBAR
// ============================================================
// ============================================================
//  ORGANIZER SIDEBAR (WITH HOME AT BOTTOM)
// ============================================================
function renderSidebar(active) {
  var user = state.user || {};

  function item(view, label, icon) {
    var isActive = active === view;

    return '' +
      '<button class="org-sidebar-item' + (isActive ? ' active' : '') + '" onclick="navigate(\'' + view + '\')" style="' +
        'width:100%;display:flex;align-items:center;gap:12px;' +
        'padding:14px 16px;margin-bottom:10px;border-radius:14px;' +
        'border:' + (isActive ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent') + ';' +
        'background:' + (isActive ? 'linear-gradient(135deg,#9B1040,#D49A35)' : 'transparent') + ';' +
        'color:#fff;cursor:pointer;font-size:14px;font-weight:700;text-align:left;' +
      '">' +
        '<span style="font-size:16px;">' + icon + '</span>' +
        '<span>' + label + '</span>' +
      '</button>';
  }

  return '' +
    '<aside class="org-sidebar" style="' +
      'width:260px;min-width:260px;' +
      'background:rgba(255,255,255,0.03);' +
      'border-right:1px solid rgba(255,255,255,0.08);' +
      'display:flex;flex-direction:column;justify-content:space-between;' +
      'padding:22px 16px;height:100vh;position:sticky;top:0;' +
    '">' +

      // ===== TOP =====
      '<div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:26px;padding:6px 8px;">' +
          '<img src="' + LOGO + '" alt="logo" style="width:42px;height:42px;object-fit:contain;" />' +
        '</div>' +

        item('dashboard', 'Dashboard', '📊') +
        item('my-events', 'My Events', '📅') +
        item('create', 'Create Event', '➕') +
        item('notifications', 'Notifications', '🔔') +
        item('reports', 'Reports', '📄') +
        item('add-staff', 'Add Staff', 'ID') +
        (user.is_admin ? item('admin-organizers', 'Organizer Approvals', 'ADM') : '') +
      '</div>' +

      // ===== BOTTOM =====
      '<div>' +

        // profile card
        '<div class="org-sidebar-profile" style="' +
          'display:flex;align-items:center;gap:10px;' +
          'padding:14px 12px;border:1px solid rgba(255,255,255,0.08);' +
          'border-radius:18px;background:rgba(255,255,255,0.04);margin-bottom:12px;' +
        '">' +
          '<div class="org-sidebar-avatar" style="' +
            'width:38px;height:38px;border-radius:50%;' +
            'display:flex;align-items:center;justify-content:center;' +
            'background:linear-gradient(135deg,#9B1040,#D49A35);' +
            'color:#fff;font-weight:800;' +
          '">' +
            ((user.name || 'U').charAt(0).toUpperCase()) +
          '</div>' +

          '<div style="min-width:0;">' +
            '<div style="font-family:Montserrat,sans-serif;font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              (user.name || 'User') +
            '</div>' +
            '<div style="font-size:12px;color:var(--muted);text-transform:capitalize;">' +
              (user.role || '') +
            '</div>' +
          '</div>' +
        '</div>' +

        // HOME BUTTON
        '<button class="org-sidebar-secondary" onclick="navigate(\'home\')" style="' +
          'width:100%;padding:12px 16px;margin-bottom:10px;border-radius:14px;' +
          'border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);' +
          'color:#fff;font-weight:700;cursor:pointer;text-align:left;' +
        '">🏠 Home</button>' +

        // LOGOUT BUTTON
        '<button class="org-sidebar-secondary" onclick="logout()" style="' +
          'width:100%;padding:12px 16px;border-radius:14px;' +
          'border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);' +
          'color:#fff;font-weight:700;cursor:pointer;text-align:left;' +
        '">🚪 Logout</button>' +

      '</div>' +
    '</aside>';
}
