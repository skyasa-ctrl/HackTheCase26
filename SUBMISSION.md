# SUBMISSION.md — deliverable checklist

**Due:** Nov 24, 2026, **11:59 pm**. Late videos are not considered.
**Format:** 5–8 min video with slides (Zoom recording is fine; team may appear on camera).
**File name:** `Lastname, Lastname, Lastname - Case Competition Submission`
**Upload:** the folder linked in the case brief.
**Slides:** https://claude.ai/artifact/MnpDwVSMsAaBWMczpnAJiW · **Script + demo click-path:** [video/SCRIPT.md](video/SCRIPT.md)

---

## Video outline (target 7:15, sections in required order)
| # | Section | Time | Presenter | Source |
|---|---|---|---|---|
| 0 | Hook: the 55-min / 4% / uninsured-and-Medicaid numbers | 0:20 | Arabella | [video/SCRIPT.md](video/SCRIPT.md) |
| 1 | AI Tool Architecture | 1:30 | Priya | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 2 | Roadmap & Milestones | 1:15 | Arabella | [ROADMAP.md](ROADMAP.md) |
| 3 | Budget & ROI | 1:15 | Sophie | [docs/BUDGET_ROI.md](docs/BUDGET_ROI.md) |
| 4 | Risk Assessment & Mitigation | 1:15 | Everyone | [docs/RISK_SECURITY.md](docs/RISK_SECURITY.md) |
| 5 | Live demo (one driver, others voice their part) | 1:30 | Arabella drives | `index.html` |
| 6 | Close: ask + Month-18 equity goal | 0:10 | Arabella | [video/SCRIPT.md](video/SCRIPT.md) |

## Rubric tracker (37 pts)
| Section | Pts | Owner | Status |
|---|---|---|---|
| 1. Focus area & rationale | 2 | Priya | 🟢 drafted |
| 1. Automation vs human oversight (name who is accountable) | 2 | Priya | 🟢 drafted |
| 1. Tool selection | 2 | Priya | 🟢 drafted |
| 1. Technical design | 3 | Priya | 🟢 drafted |
| 2. Measurable goals (incl. equity) | 3 | Arabella | 🟢 drafted |
| 2. Phase 1 pilot (criteria to move to Phase 2, adoption plan) | 3 | Arabella | 🟢 drafted |
| 2. Phase 2 scale (long-term ownership) | 2 | Arabella | 🟢 drafted |
| 3. Financial assumptions (hidden costs, alternatives) | 3 | Sophie | 🟢 drafted |
| 3. Value vs traditional (least certain assumptions) | 2 | Sophie | 🟢 drafted |
| 3. KPIs & ROI (equity KPI) | 2 | Sophie | 🟢 drafted |
| 4. Risk identification | 2 | Everyone | 🟢 drafted |
| 4. Data security (breach response) | 2 | Everyone (Sophie leads) | 🟢 drafted |
| 4. Oversight & contingency | 3 | Everyone | 🟢 drafted |
| 5. Demo (all or nothing: 1 or 3) | 3 | Everyone | 🟢 drafted |
| 6. Presentation | 3 | Everyone | 🟢 drafted |

## Demo must-haves (Option B)
- [x] Runs end-to-end on **synthetic data only**
- [x] Ranked queue with **visible reasoning** for each patient (Arabella)
- [x] Nurse **override** with logged reason (Arabella, Sophie)
- [x] Fast-track eligibility score + accept/override (Sophie)
- [x] "Update my symptoms" patient view with red-flag escalation (Sophie)
- [x] Rooms-open panel feeding wait-time ranges (Priya)
- [x] **Fairness panel** by insurance group (Arabella)
- [x] One app, polished, no broken buttons
- [x] **Real AI (Claude):** own-words symptom box → category, red flag, nurse summary (keyword safety net alongside)
- [x] **Real AI (Claude):** "leave with a plan" draft in the patient's language → nurse edits and approves before the patient sees it
- [x] Honest labels: synthetic-data caveat on model accuracy; "keyword rules, not AI" whenever Claude isn't connected
- [x] Fairness panel includes Medicaid and the same-acuity gap

## Timeline
| Date | Target |
|---|---|
| Nov 22 | ✅ Data generated, all docs drafted, demo tested end-to-end, slides + script drafted |
| Nov 23 | Demo tabs working + merged; slides drafted; script written |
| Nov 24 | Rehearse, record, edit, **upload before 11:59 pm** (aim for 9 pm) |

## Final checks before upload
- [ ] Video is 5–8 min (target 7:15)
- [ ] Header showed "AI: Claude connected" during the demo
- [ ] Slides 6, 10, 11 and 15 match the updated docs: Medicaid goals, same-acuity gap, margin-based value ($454K/yr), break-even 0.55 pts, Year-2 ROI ≈224%
- [ ] Teammates' last names filled in on slides 1 and 15
- [ ] Sections are in the required order
- [ ] No real patient data appears anywhere
- [ ] File name matches the required format
