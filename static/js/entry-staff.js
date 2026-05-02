// ============================================================
//  VIEW: ENTRY STAFF (SCANNER)
// ============================================================
var barcodeCameraStream = null;
var barcodeCameraDetector = null;
var barcodeCameraLoopId = null;
var barcodeCameraLastScanAt = 0;
var barcodeCameraActive = false;
var barcodeCameraReader = null;
var barcodeCameraControls = null;
var barcodeCameraMode = '';
var staffEventsPolling = null;

async function loadStaffEvents(silent) {
  silent = !!silent;
  if (!state.user || state.user.role !== 'entry_staff' || state.eventsLoading) {
    return;
  }

  state.eventsLoading = true;

  try {
    var response = await fetch('/api/staff/events/' + encodeURIComponent(state.user.id));
    var data = await response.json();

    if (!response.ok) {
      state.realEvents = [];
      state.eventsLoaded = true;
      state.eventsLoading = false;
      if (!silent) {
        showToast(data.message || 'Failed to load assigned events', 'error');
      }
      render();
      return;
    }

    state.realEvents = Array.isArray(data) ? data : [];
    state.eventsLoaded = true;
    state.eventsLoading = false;
    render();
  } catch (error) {
    console.error('LOAD STAFF EVENTS ERROR:', error);
    state.realEvents = [];
    state.eventsLoaded = true;
    state.eventsLoading = false;
    if (!silent) {
      showToast('Server error loading assigned events', 'error');
    }
    render();
  }
}
window.loadStaffEvents = loadStaffEvents;

function startStaffEventsPolling() {
  stopStaffEventsPolling();
  staffEventsPolling = setInterval(function() {
    if (state.view === 'scan' && state.user && state.user.role === 'entry_staff') {
      loadStaffEvents(true);
    }
  }, 6000);
}
window.startStaffEventsPolling = startStaffEventsPolling;

function stopStaffEventsPolling() {
  if (staffEventsPolling) {
    clearInterval(staffEventsPolling);
    staffEventsPolling = null;
  }
}
window.stopStaffEventsPolling = stopStaffEventsPolling;

function getSelectedStaffEvent() {
  var events = state.realEvents || [];
  var selectedEventId = (state.params && state.params.scanEvent !== undefined)
    ? parseInt(state.params.scanEvent, 10)
    : (events[0] ? events[0].id : null);

  return events.find(function(ev) {
    return Number(ev.id) === Number(selectedEventId);
  }) || events[0] || null;
}

function getStaffAlertConfig(eventData) {
  if (!eventData || !eventData.staff_alert_active) {
    return null;
  }

  var severity = eventData.staff_alert_severity || (eventData.emergency_active ? 'critical' : 'warning');
  var isCritical = severity === 'critical';

  return {
    title: eventData.staff_alert_title || (isCritical ? 'Event Alert' : 'Crowd Warning'),
    message: eventData.staff_alert_message || '',
    border: isCritical ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.28)',
    background: isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
    color: isCritical ? '#fecaca' : '#fde68a'
  };
}

function renderStaffAlertBanner(eventData) {
  var alertConfig = getStaffAlertConfig(eventData);
  if (!alertConfig) return '';

  return '<div style="width:100%;padding:16px 18px;border-radius:16px;border:1px solid ' + alertConfig.border + ';background:' + alertConfig.background + ';color:' + alertConfig.color + ';">' +
    '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:15px;letter-spacing:0.03em;margin-bottom:6px;">' + escapeHtml(alertConfig.title) + '</div>' +
    '<div style="font-size:13px;line-height:1.8;white-space:pre-line;">' + escapeHtml(alertConfig.message) + '</div>' +
    '</div>';
}

function renderScan() {
  if (barcodeCameraActive) {
    stopBarcodeCamera(true);
  }

  startStaffEventsPolling();

  if (typeof subscribeToRealtimeUpdates === 'function') {
    subscribeToRealtimeUpdates();
  }

  var events = state.realEvents || [];

  if (!state.eventsLoaded && !state.eventsLoading) {
    loadStaffEvents();
  }

  if (state.eventsLoading && !events.length) {
    return '<div style="min-height:100vh;background:var(--dark);display:flex;align-items:center;justify-content:center;padding:24px;">' +
      '<div class="card" style="max-width:520px;padding:32px;text-align:center;">' +
        '<h2 style="font-family:\'Montserrat\',sans-serif;font-weight:800;font-size:22px;margin-bottom:12px;">Loading Events...</h2>' +
        '<p style="color:var(--muted);">Please wait while the scanner loads real event data.</p>' +
      '</div>' +
    '</div>';
  }

  if (!events.length) {
    return '<div style="min-height:100vh;background:var(--dark);display:flex;align-items:center;justify-content:center;padding:24px;">' +
      '<div class="card" style="max-width:520px;padding:32px;text-align:center;">' +
        '<h2 style="font-family:\'Montserrat\',sans-serif;font-weight:800;font-size:22px;margin-bottom:12px;">No Real Events Available</h2>' +
        '<p style="color:var(--muted);margin-bottom:20px;">The scanner only works with events loaded from the database.</p>' +
        '<button class="btn-primary" onclick="navigate(\'home\')">Back to Home</button>' +
      '</div>' +
    '</div>';
  }

  var currentEvent = getSelectedStaffEvent();
  var selectedEventId = currentEvent ? currentEvent.id : null;

  var attendanceCount = currentEvent ? Number(currentEvent.attendance_count || 0) : 0;
  var ticketsSold = currentEvent ? Number(currentEvent.tickets_sold || 0) : 0;
  var remainingEntries = currentEvent ? Math.max(Number(currentEvent.capacity || 0) - attendanceCount, 0) : 0;
  var evName = currentEvent ? currentEvent.name : 'Select Event';
  var runtime = getEventRuntimeState(currentEvent);
  var entryLocked = !!(currentEvent && currentEvent.entry_locked);
  var staffStatusLabel = currentEvent && currentEvent.staff_work_status_label ? currentEvent.staff_work_status_label : 'Active';
  var statusBanner = runtime.statusMessage
    ? '<div style="width:100%;padding:12px 14px;border-radius:14px;background:' + (runtime.isEnded ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)') + ';border:1px solid ' + (runtime.isEnded ? 'rgba(239,68,68,0.24)' : 'rgba(245,158,11,0.24)') + ';font-size:13px;line-height:1.7;color:' + (runtime.isEnded ? '#fecaca' : '#fde68a') + ';">' + escapeHtml(runtime.statusMessage) + '</div>'
    : '';
  var staffAlertBanner = renderStaffAlertBanner(currentEvent);

  return '<div style="min-height:100vh;background:var(--dark);display:flex;flex-direction:column;">' +
    '<header style="background:var(--dark2);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<img src="' + LOGO + '" alt="Crowd Analyzing" style="height:32px;" />' +
        '<div style="width:1px;height:24px;background:var(--border);"></div>' +
        '<div><div style="font-family:\'Montserrat\',sans-serif;font-weight:700;font-size:13px;">Entry Staff Portal</div><div style="font-size:11px;color:var(--muted);">' + evName + ' | Status: ' + escapeHtml(staffStatusLabel) + '</div></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme" id="theme-btn">' + (document.documentElement.getAttribute('data-theme') === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19') + '</button>' +
        '<button class="btn-ghost" style="font-size:12px;" onclick="logout()">Logout</button>' +
      '</div>' +
    '</header>' +
    '<main style="flex:1;display:flex;flex-direction:column;align-items:center;padding:32px 24px;gap:24px;max-width:640px;margin:0 auto;width:100%;">' +
      '<div style="width:100%;">' +
        '<label class="field-label">Current Event</label>' +
        '<select class="input-field" style="font-size:14px;" onchange="state.params = state.params || {}; state.params.scanEvent=this.value; navigate(\'scan\', state.params)">' +
          events.map(function(e) {
            return '<option value="' + e.id + '" ' + (Number(e.id) === Number(selectedEventId) ? 'selected' : '') + '>' + e.name + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      statusBanner +
      staffAlertBanner +
      '<div class="scan-area" style="width:100%;max-width:380px;aspect-ratio:1;border:3px solid rgba(155,16,64,0.5);border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(155,16,64,0.04);position:relative;overflow:hidden;">' +
        '<div style="position:absolute;inset:0;background:radial-gradient(circle,rgba(155,16,64,0.06) 0%,transparent 70%);pointer-events:none;"></div>' +
        '<div style="position:absolute;top:12px;left:12px;width:24px;height:24px;border-top:3px solid #9B1040;border-left:3px solid #9B1040;border-radius:4px 0 0 0;"></div>' +
        '<div style="position:absolute;top:12px;right:12px;width:24px;height:24px;border-top:3px solid #9B1040;border-right:3px solid #9B1040;border-radius:0 4px 0 0;"></div>' +
        '<div style="position:absolute;bottom:12px;left:12px;width:24px;height:24px;border-bottom:3px solid #9B1040;border-left:3px solid #9B1040;border-radius:0 0 0 4px;"></div>' +
        '<div style="position:absolute;bottom:12px;right:12px;width:24px;height:24px;border-bottom:3px solid #9B1040;border-right:3px solid #9B1040;border-radius:0 0 4px 0;"></div>' +
        '<video id="barcode-camera-preview" playsinline muted style="display:none;width:100%;height:100%;object-fit:cover;"></video>' +
        '<div id="barcode-camera-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;">' +
          '<div style="font-family:\'Montserrat\',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.12em;color:rgba(155,16,64,0.8);">SCANNER READY</div>' +
          '<div style="font-size:12px;color:var(--muted);text-align:center;max-width:240px;">Enter a real ticket code generated from a purchased ticket, or open the mobile camera to scan the barcode directly.</div>' +
        '</div>' +
      '</div>' +
      '<div style="width:100%;display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button class="btn-primary" style="flex:1;justify-content:center;' + (entryLocked ? 'opacity:0.6;cursor:not-allowed;' : '') + '" onclick="startBarcodeCamera()" ' + (entryLocked ? 'disabled' : '') + '>Open Camera</button>' +
        '<button class="btn-ghost" style="flex:1;justify-content:center;" onclick="stopBarcodeCamera()">Close Camera</button>' +
      '</div>' +
      '<div style="width:100%;">' +
        '<label class="field-label">Ticket Code</label>' +
        '<div style="display:flex;gap:10px;">' +
          '<input type="text" class="input-field" id="ticket-input" placeholder="e.g. TKT-0001" style="font-size:16px;font-family:\'Montserrat\',sans-serif;font-weight:700;letter-spacing:0.08em;text-align:center;' + (entryLocked ? 'opacity:0.7;' : '') + '" onkeydown="if(event.key===\'Enter\')validateTicket()" ' + (entryLocked ? 'disabled' : '') + ' />' +
          '<button class="btn-primary" style="white-space:nowrap;' + (entryLocked ? 'opacity:0.6;cursor:not-allowed;' : '') + '" onclick="validateTicket()" ' + (entryLocked ? 'disabled' : '') + '>Validate</button>' +
        '</div>' +
      '</div>' +
      '<div id="scan-result" style="width:100%;"></div>' +
      '<div style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;" id="scan-stats">' +
        [
          { label:'Tickets Sold', val: ticketsSold, color: '#9B1040' },
          { label:'Attendance', val: attendanceCount, color: '#22C55E' },
          { label:'Remaining', val: remainingEntries, color: '#F59E0B' }
        ].map(function(s) {
          return '<div class="stat-card" style="text-align:center;padding:16px;">' +
            '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:28px;color:' + s.color + ';margin-bottom:4px;">' + s.val + '</div>' +
            '<div style="font-size:12px;color:var(--muted);font-family:\'Montserrat\',sans-serif;font-weight:600;">' + s.label + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</main>' +
  '</div>';
}

async function startBarcodeCamera() {
  var video = document.getElementById('barcode-camera-preview');
  var placeholder = document.getElementById('barcode-camera-placeholder');
  var selectedEvent = getSelectedStaffEvent();
  var runtime = getEventRuntimeState(selectedEvent);

  if (!video) return;

  if (selectedEvent && selectedEvent.entry_locked) {
    showToast(selectedEvent.staff_alert_message || 'Entry actions are currently locked for this event', 'error');
    return;
  }

  if (runtime.isUpcoming) {
    showToast('Event has not started yet', 'error');
    return;
  }

  if (runtime.isEnded) {
    showToast('Event has ended', 'error');
    return;
  }

  if (!window.isSecureContext) {
    showToast('Camera access requires HTTPS or localhost. Open the staff page from a secure link first.', 'error');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Camera access is not supported on this device', 'error');
    return;
  }

  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        var permissionState = await navigator.permissions.query({ name: 'camera' });
        if (permissionState && permissionState.state === 'denied') {
          showToast('Camera permission is blocked in your browser. Allow camera access for this site, then try again.', 'error');
          return;
        }
      } catch (permissionError) {}
    }

    stopBarcodeCamera(true);

    var started = false;
    if (typeof BarcodeDetector !== 'undefined') {
      started = await startNativeBarcodeCamera(video, placeholder);
    }

    if (!started) {
      started = await startZXingBarcodeCamera(video, placeholder);
    }

    if (!started) {
      showToast('Barcode scanning is not supported in this browser', 'error');
      return;
    }

    showToast('Camera opened. Point it at the ticket barcode.', 'success');
  } catch (error) {
    console.error('BARCODE CAMERA ERROR:', error);
    stopBarcodeCamera(true);
    if (error && error.name === 'NotAllowedError') {
      showToast('Camera permission was denied. Please allow camera access for the staff page.', 'error');
      return;
    }
    if (error && error.name === 'NotFoundError') {
      showToast('No camera was found on this device.', 'error');
      return;
    }
    showToast('Unable to open the camera for barcode scanning', 'error');
  }
}
window.startBarcodeCamera = startBarcodeCamera;

async function startNativeBarcodeCamera(video, placeholder) {
  try {
    if (typeof BarcodeDetector.getSupportedFormats === 'function') {
      var supportedFormats = await BarcodeDetector.getSupportedFormats();
      var preferredFormats = ['code_39', 'code_128', 'ean_13', 'ean_8', 'qr_code'];
      var usableFormats = preferredFormats.filter(function(format) {
        return supportedFormats.indexOf(format) !== -1;
      });
      barcodeCameraDetector = new BarcodeDetector({
        formats: usableFormats.length ? usableFormats : supportedFormats
      });
    } else {
      barcodeCameraDetector = new BarcodeDetector();
    }

    barcodeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }
      },
      audio: false
    });

    video.srcObject = barcodeCameraStream;
    await video.play();
    video.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    barcodeCameraActive = true;
    barcodeCameraMode = 'native';
    barcodeCameraLastScanAt = 0;
    barcodeCameraLoop();
    return true;
  } catch (error) {
    console.error('NATIVE BARCODE CAMERA ERROR:', error);
    stopBarcodeCamera(true);
    return false;
  }
}

async function startZXingBarcodeCamera(video, placeholder) {
  if (!window.ZXing || typeof window.ZXing.BrowserMultiFormatReader !== 'function') {
    return false;
  }

  try {
    var hints = new window.ZXing.Map();
    hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      window.ZXing.BarcodeFormat.CODE_39,
      window.ZXing.BarcodeFormat.CODE_128,
      window.ZXing.BarcodeFormat.EAN_13,
      window.ZXing.BarcodeFormat.EAN_8,
      window.ZXing.BarcodeFormat.QR_CODE
    ]);

    barcodeCameraReader = new window.ZXing.BrowserMultiFormatReader(hints, 300);
    barcodeCameraMode = 'zxing';
    barcodeCameraActive = true;

    barcodeCameraControls = await barcodeCameraReader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: 'environment' }
        }
      },
      video,
      function(result, err) {
        if (!barcodeCameraActive) return;
        if (result && result.getText) {
          applyScannedTicketCode(result.getText());
        } else if (result && result.text) {
          applyScannedTicketCode(result.text);
        }
      }
    );

    video.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    return true;
  } catch (error) {
    console.error('ZXING BARCODE CAMERA ERROR:', error);
    stopBarcodeCamera(true);
    return false;
  }
}

function stopBarcodeCamera(silent) {
  silent = !!silent;
  if (barcodeCameraLoopId) {
    cancelAnimationFrame(barcodeCameraLoopId);
    barcodeCameraLoopId = null;
  }
  if (barcodeCameraStream) {
    barcodeCameraStream.getTracks().forEach(function(track) {
      track.stop();
    });
    barcodeCameraStream = null;
  }

  if (barcodeCameraControls && typeof barcodeCameraControls.stop === 'function') {
    try {
      barcodeCameraControls.stop();
    } catch (e) {}
    barcodeCameraControls = null;
  }

  if (barcodeCameraReader && typeof barcodeCameraReader.reset === 'function') {
    try {
      barcodeCameraReader.reset();
    } catch (e) {}
    barcodeCameraReader = null;
  }

  barcodeCameraActive = false;
  barcodeCameraDetector = null;
  barcodeCameraMode = '';
  var video = document.getElementById('barcode-camera-preview');
  var placeholder = document.getElementById('barcode-camera-placeholder');
  if (video) {
    video.pause();
    video.srcObject = null;
    video.style.display = 'none';
  }
  if (placeholder) {
    placeholder.style.display = 'flex';
  }

  if (!silent) {
    showToast('Camera closed', 'success');
  }
}
window.stopBarcodeCamera = stopBarcodeCamera;

function barcodeCameraLoop() {
  if (!barcodeCameraActive || barcodeCameraMode !== 'native') return;

  var video = document.getElementById('barcode-camera-preview');
  if (!video || !barcodeCameraDetector) {
    stopBarcodeCamera(true);
    return;
  }

  barcodeCameraLoopId = requestAnimationFrame(barcodeCameraLoop);

  if (video.readyState < 2) {
    return;
  }

  if (Date.now() - barcodeCameraLastScanAt < 350) {
    return;
  }

  barcodeCameraLastScanAt = Date.now();
  barcodeCameraDetector.detect(video).then(function(barcodes) {
    if (!barcodeCameraActive || !barcodes || !barcodes.length) return;

    var rawValue = '';
    for (var i = 0; i < barcodes.length; i += 1) {
      if (barcodes[i] && barcodes[i].rawValue) {
        rawValue = normalizeTicketCode(barcodes[i].rawValue);
        if (rawValue) break;
      }
    }

    if (!rawValue) return;

    var input = document.getElementById('ticket-input');
    applyScannedTicketCode(rawValue);
  }).catch(function(error) {
    console.error('BARCODE DETECT ERROR:', error);
  });
}

function applyScannedTicketCode(value) {
  var normalized = normalizeTicketCode(value);
  if (!normalized) return;

  var input = document.getElementById('ticket-input');
  if (input) {
    input.value = normalized;
  }

  stopBarcodeCamera(true);
  validateTicket();
}


// ============================================================
//  SCAN ACTION
// ============================================================
async function validateTicket() {
  var input = document.getElementById('ticket-input');
  if (!input) return;

  var code = normalizeTicketCode(input.value);
  var resultEl = document.getElementById('scan-result');
  var events = state.realEvents || [];
  var selectedEvent = getSelectedStaffEvent();
  var selectedEventId = selectedEvent ? selectedEvent.id : null;
  var staffId = state.user && state.user.id ? state.user.id : null;
  var runtime = getEventRuntimeState(selectedEvent);

  if (!code) {
    showToast('Please enter a ticket code', 'error');
    return;
  }

  if (!selectedEventId) {
    showToast('Please select an event', 'error');
    return;
  }

  if (!staffId) {
    showToast('Staff user not found', 'error');
    return;
  }

  if (runtime.isUpcoming) {
    showToast('Event has not started yet', 'error');
    return;
  }

  if (runtime.isEnded) {
    showToast('Event has ended', 'error');
    return;
  }

  if (selectedEvent && selectedEvent.entry_locked) {
    showToast(selectedEvent.staff_alert_message || 'Entry actions are currently locked for this event', 'error');
    return;
  }

  try {
    var response = await fetch('/api/events/' + selectedEventId + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        ticket_code: code
      })
    });

    var data = await response.json();
    var html = '';

    if (response.ok) {
      state.realEvents = events.map(function(ev) {
        if (Number(ev.id) !== Number(selectedEventId)) return ev;
        return Object.assign({}, ev, {
          attendance_count: data.attendance_count,
          crowd_level: data.crowd_level,
          tickets_sold: data.tickets_sold,
          prediction: data.prediction || ev.prediction,
          time_status: 'live',
          staff_alert_active: data.staff_alert_active,
          staff_alert_type: data.staff_alert_type,
          staff_alert_severity: data.staff_alert_severity,
          staff_alert_title: data.staff_alert_title,
          staff_alert_message: data.staff_alert_message,
          entry_locked: data.entry_locked,
          entry_lock_reason: data.entry_lock_reason,
          emergency_active: data.emergency_active,
          emergency_message: data.emergency_message
        });
      });

      if (typeof applyRealtimeEventUpdate === 'function') {
        applyRealtimeEventUpdate(selectedEventId, {
          attendance_count: data.attendance_count,
          crowd_level: data.crowd_level,
          tickets_sold: data.tickets_sold,
          capacity: selectedEvent ? selectedEvent.capacity : 0,
          prediction: data.prediction,
          staff_alert_active: data.staff_alert_active,
          staff_alert_type: data.staff_alert_type,
          staff_alert_severity: data.staff_alert_severity,
          staff_alert_title: data.staff_alert_title,
          staff_alert_message: data.staff_alert_message,
          entry_locked: data.entry_locked,
          entry_lock_reason: data.entry_lock_reason,
          emergency_active: data.emergency_active,
          emergency_message: data.emergency_message
        });
      }

      html =
        '<div style="background:rgba(34,197,94,0.1);border:2px solid rgba(34,197,94,0.4);border-radius:14px;padding:20px;text-align:center;">' +
        '<div style="font-size:40px;margin-bottom:8px;">OK</div>' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:20px;color:#22C55E;margin-bottom:4px;">VALID TICKET</div>' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:700;font-size:14px;margin-bottom:12px;">' + escapeHtml(data.ticket_code) + ' - ' + escapeHtml(data.customer_name) + '</div>' +
        '<div style="font-size:13px;color:var(--muted);">Attendance: ' + data.attendance_count + ' | Crowd Level: ' + data.crowd_level + ' | Ticket Status: ' + escapeHtml(data.ticket_status || 'Done') + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:8px;">Current dashboard updated instantly for the organizer.</div>' +
        '</div>';

      showToast('Entry recorded successfully!', 'success');
    } else if (response.status === 409) {
      html =
        '<div style="background:rgba(245,158,11,0.1);border:2px solid rgba(245,158,11,0.4);border-radius:14px;padding:20px;text-align:center;">' +
        '<div style="font-size:40px;margin-bottom:8px;">!</div>' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:20px;color:#F59E0B;margin-bottom:4px;">ALREADY USED</div>' +
        '<div style="font-size:13px;color:var(--muted);">' + escapeHtml(data.message || 'This ticket was already scanned') + '</div>' +
        '</div>';

      showToast(data.message || 'Ticket already used', 'error');
    } else if (response.status === 423) {
      html =
        '<div style="background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.4);border-radius:14px;padding:20px;text-align:center;">' +
        '<div style="font-size:40px;margin-bottom:8px;">!</div>' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:20px;color:#EF4444;margin-bottom:4px;">ENTRY LOCKED</div>' +
        '<div style="font-size:13px;color:var(--muted);line-height:1.8;">' + escapeHtml(data.message || 'Entry actions are currently locked for this event') + '</div>' +
        '</div>';

      showToast(data.message || 'Entry is currently locked', 'error');
    } else {
      var stateTitle = response.status === 400 && data.message === 'Event has not started yet'
        ? 'EVENT NOT STARTED'
        : (response.status === 400 && data.message === 'Event has ended' ? 'EVENT ENDED' : 'INVALID TICKET');
      html =
        '<div style="background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.4);border-radius:14px;padding:20px;text-align:center;">' +
        '<div style="font-size:40px;margin-bottom:8px;">X</div>' +
        '<div style="font-family:\'Montserrat\',sans-serif;font-weight:900;font-size:20px;color:#EF4444;margin-bottom:4px;">' + stateTitle + '</div>' +
        '<div style="font-size:13px;color:var(--muted);">' + escapeHtml(data.message || 'Ticket not found') + '</div>' +
        '</div>';

      showToast(data.message || 'Invalid ticket', 'error');
    }

    if (resultEl) resultEl.innerHTML = html;
    renderScanStats(selectedEventId);

    input.value = '';
    input.focus();
  } catch (error) {
    console.error(error);
    showToast('Server error', 'error');
  }
}


// ============================================================
//  SCAN STATS
// ============================================================
function renderScanStats(selectedEventId) {
  var statsEl = document.getElementById('scan-stats');
  if (!statsEl) return;

  var eventData = (state.realEvents || []).find(function(ev) {
    return Number(ev.id) === Number(selectedEventId);
  });

  var attendanceCount = eventData ? Number(eventData.attendance_count || 0) : 0;
  var ticketsSold = eventData ? Number(eventData.tickets_sold || 0) : 0;
  var remainingEntries = eventData ? Math.max(Number(eventData.capacity || 0) - attendanceCount, 0) : 0;

  statsEl.innerHTML = [
    { label:'Tickets Sold', val: ticketsSold, color: '#9B1040' },
    { label:'Attendance', val: attendanceCount, color: '#22C55E' },
    { label:'Remaining', val: remainingEntries, color: '#F59E0B' }
  ].map(function(s) {
    return '<div class="stat-card" style="text-align:center;padding:16px;">' +
      '<div style="font-weight:900;font-size:28px;color:' + s.color + ';">' + s.val + '</div>' +
      '<div style="font-size:12px;color:var(--muted);">' + s.label + '</div>' +
    '</div>';
  }).join('');
}

window.validateTicket = validateTicket;
