/* Halvian Queue tab: ranked waiting list with explainable within-ESI scoring, nurse override,
 * adjustable weights and a fairness panel. SYNTHETIC DATA ONLY.
 * Hard rules honoured here: points never cross ESI levels; only CONFIRMED symptom updates score;
 * pain-only is capped; red flags page a nurse and bypass scoring; insurance is never a scoring input
 * (it is read only by the fairness panel). */
(function () {
  'use strict';
  var H = window.Halvian, U = H.util, esc = U.esc;

  /* ---------- configuration ---------- */
  var TARGET = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };       // minutes a patient may wait before points accrue
  var RECHECK_AFTER = 60;                                     // minutes since last re-check before "overdue"
  var GROUPS = ['commercial', 'medicare', 'medicaid', 'uninsured', 'other'];
  var COMPONENTS = [
    { key: 'wait', label: 'Wait over target', def: 1, max: 3, step: 0.25, unit: 'pts per 10 min over the ESI target' },
    { key: 'starve', label: 'Anti-starvation', def: 5, max: 15, step: 1, unit: 'pts once wait exceeds the ESI-level average' },
    { key: 'vitals', label: 'Abnormal vitals', def: 4, max: 10, step: 0.5, unit: 'pts per abnormal vital sign' },
    { key: 'recheck', label: 'Overdue re-check', def: 1, max: 4, step: 0.25, unit: 'pts per 15 min past ' + RECHECK_AFTER + ' min since last re-check' },
    { key: 'concern', label: 'Nurse concern', def: 10, max: 30, step: 1, unit: 'pts when the nurse flag is set' },
    { key: 'symptom', label: 'Confirmed symptom update', def: 6, max: 20, step: 1, unit: 'pts for a nurse-confirmed, non-pain update' },
    { key: 'painCap', label: 'Pain-only cap', def: 3, max: 10, step: 0.5, unit: 'maximum pts when an update is pain-only' }
  ];
  var BAR_SCALE = 25;                                         // points that fill a bar

  var weights = {};
  COMPONENTS.forEach(function (c) { weights[c.key] = c.def; });

  /* nurse overrides (session only): pin flag and a score bias used to place a row within its ESI group */
  var pins = {}, bias = {};
  var expanded = {}, pending = null, root = null, lastMsg = '';

  /* ---------- helpers ---------- */
  function r1(n) { return Math.round(n * 10) / 10; }
  function waitMin(p) { return Math.max(0, Math.round(U.minutesBetween(p.arrival_time, U.now()))); }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function fmt(n, d) { return n == null || isNaN(n) ? '—' : (d ? n.toFixed(d) : String(Math.round(n))); }
  function pendingUpdates(p) {
    var out = [];
    (p.symptom_updates || []).forEach(function (u, i) { if (!u.confirmed_by && !u.dismissed_by) out.push({ u: u, i: i }); });
    return out;
  }
  function confirmedUpdate(p) {
    var best = null;
    (p.symptom_updates || []).forEach(function (u) {
      if (u.confirmed_by && !u.red_flag && (!best || new Date(u.time) > new Date(best.time))) best = u;
    });
    return best;
  }
  function abnormalVitals(v) {
    var out = [];
    v = v || {};
    if (v.hr > 100 || v.hr < 50) out.push('heart rate ' + v.hr);
    if (v.sbp < 100 || v.sbp > 180) out.push('systolic BP ' + v.sbp);
    if (v.rr > 22 || v.rr < 10) out.push('resp rate ' + v.rr);
    if (v.spo2 < 94) out.push('SpO2 ' + v.spo2 + '%');
    if (v.temp_c >= 38.0) out.push('temp ' + v.temp_c + ' C');
    return out;
  }

  /* ---------- scoring (insurance is never read here) ---------- */
  function esiAverages(list) {
    var sum = {}, n = {};
    list.forEach(function (p) { sum[p.esi] = (sum[p.esi] || 0) + waitMin(p); n[p.esi] = (n[p.esi] || 0) + 1; });
    var avg = {};
    Object.keys(sum).forEach(function (k) { avg[k] = sum[k] / n[k]; });
    return avg;
  }
  /** Returns {total, parts:[{key,label,pts,reason}]} for one patient. */
  function scorePatient(p, avgs) {
    var w = waitMin(p), parts = [], over, pts, ab, since, cu;
    over = Math.max(0, w - TARGET[p.esi]);
    pts = Math.floor(over / 10) * weights.wait;
    parts.push({ key: 'wait', label: 'Wait over target', pts: pts,
      reason: over > 0 ? 'Waiting ' + w + ' min, ' + over + ' min over the ESI-' + p.esi + ' target of ' + TARGET[p.esi] + ' min'
        : 'Waiting ' + w + ' min, within the ESI-' + p.esi + ' target of ' + TARGET[p.esi] + ' min' });
    var avg = avgs[p.esi] || 0;
    pts = w > avg ? weights.starve : 0;
    parts.push({ key: 'starve', label: 'Anti-starvation', pts: pts,
      reason: pts ? 'Waiting ' + w + ' min, longer than the ' + Math.round(avg) + ' min average for ESI ' + p.esi
        : 'Not above the ' + Math.round(avg) + ' min average wait for ESI ' + p.esi });
    ab = abnormalVitals(p.vitals);
    parts.push({ key: 'vitals', label: 'Abnormal vitals', pts: ab.length * weights.vitals,
      reason: ab.length ? 'Abnormal vitals: ' + ab.join(', ') : 'Vitals in normal range' });
    since = p.last_recheck_time ? Math.round(U.minutesBetween(p.last_recheck_time, U.now())) : null;
    over = since == null ? 0 : Math.max(0, since - RECHECK_AFTER);
    parts.push({ key: 'recheck', label: 'Overdue re-check', pts: Math.floor(over / 15) * weights.recheck,
      reason: since == null ? 'No re-check recorded' : over > 0 ? 'Last re-check ' + since + ' min ago, ' + over + ' min overdue' : 'Last re-check ' + since + ' min ago, not overdue' });
    parts.push({ key: 'concern', label: 'Nurse concern', pts: p.nurse_concern_flag ? weights.concern : 0,
      reason: p.nurse_concern_flag ? 'Nurse flagged a concern' : 'No nurse concern flag' });
    cu = confirmedUpdate(p);
    if (cu) {
      var painOnly = !(cu.symptoms && cu.symptoms.length);
      pts = painOnly ? Math.min((cu.pain || 0) / 2, weights.painCap) : weights.symptom;
      parts.push({ key: 'symptom', label: 'Confirmed symptom update', pts: Math.min(pts, painOnly ? weights.painCap : 1e9),
        reason: painOnly ? 'Confirmed pain-only update (pain ' + cu.pain + '/10), capped at ' + weights.painCap + ' pts'
          : 'Nurse-confirmed update: ' + cu.symptoms.join(', ') });
    } else {
      parts.push({ key: 'symptom', label: 'Confirmed symptom update', pts: 0,
        reason: pendingUpdates(p).length ? 'Update pending nurse review, so no points yet' : 'No confirmed symptom update' });
    }
    var total = 0;
    parts.forEach(function (x) { x.pts = r1(x.pts); total += x.pts; });
    return { total: r1(total), parts: parts };
  }

  /* ---------- ranking ---------- */
  /** Returns {ranked:[{p,s,rank,key}], fast:[p]}. Order is ESI first, always; score only reorders inside an ESI group. */
  function computeQueue() {
    var waiting = H.state.patients.filter(function (p) { return p.status === 'waiting'; });
    var fast = H.state.patients.filter(function (p) { return p.status === 'fast-track'; }).sort(U.esiArrivalCompare);
    var offline = H.state.aiOffline, avgs = esiAverages(waiting);
    var rows = waiting.map(function (p) {
      var s = scorePatient(p, avgs);
      return { p: p, s: s, key: s.total + (bias[p.id] || 0), pinned: !!pins[p.id] };
    });
    rows.sort(function (a, b) {
      if (offline) return U.esiArrivalCompare(a.p, b.p);
      return (a.p.esi - b.p.esi) || ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.key - a.key) ||
        (new Date(a.p.arrival_time) - new Date(b.p.arrival_time));
    });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return { ranked: rows, fast: fast, avgs: avgs };
  }

  /* ---------- rendering ---------- */
  var STYLE_ID = 'ranking-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.rk-alert{background:#fde4e4;border:2px solid var(--danger);color:#5c0f13;border-radius:var(--radius);padding:.7rem .9rem;margin-bottom:.6rem;font-weight:600}' +
      '.rk-row{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);margin:.5rem 0;padding:.6rem .8rem}' +
      '.rk-row.pinned{border-left:5px solid var(--brand)}.rk-row.rk-grey{opacity:.7;background:#f0f3f6}' +
      '.rk-head{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .8rem}' +
      '.rk-rank{font-weight:700;font-size:1.1rem;min-width:2rem;color:var(--brand-dark)}' +
      '.rk-main{flex:1 1 14rem;min-width:12rem}.rk-score{font-weight:700;font-size:1.05rem;min-width:4.5rem;text-align:right}' +
      '.rk-actions{display:flex;flex-wrap:wrap;gap:.3rem}' +
      '.rk-detail{margin-top:.5rem;padding-top:.5rem;border-top:1px dashed var(--line)}' +
      '.rk-detail ul{margin:.3rem 0 0 1.1rem;padding:0}' +
      '.rk-form{margin-top:.5rem;padding:.6rem;background:var(--brand-tint);border-radius:var(--radius);display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:flex-end}' +
      '.rk-form .fld{display:flex;flex-direction:column;gap:.2rem}' +
      '.rk-pending{margin-top:.5rem;padding:.5rem .6rem;background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:var(--radius)}' +
      '.rk-weights{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.8rem 1.2rem;margin-top:.7rem}' +
      '.rk-weights .w{display:flex;flex-direction:column;gap:.15rem}.rk-weights input[type=range]{padding:0;min-height:28px;width:100%}' +
      '.rk-gap{background:var(--warn-bg);color:var(--warn-ink);border:1px solid var(--warn-line);border-radius:var(--radius);padding:.5rem .8rem;margin:.6rem 0;font-weight:500}' +
      '.rk-summary{cursor:pointer;font-weight:700;font-size:1.05rem}' +
      '.rk-esi-h{margin:.9rem 0 .2rem;font-size:.95rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}' +
      '.rk-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:1rem}' +
      '@media (max-width:1000px){.rk-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function skeleton(el) {
    el.innerHTML =
      '<div class="rk-wrap">' +
      '<div id="rk-alerts" role="alert" aria-live="assertive"></div>' +
      '<div id="rk-leave" aria-live="polite"></div>' +
      '<div id="rk-offline"></div>' +
      '<div class="card"><details id="rk-weights-box"><summary class="rk-summary">Scoring weights (nurse-set)</summary>' +
      '<p class="muted" style="margin-top:.5rem">Points only reorder patients <strong>within</strong> the same ESI level. Adjust a weight and the queue re-ranks immediately. ' +
      'Insurance is not a scoring input.</p><div class="rk-weights" id="rk-weights"></div>' +
      '<p><button type="button" class="btn btn-sm" id="rk-reset">Reset weights to defaults</button></p></details></div>' +
      '<div class="rk-grid"><div>' +
      '<div class="card"><h2>Ranked waiting list</h2><p class="muted" id="rk-sub"></p><div id="rk-msg" class="sr-only" aria-live="polite"></div><div id="rk-list"></div></div>' +
      '<div class="card"><details id="rk-fast-box"><summary class="rk-summary" id="rk-fast-sum">Fast-track (not ranked here)</summary><div id="rk-fast"></div></details></div>' +
      '</div><div>' +
      '<div class="card"><h2>Override log</h2><div id="rk-log"></div></div>' +
      '</div></div>' +
      '<div class="card"><h2>Fairness check by insurance group</h2><div id="rk-fair"></div></div>' +
      '</div>';
    buildWeights();
  }

  function buildWeights() {
    var box = root.querySelector('#rk-weights'), html = '';
    COMPONENTS.forEach(function (c) {
      html += '<div class="w"><label for="rk-w-' + c.key + '">' + esc(c.label) + ': <span id="rk-wv-' + c.key + '">' + weights[c.key] + '</span></label>' +
        '<input type="range" id="rk-w-' + c.key + '" data-w="' + c.key + '" min="0" max="' + c.max + '" step="' + c.step + '" value="' + weights[c.key] + '">' +
        '<span class="muted">' + esc(c.unit) + '</span></div>';
    });
    box.innerHTML = html;
  }

  function renderAlerts() {
    var html = '';
    H.state.patients.forEach(function (p) {
      (p.symptom_updates || []).forEach(function (u) {
        if (u.red_flag && !u.confirmed_by && !u.dismissed_by) {
          html += '<div class="rk-alert">Nurse paged: ' + esc(p.id) + ' (ESI ' + esc(p.esi) + ', ' + esc(p.chief_complaint) + ') reported red-flag symptoms' +
            (u.symptoms && u.symptoms.length ? ': ' + esc(u.symptoms.join(', ')) : '') +
            (u.ai_summary ? '. ' + (u.ai_source === 'claude' ? 'AI summary' : 'Patient wrote') + ': ' + esc(u.ai_summary.replace(/^Patient wrote: /, '')) : '') +
            (u.red_flag_reason ? ' (' + esc(u.red_flag_reason) + ')' : '') +
            '. Assess now; red flags bypass scoring. ' +
            '<button type="button" class="btn btn-sm" data-act="ack" data-id="' + esc(p.id) + '" data-i="' + (p.symptom_updates.indexOf(u)) + '">I have assessed this patient</button></div>';
        }
      });
    });
    root.querySelector('#rk-alerts').innerHTML = html;
  }

  /* Patients who tapped "I'm thinking of leaving": AI drafts a plan, a nurse must approve it before the patient sees it. */
  function renderLeave() {
    var list = (H.state.leaveNotices || []), html = '';
    list.forEach(function (n, i) {
      if (n.status === 'sent' || n.status === 'talked') return;
      var p = H.getPatient(n.patient_id);
      if (!p) return;
      html += '<div class="card" style="border-left:4px solid var(--warn-line);border-radius:0"><h2 style="margin-top:0">Thinking of leaving: ' + esc(p.id) +
        ' <span class="muted" style="font-size:1rem">(ESI ' + esc(p.esi) + ', ' + esc(p.chief_complaint) + ', waiting ' + Math.round(waitMin(p)) + ' min)</span></h2>' +
        '<p>Go and talk with the patient if you can. Their "leave with a plan" message is below; the patient sees it only after you approve it.</p>';
      if (n.status === 'drafting') {
        html += '<p class="muted">Drafting the message…</p>';
      } else {
        html += '<p class="ai-source"><strong>' + (n.source === 'claude' ? 'Draft written by AI (Claude) in ' + (n.lang === 'es' ? 'Spanish' : 'English') + '. Edit as needed.' :
          'Standard template (AI not connected). Edit as needed.') + '</strong></p>' +
          '<label for="rk-leave-' + i + '" class="sr-only">Message to patient</label>' +
          '<textarea id="rk-leave-' + i + '" rows="5" style="width:100%;box-sizing:border-box">' + esc(n.draft) + '</textarea>' +
          '<p class="row"><button type="button" class="btn btn-sm btn-primary" data-act="leave-send" data-i="' + i + '">Approve and send to patient</button> ' +
          '<button type="button" class="btn btn-sm" data-act="leave-talked" data-i="' + i + '">I talked with the patient in person</button></p>';
      }
      html += '</div>';
    });
    root.querySelector('#rk-leave').innerHTML = html;
  }

  function badges(r) {
    var p = r.p, h = '';
    if (r.pinned) h += ' <span class="pill info">Pinned to top</span>';
    if (bias[p.id] || r.pinned) h += ' <span class="pill warn">Overridden by nurse</span>';
    if (p.nurse_concern_flag) h += ' <span class="pill warn">Nurse concern</span>';
    return h;
  }

  function pendingHtml(p) {
    var h = '';
    pendingUpdates(p).forEach(function (x) {
      var u = x.u;
      if (u.red_flag) return;                 // red flags are handled by the alert at the top
      h += '<div class="rk-pending"><span class="pill warn">Symptom update pending — nurse review</span> ' +
        (u.symptoms && u.symptoms.length ? esc(u.symptoms.join(', ')) : 'no new symptoms') +
        (u.pain != null ? ', pain ' + esc(u.pain) + '/10' : '') + (u.duration ? ', ' + esc(u.duration) : '') +
        (u.ai_summary ? '<br><span class="ai-source"><strong>' + (u.ai_source === 'claude' ? 'AI summary (Claude)' : 'Keyword fallback, not AI') + ':</strong> ' + esc(u.ai_summary) + '</span>' +
          (u.free_text ? '<br><span class="muted ai-source">Patient\'s words: "' + esc(u.free_text) + '"</span>' : '') + '<br>' : '') +
        ' <span class="muted">(no points until confirmed)</span> ' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="confirm" data-id="' + esc(p.id) + '" data-i="' + x.i + '">Confirm</button> ' +
        '<button type="button" class="btn btn-sm" data-act="dismiss" data-id="' + esc(p.id) + '" data-i="' + x.i + '">Dismiss</button></div>';
    });
    return h;
  }

  function detailHtml(r) {
    var h = '<div class="rk-detail"><strong>Why this score (' + r.s.total + ' pts)</strong>';
    r.s.parts.forEach(function (x) {
      var pct = Math.min(100, Math.max(0, x.pts / BAR_SCALE * 100));
      h += '<div class="bar"><span class="bar-label">' + esc(x.label) + '</span><span class="bar-track"><span class="bar-fill" style="--pct:' + pct + '"></span></span>' +
        '<span class="bar-value">' + x.pts + '</span></div>';
    });
    h += '<ul>';
    r.s.parts.forEach(function (x) { h += '<li>' + esc(x.reason) + '</li>'; });
    if (bias[r.p.id] || r.pinned) h += '<li>Nurse override applied; AI score alone would give a different position.</li>';
    h += '</ul></div>';
    return h;
  }

  function formHtml(r) {
    var id = esc(r.p.id), label = pending.action === 'up' ? 'Move up' : pending.action === 'down' ? 'Move down' : pending.action === 'pin' ? 'Pin to top' : 'Unpin';
    return '<form class="rk-form" data-form="override" data-id="' + id + '"><div><strong>' + label + ': ' + id + '</strong></div>' +
      '<div class="fld"><label for="rk-reason">Reason (required)</label><select id="rk-reason" required>' +
      '<option value="">Choose a reason</option><option value="clinical judgment">Clinical judgment</option>' +
      '<option value="patient deteriorating">Patient deteriorating</option><option value="interpreter available">Interpreter available</option>' +
      '<option value="other">Other (explain)</option></select></div>' +
      '<div class="fld"><label for="rk-reason-text">Details (required for Other)</label><input id="rk-reason-text" type="text" maxlength="200"></div>' +
      '<button type="submit" class="btn btn-primary btn-sm">Save override</button> ' +
      '<button type="button" class="btn btn-sm" data-act="cancel">Cancel</button>' +
      '<span class="muted" id="rk-form-err" role="alert"></span></form>';
  }

  function rowHtml(r, groupInfo) {
    var p = r.p, id = esc(p.id), offline = H.state.aiOffline, open = !!expanded[p.id];
    var h = '<div class="rk-row' + (r.pinned ? ' pinned' : '') + '" data-row="' + id + '"><div class="rk-head">' +
      '<span class="rk-rank" aria-label="Rank ' + r.rank + '">#' + r.rank + '</span>' +
      '<span class="badge esi-' + esc(p.esi) + '">ESI ' + esc(p.esi) + '</span>' +
      '<div class="rk-main"><strong>' + id + '</strong> · ' + esc(p.age) + esc(p.sex) + ' · ' + esc(p.chief_complaint) +
      '<div class="muted">Waiting ' + waitMin(p) + ' min (arrived ' + U.fmtTime(p.arrival_time) + ')' + badges(r) + '</div></div>' +
      (offline ? '' : '<span class="rk-score" title="Points within ESI ' + esc(p.esi) + '">' + r.s.total + ' pts</span>') +
      '<div class="rk-actions">' +
      (offline ? '' : '<button type="button" class="btn btn-sm" data-act="why" data-id="' + id + '" aria-expanded="' + open + '">' + (open ? 'Hide reasoning' : 'Show reasoning') + '</button>' +
        '<button type="button" class="btn btn-sm" data-act="up" data-id="' + id + '" aria-label="Move ' + id + ' up within ESI ' + esc(p.esi) + '"' + (groupInfo.first ? ' disabled' : '') + '>▲</button>' +
        '<button type="button" class="btn btn-sm" data-act="down" data-id="' + id + '" aria-label="Move ' + id + ' down within ESI ' + esc(p.esi) + '"' + (groupInfo.last ? ' disabled' : '') + '>▼</button>' +
        (r.pinned ? '<button type="button" class="btn btn-sm" data-act="unpin" data-id="' + id + '">Unpin</button>'
          : '<button type="button" class="btn btn-sm" data-act="pin" data-id="' + id + '">Pin to top</button>')) +
      '</div></div>' + pendingHtml(p) +
      (open && !offline ? detailHtml(r) : '') +
      (pending && pending.id === p.id ? formHtml(r) : '') + '</div>';
    return h;
  }

  function renderList() {
    var q = computeQueue(), offline = H.state.aiOffline, html = '', lastEsi = null;
    root.querySelector('#rk-sub').textContent = q.ranked.length + ' waiting. Order: ESI level first (1 = most urgent)' +
      (offline ? ', then arrival time (AI offline).' : ', then score within the level, then arrival time.');
    if (!q.ranked.length) html = '<p class="muted">No patients are waiting.</p>';
    q.ranked.forEach(function (r, i) {
      var prev = q.ranked[i - 1], next = q.ranked[i + 1];
      if (r.p.esi !== lastEsi) { html += '<h3 class="rk-esi-h">ESI ' + esc(r.p.esi) + ' (target wait ' + TARGET[r.p.esi] + ' min)</h3>'; lastEsi = r.p.esi; }
      html += rowHtml(r, { first: !prev || prev.p.esi !== r.p.esi, last: !next || next.p.esi !== r.p.esi });
    });
    root.querySelector('#rk-list').innerHTML = html;
    var fh = '';
    q.fast.forEach(function (p) {
      fh += '<div class="rk-row rk-grey"><div class="rk-head"><span class="badge esi-' + esc(p.esi) + '">ESI ' + esc(p.esi) + '</span><div class="rk-main"><strong>' +
        esc(p.id) + '</strong> · ' + esc(p.chief_complaint) + '<div class="muted">Waiting ' + waitMin(p) + ' min · in fast-track stream</div></div></div></div>';
    });
    root.querySelector('#rk-fast').innerHTML = fh || '<p class="muted">No patients in fast-track.</p>';
    root.querySelector('#rk-fast-sum').textContent = 'Fast-track patients, greyed and not ranked here (' + q.fast.length + ')';
    return q;
  }

  function renderOffline() {
    root.querySelector('#rk-offline').innerHTML = H.state.aiOffline
      ? '<p class="banner-warning">AI is offline. Scores and reasoning are hidden and the queue falls back to ESI level, then arrival time. Nurse overrides are paused.</p>' : '';
  }

  function renderLog() {
    var items = H.state.overrides.filter(function (o) { return o.module === 'ranking'; }).slice().reverse();
    var h = items.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Patient</th><th>Decision</th><th>Reason</th></tr></thead><tbody>' : '<p class="muted">No overrides logged yet.</p>';
    items.forEach(function (o) {
      h += '<tr><td>' + esc(U.fmtTime(o.time)) + '</td><td>' + esc(o.patient_id) + '</td><td>' + esc(o.nurse_decision) +
        '<div class="muted">AI: ' + esc(o.ai_suggestion) + '</div></td><td>' + esc(o.reason) + '<div class="muted">' + esc(o.nurse) + '</div></td></tr>';
    });
    if (items.length) h += '</tbody></table></div>';
    root.querySelector('#rk-log').innerHTML = h;
  }

  function renderFairness(q) {
    var offline = H.state.aiOffline, hist = (H.data && H.data.history) || [];
    var esiMeans = {};
    var byEsi = {};
    q.ranked.forEach(function (r) { (byEsi[r.p.esi] = byEsi[r.p.esi] || []).push(r.s.total); });
    Object.keys(byEsi).forEach(function (k) { esiMeans[k] = mean(byEsi[k]); });
    // Same-acuity baseline: each past visit's door-to-provider time minus the average for its ESI level.
    var esiD2p = {};
    hist.forEach(function (x) { var v = x.outcome && x.outcome.door_to_provider_min; if (v != null) (esiD2p[x.esi] = esiD2p[x.esi] || []).push(v); });
    Object.keys(esiD2p).forEach(function (k) { esiD2p[k] = mean(esiD2p[k]); });
    var stats = {};
    GROUPS.forEach(function (g) {
      var rows = q.ranked.filter(function (r) { return r.p.insurance === g; });
      var hr = hist.filter(function (x) { return x.insurance === g; });
      var d2p = hr.map(function (x) { return x.outcome && x.outcome.door_to_provider_min; }).filter(function (v) { return v != null; });
      var lw = hr.filter(function (x) { return x.outcome && x.outcome.disposition === 'lwbs'; }).length;
      stats[g] = {
        n: rows.length,
        wait: median(rows.map(function (r) { return waitMin(r.p); })),
        diff: mean(rows.map(function (r) { return r.s.total - esiMeans[r.p.esi]; })),
        score: mean(rows.map(function (r) { return r.s.total; })),
        ov: H.state.overrides.filter(function (o) { var pt = H.getPatient(o.patient_id); return pt && pt.insurance === g; }).length,
        hn: hr.length, d2p: median(d2p), lwbs: hr.length ? 100 * lw / hr.length : null,
        sameEsi: mean(hr.filter(function (x) { return x.outcome && x.outcome.door_to_provider_min != null; })
          .map(function (x) { return x.outcome.door_to_provider_min - esiD2p[x.esi]; }))
      };
    });
    var h = '<div class="table-wrap"><table class="table"><thead><tr><th>Insurance group</th><th class="num">Waiting now</th><th class="num">Median current wait (min)</th>' +
      '<th class="num">Mean AI score</th><th class="num">Score vs ESI average</th><th class="num">Overrides</th>' +
      '<th class="num">Hist. median door-to-provider (min)</th><th class="num">Hist. wait vs same-ESI average (min)</th><th class="num">Hist. LWBS %</th></tr></thead><tbody>';
    GROUPS.forEach(function (g) {
      var s = stats[g], hl = g === 'uninsured' || g === 'medicaid' || g === 'commercial';
      h += '<tr' + (hl ? ' style="background:#f3f8fc"' : '') + '><th scope="row" style="text-align:left;position:static;background:none;text-transform:capitalize">' + esc(g) + '</th>' +
        '<td class="num">' + s.n + '</td><td class="num">' + fmt(s.wait) + '</td>' +
        '<td class="num">' + (offline ? '—' : fmt(s.score, 1)) + '</td><td class="num">' + (offline || s.diff == null ? '—' : (s.diff > 0 ? '+' : '') + s.diff.toFixed(1)) + '</td>' +
        '<td class="num">' + s.ov + '</td><td class="num">' + fmt(s.d2p) + '</td><td class="num">' + (s.sameEsi == null ? '—' : (s.sameEsi > 0 ? '+' : '') + s.sameEsi.toFixed(1)) + '</td>' +
        '<td class="num">' + (s.lwbs == null ? '—' : s.lwbs.toFixed(1) + '%') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    var u = stats.uninsured, c = stats.commercial, md = stats.medicaid, notes = [];
    if (u.wait != null && c.wait != null) {
      notes.push('Current median wait: uninsured ' + fmt(u.wait) + ' min vs commercial ' + fmt(c.wait) + ' min (gap ' + fmt(u.wait - c.wait) + ' min).');
    }
    if (u.d2p != null && c.d2p != null) {
      notes.push('Historical door-to-provider: uninsured ' + fmt(u.d2p) + ' vs commercial ' + fmt(c.d2p) + ' min (gap ' + fmt(u.d2p - c.d2p) + ' min).');
    }
    if (u.lwbs != null && c.lwbs != null) {
      notes.push('Historical LWBS: uninsured ' + u.lwbs.toFixed(1) + '% vs commercial ' + c.lwbs.toFixed(1) + '% (gap ' + (u.lwbs - c.lwbs).toFixed(1) + ' points).');
    }
    if (u.sameEsi != null && md.sameEsi != null && c.sameEsi != null) {
      notes.push('Same-acuity gap (our equity measure): uninsured ' + (u.sameEsi - c.sameEsi).toFixed(1) + ' min and Medicaid ' + (md.sameEsi - c.sameEsi).toFixed(1) +
        ' min longer than commercial patients at the same ESI level.');
    }
    if (md.lwbs != null && c.lwbs != null) notes.push('Historical LWBS: Medicaid ' + md.lwbs.toFixed(1) + '% vs commercial ' + c.lwbs.toFixed(1) + '%.');
    if (!hist.length) notes.push('Historical baseline is not loaded.');
    var flagged = (u.d2p != null && c.d2p != null && u.d2p - c.d2p >= 5) || (u.lwbs != null && c.lwbs != null && u.lwbs - c.lwbs >= 1) ||
      (u.wait != null && c.wait != null && u.wait - c.wait >= 10);
    h += '<div class="rk-gap"><strong>Uninsured and Medicaid vs commercial' + (flagged ? ': gap worth reviewing' : '') + '.</strong> ' + esc(notes.join(' ')) + '</div>';
    h += '<p class="muted">Insurance is not used in scoring — shown for fairness monitoring only. Small groups give noisy current-queue numbers; the historical baseline (' + hist.length + ' past visits) is steadier. Score vs ESI average compares each group with other patients at the same ESI level.</p>';
    root.querySelector('#rk-fair').innerHTML = h;
  }

  function refresh() {
    if (!root) return;
    renderAlerts();
    renderLeave();
    renderOffline();
    var q = renderList();
    renderLog();
    renderFairness(q);
  }

  /* ---------- actions ---------- */
  function setUpdate(id, i, changes) {
    var p = H.getPatient(id);
    if (!p || !p.symptom_updates[i]) return null;
    var arr = U.clone(p.symptom_updates);
    Object.keys(changes).forEach(function (k) { arr[i][k] = changes[k]; });
    H.updatePatient(id, { symptom_updates: arr }, 'ranking');
    return arr[i];
  }

  function groupOf(id) {
    var q = computeQueue(), me = null, grp = [];
    q.ranked.forEach(function (r) { if (r.p.id === id) me = r; });
    if (!me) return null;
    grp = q.ranked.filter(function (r) { return r.p.esi === me.p.esi; });
    return { me: me, grp: grp, idx: grp.indexOf(me) };
  }

  function applyOverride(id, action, reason) {
    var g = groupOf(id);
    if (!g) return;
    var before = 'Rank ' + g.me.rank + ' (' + g.me.s.total + ' pts) in ESI ' + g.me.p.esi, decision;
    if (action === 'pin') { pins[id] = true; decision = 'Pinned to top of ESI ' + g.me.p.esi; }
    else if (action === 'unpin') { delete pins[id]; decision = 'Unpinned'; }
    else {
      var other = g.grp[action === 'up' ? g.idx - 1 : g.idx + 1];
      if (!other) return;
      var delta = action === 'up' ? 0.01 : -0.01;
      bias[id] = (other.key + delta) - g.me.s.total;
      decision = (action === 'up' ? 'Moved above ' : 'Moved below ') + other.p.id + ' within ESI ' + g.me.p.esi;
      if (g.me.pinned && action === 'down') delete pins[id];
    }
    H.logOverride({ module: 'ranking', patient_id: id, ai_suggestion: before, nurse_decision: decision, reason: reason });
    // 'override' event triggers refresh
  }

  function onClick(e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || !root.contains(b)) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), i = parseInt(b.getAttribute('data-i'), 10);
    if (act === 'why') { expanded[id] = !expanded[id]; refresh(); }
    else if (act === 'up' || act === 'down' || act === 'pin' || act === 'unpin') { pending = { id: id, action: act }; refresh(); var s = root.querySelector('#rk-reason'); if (s) s.focus(); }
    else if (act === 'cancel') { pending = null; refresh(); }
    else if (act === 'confirm') {
      var nurse = H.state.settings.nurse;
      setUpdate(id, i, { confirmed_by: nurse });
    } else if (act === 'dismiss') {
      var u = setUpdate(id, i, { dismissed_by: H.state.settings.nurse });
      if (u) H.logOverride({ module: 'ranking', patient_id: id, ai_suggestion: 'Count symptom update toward score once confirmed',
        nurse_decision: 'Dismissed symptom update', reason: 'Nurse reviewed and dismissed the update' });
    } else if (act === 'ack') {
      setUpdate(id, i, { dismissed_by: H.state.settings.nurse, red_flag_assessed: true });
    } else if (act === 'leave-send' || act === 'leave-talked') {
      var n = (H.state.leaveNotices || [])[i];
      if (!n) return;
      var nurseName = H.state.settings.nurse;
      if (act === 'leave-send') {
        var ta = root.querySelector('#rk-leave-' + i), txt = ta ? ta.value.trim() : n.draft;
        if (!txt) { if (ta) ta.focus(); return; }
        n.final_text = txt; n.status = 'sent'; n.reviewed_by = nurseName;
        if (txt !== String(n.draft).trim()) {
          H.logOverride({ module: 'ranking', patient_id: n.patient_id, ai_suggestion: n.source === 'claude' ? 'AI-drafted leave plan' : 'Standard leave template',
            nurse_decision: 'Edited the message before sending', reason: 'Nurse review of patient message' });
        }
      } else {
        n.status = 'talked'; n.reviewed_by = nurseName;
      }
      H.emit('leave:updated', n);
    }
  }

  function onSubmit(e) {
    var f = e.target;
    if (!f || f.getAttribute('data-form') !== 'override') return;
    e.preventDefault();
    var sel = f.querySelector('#rk-reason').value, txt = f.querySelector('#rk-reason-text').value.trim(), err = f.querySelector('#rk-form-err');
    if (!sel) { err.textContent = 'Choose a reason.'; return; }
    if (sel === 'other' && !txt) { err.textContent = 'Please explain the reason.'; return; }
    var reason = sel + (txt ? ': ' + txt : '');
    var id = f.getAttribute('data-id'), action = pending && pending.action;
    pending = null;
    applyOverride(id, action, reason);
    refresh();
  }

  function onInput(e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-w');
    if (!k) return;
    weights[k] = parseFloat(t.value);
    var out = root.querySelector('#rk-wv-' + k);
    if (out) out.textContent = weights[k];
    refresh();
  }

  /* ---------- mount ---------- */
  H.registerModule('ranking', {
    mount: function (el) {
      root = el;
      injectStyles();
      skeleton(el);
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('input', onInput);
      root.querySelector('#rk-reset').addEventListener('click', function () {
        COMPONENTS.forEach(function (c) { weights[c.key] = c.def; });
        buildWeights();
        refresh();
      });
      ['patient:updated', 'symptomUpdate', 'override', 'settings', 'aiOffline', 'patientview:leaving', 'leave:updated'].forEach(function (evt) { H.on(evt, function () { refresh(); }); });
      refresh();
    }
  });
})();
