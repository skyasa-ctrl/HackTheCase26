/* Results tab: one place to see progress and improvement. SYNTHETIC DATA ONLY.
 * - Simulated pilot series (Months 0-6) from data/results.js (written by scripts/generate_results.py). NOT real post-launch data.
 * - Boarding cost (live, from Halvian.capacity.summary()), equity KPIs and Equity Gap Index, live demo-queue waits by insurance group.
 * Insurance is never a scoring input: it is read here only to measure gaps between groups. */
(function () {
  'use strict';
  var H = window.Halvian, U = H.util, esc = U.esc, root = null;
  var GROUPS = ['commercial', 'medicare', 'medicaid', 'uninsured', 'other'];

  function R() { return (H.data && H.data.results) || null; }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function fmt(n, d) { return n == null || isNaN(n) ? '—' : Number(n).toFixed(d == null ? 0 : d); }
  function dec(k) { return k.unit === '%' ? 1 : 1; }
  function val(k, v) { return fmt(v, dec(k)) + (k.unit === '%' ? '%' : ' min'); }
  function valFine(k, v) { return k.unit === '%' ? fmt(v, 2) + '%' : val(k, v); }  // 2 decimals for % so small path gaps are visible

  /* ---------- gaps and Equity Gap Index ---------- */
  function gapSeries(r) {
    var k = r.kpis, c = r.commercial_lwbs;
    return {
      uw: k.unins_wait_gap.series, mw: k.medicaid_wait_gap.series,
      ul: k.unins_lwbs.series.map(function (v) { return v - c; }),
      ml: k.medicaid_lwbs.series.map(function (v) { return v - c; })
    };
  }
  function egi(gaps, i, tgt) {
    var parts = ['uw', 'mw', 'ul', 'ml'].map(function (g) {
      var base = gaps[g][0], cur = tgt ? tgt[g] : gaps[g][i];
      return cur / base;
    });
    return 100 * mean(parts);
  }
  function targetGaps(r) {
    var k = r.kpis, c = r.commercial_lwbs;
    return { uw: k.unins_wait_gap.target, mw: k.medicaid_wait_gap.target, ul: k.unins_lwbs.target - c, ml: k.medicaid_lwbs.target - c };
  }

  /* ---------- tiny inline SVG line chart (no <text>; labels are HTML) ---------- */
  function spark(series, target, w, h, label) {
    var all = series.concat([target]), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = 4;
    if (hi === lo) hi = lo + 1;
    function X(i) { return pad + i * (w - 2 * pad) / (series.length - 1); }
    function Y(v) { return pad + (hi - v) * (h - 2 * pad) / (hi - lo); }
    var pts = series.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
    return '<svg class="rs-spark" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '" preserveAspectRatio="none">' +
      '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + Y(target).toFixed(1) + '" y2="' + Y(target).toFixed(1) + '" stroke="#1d6b3a" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="#0b5c8a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + X(series.length - 1).toFixed(1) + '" cy="' + Y(series[series.length - 1]).toFixed(1) + '" r="3.5" fill="#0b5c8a"/></svg>';
  }
  function changeText(k, latest) {
    var d = latest - k.baseline, unit = k.unit === '%' ? ' pts' : ' min';
    if (Math.abs(d) < 0.05) return 'No change';
    return (d < 0 ? 'Improved: down ' : 'Worse: up ') + fmt(Math.abs(d), 1) + unit + ' (' + fmt(Math.abs(d) / k.baseline * 100, 0) + '%)';
  }
  /* ---------- traffic-light status vs the path to the Month-18 target (Roadmap §2.1) ----------
   * Path = straight line from baseline to target over 18 months; at Month m it is baseline + (target - baseline) * m / 18.
   * Green: on or ahead of the path (5% tolerance of the total distance). Amber: behind the path but better than baseline.
   * Red: no better than baseline. Actions come from the Roadmap "If off track" column. */
  var ACTIONS = {
    d2p: 'Review fast-track use and room-status updates; add fast-track APP hours at Monday peaks.',
    lwbs: 'Check "thinking of leaving" alerts and patient-link uptake; add a waiting-room nurse round on surge days.',
    unins_wait_gap: 'Audit scores and overrides for uninsured patients; add nurse rounding for this group.',
    medicaid_wait_gap: 'Audit scores and overrides for Medicaid patients; expand nurse rounding and Spanish-speaking staff support before the next shift expansion.',
    unins_lwbs: 'Target "thinking of leaving" outreach to uninsured patients; check link uptake by language and add a nurse round.',
    medicaid_lwbs: 'Target "thinking of leaving" outreach to Medicaid patients; check link uptake by language and add a nurse round.'
  };
  function status(k) {
    var m = k.series.length - 1, latest = k.series[m], dist = k.target - k.baseline;
    var path = k.baseline + dist * m / 18, tol = Math.abs(dist) * 0.05;
    var better = dist < 0 ? function (a, b) { return a < b; } : function (a, b) { return a > b; };
    var level = !better(latest, k.baseline) ? 'red' : (better(latest, path) || Math.abs(latest - path) <= tol) ? 'green' : 'amber';
    return { level: level, path: path };
  }
  var STATUS_TEXT = { green: 'On track', amber: 'Behind path', red: 'Off track' };
  var STATUS_PILL = { green: 'ok', amber: 'warn', red: 'danger' };

  function kpiCard(k, extra, key) {
    var latest = k.series[k.series.length - 1], d = latest - k.baseline, st = status(k);
    var badge = '<span class="pill ' + STATUS_PILL[st.level] + '" style="margin-left:.4rem;font-size:.78rem">' + (st.level === 'green' ? '● ' : '▲ ') + STATUS_TEXT[st.level] + '</span>';
    var action = st.level === 'green' ? '' :
      '<div class="banner-warning" role="note" style="margin-top:.5rem;padding:.45rem .6rem;font-size:.88rem">' +
      'Action: ' + esc(ACTIONS[key] || 'Review with the nurse committee.') + '</div>';
    return '<div class="rs-kpi"><h3>' + esc(k.label) + badge + '</h3>' +
      '<div class="rs-kpi-main"><div class="rs-big">' + val(k, latest) + '</div>' + spark(k.series, k.target, 120, 40, k.label + ', Month 0 to 6 trend, target dashed') + '</div>' +
      '<dl class="rs-dl"><div><dt>Baseline</dt><dd>' + val(k, k.baseline) + '</dd></div><div><dt>Latest (Month 6)</dt><dd>' + valFine(k, latest) + '</dd></div>' +
      '<div><dt>Month-6 path</dt><dd>' + valFine(k, st.path) + '</dd></div>' +
      '<div><dt>Target (Month 18)</dt><dd>≤ ' + val(k, k.target) + '</dd></div></dl>' +
      '<p class="rs-change ' + (d < 0 ? 'good' : 'bad') + '">' + esc(changeText(k, latest)) + '</p>' + (extra || '') + action + '</div>';
  }

  /* ---------- sections ---------- */
  function sectionPilot(r) {
    var k = r.kpis, gaps = gapSeries(r), last = r.months.length - 1;
    var series = r.months.map(function (m, i) { return egi(gaps, i); }), tgt = egi(gaps, 0, targetGaps(r)), cur = series[last];
    var keys = ['d2p', 'lwbs', 'unins_wait_gap', 'medicaid_wait_gap', 'unins_lwbs', 'medicaid_lwbs'];
    var counts = { green: 0, amber: 0, red: 0 };
    keys.forEach(function (key) { if (k[key]) counts[status(k[key]).level]++; });
    var h = '<div class="card"><h2>Month-6 check: ' + counts.green + ' on track, ' + counts.amber + ' behind path' + (counts.red ? ', ' + counts.red + ' off track' : '') + '</h2>' +
      '<p class="muted" style="margin:0"><span class="pill ok">● On track</span> · <span class="pill warn">▲ Behind path</span> · ' +
      '<span class="pill danger">▲ Off track</span></p></div>';
    h += '<div class="card"><h2>Headline progress</h2>' +
      '<div class="rs-grid">' + kpiCard(k.d2p, '', 'd2p') + kpiCard(k.lwbs, '', 'lwbs') + '</div></div>';
    h += '<div class="card"><h2>Equity: gaps vs commercial patients</h2>' +
      '<p class="muted">Insurance is never used in scoring — shown only to measure gaps between groups.</p>' +
      '<div class="rs-egi"><div><div class="muted">Equity Gap Index (EGI)</div><div class="rs-big">' + fmt(cur, 0) + '</div>' +
      '<p class="rs-change ' + (cur < 100 ? 'good' : 'bad') + '">' + (cur < 100 ? 'Gaps shrinking' : cur > 100 ? 'Gaps widening' : 'Unchanged') + ' (' + (cur < 100 ? 'improved' : cur > 100 ? 'worse' : 'same') + ' vs 100 today)</p></div>' +
      spark(series, tgt, 300, 70, 'Equity Gap Index, Month 0 to 6, target dashed') +
      '<p class="muted rs-egi-note">100 = today · lower = gaps shrinking · target ≈ ' + fmt(tgt, 0) + '</p></div>' +
      '<div class="rs-grid">' +
      kpiCard(k.unins_wait_gap, '', 'unins_wait_gap') + kpiCard(k.medicaid_wait_gap, '', 'medicaid_wait_gap') +
      kpiCard(k.unins_lwbs, '', 'unins_lwbs') +
      kpiCard(k.medicaid_lwbs, '', 'medicaid_lwbs') +
      '</div></div>';
    return h;
  }

  function pct(x) { return Math.round(x * 100); }
  function f1(x) { return (x * 100).toFixed(1) + '%'; }

  function sectionModel() {
    var model = H.fastTrack && H.fastTrack.model;
    if (!model) return '<div class="card"><h2>Fast-track model: accuracy, safety and fairness</h2><p>Model not loaded.</p></div>';
    var m = model.metrics, fair = model.fairness, groups = Object.keys(fair);
    var rows = groups.map(function (g) {
      var top = g === 'uninsured' || g === 'medicaid';
      return '<tr' + (top ? ' style="background:var(--brand-tint)"' : '') + '><td>' + esc(g) + '</td><td class="num">' + fair[g].n +
        '</td><td class="num">' + f1(fair[g].selection_rate) + '</td><td class="num">' + f1(fair[g].bounce_back_rate) + '</td></tr>';
    }).join('');
    return '<div class="card"><h2>Fast-track model: accuracy, safety and fairness</h2><div class="table-wrap"><table class="table"><tbody>' +
      '<tr><td>Threshold</td><td class="num">' + pct(H.state.settings.fasttrackThreshold) + '% (trained: ' + pct(model.threshold) + '%)</td></tr>' +
      '<tr><td>Bounce-back rate at threshold</td><td class="num">' + f1(m.bounce_back_rate_at_threshold) + ' (target under ' + pct(m.bounce_back_target) + '%)</td></tr>' +
      '<tr><td>Accuracy (at 0.5)</td><td class="num">' + f1(m['accuracy_at_0.5']) + '</td></tr>' +
      '<tr><td>AUC, all patients (synthetic data)</td><td class="num">' + m.auc.toFixed(3) + '</td></tr>' +
      (m.auc_esi_3_5 != null ? '<tr><td>AUC, ESI 3–5 only (stricter; synthetic data)</td><td class="num">' + m.auc_esi_3_5.toFixed(3) + '</td></tr>' : '') +
      '<tr><td>Real-world benchmark (published)</td><td class="num">0.87</td></tr>' +
      '<tr><td>Training patients (n_train)</td><td class="num">' + m.n_train + '</td></tr></tbody></table></div>' +
      '<p class="banner-warning" style="margin-top:.6rem">Synthetic data overstates accuracy; go-live needs AUC ≥ 0.85 on real data.</p>' +
      '<h3 style="margin-top:1rem">Fairness by insurance group</h3>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Group</th><th class="num">n</th><th class="num">Selection rate</th><th class="num">Bounce-back</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p>Uninsured and Medicaid patients are selected at least as often as commercial (to confirm on real data).</p></div>';
  }

  function sectionBoarding() {
    var s = H.capacity && H.capacity.summary ? H.capacity.summary() : null;
    if (!s) return '';
    return '<div class="card"><h2>Boarding cost right now <span class="pill">Live demo data</span></h2><div class="rs-grid">' +
      '<div class="rs-kpi"><div class="muted">Estimated cost</div><div class="rs-big">$' + s.boardingCost.toLocaleString('en-US') + '</div></div>' +
      '<div class="rs-kpi"><div class="muted">ED rooms boarding</div><div class="rs-big">' + s.boardingEd + '</div></div>' +
      '<div class="rs-kpi"><div class="muted">Bed-hours lost so far today</div><div class="rs-big">' + s.boardingBedHours.toFixed(1) + '</div></div></div>' +
      '<p class="muted" style="margin:.7rem 0 0">' + s.boardingBedHours.toFixed(1) + ' bed-hours × $' + s.costPerEdBedHour + ' = $' +
      Math.round(s.boardingBedHours * s.costPerEdBedHour).toLocaleString('en-US') + ' today</p></div>';
  }

  function sectionLive() {
    var hist = (H.data && H.data.history) || [], waiting = H.state.patients.filter(function (p) { return p.status === 'waiting'; });
    var esiD2p = {};
    hist.forEach(function (x) { var v = x.outcome && x.outcome.door_to_provider_min; if (v != null) (esiD2p[x.esi] = esiD2p[x.esi] || []).push(v); });
    Object.keys(esiD2p).forEach(function (k) { esiD2p[k] = mean(esiD2p[k]); });
    var rows = '';
    GROUPS.forEach(function (g) {
      var now = waiting.filter(function (p) { return p.insurance === g; });
      var waits = now.map(function (p) { return Math.max(0, Math.round(U.minutesBetween(p.arrival_time, U.now()))); });
      var hr = hist.filter(function (x) { return x.insurance === g; });
      var d2p = hr.map(function (x) { return x.outcome && x.outcome.door_to_provider_min; }).filter(function (v) { return v != null; });
      var lw = hr.filter(function (x) { return x.outcome && x.outcome.disposition === 'lwbs'; }).length;
      var same = mean(hr.filter(function (x) { return x.outcome && x.outcome.door_to_provider_min != null; })
        .map(function (x) { return x.outcome.door_to_provider_min - esiD2p[x.esi]; }));
      var ov = H.state.overrides.filter(function (o) { var pt = H.getPatient(o.patient_id); return pt && pt.insurance === g; }).length;
      rows += '<tr><th scope="row" style="text-transform:capitalize">' + esc(g) + '</th><td class="num">' + now.length + '</td><td class="num">' + fmt(median(waits)) + '</td>' +
        '<td class="num">' + fmt(median(d2p)) + '</td><td class="num">' + (same == null ? '—' : (same > 0 ? '+' : '') + same.toFixed(1)) + '</td>' +
        '<td class="num">' + (hr.length ? (100 * lw / hr.length).toFixed(1) + '%' : '—') + '</td><td class="num">' + ov + '</td></tr>';
    });
    return '<div class="card"><h2>Today: live demo queue by insurance group <span class="pill">Live demo data</span></h2>' +
      '<p class="muted">“Same-ESI” compares each group’s historical door-to-provider with the average for the same acuity level.</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Insurance group</th><th class="num">Waiting now</th><th class="num">Median current wait (min)</th>' +
      '<th class="num">Hist. median door-to-provider (min)</th><th class="num">Hist. wait vs same-ESI average (min)</th><th class="num">Hist. LWBS %</th><th class="num">Overrides logged</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>';
  }

  function render() {
    if (!root) return;
    var r = R();
    root.querySelector('#rs-body').innerHTML = (r ? sectionPilot(r) : '<div class="card"><p class="banner-warning">Pilot results data is not loaded.</p></div>') + sectionModel() + sectionBoarding() + sectionLive();
  }

  H.registerModule('results', {
    mount: function (el) {
      root = el;
      el.innerHTML = '<div class="rs-wrap"><div id="rs-body"></div></div>';
      ['patient:updated', 'override', 'rooms:updated', 'aiOffline', 'settings'].forEach(function (e) { H.on(e, render); });
      render();
    }
  });
})();
