# Video script (target 7:15, hard limit 5–8 min)

**Slides:** [Claude Slides deck](https://claude.ai/artifact/MnpDwVSMsAaBWMczpnAJiW). Each slide's speaker notes hold the same lines as this script. The deck can be exported to PowerPoint or PDF.
**Demo:** open `index.html` in Chrome, full screen, zoom 90%. Connect the AI first (see below).
**Recording:** Zoom, share screen; one person drives the screen, and each presenter unmutes for their part. Record in one take per section if needed and join them in any editor.
**File name:** `Lastname, Lastname, Lastname - Case Competition Submission`

| Time | Slide | Presenter | Say |
|---|---|---|---|
| 0:00–0:20 | 1–2 Cover + problem | Arabella | "We're Arabella, Sophie and Priya, focused on Intake and Triage at Halvian. Today, median door-to-provider is 55 minutes against 30–40 nationally, 3,400 patients a year leave unseen, and uninsured and Medicaid patients wait longest and leave most often." |
| 0:20–0:45 | 3 Focus | Priya | Why intake and triage; who it affects; why not the other areas (see slide notes) |
| 0:45–1:15 | 4 AI vs human | Priya | "The AI suggests and explains; a named person decides." Name the charge nurse, triage nurse, committee, and the medical director + nurse manager as owners. |
| 1:15–1:50 | 5 Tools + design | Priya | Walk the diagram left to right. Stress: an LLM (Gemini) for two text tasks, inside Halvian's own cloud under a BAA; insurance never an input; the "AI offline" fallback. |
| 1:50–2:15 | 6 Goals | Arabella | Four goals. Equity is measured **within the same acuity level**, for uninsured *and* Medicaid patients. Each goal has a trigger and an action, tracked weekly on the dashboard you'll see in the demo's Results tab. |
| 2:15–2:45 | 7 Pilot | Arabella | Silent mode in month 2; the go/no-go criteria; adoption plan for skeptical nurses and wary patients |
| 2:45–3:05 | 8 Scale | Arabella | Uses pilot results; training before each expansion; winter surge; who owns and funds it |
| 3:05–3:30 | 9 Budget | Sophie | ≈$700K under the $750K cap; hidden costs counted; cheaper alternatives |
| 3:30–3:55 | 10 Value | Sophie | "We value a recovered visit at its margin, not its revenue: $300, not $1,500. Conservative value ≈$454K a year. One 24/7 triage nurse costs $569K a year, forever; we're cheaper than that from Month 11." |
| 3:55–4:20 | 11 Break-even + ROI | Sophie | "The tool pays its Year-2 running cost if LWBS falls just half a point. Year-2 ROI ≈224%. Least certain assumption: how much of the LWBS drop is ours, which is why the pilot compares against last year's same shifts." Equity KPIs. |
| 4:20–5:00 | 12 Risks | Arabella | Bias, acuity boundary, gaming, over-reliance, AI misreading words (keyword safety net + nurse confirms), patients wary of identity checks |
| 5:00–5:35 | 13 Security | Sophie | Breach timeline (paper triage within the hour); pause triggers; manual fallback |
| 5:35–7:05 | 14 → **live demo** | Arabella drives; others voice their part | Click-path below |
| 7:05–7:15 | 15 Ask | Arabella | "Fund a six-month pilot on one shift. By month 18: 40 minutes, 2.5% LWBS, and the same-acuity gaps for uninsured and Medicaid patients cut in half, with a nurse deciding every step. Thank you." |

**Pacing:** target 7:15, leaving 45 s of buffer under the 8-minute limit. One person drives the demo so there are no hand-overs of the screen. Do a timed dry run.

## Before recording the demo (2 min)
1. Open `index.html` in Chrome, full screen, zoom 90%. Reload so the demo starts fresh.
2. **Connect the AI:** click the **AI** pill in the header, keep **Gemini** selected, paste a Gemini API key (free from Google AI Studio), click **Connect**. The pill must read **"AI: Gemini connected"**. Never show the key on screen, and never commit it.
3. If AI can't connect, the demo still works, but every AI screen will say "keyword rules, not AI". In that case, say so out loud rather than calling it AI.

## Demo click-path (≈90 s). Practice twice.

**Queue (30 s)**
1. "This is the charge nurse's queue. Patients are grouped by acuity. Points only reorder patients *within* a level, so nobody jumps a sicker patient."
2. On an ESI-3 row, click **Show reasoning**: "Every score shows exactly why: wait over target, abnormal vitals, overdue re-check."
3. Click **Pin to top** on a row → reason *Clinical judgment* → **Save override**: "The nurse is always in charge, and every override is logged."

**Patient view + AI (30 s)**
4. Click **Patient view**, choose a waiting ESI 4 patient, switch language to **Español**.
5. In **"Describe it in your own words"**, type: *me duele más el tobillo y ahora siento el pecho apretado*. Click **Send**. "Gemini reads the patient's own words, in any language. It flags possible chest symptoms, and a keyword safety net checks too, so either can page a nurse."
6. Click **I'm thinking of leaving**. "Gemini drafts a leave-with-a-plan message in Spanish. The patient only sees it after a nurse approves it."
7. Back on **Queue**: point at the red **Nurse paged** banner, which shows the AI summary next to the patient's words. In the **Thinking of leaving** card, edit one word of the draft, then click **Approve and send to patient**. "A nurse checks every word that reaches the patient."

**Fast-track (15 s)**
8. Click **Fast-track**. Point at the right-hand **AI suggestions**: "Send next, video-consult candidates, and near-misses for review, all generated from the model's scores and live room status." Click **Why?** on a row → **Accept**. "An explainable eligibility score; eligible patients are ordered longest-wait first, so it stays fair. These accuracy numbers are on synthetic data; we re-test on Halvian's own data in silent mode before go-live."

**Capacity + Results + fallback (15 s)**
9. Click **Capacity**, change a room's status, move the **what-if** slider: "Room status replaces the phone and whiteboard, and feeds patients' wait ranges."
10. Click **Results**: "This is how the committee tracks our goals: door-to-provider, LWBS, and the equity gaps for uninsured and Medicaid patients, measured within the same acuity level. These pilot numbers are simulated to show the tracking, not real results. Insurance is never used in scoring, only here."
11. Tick **AI offline**: "If anything fails, suggestions disappear and the queue falls back to acuity, then arrival time: exactly how the ED runs today."

## Before uploading
- [ ] 5–8 minutes long (target 7:15)
- [ ] Header showed "AI: Gemini connected" during the demo (or AI was described honestly as the keyword fallback)
- [ ] Slides 10–11 updated to the margin-based value ($454K/yr, break-even 0.55 pts, Year-2 ROI ≈224%)
- [ ] Sections in order: Architecture → Roadmap → Budget → Risk → Demo
- [ ] Only synthetic data on screen
- [ ] File name matches the required format
- [ ] Teammates' last names filled in on slides 1 and 15
