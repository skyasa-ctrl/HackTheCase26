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
    var expanded = {};    // group key -> bool ("Show all (N)" toggles)
    var GROUP_N = 5;      // short groups are easier to navigate on video

    function moreBtn(key, total) {
      if (total <= GROUP_N) return '';
      return '<p style="margin:.4rem 0 0"><button type="button" class="btn btn-sm" data-act="toggle-group" data-key="' + key + '" aria-expanded="' + !!expanded[key] + '">' +
        (expanded[key] ? 'Show fewer (top ' + GROUP_N + ')' : 'Show all (' + total + ')') + '</button></p>';
    }
    function shown(key, list) { return expanded[key] ? list : list.slice(0, GROUP_N); }

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

    function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
    function prefText(p) {
      if (p.esi < 4) return '';
      return p.consult_pref === 'virtual' ? ' · <span class="ft-chip">prefers video</span>' : p.consult_pref === 'in_person' ? ' · prefers in person' : '';
    }
    function rowHtml(p) {
      var offline = H.state.aiOffline;
      var hi = p.esi <= 2;
      var s = (!hi && !offline && model) ? FT.score(p) : null;
      var id = esc(p.id), thr = H.state.settings.fasttrackThreshold;
      var info = '<div class="ft-who"><strong class="ft-id">' + id + '</strong> <span class="badge esi-' + p.esi + '">ESI ' + p.esi + '</span></div>' +
        '<div class="ft-what"><div class="ft-complaint">' + esc(cap(p.chief_complaint)) + '</div>' +
        '<div class="muted">' + p.age + ' y · waiting ' + waitMin(p) + ' min' + prefText(p) + '</div></div>';
      var score = '', main = '', more = '';
      if (hi) {
        score = '<span class="muted">High acuity: never eligible for fast-track.</span>';
        main = '<span class="muted">No fast-track option</span>';
      } else if (offline || !s) {
        score = '<span class="muted">AI offline: see manual criteria</span>';
        main = '<button class="btn btn-sm btn-primary" data-act="send" data-id="' + id + '">Send to fast-track (manual)</button>';
      } else {
        var v = pct(s.probability), t = pct(thr);
        score = '<div class="ft-num ' + (s.eligible ? 'above' : 'below') + '">' + v + '%</div><div class="ft-numlbl">chance of a quick case</div>' +
          '<div class="ft-meter" role="img" aria-label="Score ' + v + ' percent; cutoff ' + t + ' percent"><span class="ft-fill ' + (s.eligible ? 'above' : 'below') + '" style="width:' + v + '%"></span>' +
          '<span class="ft-tick" style="left:' + t + '%" title="Cutoff ' + t + '%"></span></div>';
        if (s.eligible) {
          main = '<button class="btn btn-sm btn-primary" data-act="accept" data-id="' + id + '">Accept</button>';
          if (p.consult_pref === 'virtual' && p.esi >= 4) more += '<button class="btn btn-ghost btn-sm" data-act="virtual" data-id="' + id + '">Offer video consult</button>';
          more += '<button class="btn btn-ghost btn-sm" data-act="decline" data-id="' + id + '">Override / Decline</button>';
        } else {
          main = '<button class="btn btn-sm" data-act="send" data-id="' + id + '">Send to fast-track</button>';
        }
        more += '<button class="btn btn-ghost btn-sm" data-act="why" data-id="' + id + '" aria-expanded="' + !!openWhy[p.id] + '">' + (openWhy[p.id] ? 'Hide why' : 'Why?') + '</button>';
      }
      var html = '<div class="ft-row"><div class="ft-info">' + info + '</div><div class="ft-score">' + score + '</div>' +
        '<div class="ft-actions">' + main + (more ? '<div class="ft-more">' + more + '</div>' : '') + '</div>';
      if (s && openWhy[p.id]) html += '<div class="ft-extra">' + barsHtml(s.contributions) + '</div>';
      if (pending && pending.id === p.id) html += '<div class="ft-extra">' + reasonForm(p, s) + '</div>';
      return html + '</div>';
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

    /* Right-hand panel: suggestions generated from the fast-track model's scores plus live room status. Advice only. */
    function suggestionsHtml() {
      if (H.state.aiOffline || !model) return '<div class="card"><h2>AI suggestions</h2><p class="muted">AI is offline, so there are no suggestions. Use the manual criteria.</p></div>';
      var r = rankCandidates(waiting()), sc = r.scores, c = FT.roomCounts(), thr = H.state.settings.fasttrackThreshold;
      var elig = r.list.filter(function (p) { return sc[p.id].eligible; });
      var next = elig.slice(0, Math.max(1, Math.min(3, c.open)));
      var video = elig.filter(function (p) { return p.consult_pref === 'virtual' && p.esi >= 4; });
      var near = r.list.filter(function (p) { var pr = sc[p.id].probability; return !sc[p.id].eligible && pr >= thr - 0.10; });
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
        h += '<h3>Offer a video consult (' + video.length + ')</h3><p class="muted" style="margin-top:0">These eligible patients said yes to a video consult, which frees a room.</p><ul style="padding-left:1.2rem">' +
          shown('sg-video', video).map(function (p) { return line(p, '', '<button class="btn btn-sm" data-act="virtual" data-id="' + esc(p.id) + '">Offer video consult</button>'); }).join('') + '</ul>' + moreBtn('sg-video', video.length);
      }
      if (near.length) {
        h += '<h3>Close to the cutoff: nurse review (' + near.length + ')</h3><p class="muted" style="margin-top:0">Within 10 points of the ' + pct(thr) + '% cutoff. A quick look may move them either way.</p><ul style="padding-left:1.2rem">' +
          shown('sg-near', near).map(function (p) {
            var neg = (sc[p.id].contributions || []).filter(function (x) { return x.value < 0; }).sort(function (a, b) { return a.value - b.value; })[0];
            return line(p, neg ? 'held back mainly by: ' + esc(neg.label) : '', '');
          }).join('') + '</ul>' + moreBtn('sg-near', near.length);
      }
      if (elig.length > c.open) {
        h += '<p class="banner-warning" style="margin-top:.5rem"><strong>Capacity:</strong> ' + elig.length + ' eligible patients but only ' + c.open +
          ' fast-track room' + (c.open === 1 ? '' : 's') + ' open. Consider extra fast-track APP hours (surge playbook)' + (video.length ? ' or video consults for those who agreed' : '') + '.</p>';
      }
      return h + '</div>';
    }

    /* Patients whose video consult a nurse offered and who accepted (status 'virtual-consult'). */
    function videoHtml() {
      var list = H.state.patients.filter(function (p) { return p.status === 'virtual-consult'; }).sort(function (a, b) {
        return (a.video_offered_at ? 0 : 1) - (b.video_offered_at ? 0 : 1) || H.util.esiArrivalCompare(a, b);
      });
      var h = '<div class="card" id="ft-video"><h2>Video consults (' + list.length + ')</h2>';
      if (!list.length) return h + '<p class="muted">No video consults yet — use “Offer video consult” on an eligible patient.</p></div>';
      function nurseFor(p) {
        var o = H.state.overrides.filter(function (x) { return x.patient_id === p.id && x.nurse_decision === 'Offered video consult'; }).pop();
        return o && o.nurse ? o.nurse : '';
      }
      h += '<ul class="ft-video-list">' + shown('g-video', list).map(function (p) {
        var by = nurseFor(p);
        return '<li><strong>' + esc(p.id) + '</strong> <span class="badge esi-' + p.esi + '">ESI ' + p.esi + '</span> ' + esc(p.chief_complaint) +
          '<div class="muted">' + esc(p.age) + 'y ' + esc(p.sex) + ' · ' + (p.video_offered_at ? (function (m) { return m < 1 ? 'accepted just now · ' : 'accepted ' + m + ' min ago · '; })(Math.round(H.util.minutesBetween(p.video_offered_at, H.util.now()))) : '') +
          'waiting ' + waitMin(p) + ' min' + (by ? ' · offered by ' + esc(by) : '') + '</div></li>';
      }).join('') + '</ul>' + moreBtn('g-video', list.length);
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
        '<p class="banner-warning">Lowering the cutoff sends more patients to fast-track but raises bounce-back risk (patients who need a full ED room after all).</p>' +
        '<p><button type="button" class="btn btn-ghost btn-sm" data-goto="results">Model accuracy and fairness: see Results tab</button></p></div>';
    }

    function manualHtml() {
      return '<div class="card"><h2>Manual fast-track criteria</h2><p>AI is offline, so scores are hidden. Use these criteria; a nurse decides.</p><ul>' +
        FT.manualCriteria.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }

    /* Grouped view, ordered for the decision a nurse actually makes ("who goes into the next fast-track room?"):
     *   1. Eligible (score at or above the cutoff), LONGEST WAIT first: every one is a safe quick case, so first come, first served.
     *   2. Below the cutoff, HIGHEST SCORE first: the near-misses a nurse may want to review.
     *   3. ESI 1-2 are never eligible, so they sit in their own group.
     * Each group shows 5 rows by default with a "Show all (N)" toggle; counts stay in the header. With AI offline
     * there are no scores, so ESI 3-5 appear in one group by acuity then arrival. A patient with an open form stays visible. */
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
    function groupHtml(key, title, note, list) {
      var vis = shown(key, list).slice();
      if (pending && !vis.some(function (p) { return p.id === pending.id; })) {
        var pp = list.filter(function (p) { return p.id === pending.id; })[0]; if (pp) vis.push(pp);
      }
      var body = vis.length ? vis.map(rowHtml).join('') : '<p class="muted">None right now.</p>';
      return '<div class="card"><h2>' + esc(title) + ' (' + list.length + ')' + (note ? ' <span class="ft-h2note">' + esc(note) + '</span>' : '') + '</h2>' +
        '<div class="ft-list">' + body + '</div>' + moreBtn(key, list.length) + '</div>';
    }

    function render() {
      var all = waiting();
      var ftNow = H.state.patients.filter(function (p) { return p.status === 'fast-track'; }).length;
      var offline = H.state.aiOffline || !model;
      var intro = '<div class="card"><h2>Fast-track candidates</h2><p class="muted">Suggestions only. Nothing moves until a nurse clicks. ' + ftNow + ' patient(s) currently in fast-track. ' +
        all.length + ' waiting in total.</p>' + (flash ? '<p class="banner-warning" role="status">' + esc(flash) + '</p>' : '') + '</div>';
      var groups;
      if (offline) {
        groups = groupHtml('g-offline', 'Waiting, ESI 3–5', 'AI offline, so no scores: ordered by acuity then arrival.', all.filter(function (p) { return p.esi >= 3; }));
      } else {
        var r = rankCandidates(all);
        groups = groupHtml('g-elig', 'Suggested for fast-track', '— score above the ' + pct(H.state.settings.fasttrackThreshold) + '% cutoff', r.list.filter(function (p) { return r.scores[p.id].eligible; })) +
          groupHtml('g-below', 'Below the cutoff', '— not suggested, nurse can still send', r.list.filter(function (p) { return !r.scores[p.id].eligible; }));
      }
      groups += groupHtml('g-high', 'High acuity (ESI 1–2)', '— never eligible for fast-track', all.filter(function (p) { return p.esi <= 2; }));
      el.innerHTML =
        '<div class="grid cols-2"><div>' + (H.state.aiOffline ? manualHtml() : '') + intro + groups + '</div>' +
        '<div>' + videoHtml() + suggestionsHtml() + consultHtml() + capacityHtml() + thresholdHtml() + '</div></div>';
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
      var g = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (g) { var tb = document.getElementById('tab-' + g.getAttribute('data-goto')); if (tb) tb.click(); return; }
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'toggle-group') { var k = b.getAttribute('data-key'); expanded[k] = !expanded[k]; }
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
        H.updatePatient(id, { status: 'virtual-consult', video_offered_at: H.util.now().toISOString() }, 'fasttrack');
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
