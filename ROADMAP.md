# 2. Roadmap & Milestones

**Owner:** Arabella · **Rubric:** 8 pts (Goals 3 · Pilot 3 · Scale 2)
Status: 🟢 complete draft

---

## 2.1 Month-18 goals (3 pts)
| # | Goal | Baseline | Month-18 target | How tracked | If off track |
|---|---|---|---|---|---|
| 1 | **Median door-to-provider** | 55 min | **≤ 40 min** (national 30–40) | EHR timestamps; weekly dashboard by shift and day | Not ≥10% better by month 9 → review fast-track use and room-status updates; add fast-track APP hours at Monday peaks |
| 2 | **LWBS rate** | 4.0% | **≤ 2.5%** (≈1,275 more patients seen/yr) | Registration vs provider-seen; weekly | Flat for 2 months → check "thinking of leaving" alerts and patient-link uptake; add a waiting-room nurse round on surge days |
| 3 | **Equity: uninsured vs commercial door-to-provider gap** | 16 min (64 vs 48) | **≤ 8 min** | Same data split by payer group and language; monthly | Not shrinking for 2 months → audit scores and overrides by group; add kiosk staffing and languages |
| 3b | **Equity: uninsured LWBS** | 5.8% | **≤ 3.5%** | Same; monthly | Same as above |
| 4 | **Safe AI use** | n/a | Override rate **10–30%**; fast-track bounce-back **< 5%**; **zero** safety events attributed to the tool | Override log; bounce-back report; safety reporting system | Override < 10% → audit for automation bias. Override > 30% → re-tune weights with nurses. Bounce-back ≥ 5% → raise the cutoff. Safety event → **pause** (Risk §4.3) |

**Why these targets:** each one closes the gap to the national benchmark. The equity targets halve the current gap. The model's fairness table (`data/fasttrack_model.json`) already shows uninsured patients get the highest fast-track selection rate (42%) with no higher bounce-back. That's why we expect equity to improve faster than the overall numbers.

## 2.2 Phase 1: Pilot (months 1–6)
**Scope:** weekday day shift, then evening shift, at Halvian's main ED. The pilot starts with the queue and fast-track scoring. Patient-facing SMS starts in English and Spanish.

| Month | Milestone | Done when |
|---|---|---|
| 1 | Governance committee formed (ED medical director, nurse manager, 2 nurse champions, informatics, privacy officer, patient advocate). BAA signed, security review, EHR data feed built. | Feed passing test data; security sign-off |
| 2 | **Bias test** on 2 years of historical data (by payer, language, age, sex). **Silent mode:** the AI scores live patients but nurses don't see it; we compare its suggestions with nurse decisions. | Bias report approved; ≥ 2 weeks of silent-mode data |
| 3 | Nurse champions co-design the scoring weights. All ED nurses take a 1-hr training plus 1 hr of shadowing. **Go-live on weekday day shift.** | ≥ 90% of nurses trained |
| 4–5 | Live pilot with weekly huddles to review override reasons. QR/SMS patient link turned on. Evening shift added in month 5. | Weekly metrics published |
| 6 | **Pilot review → go / no-go** decision by the committee | Criteria below |

**Pilot success metrics (all also split by payer group and language):**
- **Operations:** door-to-provider and LWBS on pilot shifts vs the same shifts last year
- **Safety:** fast-track bounce-back, 72-hr returns, safety reports
- **Adoption:** % of suggestions viewed, override rate, nurse survey
- **Patient experience:** patient-link uptake, satisfaction, "thinking of leaving" alerts handled

**Criteria to move to Phase 2 (all must be met):**
1. No safety events attributed to the tool
2. Fast-track bounce-back < 5%
3. Door-to-provider down ≥ 10% on pilot shifts
4. Equity gap no wider than baseline
5. ≥ 70% of pilot nurses rate the tool useful, and the override rate is between 10% and 30%

If a criterion is missed, extend the pilot by up to 3 months with a fix plan. If two are still missed after the extension, stop (Risk §4.3).

**Adoption plan for skeptical clinicians:**
- **Nurses own it:** champions co-design the weights, and nurses can change them on screen.
- **Silent mode first:** nurses see how the AI compared with their own decisions before it goes live.
- **No black box:** every score shows its reasons, point by point.
- **Overriding is easy and never penalized.** We review overrides to improve the tool, not to judge nurses.
- **Results shared openly** at huddles, including where the AI was wrong.
- **Patients:** plain-language messages, multiple languages, a kiosk for people without phones, and a human always available.

## 2.3 Phase 2: Scale (months 7–18)
| Months | Milestone | Uses pilot results by… |
|---|---|---|
| 7–9 | Adjust weights and cutoff from pilot data. Expand to **all day and evening shifts** and weekends. | Retuning anything nurses overrode most often |
| 10–12 | **Night shift.** **Winter surge readiness** (+20% volume): surge playbook, extra fast-track APP hours triggered by the queue length | Using pilot Monday-peak data to set surge triggers |
| 13–15 | Kiosks + SMS in **all top languages** (adding Vietnamese, Chinese, Somali). **First model retraining** on Halvian's data, approved by the committee | Retraining on real outcomes and overrides |
| 16–18 | Full review against the Month-18 goals. Year-2 plan and budget. | Deciding whether to extend to urgent care |

**Metrics while scaling:** door-to-provider, LWBS, bounce-back, 72-hr returns, override rate, cost per visit, and equity gaps by payer and language, reviewed monthly by the committee.

**Long-term ownership and funding:**
- **Day to day:** the ED nurse manager.
- **Configuration and safety:** the ED medical director.
- **Maintenance:** clinical informatics (≈0.3 FTE).
- **Oversight:** the ED clinical committee reviews the tool quarterly.
- **Funding:** the ≈$140K/yr run cost is paid from part of the recovered LWBS revenue, which is ≈$1M/yr even at our conservative estimate (see Budget §3.3).
- **Retire or pause criteria** are in Risk §4.3.
