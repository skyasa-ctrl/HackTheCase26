/* Fast-track tab. AI advises, a nurse decides: nothing moves without a click. Insurance is never a model input.
 * Left (40%): "Fast-track line": In-person queue, Virtual queue, Suggestions (patients who could join fast-track).
 * Right (60%): Available virtual physicians, and Virtual consults in progress (each physician as a dropdown with their patients).
 * A nurse clicks Accept on a suggestion. If the waiting queue is above the "Virtual consultation" threshold (a % of ED rooms, gear icon),
 * the patient is offered a video or in-person consult and stays in Suggestions until they reply. A patient who picks video joins the Virtual queue
 * (waiting for a physician); once a virtual physician accepts them they are listed under that physician on the right. */
(function () {
  'use strict';
  var H = window.Halvian, esc = H.util.esc, FT = H.fastTrack || (H.fastTrack = {});

  /* ---- small helpers added to the shared namespace (not overwriting score) ---- */
  FT.roomCounts = function () {
    var ft = (H.state.rooms || []).filter(function (r) { return r.type === 'fast_track'; });
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
  var GEAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  function pct(x) { return Math.round(x * 100); }

  function injectStyles() {
    if (document.getElementById('ft-style')) return;
    var st = document.createElement('style');
    st.id = 'ft-style';
    st.textContent =
      '.ft-linecard{position:relative}.ft-linecard>h2{margin-right:3rem}' +
      '.ft-gear{position:absolute;top:.6rem;right:.6rem;width:2.4rem;height:2.4rem;padding:0;display:flex;align-items:center;justify-content:center;border-radius:50%}' +
      '.ft-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:4.5rem 1rem 1rem;overflow:hidden}.ft-modal[hidden]{display:none}' +
      '.ft-dialog{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);width:100%;max-width:34rem;max-height:calc(100vh - 6rem);overflow-y:auto;padding:1rem 1.2rem;box-sizing:border-box}' +
      '.ft-dlg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}' +
      '.ft-dialog h3{margin:1.1rem 0 .3rem;font-size:1rem}.ft-dialog input[type=range]{width:100%;padding:0;min-height:28px}' +
      '.ft-pend{margin-left:.3rem}' +
      '.ft-split{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:1rem;align-items:start}@media (max-width:900px){.ft-split{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function mount(el) {
    try { mountInner(el); } catch (err) {
      if (window.console) console.error('Fast-track tab failed to load', err);
      el.innerHTML = '<div class="card"><h2>Fast-track tab could not load</h2><p class="banner-warning">' + esc(err && err.message ? err.message : err) + '</p></div>';
    }
  }

  function mountInner(el) {
    injectStyles();
    var model = FT.model;
    var role = 'nurse';
    var openWhy = {};     // patient id -> bool
    var pending = null;   // {id, kind:'decline'}
    var flash = '';
    var expanded = {};    // group key -> bool ("Show all (N)" toggles)
    var GROUP_N = 5;      // short groups are easier to navigate on video
    var secOpen = {};     // section key -> bool (undefined = open)
    var declined = {};    // patient id -> true once a nurse kept them in the main queue (not suggested again this session)
    var offered = {};     // patient id -> ISO time a video consult was offered (pending until the patient decides)
    var gearOpen = false;
    if (H.state.settings.videoPct == null) H.state.settings.videoPct = 80;   // % of ED rooms
    var MAX_VIRTUAL = 2;   // patients one virtual physician can hold at once
    var DEMO_VDOCS = [
      { id: 'vd0', name: 'Dr. Patel', focus: 'Emergency medicine', years: 14 },
      { id: 'vd1', name: 'Dr. Okafor', focus: 'Emergency medicine, minor trauma', years: 9 },
      { id: 'vd2', name: 'Dr. Lindqvist', focus: 'Pediatric emergency medicine', years: 6 },
      { id: 'vd3', name: 'Dr. Nguyen', focus: 'Urgent care, dermatology', years: 11 }
    ];
    function vdocs() {
      if (!H.state.virtualPhysicians) H.state.virtualPhysicians = DEMO_VDOCS.map(function (d) { return { id: d.id, name: d.name, focus: d.focus, years: d.years }; });
      return H.state.virtualPhysicians;
    }
    function roomsTotal() { return (H.state.rooms || []).length || FT.roomCounts().total; }
    function loadPct(n) { return Math.round(100 * n / Math.max(1, roomsTotal())); }
    function patientsOfDoc(id) { return byStatus('virtual-consult').filter(function (p) { return p.virtual_physician === id; }); }

    function moreBtn(key, total) {
      if (total <= GROUP_N) return '';
      return '<p style="margin:.4rem 0 0"><button type="button" class="btn btn-sm" data-act="toggle-group" data-key="' + key + '" aria-expanded="' + !!expanded[key] + '">' +
        (expanded[key] ? 'Show fewer (top ' + GROUP_N + ')' : 'Show all (' + total + ')') + '</button></p>';
    }
    function shown(key, list, keepId) {
      var vis = expanded[key] ? list.slice() : list.slice(0, GROUP_N);
      if (keepId && !vis.some(function (p) { return p.id === keepId; })) {
        var pp = list.filter(function (p) { return p.id === keepId; })[0]; if (pp) vis.push(pp);
      }
      return vis;
    }

    function waiting() {
      return H.state.patients.filter(function (p) { return p.status === 'waiting'; }).sort(H.util.esiArrivalCompare);
    }
    function byStatus(st) {
      return H.state.patients.filter(function (p) { return p.status === st; }).sort(H.util.esiArrivalCompare);
    }
    function waitMin(p) { return Math.max(0, Math.round(H.util.minutesBetween(p.arrival_time, H.util.now()))); }

    /* Consult preference (virtual vs in person). Kept so other tabs that read it still work; this tab no longer shows it. */
    (function seedConsultPrefs() {
      H.state.patients.forEach(function (p) {
        if (p.status !== 'waiting' || p.esi < 4 || p.consult_pref) return;
        var n = parseInt(String(p.id).replace(/\D/g, ''), 10) || 0, r = n % 10;
        if (r <= 2) { p.consult_pref = 'virtual'; p.consult_pref_source = 'synthetic'; }
        else if (r <= 6) { p.consult_pref = 'in_person'; p.consult_pref_source = 'synthetic'; }
      });
    })();

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

    /* A suggestion row: Accept, Override / Decline, Why. A pending video offer says so, and Accept then means "patient accepted the video consult". */
    function rowHtml(p, s) {
      var id = esc(p.id), thr = H.state.settings.fasttrackThreshold, isOffer = !!offered[p.id];
      var info = '<div class="ft-who"><strong class="ft-id">' + id + '</strong> <span class="badge esi-' + p.esi + '">ESI ' + p.esi + '</span></div>' +
        '<div class="ft-what"><div class="ft-complaint">' + esc(cap(p.chief_complaint)) + '</div>' +
        '<div class="muted">' + p.age + ' y · waiting ' + waitMin(p) + ' min' +
        (isOffer ? ' <span class="pill info ft-pend">Video consult offered · waiting for the patient\'s reply</span>' : '') + '</div></div>';
      var score = '', more = '';
      if (s) {
        var v = pct(s.probability), t = pct(thr);
        score = '<div class="ft-num ' + (s.eligible ? 'above' : 'below') + '">' + v + '%</div><div class="ft-numlbl">chance of a quick case</div>' +
          '<div class="ft-meter" role="img" aria-label="Score ' + v + ' percent; cutoff ' + t + ' percent"><span class="ft-fill ' + (s.eligible ? 'above' : 'below') + '" style="width:' + v + '%"></span>' +
          '<span class="ft-tick" style="left:' + t + '%" title="Cutoff ' + t + '%"></span></div>';
      } else {
        score = '<span class="muted">AI offline: see manual criteria</span>';
      }
      more = '<button class="btn btn-ghost btn-sm" data-act="decline" data-id="' + id + '">Override / Decline</button>';
      if (s) more += '<button class="btn btn-ghost btn-sm" data-act="why" data-id="' + id + '" aria-expanded="' + !!openWhy[p.id] + '">' + (openWhy[p.id] ? 'Hide why' : 'Why?') + '</button>';
      var html = '<div class="ft-row" id="ftrow-' + id + '"><div class="ft-info">' + info + '</div><div class="ft-score">' + score + '</div>' +
        '<div class="ft-actions">' + (isOffer ? '' : '<button class="btn btn-sm btn-primary" data-act="accept" data-id="' + id + '">Accept</button>') + '<div class="ft-more">' + more + '</div></div>';
      if (s && openWhy[p.id]) html += '<div class="ft-extra">' + barsHtml(s.contributions) + '</div>';
      if (pending && pending.id === p.id) html += '<div class="ft-extra">' + reasonForm(p) + '</div>';
      return html + '</div>';
    }

    function reasonForm(p) {
      return '<form class="card" data-form="reason" aria-label="Override reason"><h3>Decline the AI suggestion for ' + esc(p.id) + '</h3>' +
        '<div class="row"><label for="rs-' + esc(p.id) + '">Reason (required)</label><select id="rs-' + esc(p.id) + '" name="reason" required>' +
        '<option value="">Choose a reason…</option>' + REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><label for="rt-' + esc(p.id) + '">Details</label><input id="rt-' + esc(p.id) + '" name="text" size="40" placeholder="Short note"></div>' +
        '<p class="muted">This is logged. The patient does not move until you confirm.</p>' +
        '<div class="row"><button class="btn btn-primary btn-sm" type="submit">Confirm and log</button> <button class="btn btn-sm" type="button" data-act="cancel">Cancel</button></div>' +
        '<p class="banner-warning" data-err hidden>Please choose a reason (and add details if you chose "Other").</p></form>';
    }

    function section(key, title, count, body) {
      return '<details class="sg-sec" data-sg="' + key + '"' + (secOpen[key] === false ? '' : ' open') + '><summary><span class="sg-h">' + title +
        '</span><span class="sg-count">' + count + '</span></summary>' + body + '</details>';
    }
    function queueRow(p, meta, btn) {
      return '<div class="sg-row"><div class="sg-who"><strong class="ft-id">' + esc(p.id) + '</strong> <span class="badge esi-' + p.esi + '">ESI ' + p.esi + '</span></div>' +
        '<div class="sg-what"><div class="ft-complaint">' + esc(cap(p.chief_complaint)) + '</div><div class="muted">' + meta + '</div></div>' +
        '<div class="sg-act">' + (btn || '') + '</div></div>';
    }

    function manualHtml() {
      return '<div class="card"><h2>Manual fast-track criteria</h2><p>AI is offline, so scores are hidden. Use these criteria; a nurse decides.</p><ul>' +
        FT.manualCriteria.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }

    /* Suggestions: only patients who could join fast-track (score at or above the cutoff), longest wait first. ESI 1-2 never appear.
     * With AI offline there are no scores, so waiting ESI 4-5 patients are listed for a nurse to judge against the manual criteria. */
    function rankCandidates(all) {
      var cand = all.filter(function (p) { return p.esi >= 3; });
      var sc = {};
      cand.forEach(function (p) { sc[p.id] = FT.score(p); });
      cand = cand.filter(function (p) { return sc[p.id].eligible && !declined[p.id]; });
      cand.sort(function (a, b) { return waitMin(b) - waitMin(a); });
      return { list: cand, scores: sc };
    }

    function modalHtml(waitingN, pendList) {
      var thr = H.state.settings.videoPct, can = role !== 'nurse', t = H.state.settings.fasttrackThreshold;
      return '<div class="ft-modal" id="ft-modal"' + (gearOpen ? '' : ' hidden') + '><div class="ft-dialog" id="ft-dlg" role="dialog" aria-modal="true" aria-labelledby="ft-dlg-t" tabindex="-1">' +
        '<div class="ft-dlg-head"><h2 id="ft-dlg-t" style="margin:0">Fast-track settings</h2>' +
        '<button type="button" class="btn btn-sm" data-act="gear-close" id="ft-dlg-x" aria-label="Close settings">✕</button></div>' +
        '<h3>Virtual consultation</h3>' +
        '<label for="ft-vthr">Offer a video consult when waiting patients are above <strong id="ft-vthr-val">' + thr + '%</strong> of ED rooms</label>' +
        '<input id="ft-vthr" type="range" min="0" max="200" step="5" value="' + thr + '">' +
        '<p class="muted" id="ft-vthr-now">Now: ' + waitingN + ' waiting = ' + loadPct(waitingN) + '% of ' + roomsTotal() + ' rooms. Above the threshold, a patient a nurse accepts into fast-track is offered a video consult and shows as pending under Suggestions until a virtual physician accepts them.</p>' +
        (pendList && pendList.length ? '<h3>Demo: patient replies</h3><p class="muted">Patients reply from their own device. Until that is connected, record a reply here.</p>' +
          pendList.map(function (p) {
            return '<div class="row" style="margin:.3rem 0"><strong>' + esc(p.id) + '</strong><span class="muted" style="flex:1">' + esc(cap(p.chief_complaint)) + '</span>' +
              '<button type="button" class="btn btn-sm" data-act="reply-video" data-id="' + esc(p.id) + '">Chose video</button>' +
              '<button type="button" class="btn btn-sm" data-act="reply-person" data-id="' + esc(p.id) + '">Chose in person</button></div>';
          }).join('') : '') +
        '<h3>Fast-track cutoff</h3>' +
        '<div class="row"><label for="ft-role">Demo role</label><select id="ft-role">' +
        ['nurse', 'nurse-lead', 'admin'].map(function (r) { return '<option' + (r === role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><label for="ft-thr">Cutoff: <span id="ft-thr-val">' + pct(t) + '%</span></label>' +
        '<input id="ft-thr" type="range" min="50" max="99" step="1" value="' + pct(t) + '"' + (can ? '' : ' disabled') + ' style="min-width:12rem"></div>' +
        '<p class="muted">Lower cutoff = more patients, higher send-back risk. Only a lead or admin can change it.</p>' +
        '<p><button type="button" class="btn btn-ghost btn-sm" data-goto="results">Model accuracy and fairness: see Results tab</button></p>' +
        '</div></div>';
    }

    function render() {
      var focusId = el.contains(document.activeElement) ? document.activeElement.id : '';
      var offline = H.state.aiOffline || !model, all = waiting(), thr = H.state.settings.videoPct;
      var inPerson = byStatus('fast-track'), virtual = byStatus('virtual-consult'), c = FT.roomCounts();
      var cand = [], sc = {};
      if (offline) cand = all.filter(function (p) { return p.esi >= 4 && !declined[p.id]; });
      else { var r = rankCandidates(all); cand = r.list; sc = r.scores; }

      /* patients with a pending video offer stay listed until they choose, even if their score later drops */
      var over = !offline && loadPct(all.length) > thr, ids = {};
      cand.forEach(function (p) { ids[p.id] = true; });
      all.forEach(function (p) { if (offered[p.id] && !ids[p.id]) { cand.push(p); ids[p.id] = true; } });
      Object.keys(offered).forEach(function (k) { if (!ids[k]) delete offered[k]; });
      cand.sort(function (a, b) { return ((offered[b.id] ? 1 : 0) - (offered[a.id] ? 1 : 0)) || (waitMin(b) - waitMin(a)); });

      var keepId = pending ? pending.id : null;
      var ipBody = inPerson.length ? shown('ip', inPerson).map(function (p) { return queueRow(p, esc(p.age) + 'y ' + esc(p.sex) + ' · waiting ' + waitMin(p) + ' min'); }).join('') + moreBtn('ip', inPerson.length)
        : '<p class="muted">Nobody in the in-person queue.</p>';
      var vq = virtual.filter(function (p) { return !p.virtual_physician; });   // accepted patients live under their physician on the right
      var vBody = vq.length ? shown('vq', vq).map(function (p) {
        var m = p.video_offered_at ? Math.round(H.util.minutesBetween(p.video_offered_at, H.util.now())) : null;
        return queueRow(p, esc(p.age) + 'y ' + esc(p.sex) + ' · ' + (m === null ? '' : (m < 1 ? 'chose video just now · ' : 'chose video ' + m + ' min ago · ')) + 'waiting ' + waitMin(p) + ' min');
      }).join('') + moreBtn('vq', vq.length) : '<p class="muted">Nobody is waiting for a physician. Accepted patients are listed under their physician.</p>';
      var sBody = (over ? '<p class="muted" role="status">' + all.length + ' waiting = ' + loadPct(all.length) + '% of rooms (threshold ' + thr + '%): a patient you accept is offered a video consult and stays pending until they reply.</p>' : '') +
        (cand.length ? shown('sg', cand, keepId).map(function (p) { return rowHtml(p, offline ? null : sc[p.id]); }).join('') + moreBtn('sg', cand.length)
          : '<p class="muted">No one could join fast-track right now.</p>');

      var pendingList = cand.filter(function (p) { return offered[p.id]; });
      var docs = vdocs(), freeDocs = docs.filter(function (d) { return patientsOfDoc(d.id).length < MAX_VIRTUAL; });
      var vqWait = virtual.filter(function (p) { return !p.virtual_physician; }).sort(function (a, b) { return String(a.video_offered_at || '').localeCompare(String(b.video_offered_at || '')) || waitMin(b) - waitMin(a); });
      var nextP = vqWait[0];
      var availBody = freeDocs.length ? freeDocs.map(function (d) {
        var n = patientsOfDoc(d.id).length;
        return '<div class="sg-row"><div class="sg-who"><strong class="ft-id">' + esc(d.name) + '</strong><span class="pill ok">Available</span></div>' +
          '<div class="sg-what"><div class="ft-complaint">' + esc(d.focus || 'Virtual physician') + '</div><div class="muted">' + (d.years != null ? esc(d.years) + ' yrs · ' : '') + n + ' of ' + MAX_VIRTUAL + ' patients now</div></div>' +
          '<div class="sg-act"><button type="button" class="btn btn-sm btn-primary" data-act="doc-accept" data-id="' + esc(d.id) + '"' + (nextP ? '' : ' disabled') + '>' + (nextP ? 'Accept patient' : 'No patients waiting') + '</button></div></div>';
      }).join('') : '<p class="muted">No virtual physicians are available right now.</p>';
      var busy = docs.filter(function (d) { return patientsOfDoc(d.id).length; });
      var busyBody = busy.length ? busy.map(function (d) {
        var ps = patientsOfDoc(d.id), key = 'doc-' + d.id;
        return '<details class="sg-sec" data-sg="' + esc(key) + '"' + (secOpen[key] === false ? '' : ' open') + '><summary><span class="sg-h">' + esc(d.name) + '</span><span class="sg-count">' + ps.length + '</span></summary>' +
          ps.map(function (p) {
            var m = p.video_accepted_at ? Math.round(H.util.minutesBetween(p.video_accepted_at, H.util.now())) : null;
            return queueRow(p, esc(p.age) + 'y ' + esc(p.sex) + ' · ' + (m === null ? '' : (m < 1 ? 'accepted just now · ' : 'accepted ' + m + ' min ago · ')) + 'waiting ' + waitMin(p) + ' min',
              '<button type="button" class="btn btn-sm" data-act="doc-complete" data-id="' + esc(p.id) + '" aria-label="Mark ' + esc(p.id) + ' consult complete">Complete</button>');
          }).join('') + '</details>';
      }).join('') : '<p class="muted">No physician has accepted a virtual patient yet.</p>';

      el.innerHTML = (H.state.aiOffline ? manualHtml() : '') +
        '<div class="ft-split"><div>' +
        '<div class="card ft-linecard"><button type="button" class="btn btn-sm ft-gear" id="ft-gear" data-act="gear-open" aria-label="Fast-track settings" title="Fast-track settings" aria-haspopup="dialog">' + GEAR_SVG + '</button>' +
        '<h2>Fast-track line</h2><p class="muted">' + inPerson.length + ' in person · ' + virtual.length + ' in video consults · ' + all.length + ' waiting · ' + c.open + ' of ' + c.total + ' fast-track rooms open</p>' +
        (flash ? '<p class="banner-warning" role="status">' + esc(flash) + '</p>' : '') +
        section('ip', 'In-person queue', inPerson.length, ipBody) +
        section('vq', 'Virtual queue', vq.length, vBody) +
        section('sg', 'Suggestions', cand.length, sBody) + '</div></div>' +
        '<div><div class="card"><h2>Available virtual physicians <span class="sg-count">' + freeDocs.length + '</span></h2>' +
        '<p class="muted">' + vqWait.length + (vqWait.length === 1 ? ' patient is' : ' patients are') + ' in the virtual queue waiting for a physician. A physician leaves this list at ' + MAX_VIRTUAL + ' patients and returns when a consult is completed.</p>' + availBody + '</div>' +
        '<div class="card"><h2>Virtual consults in progress <span class="sg-count">' + virtual.length + '</span></h2>' + busyBody + '</div></div></div>' +
        modalHtml(all.length, pendingList);
      if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) f.focus(); }
    }

    function decline(id, reason) {
      var p = H.getPatient(id), s = H.state.aiOffline || !model ? null : FT.score(p);
      var sug = s ? 'Fast-track (' + pct(s.probability) + '%)' + (offered[id] ? '; video consult offered' : '') : 'AI offline (no suggestion)';
      H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: sug, nurse_decision: 'Keep in main queue', reason: reason });
      delete offered[id]; declined[id] = true;
      flash = id + ': kept in main queue. Override logged.';
    }
    /* Nurse accepts a suggestion. Over the waiting-queue limit: offer a video consult first (pending). Otherwise: in-person queue. */
    function accept(id) {
      var p = H.getPatient(id), s = H.state.aiOffline || !model ? null : FT.score(p), sug = s ? 'Fast-track (' + pct(s.probability) + '%)' : 'AI offline (manual)';
      var n = waiting().length, lim = H.state.settings.videoPct, now = loadPct(n);
      if (!H.state.aiOffline && now > lim) {
        /* Offer a video or in-person consult; the patient stays in Suggestions as pending until they reply (demo: reply is recorded in the gear popup). */
        offered[id] = H.util.now().toISOString();
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: sug, nurse_decision: 'Accepted fast-track; video consult offered',
          reason: 'Accepted AI suggestion; ' + n + ' waiting = ' + now + '% of rooms (threshold ' + lim + '%)' });
        flash = id + ': accepted. ' + n + ' waiting = ' + now + '% of rooms (threshold ' + lim + '%), so a video consult is offered. Pending the patient\'s reply.';
      } else {
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: sug, nurse_decision: 'Accepted fast-track', reason: s ? 'Accepted AI suggestion' : 'Manual decision (AI offline)' });
        H.updatePatient(id, { status: 'fast-track' }, 'fasttrack');
        flash = id + ': moved to the in-person queue.';
      }
    }
    /* The patient answers the offer (from their own device in production). Video: they join the Virtual queue to wait for a physician. In person: in-person queue. */
    function patientReply(id, choice) {
      var p = H.getPatient(id);
      if (!p || p.status !== 'waiting' || !offered[id]) return;
      delete offered[id];
      if (choice === 'video') {
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: 'Video consult offered', nurse_decision: 'Offered video consult',
          reason: 'Waiting queue above the virtual-consultation threshold; patient accepted a video consult' });
        H.updatePatient(id, { status: 'virtual-consult', video_offered_at: H.util.now().toISOString() }, 'fasttrack');
        flash = id + ': chose video and joined the virtual queue.';
      } else {
        H.logOverride({ module: 'fasttrack', patient_id: id, ai_suggestion: 'Video consult offered', nurse_decision: 'Accepted fast-track', reason: 'Patient chose to be seen in person' });
        H.updatePatient(id, { status: 'fast-track' }, 'fasttrack');
        flash = id + ': chose in person and moved to the in-person queue.';
      }
    }
    /* A virtual physician accepts the longest-waiting patient in the Virtual queue. */
    function docAccept(docId) {
      var d = vdocs().filter(function (x) { return x.id === docId; })[0];
      var list = byStatus('virtual-consult').filter(function (p) { return !p.virtual_physician; })
        .sort(function (a, b) { return String(a.video_offered_at || '').localeCompare(String(b.video_offered_at || '')) || waitMin(b) - waitMin(a); });
      if (!d || !list.length || patientsOfDoc(docId).length >= MAX_VIRTUAL) return;
      var p = list[0];
      H.updatePatient(p.id, { virtual_physician: d.id, video_accepted_at: H.util.now().toISOString() }, 'fasttrack');
      flash = p.id + ': accepted by ' + d.name + '.';
    }

    /* The physician finishes a consult: the patient leaves the virtual queue and the physician has a free slot again. */
    function docComplete(id) {
      var p = H.getPatient(id), d = p && vdocs().filter(function (x) { return x.id === p.virtual_physician; })[0];
      if (!p || p.status !== 'virtual-consult') return;
      H.updatePatient(id, { status: 'completed', virtual_physician: null, video_completed_at: H.util.now().toISOString() }, 'fasttrack');
      flash = id + ': video consult completed' + (d ? '. ' + d.name + ' is available again.' : '.');
    }

    function closeGear() {
      if (!gearOpen) return;
      gearOpen = false; render();
      var g = document.getElementById('ft-gear'); if (g) g.focus();
    }
    function openGear() {
      gearOpen = true; render();
      var s = document.getElementById('ft-vthr'); if (s) s.focus();
    }
    document.addEventListener('keydown', function (e) {
      if (!gearOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); closeGear(); return; }
      if (e.key !== 'Tab') return;
      var dlg = el.querySelector('#ft-dlg'), f = dlg ? dlg.querySelectorAll('button, input:not([disabled]), select') : [];
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    el.addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (g) { var tb = document.getElementById('tab-' + g.getAttribute('data-goto')); if (gearOpen) { gearOpen = false; render(); } if (tb) tb.click(); return; }
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'gear-open') { openGear(); return; }
      if (act === 'gear-close') { closeGear(); return; }
      if (act === 'toggle-group') { var k = b.getAttribute('data-key'); expanded[k] = !expanded[k]; }
      else if (act === 'why') openWhy[id] = !openWhy[id];
      else if (act === 'accept') accept(id);
      else if (act === 'doc-accept') docAccept(id);
      else if (act === 'reply-video') patientReply(id, 'video');
      else if (act === 'reply-person') patientReply(id, 'in_person');
      else if (act === 'doc-complete') docComplete(id);
      else if (act === 'decline') { pending = { id: id, kind: 'decline' }; flash = ''; }
      else if (act === 'cancel') pending = null;
      render();
    });
    el.addEventListener('mousedown', function (e) { if (e.target && e.target.id === 'ft-modal') closeGear(); });
    el.addEventListener('toggle', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-sg');
      if (k) secOpen[k] = e.target.open;
    }, true);
    el.addEventListener('submit', function (e) {
      if (e.target.getAttribute('data-form') !== 'reason') return;
      e.preventDefault();
      var f = e.target, reason = f.elements.reason.value, text = f.elements.text.value.trim();
      if (!reason || (reason.indexOf('Other') === 0 && !text)) { f.querySelector('[data-err]').hidden = false; return; }
      var id = pending.id;
      pending = null;
      decline(id, reason + (text ? ': ' + text : ''));
      render();
    });
    el.addEventListener('input', function (e) {
      if (e.target.id === 'ft-vthr') {
        var n = Number(e.target.value);
        H.state.settings.videoPct = n;
        var l = el.querySelector('#ft-vthr-val'); if (l) l.textContent = n + '%';
        return;
      }
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
      else if (e.target.id === 'ft-vthr') { H.emit('settings', { key: 'videoPct', value: H.state.settings.videoPct }); render(); }
    });

    H.on('patient:updated', function (d) { if (!d || d.source !== 'fasttrack') render(); });
    H.on('consult:response', function (d) { if (d && d.patient_id) { patientReply(d.patient_id, d.choice === 'video' ? 'video' : 'in_person'); render(); } });
    H.on('aiOffline', render);
    H.on('settings', function () { if (document.activeElement && (document.activeElement.id === 'ft-thr' || document.activeElement.id === 'ft-vthr') && el.contains(document.activeElement)) return; render(); });
    H.on('override', function () { /* log only */ });
    render();
  }

  H.registerModule('fasttrack', { mount: mount });
})();