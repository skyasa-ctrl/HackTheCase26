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
  function kpiCard(k, extra) {
    var latest = k.series[k.series.length - 1], d = latest - k.baseline;
    return '<div class="rs-kpi"><h3>' + esc(k.label) + '</h3>' +
      '<div class="rs-kpi-main"><div class="rs-big">' + val(k, latest) + '</div>' + spark(k.series, k.target, 120, 40, k.label + ', Month 0 to 6 trend, target dashed') + '</div>' +
      '<dl class="rs-dl"><div><dt>Baseline</dt><dd>' + val(k, k.baseline) + '</dd></div><div><dt>Latest (Month 6)</dt><dd>' + val(k, latest) + '</dd></div>' +
      '<div><dt>Target (Month 18)</dt><dd>≤ ' + val(k, k.target) + '</dd></div></dl>' +
      '<p class="rs-change ' + (d < 0 ? 'good' : 'bad') + '">' + esc(changeText(k, latest)) + '</p>' + (extra || '') + '</div>';
  }

  /* ---------- sections ---------- */
  function sectionPilot(r) {
    var k = r.kpis, gaps = gapSeries(r), last = r.months.length - 1;
    var series = r.months.map(function (m, i) { return egi(gaps, i); }), tgt = egi(gaps, 0, targetGaps(r)), cur = series[last];
    var h = '<div class="card"><h2>Headline progress</h2><p class="muted">Month 0 is today’s baseline from the case. Targets are the draft Month-18 goals.</p>' +
      '<div class="rs-grid">' + kpiCard(k.d2p) + kpiCard(k.lwbs) + '</div></div>';
    h += '<div class="card"><h2>Equity: gaps vs commercial patients</h2>' +
      '<p class="muted">Insurance is never used in scoring — shown only to measure gaps between groups.</p>' +
      '<div class="rs-egi"><div><div class="muted">Equity Gap Index (EGI)</div><div class="rs-big">' + fmt(cur, 0) + '</div>' +
      '<p class="rs-change ' + (cur < 100 ? 'good' : 'bad') + '">' + (cur < 100 ? 'Gaps shrinking' : cur > 100 ? 'Gaps widening' : 'Unchanged') + ' (' + (cur < 100 ? 'improved' : cur > 100 ? 'worse' : 'same') + ' vs 100 today)</p></div>' +
      spark(series, tgt, 300, 70, 'Equity Gap Index, Month 0 to 6, target dashed') +
      '<p class="muted rs-egi-note">EGI = average of (current gap ÷ baseline gap) across the four gaps below × 100. 100 = today, below 100 = gaps shrinking, above 100 = widening. Month 0: 100 · Month 6: ' + fmt(cur, 0) +
      ' · Month-18 target: about ' + fmt(tgt, 0) + '.</p></div>' +
      '<div class="rs-grid">' +
      kpiCard(k.unins_wait_gap) + kpiCard(k.medicaid_wait_gap) +
      kpiCard(k.unins_lwbs, '<p class="muted">Gap vs commercial ' + fmt(r.commercial_lwbs, 1) + '%: ' + fmt(k.unins_lwbs.series[last] - r.commercial_lwbs, 1) + ' pts (baseline ' + fmt(gaps.ul[0], 1) + ' pts).</p>') +
      kpiCard(k.medicaid_lwbs, '<p class="muted">Gap vs commercial ' + fmt(r.commercial_lwbs, 1) + '%: ' + fmt(k.medicaid_lwbs.series[last] - r.commercial_lwbs, 1) + ' pts (baseline ' + fmt(gaps.ml[0], 1) + ' pts).</p>') +
      '</div></div>';
    return h;
  }

  function sectionBoarding() {
    var s = H.capacity && H.capacity.summary ? H.capacity.summary() : null;
    if (!s) return '';
    return '<div class="card"><h2>Boarding cost right now <span class="pill">Live demo data</span></h2><div class="rs-grid">' +
      '<div class="rs-kpi"><div class="muted">Estimated cost</div><div class="rs-big">$' + s.boardingCost.toLocaleString('en-US') + '</div></div>' +
      '<div class="rs-kpi"><div class="muted">ED rooms boarding</div><div class="rs-big">' + s.boardingEd + '</div></div>' +
      '<div class="rs-kpi"><div class="muted">Bed-hours lost so far today</div><div class="rs-big">' + s.boardingBedHours.toFixed(1) + '</div></div></div>' +
      '<p class="muted" style="margin:.7rem 0 0">' + s.boardingEd + ' ED rooms boarding, ' + s.boardingBedHours.toFixed(1) + ' bed-hours so far today × $' + s.costPerEdBedHour +
      ' per ED bed-hour (case figure) = about ' + s.boardingBedHours.toFixed(1) + ' hours of ED capacity lost today. Median boarding is 3.5 h at Halvian vs 2–2.5 h nationally.</p></div>';
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
      '<p class="muted">Insurance is never used in scoring — shown only to measure gaps. Small groups give noisy live numbers; the historical columns (' + hist.length +
      ' past visits) are steadier. “Same-ESI” compares each group’s historical door-to-provider with the average for the same acuity level.</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Insurance group</th><th class="num">Waiting now</th><th class="num">Median current wait (min)</th>' +
      '<th class="num">Hist. median door-to-provider (min)</th><th class="num">Hist. wait vs same-ESI average (min)</th><th class="num">Hist. LWBS %</th><th class="num">Overrides logged</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>';
  }

  function render() {
    if (!root) return;
    var r = R();
    root.querySelector('#rs-body').innerHTML = (r ? sectionPilot(r) : '<div class="card"><p class="banner-warning">Pilot results data is not loaded.</p></div>') + sectionBoarding() + sectionLive();
  }

  H.registerModule('results', {
    mount: function (el) {
      root = el;
      el.innerHTML = '<div class="rs-wrap"><div class="banner-warning" role="note"><strong>Simulated pilot results (synthetic)</strong> — shows how progress will be tracked. ' +
        'No real post-launch data exists; Months 0–6 are generated by scripts/generate_results.py.</div><div id="rs-body"></div></div>';
      ['patient:updated', 'override', 'rooms:updated', 'aiOffline'].forEach(function (e) { H.on(e, render); });
      render();
    }
  });
})();
