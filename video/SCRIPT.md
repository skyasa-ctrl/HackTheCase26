# Video script (target 7:30, hard limit 5–8 min)

**Slides:** [Claude Slides deck](https://claude.ai/artifact/MnpDwVSMsAaBWMczpnAJiW). Each slide's speaker notes hold the same lines as this script. The deck can be exported to PowerPoint or PDF.
**Demo:** open `index.html` in Chrome, full screen, zoom 90%. Reload before recording so the demo starts fresh.
**Recording:** Zoom, share screen, each presenter unmutes for their part. Record in one take per section if needed and join them in any editor.
**File name:** `Lastname, Lastname, Lastname - Case Competition Submission`

| Time | Slide | Presenter | Say |
|---|---|---|---|
| 0:00–0:20 | 1 Cover | Arabella | "Hi, we're Arabella, Sophie and Priya. Our focus area is Intake and Triage at Halvian's ED: architecture, roadmap, budget, risks, then a live demo." |
| 0:20–0:45 | 2 The problem | Arabella | "Picture a patient with a sprained ankle on a Monday morning. Two hours in, no idea how much longer, so she leaves. That's about 3,400 patients a year. Median door-to-provider is 55 minutes vs 30–40 nationally, and uninsured patients wait 64 minutes and leave nearly twice as often." |
| 0:45–1:10 | 3 Focus | Priya | Why intake and triage; who it affects; why not the other areas (see slide notes) |
| 1:10–1:40 | 4 AI vs human | Priya | "The AI suggests and explains; a named person decides." Name the charge nurse, triage nurse, committee, and the medical director + nurse manager as owners. |
| 1:40–2:15 | 5 Tools + design | Priya | Walk the diagram left to right. Stress: Halvian's own cloud under a BAA, insurance never an input, "AI offline" fallback. |
| 2:15–2:40 | 6 Goals | Arabella | Four goals incl. two equity goals; each has a trigger and an action |
| 2:40–3:10 | 7 Pilot | Arabella | Silent mode in month 2; the five go/no-go criteria; adoption plan for skeptics |
| 3:10–3:30 | 8 Scale | Arabella | Uses pilot results; winter surge; who owns it; funded from recovered revenue |
| 3:30–3:55 | 9 Budget | Sophie | ≈$700K under the $750K cap; hidden costs counted; cheaper alternatives |
| 3:55–4:20 | 10 Value | Sophie | One 24/7 nurse = $569K/yr; our run cost $140K/yr; ≈$1M/yr conservative value |
| 4:20–4:45 | 11 ROI | Sophie | 121% / 640% ROI; break-even at LWBS 3.6%; least certain assumption; equity KPIs |
| 4:45–5:15 | 12 Risks | Arabella | Bias, acuity boundary, gaming, over-reliance, loss of human connection |
| 5:15–5:45 | 13 Security | Sophie | Breach timeline (paper triage within the hour); pause triggers; manual fallback |
| 5:45–7:15 | 14 → **live demo** | All | Click-path below |
| 7:15–7:30 | 15 Ask | Arabella | "Fund a six-month pilot on one shift. By month 18: 40 minutes, 2.5% LWBS, and the uninsured gap cut in half, with a nurse deciding every step. Thank you." |

## Demo click-path (≈90 s). Practice twice.

**Queue: Arabella (35 s)**
1. "This is the charge nurse's queue. Patients are grouped by acuity. Points only reorder patients *within* a level, so nobody ever jumps a sicker patient."
2. Point at the red banner: "A patient reported chest pressure on their phone. Red flags skip scoring and page a nurse right away." Click **I have assessed this patient**.
3. On an ESI-3 row, click **Show reasoning**: "Every score shows exactly why: wait over target, abnormal vitals, overdue re-check."
4. Find the row with **Symptom update pending** and click **Confirm**: "Patient updates only count once a nurse confirms them."
5. Click **Pin to top** on any row → reason *Clinical judgment* → **Save override**: "The nurse is always in charge, and every override is logged."
6. Scroll to the **Fairness check**: "Insurance is never used in scoring. We only use it here, to check the tool is fair."

**Fast-track: Sophie (25 s)**
7. Click the **Fast-track** tab. Click **Why?** on an eligible ESI-4/5 patient: "The model gives an explainable eligibility score."
8. Click **Accept** on one patient: "The nurse accepts or overrides it. The cutoff keeps bounce-back under 5%, and uninsured patients get the highest fast-track rate."

**Capacity: Priya (15 s)**
9. Click the **Capacity** tab. Click an ED room tile to change its status: "Room status replaces the phone and whiteboard." Move the **what-if** slider: "Freeing boarded rooms shortens the estimated waits right away."

**Patient view + fallback: Sophie / Arabella (15 s)**
10. Click the **Patient view** tab and choose a patient: "No app or account, just the wristband QR code. They see a wait *range*, and can tap **Update my symptoms**." Switch the language to **Español**.
11. Tick **AI offline** in the header: "If anything fails, suggestions disappear and the queue falls back to acuity, then arrival time, which is exactly how the ED runs today."

## Before uploading
- [ ] 5–8 minutes long
- [ ] Sections in order: Architecture → Roadmap → Budget → Risk → Demo
- [ ] Only synthetic data on screen
- [ ] File name matches the required format
- [ ] Teammates' last names filled in on slides 1 and 15
