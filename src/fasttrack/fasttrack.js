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
    var showAll = false;  // default: top 10 most likely quick cases
    var TOP_N = 10;

    function waiting() {
      return H.state.patients.filter(function (p) { return p.status === 'waiting'; }).sort(H.util.esiArrivalCompare);
    }
    function waitMin(p) { return Math.max(0, Math.round(H.util.minutesBetween(p.arrival_time, H.util.now()))); }

    /* Consult preference (virtual vs in person). Patients answer on the Patient view (SMS link) for ESI 4-5.
     * For the demo, some synthetic answers are pre-filled so the panel isn't empty (marked "synthetic"). */
    (function seedConsultPrefs() {
      H.state.patients.forEach(function (p) {
        if (p.status !== 'waiting' || p.esi < 4 || p.consult_pref) return;
        var n = parseInt(String(p.id).replace(/\D/g, ''), 10) || 0, r = n % 10;
        if (r <= 2) { p.consult_pref = 'virtual'; p.consult_pref_source = 'synthetic'; }
        else if (r <= 6) { p.consult_pref = 'in_person'; p.consult_pref_source = 'synthetic'; }
      });
    })();
    function prefBadge(p) {
      if (p.esi < 4) return '';
      return p.consult_pref === 'virtual' ? ' <span class="pill info">Prefers video consult</span>' :
        p.consult_pref === 'in_person' ? ' <span class="pill">Prefers in person</span>' : ' <span class="pill">Consult pref: not asked</span>';
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
        '<td>' + esc(p.chief_complaint) + '<div class="muted">' + p.age + 'y, waiting ' + waitMin(p) + ' min</div>' + prefBadge(p) + '</td>';
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
          ? '<button class="btn btn-sm btn-primary" data-act="accept" data-id="' + esc(p.id) + '">Accept</button> ' +
            (p.consult_pref === 'virtual' && p.esi >= 4 ? '<button class="btn btn-sm" data-act="virtual" data-id="' + esc(p.id) + '">Offer video consult</button> ' : '') +
            '<button class="btn btn-sm" data-act="decline" data-id="' + esc(p.id) + '">Override / Decline</button>'
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
        var top = g === 'uninsured' || g === 'medicaid';
        return '<tr' + (top ? ' style="background:var(--brand-tint)"' : '') + '><td>' + esc(g) + '</td><td class="num">' + fair[g].n +
          '</td><td class="num">' + f1(fair[g].selection_rate) + '</td><td class="num">' + f1(fair[g].bounce_back_rate) + '</td></tr>';
      }).join('');
      return '<div class="card"><h2>Model card</h2><div class="table-wrap"><table class="table"><tbody>' +
        '<tr><td>Threshold</td><td class="num">' + pct(H.state.settings.fasttrackThreshold) + '% (trained: ' + pct(model.threshold) + '%)</td></tr>' +
        '<tr><td>Bounce-back rate at threshold</td><td class="num">' + f1(m.bounce_back_rate_at_threshold) + ' (target under ' + pct(m.bounce_back_target) + '%)</td></tr>' +
        '<tr><td>Accuracy (at 0.5)</td><td class="num">' + f1(m['accuracy_at_0.5']) + '</td></tr>' +
        '<tr><td>AUC, all patients (synthetic data)</td><td class="num">' + m.auc.toFixed(3) + '</td></tr>' +
        (m.auc_esi_3_5 != null ? '<tr><td>AUC, ESI 3–5 only (stricter; synthetic data)</td><td class="num">' + m.auc_esi_3_5.toFixed(3) + '</td></tr>' : '') +
        '<tr><td>Real-world benchmark (published)</td><td class="num">0.87</td></tr>' +
        '<tr><td>Training patients (n_train)</td><td class="num">' + m.n_train + '</td></tr></tbody></table></div>' +
        '<p class="banner-warning" style="margin-top:.6rem"><strong>Read with care:</strong> synthetic labels are cleaner than real triage data, so these numbers overstate real-world accuracy. ' +
        'Go-live bar in silent mode: AUC of at least 0.85 on Halvian\'s own data and bounce-back under 5%.</p>' +
        '<h3 style="margin-top:1rem">Fairness by insurance group</h3><p class="muted"><strong>Insurance is not a model input.</strong> It is used only here, to check the model is fair.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Group</th><th class="num">n</th><th class="num">Selection rate</th><th class="num">Bounce-back</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p>In this synthetic test, uninsured (' + f1(fair.uninsured.selection_rate) + ') and Medicaid (' + f1(fair.medicaid.selection_rate) + ') patients are selected for fast-track at least as often as commercial patients (' + f1(fair.commercial.selection_rate) + '), with similar bounce-back. ' +
        'This is a hypothesis to confirm on real Halvian data in silent mode, not proof.</p></div>';
    }

    /* Right-hand panel: suggestions generated from the fast-track model's scores plus live room status. Advice only. */
    function suggestionsHtml() {
      if (H.state.aiOffline || !model) return '<div class="card"><h2>AI suggestions</h2><p class="muted">AI is offline, so there are no suggestions. Use the manual criteria.</p></div>';
      var r = rankCandidates(waiting()), sc = r.scores, c = FT.roomCounts(), thr = H.state.settings.fasttrackThreshold;
      var elig = r.list.filter(function (p) { return sc[p.id].eligible; });
      var next = elig.slice(0, Math.max(1, Math.min(3, c.open)));
      var video = elig.filter(function (p) { return p.consult_pref === 'virtual' && p.esi >= 4; }).slice(0, 3);
      var near = r.list.filter(function (p) { var pr = sc[p.id].probability; return !sc[p.id].eligible && pr >= thr - 0.10; }).slice(0, 3);
      function line(p, extra, btn) {
        return '<li style="margin-bottom:.45rem"><strong>' + esc(p.id) + '</strong> · ' + esc(p.chief_complaint) + ' · ' + pct(sc[p.id].probability) + '% · waiting ' + waitMin(p) + ' min' +
          (extra ? ' · ' + extra : '') + (btn ? ' ' + btn : '') + '</li>';
      }
      var h = '<div class="card"><h2>AI suggestions <span class="pill info">From the fast-track model</span></h2>' +
        '<p class="muted">Generated from each patient\'s model score and live fast-track room status. Suggestions only: a nurse decides.</p>';
      h += '<h3>Send next' + (c.open ? ' (' + c.open + ' fast-track room' + (c.open === 1 ? '' : 's') + ' open)' : ' (no room open yet)') + '</h3>';
      h += next.length ? '<ol style="padding-left:1.2rem">' + next.map(function (p) {
        return line(p, p.consult_pref === 'virtual' ? 'prefers video' : '', '<button class="btn btn-sm btn-primary" data-act="accept" data-id="' + esc(p.id) + '">Accept</button>');
      }).join('') + '</ol>' : '<p class="muted">No eligible patients right now.</p>';
      if (video.length) {
        h += '<h3>Offer a video consult</h3><p class="muted" style="margin-top:0">These eligible patients said yes to a video consult, which frees a room.</p><ul style="padding-left:1.2rem">' +
          video.map(function (p) { return line(p, '', '<button class="btn btn-sm" data-act="virtual" data-id="' + esc(p.id) + '">Offer video consult</button>'); }).join('') + '</ul>';
      }
      if (near.length) {
        h += '<h3>Close to the cutoff: nurse review</h3><p class="muted" style="margin-top:0">Within 10 points of the ' + pct(thr) + '% cutoff. A quick look may move them either way.</p><ul style="padding-left:1.2rem">' +
          near.map(function (p) {
            var neg = (sc[p.id].contributions || []).filter(function (x) { return x.value < 0; }).sort(function (a, b) { return a.value - b.value; })[0];
            return line(p, neg ? 'held back mainly by: ' + esc(neg.label) : '', '');
          }).join('') + '</ul>';
      }
      if (elig.length > c.open) {
        h += '<p class="banner-warning" style="margin-top:.5rem"><strong>Capacity:</strong> ' + elig.length + ' eligible patients but only ' + c.open +
          ' fast-track room' + (c.open === 1 ? '' : 's') + ' open. Consider extra fast-track APP hours (surge playbook)' + (video.length ? ' or video consults for those who agreed' : '') + '.</p>';
      }
      return h + '</div>';
    }

    function consultHtml() {
      var low = waiting().filter(function (p) { return p.esi >= 4; });
      var v = low.filter(function (p) { return p.consult_pref === 'virtual'; }), ip = low.filter(function (p) { return p.consult_pref === 'in_person'; });
      var na = low.length - v.length - ip.length, inVirtual = H.state.patients.filter(function (p) { return p.status === 'virtual-consult'; }).length;
      return '<div class="card"><h2>Consult preference: video or in person</h2>' +
        '<p class="muted">ESI 4–5 patients are asked on their SMS link (or at the kiosk) whether they would accept a video consult if a clinician agrees it is safe. Some answers here are pre-filled synthetic data.</p>' +
        '<div class="table-wrap"><table class="table"><tbody>' +
        '<tr><td>Prefer a video consult</td><td class="num"><strong>' + v.length + '</strong></td></tr>' +
        '<tr><td>Prefer in person</td><td class="num">' + ip.length + '</td></tr>' +
        '<tr><td>Not asked yet</td><td class="num">' + na + '</td></tr>' +
        '<tr><td>In a video consult now</td><td class="num">' + inVirtual + '</td></tr></tbody></table></div>' +
        '<p class="muted" style="margin-bottom:0">A clinician always decides whether video is safe. Patients without a phone can use a video booth at the kiosk, so the option doesn\'t depend on owning a smartphone.</p></div>';
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

    /* Top 10 view, ordered for the decision a nurse actually makes ("who goes into the next fast-track room?"):
     *   1. Eligible patients (score at or above the cutoff) first, LONGEST WAIT first: every one of them is a
     *      safe quick case, so among them the fair order is first come, first served.
     *   2. Then patients below the cutoff, HIGHEST SCORE first: the near-misses a nurse may want to review.
     * ESI 1-2 are never eligible, so they appear only in "Show all". With AI offline there are no scores,
     * so the list falls back to acuity then arrival order. A patient with an open form always stays visible. */
    function rankCandidates(all) {
      var cand = all.filter(function (p) { return p.esi >= 3; });
      var sc = {};
      cand.forEach(function (p) { sc[p.id] = FT.score(p); });
      cand.sort(function (a, b) {
        var ea = sc[a.id].eligible, eb = sc[b.id].eligible;
        if (ea !== eb) return ea ? -1 : 1;
        if (ea) return waitMin(b) - waitMin(a);
        return sc[b.id].probability - sc[a.id].probability;
      });
      return { list: cand, scores: sc };
    }
    function topList(all) {
      var offline = H.state.aiOffline || !model;
      var cand = all.filter(function (p) { return p.esi >= 3; });
      if (!offline) cand = rankCandidates(all).list;
      var top = cand.slice(0, TOP_N);
      if (pending && !top.some(function (p) { return p.id === pending.id; })) {
        var pp = H.getPatient(pending.id); if (pp) top.push(pp);
      }
      return top;
    }

    function render() {
      var all = waiting(), list = showAll ? all : topList(all);
      var ftNow = H.state.patients.filter(function (p) { return p.status === 'fast-track'; }).length;
      var offline = H.state.aiOffline || !model;
      var body = list.length ? list.map(rowHtml).join('') : '<tr><td colspan="5" class="muted">No patients waiting.</td></tr>';
      var viewNote = showAll
        ? 'Showing all ' + all.length + ' waiting patients in acuity and arrival order.'
        : 'Showing the top ' + Math.min(TOP_N, list.length) + ' of ' + all.length + ' waiting patients' +
          (offline ? ' (ESI 3–5, by acuity then arrival; AI offline, so no scores).' : ': eligible patients first, longest wait first (fair order among safe quick cases), then near-misses by score. ESI 1–2 are never eligible.');
      var toggle = '<button type="button" class="btn btn-sm" data-act="toggle-all">' + (showAll ? 'Show top ' + TOP_N + ' only' : 'Show all ' + all.length + ' waiting patients') + '</button>';
      el.innerHTML =
        '<div class="grid cols-2"><div>' + (H.state.aiOffline ? manualHtml() : '') +
        '<div class="card"><h2>' + (showAll ? 'All waiting patients' : 'Top ' + TOP_N + ' fast-track candidates') + '</h2><p class="muted">Suggestions only. Nothing moves until a nurse clicks. ' + ftNow + ' patient(s) currently in fast-track.</p>' +
        '<p class="row" style="align-items:center;gap:.6rem"><span class="muted">' + esc(viewNote) + '</span> ' + toggle + '</p>' +
        (flash ? '<p class="banner-warning" role="status">' + esc(flash) + '</p>' : '') +
        '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Acuity</th><th>Complaint</th><th>Fast-track score</th><th>Action</th></tr></thead><tbody>' + body + '</tbody></table></div></div></div>' +
        '<div>' + suggestionsHtml() + consultHtml() + capacityHtml() + thresholdHtml() + modelCardHtml() + '</div></div>';
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
      if (act === 'toggle-all') showAll = !showAll;
      else if (act === 'why') openWhy[id] = !openWhy[id];
      else if (act === 'accept') {
        var p = H.getPatient(id), s = FT.score(p);
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: 'Fast-track (' + pct(s.probability) + '%)', nurse_decision: 'Accepted fast-track', reason: 'Accepted AI suggestion' });
        H.updatePatient(id, { status: 'fast-track' }, 'fasttrack');
        flash = id + ': moved to fast-track by nurse.';
      } else if (act === 'virtual') {
        var pv = H.getPatient(id), sv = FT.score(pv);
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: 'Fast-track (' + pct(sv.probability) + '%); patient prefers video',
          nurse_decision: 'Offered video consult', reason: 'Eligible quick case; patient agreed to a video consult' });
        H.updatePatient(id, { status: 'virtual-consult' }, 'fasttrack');
        flash = id + ': video consult offered by nurse. Room kept free.';
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
