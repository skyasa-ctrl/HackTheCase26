# HackTheCase26 — Halvian ED Triage Assistant

Our team's submission for the 2026 Healthcare AI Hack the Case.

**Focus area:** Intake & Triage at Halvian Medical Center's emergency department.
**One-line pitch:** An AI triage assistant that helps nurses order the waiting room fairly, sends low-urgency patients to fast-track faster, and keeps patients informed while they wait. A nurse makes and owns every decision.

**Deadline:** Video due **Nov 24, 2026, 11:59 pm**. See [SUBMISSION.md](SUBMISSION.md).

---

## Team & ownership

| Person | Demo piece | Rubric sections |
|---|---|---|
| **Arabella** | Ranking tool & scoring matrix (`src/ranking/`) | 2. Roadmap & Milestones ([ROADMAP.md](ROADMAP.md)) |
| **Sophie** | Fast-track intake (`src/fasttrack/`) | 3. Budget & ROI ([docs/BUDGET_ROI.md](docs/BUDGET_ROI.md)), lead on data security |
| **Priya** | Bed / room capacity input (`src/capacity/`) | 1. AI Tool Architecture ([ARCHITECTURE.md](ARCHITECTURE.md)) |
| **Everyone** | Integrating the parts into one app (`index.html`, `src/shared/`) | 4. Risk Assessment & Mitigation ([docs/RISK_SECURITY.md](docs/RISK_SECURITY.md)), 5. Demo, 6. Presentation ([slides/](slides/), [video/](video/)) |

> **Risk is shared:** each person writes the risks, oversight steps and manual fallback for their own component in [docs/RISK_SECURITY.md](docs/RISK_SECURITY.md).

---

## Repo layout

```
HackTheCase26/
├── README.md            ← you are here
├── CLAUDE.md            ← rules for Claude Code sessions in this repo
├── CONTEXT_BUNDLE.md    ← case brief + rubric + decisions; paste into any AI chat
├── ARCHITECTURE.md      ← Section 1 (Priya)
├── ROADMAP.md           ← Section 2 (Arabella)
├── SUBMISSION.md        ← deliverable checklist, video outline, rubric tracker
├── docs/
│   ├── BUDGET_ROI.md    ← Section 3 (Sophie)
│   └── RISK_SECURITY.md ← Section 4 (everyone)
├── data/                ← SHARED synthetic dataset (generated; see Data & model)
├── scripts/             ← generate_data.py, train_fasttrack.py
├── src/
│   ├── shared/          ← shared JS/CSS, data loading (coordinate edits)
│   ├── ranking/         ← Arabella
│   ├── fasttrack/       ← Sophie
│   └── capacity/        ← Priya
├── slides/              ← slide deck exports
└── video/               ← script + recording notes (don't commit large video files)
```

## Data & model

All data is synthetic and deterministic (fixed seed). To regenerate everything (needs only Python 3.12, standard library):

```
python scripts/generate_data.py && python scripts/train_fasttrack.py
```

- `generate_data.py` writes `data/patients`, `data/history` (3,000 past visits), `data/rooms` as `.json` plus `.js` (the `.js` files set `Halvian.data.*` so the app works from `file://`).
- `train_fasttrack.py` trains a small logistic regression on `history` using intake features only (acuity, vitals flags, age band, arrival mode, complaint category). **Insurance is never a feature.** It writes `data/fasttrack_model.json/.js` with weights, the cutoff (chosen so bounce-back stays under 5% on held-out data), metrics, and a per-insurance fairness table.
- Demo "now" is Mon 2026-11-23 10:30. Do not hand-edit generated files; change the scripts and re-run.

## How we work

1. **Pull before you start:** `git pull`
2. **Work on your own branch:** `git checkout -b arabella/ranking` (or `sophie/fasttrack`, `priya/capacity`)
3. **Stay in your own folder.** `data/` and `src/shared/` are shared, so post in the group chat before changing them.
4. **Push and open a pull request** into `main`. Another teammate gives it a quick look, then it gets merged.
5. **Synthetic data only.** Never use real patient information anywhere in this repo.

## Running the demo

The demo is a static web app with no build step and no server. Open `index.html` in a browser, or use the GitHub Pages link once Pages is enabled (Settings → Pages → `main` branch).

**Connecting the AI (needed for the demo video):** click the **AI** pill in the header, choose **Gemini** (default) or **Claude**, paste that provider's API key, and click **Connect**. A free Gemini key comes from Google AI Studio (aistudio.google.com). The pill should read "AI: Gemini connected". The key stays in that browser tab's memory only. It is never saved, and it must **never be committed**. Without a key, the two AI features fall back to keyword rules and say so on screen.

GitHub Pages link:
`https://skyasa-ctrl.github.io/HackTheCase26/`
