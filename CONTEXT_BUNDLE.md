# CONTEXT_BUNDLE.md

A single file to paste into Claude (or any AI tool) so it understands the case, the rubric and our decisions without re-reading everything. Keep it updated when the team decides something.

---

## 1. The case (summary of the brief)

**Halvian Medical Center** is a fictional 320-bed regional hospital whose ED sees about **85,000 visits a year**. Leadership wants AI to make the ED faster, fairer and safer without hiring dozens of administrative staff. Many clinicians are skeptical of AI, so earning their trust is part of the challenge. AI must support clinicians and never replace clinical judgment.

- **Budget:** $500K/yr for AI tools and automation, about **$750K over 18 months**
- **Timeline:** improve ED operations within **18 months**: Pilot in months 1–6, Scale in months 7–18
- **Constraint:** use readily available AI and automation platforms. A qualified human stays accountable for every clinical decision.

**Payer mix:** Medicaid/CHIP 35%, Medicare 22%, commercial 33%, uninsured 8%. 16% of ED visits are admitted. Volume peaks on weekday mornings and evenings, Monday is the busiest day, and winter respiratory season adds about 20%.

**Systems:** a commercial EHR (charts, orders, results) plus a connected registration and scheduling system. Both can export data and connect to outside tools. **Bed status is tracked by phone and whiteboard.**

**Space:** 32 ED treatment rooms · 8 fast-track rooms · 4 resus/trauma bays · 4 behavioral health rooms · 40 waiting-room seats · 320 inpatient beds (24 ICU, about 88% occupied, about 40 open on average)

**Staff per shift (Day / Evening / Night):**
| Role | Day | Eve | Night |
|---|---|---|---|
| ED physicians | 4 | 4 | 2 |
| Advanced practice providers (APPs) | 3 | 3 | 1 |
| Triage & bedside nurses | 14 | 14 | 9 |
| Technicians & registration | 8 | 7 | 4 |

**Baseline performance:**
| Measure | Halvian | National |
|---|---|---|
| Median door-to-provider | 55 min | 30–40 min |
| Left without being seen (LWBS) | 4% | 2–3% |
| Median boarding time | 3.5 hrs | 2–2.5 hrs |
| Follow-up completion (14 days) | 40% | 40–50% |

**Outcome gaps (equity):**
| Group | Door-to-provider | LWBS |
|---|---|---|
| All | 55 min | 4.0% |
| Commercial | 48 min | 3.0% |
| Medicaid | 58 min | 4.6% |
| Uninsured | 64 min | 5.8% |

**Where intake time is lost today:** registration takes 5–10 min of manual entry with lines during surges. Triage takes 5–15 min; nurses sort arrivals by hand and acuity assignments vary. Waiting runs a median of 55 min, and 2+ hrs for low-urgency patients on surge days. Patients get few updates while they wait.

**Cost figures to use:** nurse $65/hr · physician $200/hr · APP $100/hr · registration/admin $35/hr · overtime 1.5× · net revenue per ED visit $1,500 · lost capacity per ED bed-hour occupied by a boarder about $350.

**Deliverable:** a 5–8 min video with slides covering, in order: (1) AI Tool Architecture, (2) Roadmap + Milestones, (3) Budget & ROI, (4) Risk Assessment & Mitigation, (5) Working MVP Demo (synthetic data only). Due **Nov 24, 11:59 pm**. File name: `Lastname, Lastname, Lastname - Case Competition Submission`.

## 2. Rubric (37 points)

| Section | Sub-criterion | Pts | What earns full marks |
|---|---|---|---|
| 1. Architecture | Focus area & rationale | 2 | Justified with baseline numbers; who is affected and why |
| | Automation vs human oversight | 2 | Clear AI-vs-human split, **names who is accountable** when AI is wrong |
| | Tool selection | 2 | Real, cost-aware tools tailored to the ED |
| | Technical design | 3 | Data, information flow, where it runs, cost, scalability, reliability, maintenance, privacy |
| 2. Roadmap | Measurable goals | 3 | 3–4 goals tied to baselines, **including an equity goal**, a tracking plan, and actions if goals are missed |
| | Phase 1 pilot | 3 | Milestone schedule, **criteria to move to Phase 2**, metrics including equity, adoption plan for skeptics |
| | Phase 2 scale | 2 | Uses pilot results, milestones, metrics, long-term ownership and funding |
| 3. Budget & ROI | Financial assumptions | 3 | Budget by phase, **hidden costs** (training time, security review), lower-cost alternatives |
| | Value vs traditional | 2 | Quantified versus staffing/overtime, shows the math, names the **least certain assumptions** |
| | KPIs & ROI | 2 | Measurable KPIs, overall ROI, **equity KPI** |
| 4. Risk | Risk identification | 2 | Bias, privacy, over-reliance, loss of human connection |
| | Data security | 2 | Protection plan plus a **specific breach/ransomware response** |
| | Oversight & contingency | 3 | Bias testing before launch, monitoring after, when to pause or retire, override without deferring, manual fallback |
| 5. Demo | | 3 | **All or nothing (1 or 3 pts).** Fully functional, meaningful AI, supports the focus area, synthetic data, polished |
| 6. Presentation | | 3 | Clear, organized, engaging, polished |

## 3. Decisions we've made

- **Focus area: Intake & Triage.** It has the largest gaps versus benchmark (55 vs 30–40 min, 4% vs 2–3% LWBS) and the largest equity gap (uninsured patients wait 64 min with 5.8% LWBS).
- **Demo = Option B staff dashboard** with a small patient-facing view. It must be **one** tool.
- **Bed capacity is not a separate focus area.** It only feeds triage by showing open rooms and estimating waits. Enterprise capacity platforms are out of scope on budget: Qventus and GE CareIntellect are quote-only, and Tampa General's GE command center cost about **$13M**, more than 17× our 18-month budget. That hospital has over 1,000 beds, so treat this as an order-of-magnitude benchmark.
- **Patient access:** no app or account. Patients use a QR code on their wristband, or an SMS link tied to the registration record, plus a kiosk for people without phones. Multiple languages. This is an equity decision: app and account flows lose exactly the Medicaid and uninsured patients with the worst outcomes. Track uptake by insurance group as an equity KPI.
- **Scoring matrix:** points only within an acuity level. Point sources are wait over target, vitals change, overdue re-check, nurse concern flag, and a confirmed symptom update. Nurses set the weights. Pain-only points are capped, one update per 30 min, a nurse confirms before points count, red flags page a nurse right away, and the button is labeled "Update my symptoms."
- **Anti-starvation:** extra points once a patient's wait exceeds the average for their acuity level, so no one keeps getting pushed down.
- **Fast-track:** the model scores fast-track eligibility from triage intake (chief complaint, vitals, age, arrival mode). The nurse accepts or overrides, and every override is logged. Accepted patients go to the 8 fast-track rooms with an APP. Set the cutoff so the **bounce-back rate** (fast-tracked patients sent back to the main ED) stays below a target, e.g. 5%.
- **Leaving patients:** a nurse gets an alert, and the AI drafts a "leave with a plan" message that the nurse reviews before it is sent.
- **Learning loop:** a monthly report compares symptom updates and overrides with what happened next. A clinical committee approves weight changes. The model never changes itself automatically.
- **Insurance** is never a model input. It is used only for fairness checks. Cited evidence: uninsured visits are 3.8 percentage points more likely to be nonurgent ([AJMC](https://www.ajmc.com/view/insurance-impact-on-nonurgent-and-primary-caresensitive-emergency-department-use)), so fast-track should disproportionately help the uninsured group.
- **Dropped:** "alternate hospital" redirect (EMTALA risk).
- **Privacy:** the tool runs inside Halvian's own cloud tenant under a BAA (the HIPAA contract that lets a vendor handle patient data). It collects only the identifiers it needs.

## 4. Draft numbers (to be refined by owners)

- **LWBS recovery:** 4% × 85,000 = 3,400 lost visits/yr. Reaching 2.5% recovers about 1,275 visits × $1,500 ≈ **$1.9M/yr**. Least certain assumption: that recovered visits earn the average net revenue, since uninsured visits bring in less.
- **Draft Month-18 goals:** door-to-provider 55 → 40 min · LWBS 4.0% → 2.5% · uninsured-vs-commercial wait gap 16 → ≤8 min and uninsured LWBS 5.8% → ≤3.5% · nurse override rate held between 10% and 30%.

**Final numbers (Nov 22, used in all docs and slides):**
- **Budget:** ≈$700K over 18 months (pilot $377K, scale $323K, incl. 10% contingency). Year-2 run cost ≈$140K/yr.
- **Value:** conservative ≈$1.03M/yr (1,275 visits × $750 after a 50% revenue haircut, plus 1,095 nurse-hours × $65).
- **ROI:** 121% during build, ≈640% in year 2. Break-even at LWBS 3.6%.
- **Traditional alternative:** one 24/7 triage nurse = $569K/yr ($854K on overtime).
- **Fast-track model:** cutoff 86%, bounce-back 3.3% (target < 5%), AUC 0.98 on synthetic data.
- **Slides:** https://claude.ai/artifact/MnpDwVSMsAaBWMczpnAJiW · **Script:** video/SCRIPT.md

## 5. Team
Arabella (Claude Max): ranking & scoring matrix, Roadmap · Sophie: fast-track intake, Budget & ROI, lead on data security · Priya (Claude Pro): capacity input, AI Architecture · **Everyone:** Risk Assessment & Mitigation (each person covers their own component), demo integration, video.
