/* Tab count badges (Queue waiting, Fast-track eligible, Capacity open). Read-only: never changes state.
 * Classic script, loaded last. SYNTHETIC DATA ONLY. */
(function () {
  'use strict';
  var H = window.Halvian;
  if (!H) return;
  function set(id, text, label) {
    var el = document.getElementById('count-' + id);
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    var tab = document.getElementById('tab-' + id);
    if (tab && text) tab.setAttribute('aria-label', label);
  }
  function update() {
    var pts = H.state.patients || [], waiting = 0, elig = 0, open = 0;
    pts.forEach(function (p) {
      if (p.status !== 'waiting') return;
      waiting++;
      try { if (!H.state.aiOffline && p.esi >= 3 && H.fastTrack.score(p).eligible) elig++; } catch (e) { /* ignore */ }
    });
    (H.state.rooms || []).forEach(function (r) { if (r.status === 'open') open++; });
    set('queue', String(waiting), 'Queue, ' + waiting + ' waiting');
    set('fasttrack', H.state.aiOffline ? '' : elig + ' eligible', 'Fast-track, ' + elig + ' eligible');
    set('capacity', open + ' open', 'Capacity, ' + open + ' rooms open');
  }
  ['ready', 'patient:updated', 'symptomUpdate', 'override', 'aiOffline', 'rooms:updated', 'tab'].forEach(function (e) { H.on(e, update); });
  update();
})();
