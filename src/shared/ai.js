/* Halvian AI helper: the demo's language-model features. SYNTHETIC DATA ONLY.
 *
 * Two real AI tasks, both low-risk text work that a nurse always reviews:
 *   1. triage(text, lang, patient)  : sorts a patient's own-words symptom description into a
 *      category, flags red-flag symptoms, writes a one-line summary for the nurse and a short
 *      reply to the patient in their language.
 *   2. leavePlan(patient, lang)     : drafts a "leave with a plan" message in the patient's language
 *      for a patient who says they are thinking of leaving. A nurse must approve it before the
 *      patient sees it.
 *
 * How it connects to Google Gemini:
 *   - A presenter pastes a Google Gemini API key into the header panel. The key is held in
 *     memory for this page only. It is never saved, logged, or committed. It is sent in the
 *     x-goog-api-key request header, never in the URL.
 *   - No key, or "AI offline" switched on: a simple keyword rule set is used instead and
 *     every screen says "rules fallback, not AI". Nothing pretends to be AI when it isn't.
 *   - Any Gemini failure (HTTP error, safety block, empty or non-JSON reply) also falls back to
 *     the rules, and the result carries an .error note.
 *   - API reference: https://ai.google.dev/api/generate-content  (models.generateContent, v1beta)
 *     Model: gemini-3.5-flash-lite (stable Flash-Lite tier): https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
 *
 * Safety rules built in:
 *   - Red flags are OR-ed: if either the AI or the keyword rules see a red flag, a nurse is paged.
 *   - Obvious identifiers (long digit strings, emails) are stripped before text is sent.
 *   - No insurance, name or diagnosis is ever sent; only visit ID, ESI, complaint and age band.
 *
 * Public API: Halvian.ai.{mode(), label(), setKey(k), triage(text, lang, patient), leavePlan(patient, lang), CATEGORY_LABELS}
 */
(function () {
  'use strict';
  var H = (window.Halvian = window.Halvian || {});
  var key = null;                       // memory only
  var MODEL = 'gemini-3.5-flash-lite';
  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

  var CATEGORY_LABELS = {
    chest_cardiac: 'Chest or heart symptoms', respiratory: 'Breathing symptoms', neuro: 'Neurological symptoms',
    abdominal: 'Stomach / abdominal symptoms', trauma_major: 'Serious injury', injury_minor: 'Minor injury',
    infection_minor: 'Minor infection symptoms', skin: 'Skin problem', behavioral: 'Mental health concern',
    obstetric: 'Pregnancy-related', other: 'Other symptoms'
  };

  // Keyword rules: the fallback, and a safety net that runs alongside the AI.
  var RED_RULES = [
    /chest.{0,20}(pain|pressure|tight|hurt)/i, /can'?t breathe|cannot breathe|short(ness)? of breath|trouble breathing/i,
    /faint|passed out|black(ed)? out/i, /confus/i, /bleeding (a lot|heavily)|heavy bleeding|vomiting blood/i,
    /face (droop|drooping)|slurred|weak(ness)? on one side|can'?t move (my )?(arm|leg)/i, /seizure/i,
    /suicid|kill myself|hurt myself/i,
    /dolor (de|en el) pecho|(presi[oó]n|opresi[oó]n) en el pecho|pecho apretado|me duele el pecho/i, /no puedo respirar|falta de aire/i, /desmay/i,
    /confundid/i, /sangr(ando|ado) mucho|v[oó]mito con sangre/i, /cara ca[ií]da|habla arrastrada|debilidad de un lado/i,
    /convulsi/i, /suicid|hacerme da[nñ]o/i
  ];
  var CAT_RULES = [
    ['chest_cardiac', /chest|heart|palpitat|pecho|coraz[oó]n/i], ['respiratory', /breath|cough|asthma|wheez|respir|tos/i],
    ['neuro', /head(ache)?|dizz|numb|confus|cabeza|mare/i], ['abdominal', /stomach|belly|abdom|vomit|nause|diarr|est[oó]mago|v[oó]mit/i],
    ['injury_minor', /ankle|wrist|sprain|cut|knee|tobillo|mu[nñ]eca|rodilla|corte/i], ['infection_minor', /throat|ear|fever|urin|garganta|o[ií]do|fiebre/i],
    ['skin', /rash|itch|bite|abscess|sarpullido|picaz[oó]n|picadura/i], ['behavioral', /anxi|panic|suicid|ansiedad|p[aá]nico/i],
    ['obstetric', /pregnan|embaraz/i]
  ];

  function log(task, source, ok, note) {
    if (!H.state) return;
    H.state.aiLog = H.state.aiLog || [];
    H.state.aiLog.push({ time: H.util ? H.util.iso(H.util.now()) : '', task: task, source: source, ok: ok, note: note || '' });
  }

  function scrub(text) {
    return String(text || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]').replace(/\+?\d[\d\s().-]{6,}\d/g, '[number removed]').slice(0, 600);
  }

  function mode() {
    if (H.state && H.state.aiOffline) return 'offline';
    if (key) return 'api';
    return 'none';
  }

  function label() {
    var m = mode();
    return m === 'api' ? 'AI: connected (Gemini)' :
      m === 'offline' ? 'AI: offline' : 'AI: not connected';
  }

  /* Gemini generateContent. Key goes in a header so it never appears in a URL or log.
   * json=true asks for application/json output (generationConfig.responseMimeType). */
  function complete(prompt, json) {
    if (mode() !== 'api') return Promise.reject(new Error(mode() === 'offline' ? 'AI is switched off' : 'AI not connected'));
    var gen = { maxOutputTokens: 1024 };
    if (json) gen.responseMimeType = 'application/json';
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Gemini API ' + r.status + ': ' + t.replace(key, '[key]').slice(0, 160)); });
      return r.json();
    }).then(function (j) {
      if (j && j.promptFeedback && j.promptFeedback.blockReason) throw new Error('Gemini blocked the request (' + j.promptFeedback.blockReason + ')');
      var c = j && j.candidates && j.candidates[0];
      if (!c) throw new Error('Gemini returned no candidates');
      var text = ((c.content && c.content.parts) || []).map(function (x) { return x.text || ''; }).join('').trim();
      if (!text) throw new Error('Gemini returned an empty reply' + (c.finishReason ? ' (' + c.finishReason + ')' : ''));
      if (c.finishReason === 'SAFETY') throw new Error('Gemini blocked the reply (SAFETY)');
      return text;
    });
  }

  function parseJson(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('No JSON in AI reply');
    return JSON.parse(s.slice(a, b + 1));
  }

  function ageBand(age) { return age < 5 ? 'under 5' : age < 18 ? '5-17' : age < 65 ? '18-64' : '65+'; }

  function rulesTriage(text, lang) {
    var red = RED_RULES.filter(function (r) { return r.test(text); });
    var cat = 'other';
    for (var i = 0; i < CAT_RULES.length; i++) { if (CAT_RULES[i][1].test(text)) { cat = CAT_RULES[i][0]; break; } }
    return {
      category: cat, red_flag: red.length > 0, red_flag_reason: red.length ? 'Matched a red-flag keyword' : '',
      nurse_summary: 'Patient wrote: "' + String(text).slice(0, 120) + '"',
      patient_reply: lang === 'es' ? 'Gracias. Una enfermera revisará su mensaje.' : 'Thank you. A nurse will review your message.',
      source: 'rules'
    };
  }

  /** Sort an own-words symptom description. Always resolves (falls back to rules). */
  function triage(text, lang, p) {
    var clean = scrub(text), rules = rulesTriage(clean, lang);
    if (mode() === 'offline' || mode() === 'none') { log('triage', 'rules', true, mode()); return Promise.resolve(rules); }
    var prompt =
      'You support (never replace) an emergency department triage nurse. A waiting patient typed how they feel now.\n' +
      'Patient context (no identifiers): triage level ESI ' + p.esi + ', chief complaint "' + p.chief_complaint + '", age band ' + ageBand(p.age) + '.\n' +
      'Patient text (language: ' + (lang === 'es' ? 'Spanish' : 'English') + '): """' + clean + '"""\n\n' +
      'Return ONLY a JSON object with these keys:\n' +
      '- "category": one of ' + Object.keys(CATEGORY_LABELS).join(', ') + '\n' +
      '- "red_flag": true if the text suggests a possible emergency needing immediate nurse assessment (chest pain or pressure, trouble breathing, fainting, confusion, heavy bleeding, stroke signs, seizure, thoughts of self-harm, rapidly worsening symptoms); when unsure, true\n' +
      '- "red_flag_reason": short phrase, or ""\n' +
      '- "nurse_summary": one plain English sentence (max 25 words) for the nurse; no diagnosis\n' +
      '- "patient_reply": one or two calm sentences to the patient in ' + (lang === 'es' ? 'Spanish' : 'English') + ': acknowledge, say a nurse will review, and if red_flag say a nurse is coming now. No diagnosis, no wait-time promises.';
    return complete(prompt, true).then(function (txt) {
      var j = parseJson(txt);
      var cat = CATEGORY_LABELS[j.category] ? j.category : rules.category;
      var res = {
        category: cat, red_flag: !!j.red_flag || rules.red_flag,                 // OR: safety net
        red_flag_reason: j.red_flag_reason || (rules.red_flag ? 'Keyword safety net' : ''),
        nurse_summary: String(j.nurse_summary || rules.nurse_summary).slice(0, 220),
        patient_reply: String(j.patient_reply || rules.patient_reply).slice(0, 300),
        source: 'gemini'
      };
      log('triage', 'gemini', true);
      return res;
    }).catch(function (err) {
      log('triage', 'rules', false, err.message);
      rules.error = err.message;
      return rules;
    });
  }

  var TEMPLATE = {
    en: 'Where to go: your regular doctor or an urgent care clinic today. Warning signs: come back or call 911 for chest pain, trouble breathing, fainting, confusion, severe bleeding, or face drooping or weakness on one side. Follow-up: leave your phone number at the desk so a nurse can check on you.',
    es: 'A dónde ir: su médico de siempre o una clínica de atención urgente hoy. Señales de alarma: regrese o llame al 911 si tiene dolor de pecho, dificultad para respirar, desmayo, confusión, sangrado fuerte, o cara caída o debilidad de un lado. Seguimiento: deje su teléfono en el mostrador para que una enfermera lo llame.'
  };

  /** Draft a "leave with a plan" message. Always resolves (falls back to the standard template). */
  function leavePlan(p, lang) {
    var fallback = { text: TEMPLATE[lang] || TEMPLATE.en, source: 'template' };
    if (mode() === 'offline' || mode() === 'none') { log('leavePlan', 'template', true, mode()); return Promise.resolve(fallback); }
    var prompt =
      'Draft a short message for an emergency department patient who says they are thinking of leaving before being seen. ' +
      'A nurse will review and edit it before the patient sees it.\n' +
      'Context (no identifiers): triage level ESI ' + p.esi + ', chief complaint "' + p.chief_complaint + '", age band ' + ageBand(p.age) + '.\n' +
      'Write in ' + (lang === 'es' ? 'Spanish' : 'English') + ', at a 6th-grade reading level, max 90 words, three short labelled parts: ' +
      '(1) where to get care today instead, (2) warning signs specific to this complaint that mean return or call 911, (3) follow-up. ' +
      'Encourage them to stay if they can. No diagnosis. Plain text only.';
    return complete(prompt).then(function (txt) {
      log('leavePlan', 'gemini', true);
      return { text: String(txt).trim().slice(0, 900), source: 'gemini' };
    }).catch(function (err) {
      log('leavePlan', 'template', false, err.message);
      fallback.error = err.message;
      return fallback;
    });
  }

  /* ---------- header connect panel ---------- */
  function initPanel() {
    var status = document.getElementById('ai-status');
    var input = document.getElementById('ai-key'), use = document.getElementById('ai-key-use'), clear = document.getElementById('ai-key-clear');
    function paint() {
      if (status) { status.textContent = label(); status.setAttribute('data-state', mode()); }
          }
    if (use) use.addEventListener('click', function () {
      var k = (input && input.value || '').trim();
      if (!k) { if (input) input.focus(); return; }
      key = k; if (input) input.value = '';
      paint(); if (H.emit) H.emit('ai:status', mode());
    });
    if (clear) clear.addEventListener('click', function () { key = null; paint(); if (H.emit) H.emit('ai:status', mode()); });
    if (H.on) H.on('aiOffline', paint);
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
  else initPanel();

  H.ai = {
    mode: mode, label: label, triage: triage, leavePlan: leavePlan, CATEGORY_LABELS: CATEGORY_LABELS,
    setKey: function (k) { key = k || null; }
  };
})();
