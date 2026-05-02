// ============================================================
//  NAVIGATION
// ============================================================
function navigate(view, params) {
  params = params || {};

  state.view = view;
  state.params = params;

  history.pushState(
    { view: view, params: params },
    '',
    '#' + view
  );

  render();
}
window.navigate = navigate;


// ============================================================
//  RENDER ROUTER
// ============================================================
function render(options) {
  options = options || {};
  destroyAllCharts();

  if (state.view !== 'dashboard' && typeof stopDashboardPolling === 'function') {
    stopDashboardPolling();
  }

  if (state.view !== 'notifications' && typeof stopNotificationsPolling === 'function') {
    stopNotificationsPolling();
  }

  if (state.view !== 'scan' && typeof stopBarcodeCamera === 'function') {
    stopBarcodeCamera(true);
  }

  if (state.view !== 'scan' && typeof stopStaffEventsPolling === 'function') {
    stopStaffEventsPolling();
  }

  var app = document.getElementById('app');
  var v = state.view;

  if (!app) {
    document.body.innerHTML = '<h1 style="color:white;padding:40px;">App container not found</h1>';
    return;
  }

  var previousOrgMain = document.querySelector('.org-main');
  var preservedOrgMainScrollTop = options.preserveScroll && previousOrgMain
    ? previousOrgMain.scrollTop
    : 0;
  var preservedWindowScrollY = options.preserveScroll ? window.scrollY : 0;

  if (v === 'home') {
    app.innerHTML = renderHome();
    setTimeout(function () {
      if (typeof syncSupportChatScroll === 'function') {
        syncSupportChatScroll();
      }
    }, 20);

  } else if (v === 'detail') {
    app.innerHTML = renderDetail();

    setTimeout(function () {
      if (typeof initEventDetailPage === 'function') {
        initEventDetailPage();
      }
    }, 20);

  } else if (v === 'login') {
    app.innerHTML = renderLogin();

  } else if (v === 'signup') {
    app.innerHTML = renderSignup();

  } else if (v === 'notifications') {
    app.innerHTML = renderNotifications();
    if (typeof startNotificationsPolling === 'function') {
      startNotificationsPolling();
    }

  } else if (v === 'customer-dashboard') {
    app.innerHTML = renderCustomerDashboard();

    setTimeout(function () {
      if (typeof syncSupportChatScroll === 'function') {
        syncSupportChatScroll();
      }
      if (typeof initCustomerDashboardCharts === 'function') {
        initCustomerDashboardCharts();
      }
    }, 20);

  } else if (v === 'dashboard') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }
    app.innerHTML = renderDashboard();

    if (typeof startDashboardPolling === 'function') {
      startDashboardPolling();
    }

    setTimeout(function () {
      if (typeof initDashboardCharts === 'function') {
        initDashboardCharts();
      }
    }, 20);

  } else if (v === 'my-events') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }

    app.innerHTML = renderMyEvents();

  } else if (v === 'reports') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }

    app.innerHTML = renderReports();

    setTimeout(function () {
      if (typeof initReportsCharts === 'function') {
        initReportsCharts();
      }
    }, 20);

  } else if (v === 'add-staff') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }

    app.innerHTML = renderAddStaff();

  } else if (v === 'create') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }

    app.innerHTML = renderCreate();
    setTimeout(function() {
      if (typeof initCreateEventForm === 'function') {
        initCreateEventForm();
      }
    }, 0);

  } else if (v === 'edit') {
    if (!state.user || state.user.role !== 'organizer') {
      navigate('login');
      return;
    }

    app.innerHTML = renderEdit();
    setTimeout(function() {
      if (typeof initEditEventForm === 'function') {
        initEditEventForm();
      }
    }, 0);

  } else if (v === 'scan') {
    if (!state.user || state.user.role !== 'entry_staff') {
      state.loginRole = 'entry_staff';
      navigate('login');
      return;
    }

    app.innerHTML = renderScan();

  } else if (v === 'admin-organizers') {
    if (!state.user || !state.user.is_admin) {
      navigate('login');
      return;
    }

    app.innerHTML = renderAdminOrganizers();

  } else {
    app.innerHTML = renderHome();
  }

  if (options.preserveScroll) {
    setTimeout(function() {
      var nextOrgMain = document.querySelector('.org-main');
      if (nextOrgMain) {
        nextOrgMain.scrollTop = preservedOrgMainScrollTop;
      } else {
        window.scrollTo(0, preservedWindowScrollY);
      }
    }, 0);
  } else {
    window.scrollTo(0, 0);
  }
}


// ============================================================
//  HANDLE BACK / FORWARD
// ============================================================
window.onpopstate = function(event) {
  if (event.state) {
    state.view = event.state.view;
    state.params = event.state.params || {};
    render();
  }
};


// ============================================================
//  BOOT
// ============================================================
if (window.location.hash) {
  state.view = window.location.hash.replace('#', '');
}

history.replaceState(
  { view: state.view, params: state.params },
  '',
  '#' + state.view
);

render();

if (typeof loadEvents === 'function') {
  loadEvents();
}

if (typeof validateSavedAuthSession === 'function') {
  validateSavedAuthSession();
}
