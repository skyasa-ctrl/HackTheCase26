/* Patient view: simulates the page that opens from the wristband QR / SMS link. Large text, plain language, EN/ES. */
(function () {
  'use strict';
  var H = window.Halvian, esc = H.util.esc;

  var T = {
    en: {
      demo: 'Demo: choose patient (simulates scanning wristband QR)', lang: 'Language',
      hello: 'Hello, your visit ID', status: 'Where you are now',
      st_waiting: 'You are checked in and waiting to be seen.', st_fast: 'You are on our fast-track path for quicker, simpler problems. A staff member will call you.',
      st_roomed: 'You have been called back to a room.', st_left: 'Our records show you have left.',
      wait: 'Estimated wait', wait_range: 'about {a}–{b} min', wait_asap: 'You will be seen as soon as possible.', wait_staff: 'Staff will update you on your wait.',
      wait_note: 'This is a range, not a promise. It can change if sicker patients arrive.',
      next: 'What happens next', n1: 'Stay in the waiting area so staff can find you.', n2: 'A nurse may check on you and your vital signs again.',
      n3: 'A provider will see you, and may order tests or treatment.', n4: 'You will get instructions before you go home or to a room.',
      warn: 'If you feel much worse — chest pain, trouble breathing, fainting, severe bleeding — tell staff at the desk now or call for help.',
      upd: 'Update my symptoms', upd_help: 'Tell us if something has changed. This does not change your place in line automatically. A nurse reviews every update.',
      sym: 'What are you feeling now? (tick all that apply)', pain: 'Pain from 0 (none) to 10 (worst)', dur: 'How long has this been going on?',
      d1: 'Less than 1 hour', d2: '1 to 6 hours', d3: '6 to 24 hours', d4: 'More than 1 day', send: 'Send update',
      wait_more: 'You can send another update in {m} min.', red: 'A nurse has been alerted and will come to you now.', ok: 'A nurse will review your update. Your place in line does not change automatically.',
      conf: 'Is this confusing?', conf_thanks: 'Thank you. Your feedback was saved and will help us make this page clearer.',
      leave: "I'm thinking of leaving", leave_note: 'A nurse has been notified and will talk with you before you go.',
      plan_h: 'If you decide to leave: your plan', plan1: 'Where to go: your regular doctor or an urgent care clinic today. Call 911 or return here if you get worse.',
      plan2: 'Warning signs — come back or call 911 for: chest pain, trouble breathing, fainting, confusion, severe bleeding, face drooping or weakness on one side.',
      plan3: 'Follow-up: tell the desk your phone number so a nurse can check on you, and see a doctor within 24 hours.',
      plan_ai: 'Drafted by AI and reviewed by a nurse.', plan_pending: 'Waiting for nurse review.',
      s_chest: 'Chest pain or pressure', s_breath: 'Trouble breathing', s_faint: 'Fainting or nearly fainting', s_conf: 'New confusion',
      s_bleed: 'Severe bleeding', s_stroke: 'Stroke signs (face drooping, arm weakness, trouble speaking)', s_nausea: 'Nausea or vomiting', s_dizzy: 'Dizziness',
      s_fever: 'Fever or chills', s_pain: 'Pain getting worse', s_head: 'Headache', s_other: 'Something else', none: 'No patient selected.'
    },
    es: {
      demo: 'Demo: elija paciente (simula escanear el código QR de la pulsera)', lang: 'Idioma',
      hello: 'Hola, su número de visita', status: 'Dónde está ahora',
      st_waiting: 'Ya se registró y está esperando ser atendido.', st_fast: 'Está en nuestra vía rápida para problemas más simples. Un miembro del personal lo llamará.',
      st_roomed: 'Lo llamaron a una sala.', st_left: 'Nuestros registros indican que ya se fue.',
      wait: 'Espera estimada', wait_range: 'aproximadamente {a}–{b} min', wait_asap: 'Lo atenderemos lo antes posible.', wait_staff: 'El personal le avisará sobre su espera.',
      wait_note: 'Es un rango, no una promesa. Puede cambiar si llegan pacientes más graves.',
      next: 'Qué sigue', n1: 'Quédese en la sala de espera para que el personal lo encuentre.', n2: 'Una enfermera puede revisarlo y volver a tomar sus signos vitales.',
      n3: 'Un proveedor lo verá y puede pedir pruebas o tratamiento.', n4: 'Recibirá instrucciones antes de irse a casa o a una sala.',
      warn: 'Si se siente mucho peor — dolor de pecho, dificultad para respirar, desmayo, sangrado fuerte — avise al personal en el mostrador ahora o pida ayuda.',
      upd: 'Actualizar mis síntomas', upd_help: 'Díganos si algo cambió. Esto no cambia su lugar en la fila automáticamente. Una enfermera revisa cada actualización.',
      sym: '¿Qué siente ahora? (marque todo lo que aplique)', pain: 'Dolor de 0 (nada) a 10 (el peor)', dur: '¿Desde cuándo?',
      d1: 'Menos de 1 hora', d2: '1 a 6 horas', d3: '6 a 24 horas', d4: 'Más de 1 día', send: 'Enviar actualización',
      wait_more: 'Puede enviar otra actualización en {m} min.', red: 'Se avisó a una enfermera y vendrá con usted ahora.', ok: 'Una enfermera revisará su actualización. Su lugar en la fila no cambia automáticamente.',
      conf: '¿Esto es confuso?', conf_thanks: 'Gracias. Guardamos su comentario para hacer esta página más clara.',
      leave: 'Estoy pensando en irme', leave_note: 'Se avisó a una enfermera y hablará con usted antes de que se vaya.',
      plan_h: 'Si decide irse: su plan', plan1: 'A dónde ir: su médico de siempre o una clínica de atención urgente hoy. Llame al 911 o regrese si empeora.',
      plan2: 'Señales de alarma — regrese o llame al 911 si tiene: dolor de pecho, dificultad para respirar, desmayo, confusión, sangrado fuerte, cara caída o debilidad de un lado.',
      plan3: 'Seguimiento: dé su teléfono en el mostrador para que una enfermera lo llame, y vea a un médico en 24 horas.',
      plan_ai: 'Redactado por IA y revisado por una enfermera.', plan_pending: 'Esperando revisión de la enfermera.',
      s_chest: 'Dolor u opresión en el pecho', s_breath: 'Dificultad para respirar', s_faint: 'Desmayo o casi desmayo', s_conf: 'Confusión nueva',
      s_bleed: 'Sangrado fuerte', s_stroke: 'Señales de derrame (cara caída, debilidad del brazo, dificultad para hablar)', s_nausea: 'Náuseas o vómito', s_dizzy: 'Mareo',
      s_fever: 'Fiebre o escalofríos', s_pain: 'El dolor empeora', s_head: 'Dolor de cabeza', s_other: 'Otra cosa', none: 'Ningún paciente seleccionado.'
    }
  };
  var SYMS = [['s_chest', 1], ['s_breath', 1], ['s_faint', 1], ['s_conf', 1], ['s_bleed', 1], ['s_stroke', 1],
    ['s_nausea', 0], ['s_dizzy', 0], ['s_fever', 0], ['s_pain', 0], ['s_head', 0], ['s_other', 0]];
  var EN_SYM = {}; SYMS.forEach(function (s) { EN_SYM[s[0]] = T.en[s[0]]; });

  /* Returns [lo, hi], null (no number to show). Prefers the shared capacity estimate so all tabs agree. */
  function waitRange(p) {
    if (p.esi <= 2) return null;
    if (H.capacity && typeof H.capacity.estimateWaitRange === 'function') {
      var r = H.capacity.estimateWaitRange(p);
      return r ? [r.low, r.high] : null;
    }
    if (H.state.aiOffline) return null;
    var ahead = H.state.patients.filter(function (q) {
      return q.id !== p.id && q.status === 'waiting' &&
        (q.esi < p.esi || (q.esi === p.esi && new Date(q.arrival_time) < new Date(p.arrival_time)));
    }).length;
    if (p.status === 'fast-track') ahead = Math.min(ahead, 3);
    var per = p.esi === 3 ? 8 : 5;
    var lo = Math.round((10 + ahead * per * 0.7) / 5) * 5, hi = Math.round((25 + ahead * per * 1.5) / 5) * 5;
    return [Math.max(10, lo), Math.max(lo + 15, hi)];
  }

  function mount(el) {
    var lang = 'en', pid = '', msg = {}, leaveShown = {}, feedbackShown = {};

    function t(k, v) {
      var s = (T[lang][k] != null ? T[lang][k] : T.en[k]) || k;
      if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); });
      return esc(s);
    }

    function patientsList() { return H.state.patients.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }); }

    function render() {
      var p = pid ? H.getPatient(pid) : null;
      var opts = '<option value="">—</option>' + patientsList().map(function (q) {
        return '<option value="' + esc(q.id) + '"' + (q.id === pid ? ' selected' : '') + '>' + esc(q.id) + '</option>';
      }).join('');
      var head = '<div class="card"><div class="row"><label for="pv-sel">' + t('demo') + '</label><select id="pv-sel">' + opts + '</select></div>' +
        '<div class="row"><label for="pv-lang">' + t('lang') + '</label><select id="pv-lang"><option value="en"' + (lang === 'en' ? ' selected' : '') + '>English</option><option value="es"' + (lang === 'es' ? ' selected' : '') + '>Español</option></select></div></div>';
      el.innerHTML = '<div lang="' + lang + '" style="max-width:640px;margin:0 auto;font-size:1.2rem;line-height:1.55">' + head + (p ? body(p) : '<div class="card empty">' + t('none') + '</div>') + '</div>';
    }

    function body(p) {
      var st = p.status === 'fast-track' ? 'st_fast' : p.status === 'roomed' ? 'st_roomed' : p.status === 'left' ? 'st_left' : 'st_waiting';
      var r = waitRange(p);
      var wait = r ? t('wait_range', { a: r[0], b: r[1] }) : t(p.esi <= 2 ? 'wait_asap' : 'wait_staff');
      var gate = H.canSubmitSymptomUpdate(p.id);
      var m = msg[p.id] || '';
      var h = '<div class="card"><h2 style="font-size:1.6rem">' + t('hello') + ' ' + esc(p.id) + '</h2>' +
        '<h3>' + t('status') + '</h3><p>' + t(st) + '</p>' +
        '<h3>' + t('wait') + '</h3><p style="font-size:1.5rem;font-weight:700">' + wait + '</p>' + (r ? '<p class="muted" style="font-size:1rem">' + t('wait_note') + '</p>' : '') + '</div>';
      h += '<div class="card"><h3>' + t('next') + '</h3><ol><li>' + t('n1') + '</li><li>' + t('n2') + '</li><li>' + t('n3') + '</li><li>' + t('n4') + '</li></ol></div>';
      h += '<div class="banner-warning" role="alert" style="font-size:1.15rem;border-width:2px"><strong>' + t('warn') + '</strong></div>';

      h += '<div class="card"><h2>' + t('upd') + '</h2><p>' + t('upd_help') + '</p>';
      if (m) h += '<p class="banner-warning" role="status" style="font-size:1.15rem">' + m + '</p>';
      if (!gate.ok) h += '<p class="pill warn" style="font-size:1rem">' + t('wait_more', { m: gate.minutesUntil }) + '</p>';
      h += '<form id="pv-form"><fieldset style="border:0;padding:0;margin:0"' + (gate.ok ? '' : ' disabled') + '><legend><strong>' + t('sym') + '</strong></legend>' +
        SYMS.map(function (s) {
          var cid = 'pv-sym-' + esc(p.id) + '-' + s[0];
          return '<div style="margin:.4rem 0"><label for="' + cid + '" style="font-weight:500"><input type="checkbox" id="' + cid + '" name="sym" value="' + s[0] + '" style="width:1.4rem;height:1.4rem;vertical-align:middle"> ' + t(s[0]) + '</label></div>';
        }).join('') +
        '<div style="margin:.8rem 0"><label for="pv-pain">' + t('pain') + ': <output id="pv-pain-out">0</output></label><br><input id="pv-pain" type="range" min="0" max="10" value="0" style="width:100%"></div>' +
        '<div style="margin:.8rem 0"><label for="pv-dur">' + t('dur') + '</label><br><select id="pv-dur" style="font-size:1.1rem;width:100%">' +
        ['d1', 'd2', 'd3', 'd4'].map(function (d) { return '<option value="' + d + '">' + t(d) + '</option>'; }).join('') + '</select></div>' +
        '<button class="btn btn-primary" type="submit" style="font-size:1.2rem;min-height:48px">' + t('send') + '</button></fieldset></form></div>';

      h += '<div class="card row"><button class="btn" id="pv-conf" style="min-height:48px">' + t('conf') + '</button>' +
        '<button class="btn" id="pv-leave" style="min-height:48px">' + t('leave') + '</button></div>';
      if (feedbackShown[p.id]) h += '<p class="pill ok" role="status" style="font-size:1rem">' + t('conf_thanks') + '</p>';
      if (leaveShown[p.id]) {
        h += '<div class="card" role="status"><p class="pill info" style="font-size:1rem">' + t('leave_note') + '</p><h3>' + t('plan_h') + '</h3><p>' + t('plan1') + '</p><p>' + t('plan2') + '</p><p>' + t('plan3') + '</p>' +
          '<p class="muted">' + t('plan_ai') + ' <em>(' + t('plan_pending') + ')</em></p></div>';
      }
      return h;
    }

    el.addEventListener('change', function (e) {
      if (e.target.id === 'pv-sel') { pid = e.target.value; render(); }
      else if (e.target.id === 'pv-lang') { lang = e.target.value; render(); }
    });
    el.addEventListener('input', function (e) {
      if (e.target.id === 'pv-pain') el.querySelector('#pv-pain-out').textContent = e.target.value;
    });
    el.addEventListener('click', function (e) {
      if (!pid) return;
      if (e.target.id === 'pv-conf') {
        H.state.feedback = H.state.feedback || [];
        H.state.feedback.push({ patient_id: pid, time: H.util.iso(H.util.now()), lang: lang, page: 'patientview', confusing: true });
        feedbackShown[pid] = true; render();
      } else if (e.target.id === 'pv-leave') {
        H.state.leaveNotices = H.state.leaveNotices || [];
        H.state.leaveNotices.push({ patient_id: pid, time: H.util.iso(H.util.now()), nurse_notified: true, plan_reviewed_by: null });
        H.emit('patientview:leaving', { patient_id: pid });
        leaveShown[pid] = true; render();
      }
    });
    el.addEventListener('submit', function (e) {
      if (e.target.id !== 'pv-form') return;
      e.preventDefault();
      var keys = Array.prototype.map.call(el.querySelectorAll('input[name="sym"]:checked'), function (c) { return c.value; });
      var red = SYMS.some(function (s) { return s[1] && keys.indexOf(s[0]) >= 0; });
      var res = H.logSymptomUpdate({
        patient_id: pid, symptoms: keys.map(function (k) { return EN_SYM[k]; }),
        pain: Number(el.querySelector('#pv-pain').value), duration: T.en[el.querySelector('#pv-dur').value], red_flag: red
      });
      if (res && res.error) msg[pid] = t('wait_more', { m: res.minutesUntil });
      else msg[pid] = red ? t('red') : t('ok');
      render();
    });

    H.on('rooms:updated', function () { if (pid) render(); });
    H.on('aiOffline', function () { if (pid) render(); });
    H.on('patient:updated', function (d) { if (d && d.source !== 'symptomUpdate' && pid && d.patient && d.patient.id === pid) render(); });
    render();
  }

  H.registerModule('patientview', { mount: mount });
})();
