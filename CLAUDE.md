# CLAUDE.md — instructions for Claude Code in this repo

Read [CONTEXT_BUNDLE.md](CONTEXT_BUNDLE.md) first. It has the case brief, the rubric, and the decisions the team has already made. Do not re-open those decisions unless a teammate asks.

## What we're building
A single static web app: the **Halvian ED Triage Assistant**, a staff-facing dashboard (rubric demo Option B) with a small patient-facing "Update my symptoms" view. Focus area: **Intake & Triage**.

Three tabs, one app:
- **Queue** (`src/ranking/`, Arabella): ranked waiting list, per-patient score breakdown, nurse override, adjustable scoring weights, fairness panel by insurance group.
- **Fast-track** (`src/fasttrack/`, Sophie): fast-track eligibility score with a cutoff, accept/override with logged reason, patient symptom-update view.
- **Capacity** (`src/capacity/`, Priya): open ED / fast-track / behavioral health rooms and boarding count, used to estimate wait-time ranges.

## Hard rules (these come from the case brief and our design decisions)
1. **Synthetic data only.** Never use, generate from, or ask for real patient data.
2. **AI advises, a human decides.** Every AI output has an accept/override control, and every override is logged with a reason. Nothing changes a patient's queue position or stream until a nurse confirms it.
3. **Acuity boundary.** Ranking points only reorder patients *within* the same acuity (ESI) level. A lower-urgency patient can never move above a higher-urgency one.
4. **Symptom-update safeguards.** A nurse must confirm before points count. Pain-only points are capped. Patients can submit at most one update every 30 minutes. Red-flag symptoms page a nurse right away and bypass scoring. The button is labeled "Update my symptoms," never "see me sooner."
5. **Insurance is never a model input.** It is used only in the fairness panel, to compare waits, scores, LWBS and override rates across groups.
6. **No redirecting patients to other hospitals** once they arrive at the ED (EMTALA).
7. **Wait-time estimates** are shown as ranges and never shown to acuity 1–2 patients.
8. **No secrets in the client.** This is a static site on GitHub Pages, so never commit API keys. Scoring and fast-track models run in the browser (rules, and coefficients from a model trained offline and exported to JSON). The **one exception** is `src/shared/ai.js`, which calls an LLM (Gemini by default, Claude optional) for the two text tasks (sorting own-words symptom descriptions, drafting leave-with-a-plan messages). It uses a key the presenter pastes in at runtime (held in memory only), or `window.claude` when run as a Claude artifact. It must always fall back to the labelled keyword rules, and never label rules output as AI.
9. **Patient-facing AI text needs a nurse first.** An AI-drafted message reaches a patient only after a nurse approves it. The one exception is a generic acknowledgment ("a nurse will review this"), which contains no clinical advice.

## Tech conventions
- Plain HTML + CSS + vanilla JS. **Classic `<script src>` tags only: no ES modules, no `fetch()` of local files, no CDN.** (The only network calls are `ai.js` calling the Gemini or Claude API.) Teammates open `index.html` by double-clicking (file://), where module imports and JSON fetches fail. No build step, no framework, works offline.
- Everything hangs off one global namespace, `window.Halvian` (state, event bus, helpers, `registerModule`; see the header comment of `src/shared/core.js`). Each tab is a module: `Halvian.registerModule('ranking' | 'fasttrack' | 'capacity' | 'patientview', {mount(el)})`.
- Data ships as JS files that assign globals (`Halvian.data.patients`, `.history`, `.rooms`, `.fasttrackModel`), with matching `.json` copies for reference. Regenerate with `python scripts/generate_data.py && python scripts/train_fasttrack.py`. Never hand-edit generated files.
- `Halvian.state.aiOffline` true means fall back to ESI-then-arrival ordering and hide AI suggestions (`Halvian.util.esiArrivalCompare`).
- Use `Halvian.util.now()` (fixed demo time, Mon 2026-11-23 10:30), never `new Date()`.
- Shared code lives in `src/shared/`, shared data in `data/`. Coordinate before changing either.
- Each owner works only in their own `src/<area>/` folder and on their own branch (`<name>/<area>`).
- Keep it accessible: readable contrast, keyboard-usable controls, plain-language text, and patient-facing text ready for translation.

## Shared data schema (`data/patients.json`)
Agree on this before writing feature code. Draft:

```json
{
  "id": "P0001",
  "arrival_time": "2026-11-23T09:14:00",
  "age": 34,
  "sex": "F",
  "preferred_language": "es",
  "insurance": "medicaid",          // FAIRNESS PANEL ONLY. Never a model input.
  "arrival_mode": "walk-in",        // walk-in | ambulance | transfer
  "chief_complaint": "ankle injury",
  "vitals": { "hr": 92, "sbp": 128, "rr": 16, "spo2": 98, "temp_c": 36.9 },
  "pain": 6,
  "esi": 4,                          // nurse-assigned acuity, 1 (most urgent) to 5
  "last_recheck_time": "2026-11-23T09:40:00",
  "nurse_concern_flag": false,
  "symptom_updates": [],             // {time, symptoms[], pain, duration, confirmed_by (null = pending), red_flag, nurse_paged?}
  "status": "waiting",               // waiting | fast-track | roomed | left
  "outcome": {                       // ground truth, used for evaluation only
    "disposition": "discharged",     // discharged | admitted | transferred | lwbs
    "fast_track_appropriate": true,
    "door_to_provider_min": 47
  }
}
```

`data/rooms.json` (Priya) holds room inventory and status: 32 ED, 8 fast-track, 4 resus/trauma, 4 behavioral health, and how many are held by boarding patients.

## When editing docs
`ARCHITECTURE.md`, `ROADMAP.md`, `docs/*.md`: keep the numbers consistent with CONTEXT_BUNDLE.md. Use the case's cost figures. State any assumption you add, and call out the least certain ones.
