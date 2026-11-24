/* Capacity tab (Priya). Room status as an INPUT to triage: open rooms, boarding-blocked rooms, wait-time ranges.
 * Not a bed-management system. Synthetic data only. Classic script; hangs off window.Halvian.
 * Exposes Halvian.capacity = { summary(), estimateWaitRange(patient), assumptions }.
 * Emits 'rooms:updated' after a staff member changes a room's status.
 */
(function () {
  'use strict';
  var H = window.Halvian, esc = H.util.esc;

  var COST_PER_ED_BED_HOUR = 350; // case figure
  var ASSUME = { edTurnMin: 150, ftTurnMin: 45, roomPrepMin: 10, spread: [0.7, 1.4] };
  var TYPES = [
    { key: 'ed', label: 'Emergency department rooms' },
    { key: 'fast_track', label: 'Fast-track rooms' },
    { key: 'resus', label: 'Resus / trauma bays' },
    { key: 'behavioral', label: 'Behavioral health rooms' }
  ];
  var STATUSES = ['open', 'occupied', 'cleaning', 'boarding'];
  var NEXT = { open: 'occupied', occupied: 'cleaning', cleaning: 'open', boarding: 'cleaning' };
  var STATUS_LABEL = { open: 'Open', occupied: 'Occupied', cleaning: 'Cleaning', boarding: 'Boarding' };

  function rooms() { return H.state.rooms || []; }
  function minutesIn(r) { return Math.max(0, Math.round(H.util.minutesBetween(r.since, H.util.now()))); }
  function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }

  /* ---------- computations ---------- */
  function summary() {
    var by = {}, boardingHours = 0, boardingEd = 0;
    TYPES.forEach(function (t) { by[t.key] = { open: 0, occupied: 0, cleaning: 0, boarding: 0, total: 0 }; });
    rooms().forEach(function (r) {
      var b = by[r.type]; if (!b) return;
      b[r.status] = (b[r.status] || 0) + 1; b.total++;
      if (r.type === 'ed' && r.status === 'boarding') { boardingEd++; boardingHours += minutesIn(r) / 60; }
    });
    var boardingTotal = 0;
    TYPES.forEach(function (t) { boardingTotal += by[t.key].boarding; });
    return {
      byType: by, boardingTotal: boardingTotal, boardingEd: boardingEd,
      boardingBedHours: boardingHours, // ED bed-hours currently lost to boarding patients
      boardingCost: Math.round(boardingHours * COST_PER_ED_BED_HOUR),
      costPerEdBedHour: COST_PER_ED_BED_HOUR
    };
  }

  function waiting() {
    return (H.state.patients || []).filter(function (p) { return p.status === 'waiting'; });
  }

  /* Rooms serving an ESI level: ESI 3 -> ED rooms, ESI 4-5 -> fast-track rooms. */
  function rangeFor(esi, extraEdOpen) {
    if (esi <= 2) return null;
    var type = esi === 3 ? 'ed' : 'fast_track';
    var turn = type === 'ed' ? ASSUME.edTurnMin : ASSUME.ftTurnMin;
    var s = summary().byType[type];
    var open = s.open + (type === 'ed' ? (extraEdOpen || 0) : 0);
    // only count patients who compete for the same room type (ESI 1-3 -> ED rooms, ESI 4-5 -> fast-track)
    var ahead = waiting().filter(function (p) {
      return p.esi <= esi && (type === 'ed' ? p.esi <= 3 : p.esi >= 4);
    }).length;
    var position = ahead + 1; // the person arriving now
    var base;
    if (position <= open) base = ASSUME.roomPrepMin;
    else {
      // rooms that can still turn over: occupied or cleaning (boarding rooms are blocked)
      var turning = Math.max(1, s.occupied + s.cleaning);
      var perMin = turning / turn; // patients roomed per minute at steady state
      base = ASSUME.roomPrepMin + (position - open) / perMin;
    }
    var low = Math.max(5, Math.round(base * ASSUME.spread[0] / 5) * 5);
    var high = Math.max(low + 5, Math.round(base * ASSUME.spread[1] / 5) * 5);
    return { low: low, high: high, ahead: ahead, openRooms: open, type: type };
  }

  H.capacity = {
    summary: summary,
    assumptions: ASSUME,
    /** {low, high} minutes, or null for ESI 1-2 (never shown) or when AI is offline. */
    estimateWaitRange: function (patient) {
      if (!patient || patient.esi <= 2 || H.state.aiOffline) return null;
      var r = rangeFor(patient.esi, 0);
      return r ? { low: r.low, high: r.high } : null;
    }
  };

  /* ---------- UI ---------- */
  function mount(el) {
    var whatIf = 0;
    el.innerHTML =
      '<style>' +
      '.cap-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:.5rem}' +
      '.cap-tile{appearance:none;font:inherit;text-align:left;border:2px solid var(--line);border-radius:var(--radius);padding:.45rem .55rem;cursor:pointer;min-height:64px;color:var(--ink);display:block;width:100%}' +
      '.cap-tile b{display:block;font-size:.95rem}.cap-tile span{display:block;font-size:.8rem}' +
      '.cap-tile.s-open{background:#dff3e4;border-color:#1d6b3a}' +
      '.cap-tile.s-occupied{background:#e0ecfb;border-color:#2a5d9f}' +
      '.cap-tile.s-cleaning{background:#fff3c4;border-color:#8a6100}' +
      '.cap-tile.s-boarding{background:#fde4e4;border-color:#a4262c}' +
      '.cap-tile:hover{filter:brightness(.96)}' +
      '.cap-swatch{display:inline-block;width:.9rem;height:.9rem;border-radius:3px;border:2px solid;vertical-align:-2px;margin-right:.3rem}' +
      '.cap-stat{font-size:1.9rem;font-weight:700;line-height:1.1}' +
      '.cap-group{margin-bottom:1rem}.cap-group h3{margin-bottom:.4rem}' +
      '.cap-range{width:min(100%,28rem)}' +
      '</style>' +
      '<div id="cap-banner" class="banner-warning" hidden role="status"></div>' +
      '<div class="card"><h2>Room capacity for triage</h2>' +
      '<p class="muted">This is not a bed-management system. It replaces the phone-and-whiteboard room status only as an input to triage: ' +
      'how many rooms are open, how many are blocked by boarding patients, and what that means for wait-time estimates. ' +
      'Staff update statuses by hand, like the whiteboard but shared.</p></div>' +
      '<div id="cap-cards" class="grid cols-3"></div>' +
      '<div class="card"><h2>Room board</h2>' +
      '<div class="row muted" id="cap-legend" aria-label="Legend"></div>' +
      '<div id="cap-board"></div>' +
      '<form id="cap-set" class="row" style="margin-top:.75rem"><label for="cap-room">Set room</label><select id="cap-room"></select>' +
      '<label for="cap-status">to</label><select id="cap-status"></select>' +
      '<button class="btn btn-primary" type="submit">Apply</button><span id="cap-msg" class="muted" role="status"></span></form></div>' +
      '<div id="cap-estimates"><div class="card"><h2>Estimated wait if arriving now</h2><div id="cap-est-body"></div>' +
      '<div class="card" style="margin:1rem 0 0;background:var(--brand-tint)"><h3>What-if: boarding patients moved upstairs</h3>' +
      '<div class="row"><label for="cap-slider">Boarding patients moved upstairs</label>' +
      '<input id="cap-slider" class="cap-range" type="range" min="0" max="0" value="0" aria-describedby="cap-whatif-out">' +
      '<strong id="cap-slider-val">0</strong></div><p id="cap-whatif-out" role="status" style="margin-top:.5rem"></p></div>' +
      '<p class="muted" id="cap-assume"></p></div></div>';

    var $ = function (id) { return el.querySelector('#' + id); };
    var slider = $('cap-slider');

    // static pieces
    $('cap-legend').innerHTML = STATUSES.map(function (s) {
      var c = { open: '#1d6b3a', occupied: '#2a5d9f', cleaning: '#8a6100', boarding: '#a4262c' }[s];
      var bg = { open: '#dff3e4', occupied: '#e0ecfb', cleaning: '#fff3c4', boarding: '#fde4e4' }[s];
      return '<span><span class="cap-swatch" style="background:' + bg + ';border-color:' + c + '"></span>' + STATUS_LABEL[s] + '</span>';
    }).join('');
    $('cap-status').innerHTML = STATUSES.map(function (s) { return '<option value="' + s + '">' + STATUS_LABEL[s] + '</option>'; }).join('');
    $('cap-room').innerHTML = rooms().map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.id) + '</option>'; }).join('');

    function setStatus(r, status) {
      if (r.status === status) return;
      r.status = status;
      r.since = H.util.iso(H.util.now());
      if (status === 'open' || status === 'cleaning') r.patient_id = null;
      H.emit('rooms:updated', { room: r });
    }

    function renderCards() {
      var s = summary(), ed = s.byType.ed, ft = s.byType.fast_track;
      function card(title, big, sub) {
        return '<div class="card"><div class="muted">' + title + '</div><div class="cap-stat">' + big + '</div><div class="muted">' + sub + '</div></div>';
      }
      $('cap-cards').innerHTML =
        card('Open ED rooms', ed.open + ' / ' + ed.total, ed.cleaning + ' cleaning, ' + ed.occupied + ' occupied, ' + ed.boarding + ' boarding') +
        card('Open fast-track rooms', ft.open + ' / ' + ft.total, ft.cleaning + ' cleaning, ' + ft.occupied + ' occupied') +
        card('Boarding patients', s.boardingTotal, s.boardingEd + ' in ED rooms, ' + (s.boardingTotal - s.boardingEd) + ' in other rooms');
    }

    function renderBoard() {
      var html = '';
      TYPES.forEach(function (t) {
        var list = rooms().filter(function (r) { return r.type === t.key; });
        if (!list.length) return;
        html += '<section class="cap-group"><h3>' + esc(t.label) + ' (' + list.length + ')</h3><div class="cap-board">' +
          list.map(function (r) {
            var m = minutesIn(r);
            var label = r.id + ', ' + STATUS_LABEL[r.status] + (r.patient_id ? ', patient ' + r.patient_id : ', no patient') + ', ' + fmtMin(m) + ' in this status. Select to advance status.';
            return '<button type="button" class="cap-tile s-' + esc(r.status) + '" data-room="' + esc(r.id) + '" aria-label="' + esc(label) + '">' +
              '<b>' + esc(r.id) + '</b><span>' + esc(STATUS_LABEL[r.status]) + '</span>' +
              '<span>' + (r.patient_id ? esc(r.patient_id) : '&mdash;') + '</span><span>' + esc(fmtMin(m)) + '</span></button>';
          }).join('') + '</div></section>';
      });
      var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-room');
      $('cap-board').innerHTML = html;
      if (focused && el.contains($('cap-board'))) {
        var again = $('cap-board').querySelector('[data-room="' + focused + '"]');
        if (again) again.focus();
      }
    }

    function renderEstimates() {
      var off = H.state.aiOffline, body = $('cap-est-body'), out = $('cap-whatif-out'), s = summary();
      var banner = $('cap-banner');
      banner.hidden = !off;
      banner.textContent = off ? 'AI is offline. The room board still works by hand; wait-time estimates are hidden. Queue order falls back to ESI then arrival time.' : '';
      $('cap-assume').innerHTML = 'Assumptions (not measured): an ED room turns over about every ' + ASSUME.edTurnMin + ' min, a fast-track room about every ' + ASSUME.ftTurnMin +
        ' min; ' + ASSUME.roomPrepMin + ' min to room an arriving patient; boarding rooms cannot turn over. ESI 3 uses ED rooms; ESI 4&ndash;5 use fast-track rooms. ' +
        'Ranges are a guide for staff, not a promise, and are never shown to ESI 1&ndash;2 patients.';
      slider.max = s.boardingEd; if (whatIf > s.boardingEd) whatIf = s.boardingEd;
      slider.value = whatIf; slider.disabled = off || s.boardingEd === 0;
      $('cap-slider-val').textContent = whatIf;
      if (off) { body.innerHTML = '<p class="muted">Estimates hidden while AI is offline.</p>'; out.textContent = ''; return; }
      var rows = '';
      [1, 2, 3, 4, 5].forEach(function (e) {
        var now = rangeFor(e, 0), alt = rangeFor(e, whatIf);
        var cell, extra = '';
        if (!now) cell = 'Immediate';
        else {
          cell = now.low + '&ndash;' + now.high + ' min';
          if (whatIf > 0) extra = '<td>' + alt.low + '&ndash;' + alt.high + ' min</td>'; else extra = '<td class="muted">&mdash;</td>';
        }
        rows += '<tr><td><span class="badge esi-' + e + '">ESI ' + e + '</span></td><td>' + cell + '</td>' +
          '<td class="num">' + (now ? now.ahead : '&mdash;') + '</td><td class="num">' + (now ? now.openRooms : '&mdash;') + '</td>' +
          (now ? extra : '<td class="muted">&mdash;</td>') + '</tr>';
      });
      body.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Acuity</th><th>Estimated wait</th><th class="num">Waiting ahead</th>' +
        '<th class="num">Open rooms</th><th>With what-if</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      var ed = s.byType.ed.open;
      out.textContent = whatIf === 0 ? s.boardingEd + ' ED rooms held by boarding patients' :
        'Moving ' + whatIf + ' boarding ' + (whatIf === 1 ? 'patient' : 'patients') + ' upstairs would open ' + whatIf + ' ED ' + (whatIf === 1 ? 'room' : 'rooms') +
        ' (' + ed + ' to ' + (ed + whatIf) + ' open) and recover about ' + (whatIf * 3.5).toFixed(1) + ' h of ED capacity per typical boarding stay. ESI 3 estimate: ' +
        rangeFor(3, 0).low + '&ndash;' + rangeFor(3, 0).high + ' min becomes ' + rangeFor(3, whatIf).low + '&ndash;' + rangeFor(3, whatIf).high + ' min.';
      if (whatIf > 0) out.innerHTML = esc(out.textContent).replace(/&amp;ndash;/g, '&ndash;');
    }

    function renderAll() { renderCards(); renderBoard(); renderEstimates(); }

    el.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.cap-tile') : null;
      if (!t) return;
      var id = t.getAttribute('data-room');
      var r = rooms().filter(function (x) { return x.id === id; })[0];
      if (r) { setStatus(r, NEXT[r.status] || 'open'); }
    });
    $('cap-set').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('cap-room').value, st = $('cap-status').value;
      var r = rooms().filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      setStatus(r, st);
      $('cap-msg').textContent = id + ' set to ' + STATUS_LABEL[st].toLowerCase() + '.';
    });
    slider.addEventListener('input', function () { whatIf = +slider.value; renderEstimates(); });

    H.on('rooms:updated', renderAll);
    H.on('patient:updated', function () { renderCards(); renderEstimates(); });
    H.on('aiOffline', renderEstimates);
    H.on('tab', function (t) { if (t === 'capacity') renderAll(); });
    renderAll();
  }

  H.registerModule('capacity', { mount: mount });
})();
