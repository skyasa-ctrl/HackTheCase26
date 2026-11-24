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
    { key: 'wait', label: 'Waiting past target', desc: 'Points for every 10 min past the acuity’s target wait.', def: 1, max: 3, step: 0.25, unit: 'pts per 10 min over the ESI target' },
    { key: 'starve', label: 'Waited longer than similar patients', desc: 'One-time boost if waiting longer than others at the same acuity.', def: 5, max: 15, step: 1, unit: 'pts once wait exceeds the ESI-level average' },
    { key: 'vitals', label: 'Abnormal vital signs', desc: 'Points for each vital sign outside the normal range.', def: 4, max: 10, step: 0.5, unit: 'pts per abnormal vital sign' },
    { key: 'recheck', label: 'Overdue re-check', desc: 'Points for every 15 min after 60 min without a re-check.', def: 1, max: 4, step: 0.25, unit: 'pts per 15 min past ' + RECHECK_AFTER + ' min since last re-check' },
    { key: 'concern', label: 'Nurse concern', desc: 'Points when a nurse flags ‘I’m worried about this patient.’', def: 10, max: 30, step: 1, unit: 'pts when the nurse flag is set' },
    { key: 'symSevere', label: 'Symptom update: severe', desc: 'Red-flag symptoms a nurse has assessed, if the patient stays in the waiting room.', def: 12, max: 30, step: 1, unit: 'pts for a severe, nurse-assessed update' },
    { key: 'symptom', label: 'Symptom update: moderate', desc: 'Nausea or vomiting, dizziness, fever, worsening pain, headache.', def: 6, max: 20, step: 1, unit: 'pts for a moderate, nurse-confirmed update' },
    { key: 'symMild', label: 'Symptom update: mild', desc: 'Minor injury, skin problem, minor infection, or something else.', def: 2, max: 10, step: 0.5, unit: 'pts for a mild, nurse-confirmed update' },
    { key: 'painCap', label: 'Pain-only limit', desc: 'Most points a pain-only update can add.', def: 3, max: 10, step: 0.5, unit: 'maximum pts when an update is pain-only' }
  ];
  var WGROUPS = [
    { title: 'Waiting time', keys: ['wait', 'starve', 'recheck'] },
    { title: 'Patient condition', keys: ['vitals', 'concern'] },
    { title: 'New symptoms reported', keys: ['symSevere', 'symptom', 'symMild', 'painCap'] }
  ];
  var SHORT = { symSevere: 'Severe', symptom: 'Moderate', symMild: 'Mild', painCap: 'Pain only (max)' };
  var TIPS = {
    wait: "Target waits: ESI 2: 10 min, ESI 3: 30, ESI 4: 60, ESI 5: 120. Example: ESI 4 waiting 90 min = 30 min over = 3 points at the default.",
    starve: "Applies when someone has waited longer than the current average for patients at the same acuity, so nobody keeps getting passed over.",
    vitals: "Outside normal at the last check: heart rate under 50 or over 100, systolic BP under 100 or over 180, breathing rate under 10 or over 22, SpO2 under 94%, temperature 38.0 °C or higher. Example: HR 112 and SpO2 92% = 2 abnormal = 8 points at the default.",
    recheck: "Example: last re-checked 90 min ago = 30 min overdue = 2 points at the default.",
    concern: "Any nurse can set the flag. Your clinical gut feeling counts.",
    symSevere: "Chest pain, trouble breathing, fainting, new confusion, severe bleeding or stroke signs. These page a nurse immediately and bypass scoring; once the nurse has assessed the patient, if they stay in the waiting room these points keep them near the top of their acuity level.",
    symptom: "The patient reports new symptoms through the SMS link (or a nurse logs them on rounds) and a nurse confirms them. Unconfirmed updates add nothing. If several symptoms are reported, the most severe one counts.",
    symMild: "Small changes that rarely mean deterioration. Kept low so they don't push sicker patients down.",
    painCap: "Pain matters, but pain alone shouldn’t jump the queue; reassess the patient instead."
  };
  function pts(v) { return v + (v === 1 ? ' pt' : ' pts'); }
  var FMT = {
    wait: function (v) { return pts(v) + ' / 10 min'; }, starve: function (v) { return '+' + pts(v); },
    vitals: function (v) { return pts(v) + ' each'; }, recheck: function (v) { return pts(v) + ' / 15 min'; },
    concern: function (v) { return '+' + pts(v); }, symptom: function (v) { return '+' + pts(v); },
    symSevere: function (v) { return '+' + pts(v); }, symMild: function (v) { return '+' + pts(v); },
    painCap: function (v) { return 'max ' + pts(v); }
  };
  var BAR_SCALE = 25;                                         // points that fill a bar

  var weights = {}, savedWeights = {}, lastWeightChange = null;
  COMPONENTS.forEach(function (c) { weights[c.key] = c.def; savedWeights[c.key] = c.def; });

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
  /* Latest update that counts: nurse-confirmed non-red-flag updates, or red-flag updates a nurse has
   * already assessed (unassessed red flags never score: they page a nurse instead). */
  function confirmedUpdate(p) {
    var best = null;
    (p.symptom_updates || []).forEach(function (u) {
      var counts = (u.confirmed_by && !u.red_flag) || (u.red_flag && u.red_flag_assessed);
      if (counts && (!best || new Date(u.time) > new Date(best.time))) best = u;
    });
    return best;
  }
  /* Symptom severity tier for an update; the most severe symptom wins. Patient-view checkboxes and AI categories both map here. */
  var SEVERE_RE = /chest|breath|faint|confusion|bleeding|stroke|serious injury|neurological/i;
  var MILD_RE = /something else|minor injury|minor infection|skin|other symptoms/i;
  function severity(u) {
    var syms = u.symptoms || [];
    if (u.red_flag || syms.some(function (x) { return SEVERE_RE.test(x); })) return 'severe';
    if (syms.length && syms.every(function (x) { return MILD_RE.test(x); })) return 'mild';
    return 'moderate';
  }
  var SEV_KEY = { severe: 'symSevere', moderate: 'symptom', mild: 'symMild' };
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
      var sev = painOnly ? null : severity(cu);
      pts = painOnly ? Math.min((cu.pain || 0) / 2, weights.painCap) : weights[SEV_KEY[sev]];
      parts.push({ key: 'symptom', label: 'Confirmed symptom update' + (sev ? ' (' + sev + ')' : ''), pts: Math.min(pts, painOnly ? weights.painCap : 1e9),
        reason: painOnly ? 'Confirmed pain-only update (pain ' + cu.pain + '/10), capped at ' + weights.painCap + ' pts'
          : (cu.red_flag ? 'Red-flag update already assessed by a nurse' : 'Nurse-confirmed update') + ', ' + sev + ' tier: ' + cu.symptoms.join(', ') });
    } else {
      parts.push({ key: 'symptom', label: 'Confirmed symptom update', pts: 0,
        reason: pendingUpdates(p).length ? 'Update pending nurse review, so no points yet' : 'No confirmed symptom update' });
    }
    var total = 0;
    parts.forEach(function (x) { x.pts = r1(x.pts); total += x.pts; });
    return { total: r1(total), parts: parts };
  }

  /* ---------- ranking ---------- */
  /** Returns {ranked:[{p,s,rank,key}]}. Order is ESI first, always; score only reorders inside an ESI group. */
  function computeQueue() {
    var waiting = H.state.patients.filter(function (p) { return p.status === 'waiting'; });
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
    return { ranked: rows, avgs: avgs };
  }

  /* ---------- rendering ---------- */
  var STYLE_ID = 'ranking-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.rk-row{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);margin:.4rem 0;padding:.6rem .8rem;scroll-margin-top:9rem}' +
      '.rk-row.rk-flash{animation:rkflash 2.8s ease-out;outline:3px solid var(--brand);outline-offset:1px}' +
      '@keyframes rkflash{0%,60%{background:#cfe6f5}100%{background:var(--surface)}}' +
      '.rk-sumbar{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 1rem;padding:0;list-style:none}' +
      '.rk-sumbar li{flex:1 1 9rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:.45rem .8rem;box-shadow:var(--shadow)}' +
      '.rk-sumbar b{display:block;font-size:1.35rem;line-height:1.2;font-variant-numeric:tabular-nums}' +
      '.rk-sumbar span{font-size:.82rem;color:var(--muted);font-weight:600}' +
      '.rk-sumbar li.hot{border-color:var(--danger);background:#fde4e4}.rk-sumbar li.hot b,.rk-sumbar li.hot span{color:#7a1a1f}' +
      '.rk-sumbar li.warm{border-color:var(--warn-line);background:var(--warn-bg)}' +
      '.rk-row.pinned{border-left:5px solid var(--brand)}' +
      '.rk-head{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .8rem}' +
      '.rk-rank{font-weight:700;font-size:1.1rem;min-width:2rem;color:var(--brand-dark)}' +
      '.rk-main{flex:1 1 14rem;min-width:12rem}.rk-score{font-weight:700;font-size:1.05rem;flex:0 0 4.5rem;text-align:right;font-variant-numeric:tabular-nums}' +
      '.rk-actions{display:flex;flex-wrap:nowrap;gap:.3rem;margin-left:auto;justify-content:flex-end}' +
      '.rk-actions .btn{min-width:2.2rem}.rk-actions [data-act=why]{min-width:8.4rem}.rk-actions [data-act=pin],.rk-actions [data-act=unpin]{min-width:6rem}' +
      '.rk-detail{margin-top:.5rem;padding-top:.5rem;border-top:1px dashed var(--line)}' +
      '.rk-detail ul{margin:.3rem 0 0 1.1rem;padding:0}' +
      '.rk-form{margin-top:.5rem;padding:.6rem;background:var(--brand-tint);border-radius:var(--radius);display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:flex-end}' +
      '.rk-form .fld{display:flex;flex-direction:column;gap:.2rem}' +
      '.rk-pending{margin-top:.5rem;padding:.5rem .6rem;background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:var(--radius)}' +
      '.rk-info{cursor:help;color:var(--brand);font-weight:700;border-radius:50%;padding:0 .2rem}' +
      '.rk-gap{background:var(--warn-bg);color:var(--warn-ink);border:1px solid var(--warn-line);border-radius:var(--radius);padding:.5rem .8rem;margin:.6rem 0;font-weight:500}' +
      '.rk-summary{cursor:pointer;font-weight:700;font-size:1.05rem}' +
      '.rk-esi-h{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .7rem;margin:1.1rem 0 .3rem;padding:.35rem .7rem;font-size:.95rem;border-radius:var(--radius);border-left:5px solid currentColor}' +
      '.rk-esi-h:first-child{margin-top:.4rem}.rk-esi-h .t{font-weight:700;color:var(--ink)}.rk-esi-h .m{color:var(--ink);font-weight:500;font-size:.88rem;margin-left:auto}' +
      '.rk-esi-h.esi-1{background:var(--esi1-bg);color:var(--esi1)}.rk-esi-h.esi-2{background:var(--esi2-bg);color:var(--esi2)}.rk-esi-h.esi-3{background:var(--esi3-bg);color:var(--esi3)}' +
      '.rk-esi-h.esi-4{background:var(--esi4-bg);color:var(--esi4)}.rk-esi-h.esi-5{background:var(--esi5-bg);color:var(--esi5)}' +
      '.rk-logbox>summary{display:flex;align-items:center;gap:.5rem}.rk-logbox[open]>summary{margin-bottom:.6rem}' +
      '.rk-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:1rem}' +
      '@media (max-width:1100px){.rk-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function skeleton(el) {
    el.innerHTML =
      '<div class="rk-wrap">' +
      '<div id="rk-alerts" role="alert" aria-live="assertive"></div>' +
      '<ul class="rk-sumbar" id="rk-sumbar" aria-label="Queue summary"></ul>' +
      '<div id="rk-leave" aria-live="polite"></div>' +
      '<div id="rk-offline"></div>' +
      '<div class="card"><details id="rk-weights-box"><summary class="rk-summary">Scoring weights<br><span class="muted" style="font-weight:500">Adjust how much each factor matters, based on your experience on the floor.</span></summary>' +
      '<div class="rk-weights" id="rk-weights"></div>' +
      '<div class="rk-wsave"><div class="rk-wreason"><label for="rk-w-reason">Why are you changing this? (optional)</label>' +
      '<input id="rk-w-reason" type="text" maxlength="200" placeholder="e.g. Nights are seeing slow re-checks"></div>' +
      '<div class="rk-wbtns"><button type="button" class="btn btn-sm btn-primary" id="rk-w-save">Save change</button>' +
      '<button type="button" class="btn btn-sm" id="rk-reset">Reset weights to defaults</button></div>' +
      '<p class="muted rk-wlast" id="rk-w-last" role="status" aria-live="polite"></p></div></details></div>' +
      '<div class="rk-grid"><div>' +
      '<div class="card"><h2>Ranked waiting list</h2><div id="rk-msg" class="sr-only" aria-live="polite"></div><div id="rk-list"></div></div>' +
      '</div><div>' +
      '<div class="card"><details class="rk-logbox" id="rk-logbox"><summary class="rk-summary">Override log <span class="pill" id="rk-log-n">0</span></summary><div id="rk-log"></div></details></div>' +
      '</div></div>' +
      '</div>';
    buildWeights();
  }

  function levelWord(c, v) { return FMT[c.key](v); }
  function buildWeights() {
    var box = root.querySelector('#rk-weights'), html = '';
    WGROUPS.forEach(function (g) {
      html += '<div class="rk-wgroup" role="group" aria-labelledby="rk-wg-' + g.keys[0] + '"><h3 class="rk-wgroup-h" id="rk-wg-' + g.keys[0] + '">' + esc(g.title) + '</h3>';
      g.keys.forEach(function (k) {
        var c = COMPONENTS.filter(function (x) { return x.key === k; })[0];
        var tip = c.desc + ' ' + TIPS[k], lbl = SHORT[k] || c.label;
        html += '<div class="rk-wrow"><span class="rk-wlabel"><label for="rk-w-' + k + '">' + esc(lbl) + '</label>' +
          '<span class="rk-info" tabindex="0" role="img" aria-label="' + esc(tip) + '" title="' + esc(tip) + '">ⓘ</span></span>' +
          '<div class="wslider"><span class="wbubble" id="rk-wb-' + k + '" aria-hidden="true"></span>' +
          '<input type="range" id="rk-w-' + k + '" data-w="' + k + '" min="0" max="' + c.max + '" step="' + c.step + '" value="' + weights[k] + '" aria-valuetext="' + esc(FMT[k](weights[k])) + '"></div>' +
          '<span class="wv" id="rk-wv-' + k + '">' + levelWord(c, weights[k]) + '</span></div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }
  function saveWeights() {
    var diffs = [], olds = [];
    COMPONENTS.forEach(function (c) {
      if (weights[c.key] !== savedWeights[c.key]) { diffs.push(c.label + ' ' + savedWeights[c.key] + ' → ' + weights[c.key]); olds.push(c.label + ' ' + savedWeights[c.key]); }
    });
    var note = root.querySelector('#rk-w-last');
    if (!diffs.length) { note.textContent = 'No weight changes to save.'; return; }
    var reasonEl = root.querySelector('#rk-w-reason'), reason = reasonEl.value.trim(), nurse = H.state.settings.nurse;
    COMPONENTS.forEach(function (c) { savedWeights[c.key] = weights[c.key]; });
    lastWeightChange = { nurse: nurse, time: U.fmtTime(U.now()), reason: reason };
    reasonEl.value = '';
    H.logOverride({ module: 'ranking', patient_id: null, ai_suggestion: 'Previous scoring weights: ' + olds.join(', '),
      nurse_decision: 'Scoring weights changed: ' + diffs.join('; '), reason: reason || 'No reason given (weights set by nurse)', nurse: nurse });
    note.textContent = 'Last changed ' + lastWeightChange.time + ' by ' + nurse;
  }

  var assessed = [], lastAlertHtml = null;
  var WARN_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M12 2.5 1.8 20.5h20.4L12 2.5z" fill="#fff" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>';
  function ago(t) {
    var m = Math.max(0, Math.round(U.minutesBetween(t, U.now())));
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min ago';
  }
  function activeFlags() {
    var out = [];
    H.state.patients.forEach(function (p) {
      (p.symptom_updates || []).forEach(function (u, i) {
        if (u.red_flag && !u.confirmed_by && !u.dismissed_by) out.push({ p: p, u: u, i: i });
      });
    });
    return out;
  }
  function whoWords(p) {
    var minor = p.age != null && p.age < 18, noun = p.sex === 'M' ? (minor ? 'boy' : 'man') : p.sex === 'F' ? (minor ? 'girl' : 'woman') : 'patient';
    return p.age != null ? esc(p.age) + '-year-old ' + noun : noun;
  }
  function flagCard(f) {
    var p = f.p, u = f.u, id = esc(p.id), syms = u.symptoms || [], h;
    h = '<article class="rk-flag" aria-label="Red flag: patient ' + id + ' needs reassessment, nurse paged">' +
      '<div class="rk-flag-icon">' + WARN_SVG + '</div><div class="rk-flag-body">' +
      '<h2 class="rk-flag-title">' + id + ' needs reassessment <span class="rk-flag-time">· ' + esc(ago(u.time)) + '</span></h2>' +
      '<p class="rk-flag-line">' + whoWords(p) + ' · ESI ' + esc(p.esi) + ' · came in for ' + esc(p.chief_complaint) + '</p>' +
      (syms.length ? '<p class="rk-flag-line">New symptoms reported: <strong>' + esc(syms.join(', ')) + '</strong></p>' : '');
    if (u.ai_summary || u.red_flag_reason) {
      h += '<p class="rk-flag-line">' + (u.ai_summary ? (u.ai_source && u.ai_source !== 'rules' ? 'AI summary (' + H.ai.sourceName(u.ai_source) + '): ' : 'Patient wrote: ') + esc(u.ai_summary.replace(/^Patient wrote: /, '')) : '') +
        (u.red_flag_reason ? ' <span class="muted">(' + esc(u.red_flag_reason) + ')</span>' : '') + '</p>';
    }
    h += '</div>' +
      '<div class="rk-flag-actions"><button type="button" class="btn btn-danger" data-act="ack" data-id="' + id + '" data-i="' + f.i + '">Mark assessed</button>' +
      '<button type="button" class="btn" data-act="show-row" data-id="' + id + '">Show in queue</button></div></article>';
    return h;
  }
  function renderAlerts() {
    var flags = activeFlags(), html = '';
    if (flags.length > 1) html += '<h2 class="rk-flag-count">' + flags.length + ' red flags</h2>';
    flags.forEach(function (f) { html += flagCard(f); });
    assessed.slice(-3).forEach(function (a) {
      html += '<p class="rk-assessed" role="status"><span aria-hidden="true">✓</span> ' + esc(a.id) + ' assessed by ' + esc(a.nurse) + ' at ' + esc(a.time) + '</p>';
    });
    if (html !== lastAlertHtml) { root.querySelector('#rk-alerts').innerHTML = html; lastAlertHtml = html; }
    return flags.length;
  }

  /* Queue and Fast-track overrides share one log (weights changes have no patient). */
  function rankingLog() { return H.state.overrides.filter(function (o) { return o.module === 'ranking' || o.module === 'fasttrack'; }); }

  function renderSummary(q, nFlags) {
    var pend = 0, ov = rankingLog().length;
    H.state.patients.forEach(function (p) { pendingUpdates(p).forEach(function (x) { if (!x.u.red_flag) pend++; }); });
    function t(n, label, cls) { return '<li' + (cls ? ' class="' + cls + '"' : '') + '><b>' + n + '</b><span>' + label + '</span></li>'; }
    root.querySelector('#rk-sumbar').innerHTML = t(q.ranked.length, 'Waiting') + t(nFlags, nFlags === 1 ? 'Red flag' : 'Red flags', nFlags ? 'hot' : '') +
      t(pend, 'Symptom updates pending', pend ? 'warm' : '') + t(ov, ov === 1 ? 'Logged override' : 'Logged overrides');
  }

  function showRow(id) {
    var row = root.querySelector('[data-row="' + id + '"]');
    if (!row) { lastMsg = id + ' is not in the ranked list.'; root.querySelector('#rk-msg').textContent = lastMsg; return; }
    var top = row.getBoundingClientRect().top + window.pageYOffset - (document.querySelector('.app-top') || { offsetHeight: 0 }).offsetHeight - 12;
    window.scrollTo(0, Math.max(0, top));
    row.classList.remove('rk-flash'); void row.offsetWidth; row.classList.add('rk-flash');
    row.setAttribute('tabindex', '-1'); row.focus({ preventScroll: true });
    root.querySelector('#rk-msg').textContent = 'Showing ' + id + ' in the queue.';
    setTimeout(function () { row.classList.remove('rk-flash'); }, 2900);
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
        html += '<p class="ai-source"><strong>' + (n.source && n.source !== 'template' ? 'Draft written by AI (' + H.ai.sourceName(n.source) + ') in ' + (n.lang === 'es' ? 'Spanish' : 'English') + '. Edit as needed.' :
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
        (u.ai_summary ? '<br><span class="ai-source"><strong>' + (u.ai_source && u.ai_source !== 'rules' ? 'AI summary (' + H.ai.sourceName(u.ai_source) + ')' : 'Keyword fallback, not AI') + ':</strong> ' + esc(u.ai_summary) + '</span>' +
          (u.free_text ? '<br><span class="muted ai-source">Patient\'s words: "' + esc(u.free_text) + '"</span>' : '') + '<br>' : '') +
        ' ' +
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
      '<div class="muted">Waiting ' + waitMin(p) + ' min' + badges(r) + '</div></div>' +
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
    if (!q.ranked.length) html = '<p class="muted">No patients are waiting.</p>';
    var cnt = {}, LVL = { 1: 'Resuscitation', 2: 'Emergent', 3: 'Urgent', 4: 'Less urgent', 5: 'Non-urgent' };
    q.ranked.forEach(function (r) { cnt[r.p.esi] = (cnt[r.p.esi] || 0) + 1; });
    q.ranked.forEach(function (r, i) {
      var prev = q.ranked[i - 1], next = q.ranked[i + 1], e = r.p.esi;
      if (e !== lastEsi) {
        html += '<h3 class="rk-esi-h esi-' + esc(e) + '"><span class="t">ESI ' + esc(e) + ' · ' + LVL[e] + '</span><span class="m">' + cnt[e] + ' waiting</span></h3>';
        lastEsi = e;
      }
      html += rowHtml(r, { first: !prev || prev.p.esi !== r.p.esi, last: !next || next.p.esi !== r.p.esi });
    });
    root.querySelector('#rk-list').innerHTML = html;
    return q;
  }

  function renderOffline() {
    root.querySelector('#rk-offline').innerHTML = H.state.aiOffline
      ? '<p class="banner-warning">AI is offline. Scores and reasoning are hidden and the queue falls back to ESI level, then arrival time. Nurse overrides are paused.</p>' : '';
  }

  function renderLog() {
    var items = rankingLog().slice().reverse();
    var h = items.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Patient</th><th>Decision</th><th>Reason</th></tr></thead><tbody>' : '<p class="muted">No overrides logged yet.</p>';
    items.forEach(function (o) {
      h += '<tr><td>' + esc(U.fmtTime(o.time)) + '</td><td>' + esc(o.patient_id) + '</td><td>' + (o.module === 'fasttrack' ? 'Fast-track: ' : '') + esc(o.nurse_decision) +
        '</td><td>' + esc(o.reason) + '<div class="muted">' + esc(o.nurse) + '</div></td></tr>';
    });
    if (items.length) h += '</tbody></table></div>';
    root.querySelector('#rk-log').innerHTML = h;
    root.querySelector('#rk-log-n').textContent = items.length;
  }

  function refresh() {
    if (!root) return;
    var nFlags = renderAlerts();
    renderLeave();
    renderOffline();
    var q = renderList();
    renderSummary(q, nFlags);
    renderLog();
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

  function applyOverride(id, action, reason, meta) {
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
    var entry = H.logOverride({ module: 'ranking', patient_id: id, ai_suggestion: before, nurse_decision: decision, reason: reason, nurse: meta && meta.nurse });
    if (meta && meta.time) entry.time = meta.time;
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
    } else if (act === 'show-row') {
      showRow(id);
    } else if (act === 'ack') {
      assessed.push({ id: id, nurse: H.state.settings.nurse, time: U.fmtTime(U.now()) });
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
          H.logOverride({ module: 'ranking', patient_id: n.patient_id, ai_suggestion: n.source && n.source !== 'template' ? 'AI-drafted leave plan (' + H.ai.sourceName(n.source) + ')' : 'Standard leave template',
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
    var comp = COMPONENTS.filter(function (c) { return c.key === k; })[0];
    if (out) out.textContent = levelWord(comp, weights[k]);
    t.setAttribute('aria-valuetext', FMT[k](weights[k]));
    showBubble(t);
    refresh();
  }
  var bubbleTimers = {};
  function showBubble(inp) {
    var k = inp.getAttribute('data-w'), b = root.querySelector('#rk-wb-' + k);
    if (!b) return;
    var min = parseFloat(inp.min), max = parseFloat(inp.max), v = parseFloat(inp.value), tw = 18;
    var frac = max > min ? (v - min) / (max - min) : 0;
    b.textContent = FMT[k](v);
    b.style.left = 'calc(' + (frac * 100) + '% + ' + (tw / 2 - frac * tw) + 'px)';
    b.classList.add('show');
    clearTimeout(bubbleTimers[k]);
  }
  function hideBubbleSoon(inp) {
    var k = inp.getAttribute('data-w'), b = root.querySelector('#rk-wb-' + k);
    if (!b) return;
    clearTimeout(bubbleTimers[k]);
    bubbleTimers[k] = setTimeout(function () { b.classList.remove('show'); }, 800);
  }
  function onBubbleEvt(e) {
    var t = e.target;
    if (!t.getAttribute || !t.getAttribute('data-w')) return;
    if (e.type === 'pointerdown' || e.type === 'focusin') showBubble(t); else hideBubbleSoon(t);
  }

  /* ---------- demo seed: a shift already in progress (synthetic; deterministic; runs once at load) ---------- */
  function seedOverrides() {
    var D = '2026-11-23T', FTM = H.fastTrack, ft;
    function pc(id) { return Math.round(FTM.score(H.getPatient(id)).probability * 100); }
    function stamp(entry, hhmm) { entry.time = D + hhmm + ':00'; }
    /* weights first, so the ranks quoted in the log match what the queue shows */
    weights.recheck = savedWeights.recheck = 1.5;
    applyOverride('P0027', 'pin', 'Interpreter available now for 10 min', { nurse: 'RN Garcia', time: D + '09:38:00' });
    applyOverride('P0025', 'down', 'Waiting on X-ray result before reassessment', { nurse: 'RN Patel', time: D + '09:47:00' });
    ft = H.logOverride({ module: 'fasttrack', patient_id: 'P0006', ai_suggestion: 'Fast-track (' + pc('P0006') + '%)', nurse_decision: 'Keep in main queue',
      reason: 'Ankle swelling looks like possible fracture; needs main ED imaging', nurse: 'RN Garcia' });
    stamp(ft, '09:55');
    applyOverride('P0012', 'up', 'Patient looks paler, vitals trending down', { nurse: 'Charge RN Kim', time: D + '10:03:00' });
    ft = H.logOverride({ module: 'fasttrack', patient_id: 'P0009', ai_suggestion: 'Not fast-track (' + pc('P0009') + '%)', nurse_decision: 'Send to fast-track',
      reason: 'Localized rash, stable; fast-track APP agrees', nurse: 'RN Patel' });
    stamp(ft, '10:11');
    H.getPatient('P0009').status = 'fast-track';
    ft = H.logOverride({ module: 'ranking', patient_id: null, ai_suggestion: 'Previous scoring weights: Overdue re-check 1',
      nurse_decision: 'Scoring weights changed: Overdue re-check 1 → 1.5', reason: 'Raised overdue re-check weight; nights are seeing slow re-checks', nurse: 'Charge RN Kim' });
    stamp(ft, '10:18');
    lastWeightChange = { nurse: 'Charge RN Kim', time: '10:18', reason: 'Raised overdue re-check weight; nights are seeing slow re-checks' };
  }
  seedOverrides();

  /* ---------- mount ---------- */
  H.registerModule('ranking', {
    mount: function (el) {
      root = el;
      injectStyles();
      skeleton(el);
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('input', onInput);
      ['pointerdown', 'focusin'].forEach(function (n) { el.addEventListener(n, onBubbleEvt); });
      ['pointerup', 'pointercancel', 'focusout', 'change'].forEach(function (n) { el.addEventListener(n, onBubbleEvt); });
      document.addEventListener('pointerup', function () { root.querySelectorAll('.wbubble.show').forEach(function (b) { hideBubbleSoon(root.querySelector('#rk-w-' + b.id.slice(6))); }); });
      if (lastWeightChange) root.querySelector('#rk-w-last').textContent = 'Last changed ' + lastWeightChange.time + ' by ' + lastWeightChange.nurse;
      root.querySelector('#rk-w-save').addEventListener('click', saveWeights);
      root.querySelector('#rk-reset').addEventListener('click', function () {
        COMPONENTS.forEach(function (c) { weights[c.key] = c.def; });
        buildWeights();
        refresh();
      });
      ['patient:updated', 'symptomUpdate', 'override', 'settings', 'aiOffline', 'leave:updated'].forEach(function (evt) { H.on(evt, function () { refresh(); }); });
      refresh();
    }
  });
})();
