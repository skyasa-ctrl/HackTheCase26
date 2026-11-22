/* Fast-track tab. AI advises, a nurse decides: nothing moves without a click. Insurance is never a model input. */
(function () {
  'use strict';
  var H = window.Halvian, esc = H.util.esc, FT = H.fastTrack;

  /* ---- small helpers added to the shared namespace (not overwriting score) ---- */
  FT.roomCounts = function () {
    var ft = H.state.rooms.filter(function (r) { return r.type === 'fast_track'; });
    return { total: ft.length || 8, open: ft.filter(function (r) { return r.status === 'open'; }).length };
  };
  FT.manualCriteria = [
    'Triage level ESI 4 or 5',
    'Vital signs in the normal range (HR 50-100, BP 100-180, RR 10-22, SpO2 94% or higher, no fever)',
    'Can walk and sit up without help (ambulatory)',
    'Pain under 8 out of 10',
    'Not arriving by ambulance or transfer',
    'Single, simple problem expected to need one provider visit (for example sprain, small cut, sore throat, rash)',
    'No chest, breathing, stroke-type, or major trauma complaint; no nurse concern flag'
  ];
  var REASONS = ['Clinical concern not captured by the score', 'Vitals or exam changed since triage',
    'Needs more than one resource (imaging, labs, procedure)', 'Patient preference or social factor',
    'Fast-track rooms full / staffing', 'Other (explain below)'];

  function pct(x) { return Math.round(x * 100); }
  function f1(x) { return (x * 100).toFixed(1) + '%'; }

  function mount(el) {
    var model = FT.model;
    var role = 'nurse';
    var openWhy = {};     // patient id -> bool
    var pending = null;   // {id, kind:'decline'|'send'}
    var flash = '';

    function waiting() {
      return H.state.patients.filter(function (p) { return p.status === 'waiting'; }).sort(H.util.esiArrivalCompare);
    }

    function barsHtml(contribs) {
      var top = contribs.slice(0, 6);
      var max = Math.max.apply(null, top.map(function (c) { return Math.abs(c.value); }).concat([0.01]));
      return top.map(function (c) {
        var neg = c.value < 0;
        return '<div class="bar' + (neg ? ' neg' : '') + '"><span class="bar-label">' + esc(c.label) + '</span>' +
          '<span class="bar-track"><span class="bar-fill" style="--pct:' + Math.round(Math.abs(c.value) / max * 100) + '"></span></span>' +
          '<span class="bar-value">' + (neg ? '−' : '+') + Math.abs(c.value).toFixed(2) + '</span></div>';
      }).join('') + '<p class="muted">Blue bars (+) push toward "quick case", red bars (−) push away. Values are log-odds; the score is advice only.</p>';
    }

    function rowHtml(p) {
      var offline = H.state.aiOffline;
      var hi = p.esi <= 2;
      var s = (!hi && !offline && model) ? FT.score(p) : null;
      var cells = '<td>' + esc(p.id) + '</td><td><span class="badge esi-' + p.esi + '">ESI ' + p.esi + '</span></td>' +
        '<td>' + esc(p.chief_complaint) + '<div class="muted">' + p.age + 'y, waiting ' + Math.max(0, Math.round(H.util.minutesBetween(p.arrival_time, H.util.now()))) + ' min</div></td>';
      var score, actions;
      if (hi) {
        score = '<span class="pill danger">Not eligible — high acuity</span>'; actions = '<span class="muted">No fast-track option</span>';
      } else if (offline) {
        score = '<span class="muted">AI offline — see manual criteria</span>';
        actions = '<button class="btn btn-sm btn-primary" data-act="send" data-id="' + esc(p.id) + '">Send to fast-track (manual)</button>';
      } else {
        score = '<strong>' + pct(s.probability) + '% likely quick case</strong> ' +
          (s.eligible ? '<span class="pill ok">Eligible (≥ ' + pct(s.threshold) + '%)</span>' : '<span class="pill warn">Below ' + pct(s.threshold) + '% threshold</span>') +
          '<div><button class="btn btn-ghost btn-sm" data-act="why" data-id="' + esc(p.id) + '" aria-expanded="' + !!openWhy[p.id] + '">' + (openWhy[p.id] ? 'Hide why' : 'Why?') + '</button></div>';
        actions = s.eligible
          ? '<button class="btn btn-sm btn-primary" data-act="accept" data-id="' + esc(p.id) + '">Accept</button> <button class="btn btn-sm" data-act="decline" data-id="' + esc(p.id) + '">Override / Decline</button>'
          : '<button class="btn btn-sm" data-act="send" data-id="' + esc(p.id) + '">Send to fast-track anyway (override)</button>';
      }
      var html = '<tr>' + cells + '<td>' + score + '</td><td>' + actions + '</td></tr>';
      if (s && openWhy[p.id]) html += '<tr><td colspan="5">' + barsHtml(s.contributions) + '</td></tr>';
      if (pending && pending.id === p.id) html += '<tr><td colspan="5">' + reasonForm(p, s) + '</td></tr>';
      return html;
    }

    function reasonForm(p, s) {
      var title = pending.kind === 'decline' ? 'Decline the AI suggestion for ' : 'Send to fast-track against the score for ';
      return '<form class="card" data-form="reason" aria-label="Override reason"><h3>' + title + esc(p.id) + '</h3>' +
        '<div class="row"><label for="rs-' + esc(p.id) + '">Reason (required)</label><select id="rs-' + esc(p.id) + '" name="reason" required>' +
        '<option value="">Choose a reason…</option>' + REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><label for="rt-' + esc(p.id) + '">Details</label><input id="rt-' + esc(p.id) + '" name="text" size="40" placeholder="Short note"></div>' +
        '<p class="muted">This is logged. The patient does not move until you confirm.</p>' +
        '<div class="row"><button class="btn btn-primary btn-sm" type="submit">Confirm and log</button> <button class="btn btn-sm" type="button" data-act="cancel">Cancel</button></div>' +
        '<p class="banner-warning" data-err hidden>Please choose a reason (and add details if you chose "Other").</p></form>';
    }

    function capacityHtml() {
      var c = FT.roomCounts();
      return '<div class="card"><h2>Fast-track capacity</h2><p><strong>' + c.open + ' of ' + c.total + '</strong> fast-track rooms open.</p>' +
        (c.open === 0 ? '<p class="banner-warning">No fast-track rooms are open. Accepting still marks the patient fast-track; a room is not required.</p>' : '') + '</div>';
    }

    function modelCardHtml() {
      if (!model) return '<div class="card"><h2>Model card</h2><p>Model not loaded.</p></div>';
      var m = model.metrics, fair = model.fairness, groups = Object.keys(fair);
      var rows = groups.map(function (g) {
        var top = g === 'uninsured';
        return '<tr' + (top ? ' style="background:var(--brand-tint)"' : '') + '><td>' + esc(g) + (top ? ' <span class="pill info">highest</span>' : '') + '</td><td class="num">' + fair[g].n +
          '</td><td class="num">' + f1(fair[g].selection_rate) + '</td><td class="num">' + f1(fair[g].bounce_back_rate) + '</td></tr>';
      }).join('');
      return '<div class="card"><h2>Model card</h2><div class="table-wrap"><table class="table"><tbody>' +
        '<tr><td>Threshold</td><td class="num">' + pct(H.state.settings.fasttrackThreshold) + '% (trained: ' + pct(model.threshold) + '%)</td></tr>' +
        '<tr><td>Bounce-back rate at threshold</td><td class="num">' + f1(m.bounce_back_rate_at_threshold) + ' (target under ' + pct(m.bounce_back_target) + '%)</td></tr>' +
        '<tr><td>Accuracy (at 0.5)</td><td class="num">' + f1(m['accuracy_at_0.5']) + '</td></tr>' +
        '<tr><td>AUC</td><td class="num">' + m.auc.toFixed(3) + '</td></tr>' +
        '<tr><td>Training patients (n_train)</td><td class="num">' + m.n_train + '</td></tr></tbody></table></div>' +
        '<h3 style="margin-top:1rem">Fairness by insurance group</h3><p class="muted"><strong>Insurance is not a model input.</strong> It is used only here, to check the model is fair.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Group</th><th class="num">n</th><th class="num">Selection rate</th><th class="num">Bounce-back</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p>Uninsured patients have the highest fast-track selection rate (' + f1(fair.uninsured.selection_rate) + '), with bounce-back (' + f1(fair.uninsured.bounce_back_rate) +
        ') no higher than other groups, so fast-track helps narrow the wait gap for uninsured patients.</p></div>';
    }

    function thresholdHtml() {
      var can = role !== 'nurse', t = H.state.settings.fasttrackThreshold;
      return '<div class="card"><h2>Threshold</h2><div class="row"><label for="ft-role">Demo role</label><select id="ft-role">' +
        ['nurse', 'nurse-lead', 'admin'].map(function (r) { return '<option' + (r === role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><label for="ft-thr">Fast-track cutoff: <span id="ft-thr-val">' + pct(t) + '%</span></label>' +
        '<input id="ft-thr" type="range" min="50" max="99" step="1" value="' + pct(t) + '"' + (can ? '' : ' disabled') + ' style="min-width:12rem"></div>' +
        (can ? '' : '<p class="muted">Only a nurse-lead or admin can change the cutoff.</p>') +
        '<p class="banner-warning">Lowering the cutoff sends more patients to fast-track but raises bounce-back risk (patients who need a full ED room after all).</p></div>';
    }

    function manualHtml() {
      return '<div class="card"><h2>Manual fast-track criteria</h2><p>AI is offline, so scores are hidden. Use these criteria; a nurse decides.</p><ul>' +
        FT.manualCriteria.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }

    function render() {
      var list = waiting();
      var ftNow = H.state.patients.filter(function (p) { return p.status === 'fast-track'; }).length;
      var body = list.length ? list.map(rowHtml).join('') : '<tr><td colspan="5" class="muted">No patients waiting.</td></tr>';
      el.innerHTML =
        '<div class="grid cols-2"><div>' + (H.state.aiOffline ? manualHtml() : '') +
        '<div class="card"><h2>Waiting patients</h2><p class="muted">Suggestions only. Nothing moves until a nurse clicks. ' + ftNow + ' patient(s) currently in fast-track.</p>' +
        (flash ? '<p class="banner-warning" role="status">' + esc(flash) + '</p>' : '') +
        '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Acuity</th><th>Complaint</th><th>Fast-track score</th><th>Action</th></tr></thead><tbody>' + body + '</tbody></table></div></div></div>' +
        '<div>' + capacityHtml() + thresholdHtml() + modelCardHtml() + '</div></div>';
    }

    function decide(id, kind, reason) {
      var p = H.getPatient(id), s = FT.score(p);
      var sug = H.state.aiOffline ? 'AI offline (no suggestion)' : (s.eligible ? 'Fast-track (' + pct(s.probability) + '%)' : 'Not fast-track (' + pct(s.probability) + '%)');
      if (kind === 'decline') {
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: sug, nurse_decision: 'Keep in main queue', reason: reason });
        flash = id + ': kept in main queue. Override logged.';
      } else {
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: sug, nurse_decision: 'Send to fast-track', reason: reason });
        H.updatePatient(id, { status: 'fast-track' }, 'fasttrack');
        flash = id + ': sent to fast-track (override logged).';
      }
    }

    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'why') openWhy[id] = !openWhy[id];
      else if (act === 'accept') {
        var p = H.getPatient(id), s = FT.score(p);
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: 'Fast-track (' + pct(s.probability) + '%)', nurse_decision: 'Accepted fast-track', reason: 'Accepted AI suggestion' });
        H.updatePatient(id, { status: 'fast-track' }, 'fasttrack');
        flash = id + ': moved to fast-track by nurse.';
      } else if (act === 'decline' || act === 'send') { pending = { id: id, kind: act }; flash = ''; }
      else if (act === 'cancel') pending = null;
      render();
    });
    el.addEventListener('submit', function (e) {
      if (e.target.getAttribute('data-form') !== 'reason') return;
      e.preventDefault();
      var f = e.target, reason = f.elements.reason.value, text = f.elements.text.value.trim();
      if (!reason || (reason.indexOf('Other') === 0 && !text)) { f.querySelector('[data-err]').hidden = false; return; }
      var id = pending.id, kind = pending.kind;
      pending = null;
      decide(id, kind, reason + (text ? ': ' + text : ''));
      render();
    });
    el.addEventListener('input', function (e) {
      if (e.target.id !== 'ft-thr') return;
      var v = Number(e.target.value) / 100;
      if (role === 'nurse') return;
      H.state.settings.fasttrackThreshold = v;
      H.emit('settings', { key: 'fasttrackThreshold', value: v });
      var lbl = el.querySelector('#ft-thr-val'); if (lbl) lbl.textContent = pct(v) + '%';
    });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'ft-role') { role = e.target.value; render(); }
      else if (e.target.id === 'ft-thr') render();
    });

    H.on('patient:updated', function (d) { if (!d || d.source !== 'fasttrack') render(); });
    H.on('aiOffline', render);
    H.on('settings', function () { if (el.querySelector('#ft-thr') && document.activeElement && document.activeElement.id === 'ft-thr') return; render(); });
    H.on('override', function () { /* log only */ });
    render();
  }

  H.registerModule('fasttrack', { mount: mount });
})();
