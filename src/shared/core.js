/* Halvian shared core. Classic script (no modules, no fetch) so index.html works from file://.
 * Everything hangs off window.Halvian. SYNTHETIC DATA ONLY.
 *
 * Public API:
 *   Halvian.state            { patients, rooms, overrides, symptomUpdates, settings, aiOffline, activeTab }
 *   Halvian.on(evt, fn)      -> returns an unsubscribe function
 *   Halvian.off(evt, fn)
 *   Halvian.emit(evt, payload)
 *   Halvian.util.{now, minutesBetween, fmtTime, iso, esc, clone, esiArrivalCompare}
 *   Halvian.logOverride({module, patient_id, ai_suggestion, nurse_decision, reason, nurse})
 *   Halvian.registerModule(name, {mount(containerEl)})   names: ranking | fasttrack | capacity | results
 *   Halvian.getPatient(id), Halvian.updatePatient(id, changes, source)
 *   Halvian.setAiOffline(bool)
 *   Halvian.logSymptomUpdate({patient_id, symptoms[], pain, duration, red_flag, [free_text, ai_summary, ai_source, red_flag_reason]})  / canSubmitSymptomUpdate(id)
 *   Halvian.fastTrack.{score(patient), featurize(patient), model}
 * Events: 'ready', 'override', 'aiOffline', 'patient:updated', 'symptomUpdate', 'settings', 'tab'
 */
(function () {
  'use strict';
  var H = (window.Halvian = window.Halvian || {});
  H.data = H.data || {};

  var DEMO_NOW = '2026-11-23T10:30:00';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- event bus ---------- */
  var listeners = {};
  H.on = function (evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return function () { H.off(evt, fn); };
  };
  H.off = function (evt, fn) {
    listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
  };
  H.emit = function (evt, payload) {
    (listeners[evt] || []).slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { if (window.console) console.error('Halvian listener for "' + evt + '" failed', e); }
    });
  };

  /* ---------- helpers ---------- */
  function toDate(x) { return x instanceof Date ? x : new Date(x); }
  H.util = {
    clone: clone,
    /** Fixed demo "now" (Mon 2026-11-23 10:30 local) as a Date. Always use this, never new Date(). */
    now: function () { return new Date(DEMO_NOW); },
    /** Minutes from a to b (ISO strings or Dates). Positive if b is later. Not rounded. */
    minutesBetween: function (a, b) { return (toDate(b) - toDate(a)) / 60000; },
    /** "10:30" style 24h time (ISO string or Date). */
    fmtTime: function (x) {
      var d = toDate(x);
      return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    },
    /** Local ISO string without timezone, "YYYY-MM-DDTHH:MM:SS" (matches the data files). */
    iso: function (x) {
      var d = toDate(x), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    },
    /** HTML-escape for safe innerHTML building. */
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    /** Comparator: ESI ascending, then earlier arrival first. This is the "AI offline" fallback order. */
    esiArrivalCompare: function (a, b) {
      return (a.esi - b.esi) || (toDate(a.arrival_time) - toDate(b.arrival_time));
    }
  };
  H.now = H.util.now;

  /* ---------- state ---------- */
  var model = H.data.fasttrackModel || null;
  H.state = {
    patients: clone(H.data.patients || []),
    rooms: clone(H.data.rooms || []),
    overrides: [],
    symptomUpdates: [],
    aiOffline: false,
    activeTab: 'queue',
    settings: {
      nurse: 'RN (demo)',
      fasttrackThreshold: model ? model.threshold : 0.85,
      symptomUpdateMinIntervalMin: 30
    }
  };

  H.getPatient = function (id) {
    for (var i = 0; i < H.state.patients.length; i++) if (H.state.patients[i].id === id) return H.state.patients[i];
    return null;
  };
  /** Apply changes (shallow merge) to a patient and notify. A nurse must have confirmed the change upstream. */
  H.updatePatient = function (id, changes, source) {
    var p = H.getPatient(id);
    if (!p) return null;
    Object.keys(changes || {}).forEach(function (k) { p[k] = changes[k]; });
    H.emit('patient:updated', { patient: p, changes: changes, source: source || null });
    return p;
  };
  H.setAiOffline = function (on) {
    H.state.aiOffline = !!on;
    H.emit('aiOffline', H.state.aiOffline);
  };

  /** Append to the override log. Every AI suggestion a nurse rejects (or accepts) is logged with a reason. */
  H.logOverride = function (o) {
    var entry = {
      time: DEMO_NOW,
      module: o.module || null,
      patient_id: o.patient_id || null,
      ai_suggestion: o.ai_suggestion,
      nurse_decision: o.nurse_decision,
      reason: o.reason || '',
      nurse: o.nurse || H.state.settings.nurse
    };
    H.state.overrides.push(entry);
    H.emit('override', entry);
    return entry;
  };

  /** Symptom update safeguard: at most one every 30 minutes per patient. */
  H.canSubmitSymptomUpdate = function (patientId) {
    var p = H.getPatient(patientId);
    if (!p) return { ok: false, minutesUntil: 0 };
    var min = H.state.settings.symptomUpdateMinIntervalMin;
    var last = null;
    (p.symptom_updates || []).forEach(function (u) { if (!last || new Date(u.time) > new Date(last)) last = u.time; });
    if (!last) return { ok: true, minutesUntil: 0 };
    var since = H.util.minutesBetween(last, H.util.now());
    return since >= min ? { ok: true, minutesUntil: 0 } : { ok: false, minutesUntil: Math.ceil(min - since) };
  };
  /** Record a patient-submitted update (unconfirmed: confirmed_by null; scoring must wait for a nurse). */
  H.logSymptomUpdate = function (u) {
    var p = H.getPatient(u.patient_id);
    if (!p) return null;
    var gate = H.canSubmitSymptomUpdate(u.patient_id);
    if (!gate.ok) return { error: 'rate_limited', minutesUntil: gate.minutesUntil };
    var entry = {
      time: DEMO_NOW, symptoms: u.symptoms || [], pain: u.pain == null ? null : u.pain,
      duration: u.duration || '', confirmed_by: null, red_flag: !!u.red_flag
    };
    // Optional fields from the own-words box (sorted by the AI (Gemini), or by the labelled keyword fallback).
    ['free_text', 'ai_summary', 'ai_source', 'red_flag_reason'].forEach(function (k) { if (u[k]) entry[k] = u[k]; });
    if (entry.red_flag) entry.nurse_paged = true;
    p.symptom_updates.push(entry);
    H.state.symptomUpdates.push({ patient_id: p.id, entry: entry });
    H.emit('symptomUpdate', { patient_id: p.id, entry: entry });
    H.emit('patient:updated', { patient: p, changes: { symptom_updates: p.symptom_updates }, source: 'symptomUpdate' });
    return entry;
  };

  /* ---------- fast-track scoring (shared, so any tab can show eligibility) ---------- */
  var FT = (H.fastTrack = H.fastTrack || {});
  FT.model = model;
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  /** Binary feature flags, mirrors featurize() in scripts/train_fasttrack.py. Returns {featureName: 0|1}. */
  FT.featurize = function (p) {
    var v = p.vitals || {};
    var cat = (model && model.complaint_categories[p.chief_complaint]) || 'other';
    var x = {
      esi_2: p.esi === 2, esi_3: p.esi === 3, esi_4: p.esi === 4, esi_5: p.esi === 5,
      hr_abnormal: v.hr > 100 || v.hr < 50, sbp_abnormal: v.sbp < 100 || v.sbp > 180,
      rr_abnormal: v.rr > 22 || v.rr < 10, spo2_low: v.spo2 < 94, fever: v.temp_c >= 38.0,
      pain_severe: p.pain >= 8, age_0_4: p.age < 5, age_65_74: p.age >= 65 && p.age < 75,
      age_75_plus: p.age >= 75, arrival_ambulance: p.arrival_mode === 'ambulance',
      arrival_transfer: p.arrival_mode === 'transfer'
    };
    ['chest_cardiac', 'respiratory', 'neuro', 'abdominal', 'trauma_major', 'injury_minor',
      'infection_minor', 'skin', 'behavioral', 'obstetric'].forEach(function (c) { x['cat_' + c] = cat === c; });
    Object.keys(x).forEach(function (k) { x[k] = x[k] ? 1 : 0; });
    return x;
  };
  /**
   * Score a patient. Insurance is never read. Advisory only: a nurse accepts or overrides.
   * Returns {probability, eligible, threshold, contributions:[{feature,label,value}]} where value is the
   * log-odds contribution (weight * flag), sorted by |value| descending, zero contributions omitted.
   * ESI 1-2 are never eligible regardless of score.
   */
  FT.score = function (p) {
    if (!model) return { probability: 0, eligible: false, threshold: 1, contributions: [] };
    var x = FT.featurize(p), z = model.bias, contribs = [];
    model.features.forEach(function (f, i) {
      var c = model.weights[i] * x[f];
      if (x[f]) { z += c; contribs.push({ feature: f, label: model.labels[f] || f, value: c }); }
    });
    contribs.sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    var prob = sigmoid(z), thr = H.state.settings.fasttrackThreshold;
    return { probability: prob, eligible: prob >= thr && p.esi >= (model.min_esi_for_fast_track || 3),
      threshold: thr, bias: model.bias, contributions: contribs };
  };

  /* ---------- module registry + tabs ---------- */
  var TAB_MODULE = { queue: 'ranking', fasttrack: 'fasttrack', capacity: 'capacity', results: 'results' };
  var modules = H.modules = H.modules || {}, mounted = {}, domReady = false;

  function containerFor(name) { return document.getElementById('mod-' + name); }
  function mountModule(name) {
    var el = containerFor(name), mod = modules[name];
    if (!el || mounted[name]) return;
    if (!mod || typeof mod.mount !== 'function') { comingSoon(el, name); return; }
    mounted[name] = true;
    el.innerHTML = '';
    try { mod.mount(el); }
    catch (e) {
      if (window.console) console.error('Module "' + name + '" failed to mount', e);
      el.innerHTML = '<div class="card"><p class="banner-warning">The "' + H.util.esc(name) +
        '" module hit an error and could not load. Other tabs still work.</p></div>';
    }
  }
  function comingSoon(el, name) {
    el.innerHTML = '<div class="card empty"><h2>Coming soon</h2><p>The ' + H.util.esc(name) + ' module is not loaded yet.</p></div>';
  }
  H.registerModule = function (name, mod) {
    modules[name] = mod;
    if (domReady) { mounted[name] = false; mountModule(name); }
  };

  function selectTab(tab) {
    H.state.activeTab = tab;
    var tabs = document.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === tab;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      var panel = document.getElementById('panel-' + tabs[i].getAttribute('data-tab'));
      if (panel) panel.hidden = !on;
    }
    H.emit('tab', tab);
  }

  function initShell() {
    domReady = true;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : -1;
        if (j >= 0) { e.preventDefault(); tabs[j].focus(); selectTab(tabs[j].getAttribute('data-tab')); }
      });
    });
    var toggle = document.getElementById('ai-offline-toggle'), banner = document.getElementById('ai-offline-banner');
    if (toggle) toggle.addEventListener('change', function () { H.setAiOffline(toggle.checked); });
    H.on('aiOffline', function (on) {
      if (banner) banner.hidden = !on;
      if (toggle) toggle.checked = on;
    });
    var clock = document.getElementById('demo-clock');
    if (clock) clock.textContent = 'Demo time: Mon 23 Nov 2026, ' + H.util.fmtTime(H.util.now());
    Object.keys(TAB_MODULE).forEach(function (t) { mountModule(TAB_MODULE[t]); });
    selectTab('queue');
    H.emit('ready', null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShell);
  else initShell();
})();
