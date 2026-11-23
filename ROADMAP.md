# 2. Roadmap & Milestones

**Owner:** Arabella · **Rubric:** 8 pts (Goals 3 · Pilot 3 · Scale 2)
Status: 🟢 complete draft

---

## 2.1 Month-18 goals (3 pts)
| # | Goal | Baseline | Month-18 target | How tracked | If off track |
|---|---|---|---|---|---|
| 1 | **Median door-to-provider** | 55 min | **≤ 40 min** (national 30–40) | EHR timestamps; weekly dashboard by shift and day | Not ≥10% better by month 9 → review fast-track use and room-status updates; add fast-track APP hours at Monday peaks |
| 2 | **LWBS rate** | 4.0% | **≤ 2.5%** (≈1,275 more patients seen/yr) | Registration vs provider-seen; weekly | Flat for 2 months → check "thinking of leaving" alerts and patient-link uptake; add a waiting-room nurse round on surge days |
| 3 | **Equity: door-to-provider gap vs commercial, measured within the same ESI level** | Overall gap: uninsured 16 min (64 vs 48), Medicaid 10 min (58 vs 48). Same-acuity baseline set in month 2 from historical data | **Halved** for both groups (overall uninsured gap **≤ 8 min**) | Same data split by payer group and language, compared within each ESI level; monthly | Not shrinking for 2 months → audit scores and overrides by group; add kiosk staffing, languages and nurse rounding for that group |
| 3b | **Equity: LWBS for uninsured and Medicaid** | Uninsured 5.8%; Medicaid 4.6% | Uninsured **≤ 3.5%**; Medicaid **≤ 3.3%** | Same; monthly | Same as above |
| 4 | **Safe AI use** | n/a | Override rate **10–30%**; fast-track bounce-back **< 5%**; **zero** safety events attributed to the tool | Override log; bounce-back report; safety reporting system | Override < 10% → audit for automation bias. Override > 30% → re-tune weights with nurses. Bounce-back ≥ 5% → raise the cutoff. Safety event → **pause** (Risk §4.3) |

**Why these targets:**
- Each one closes the gap to the national benchmark (30–40 min; 2–3% LWBS).
- The equity targets halve today's gaps. Medicaid is included because it's Halvian's largest payer group (35% of visits).
- The equity gap is measured **within the same ESI level**, so sicker patients being seen first isn't counted as unfair. What's left is the part of the gap the tool should close.
- Uninsured and Medicaid visits are more often non-urgent (AJMC), so faster fast-track routing should help them most. In our synthetic test, uninsured and Medicaid patients are selected for fast-track at least as often as commercial patients, with similar bounce-back. **That is a hypothesis to confirm in silent mode, not proof.**

## 2.2 Phase 1: Pilot (months 1–6)
**Scope:** weekday day shift, then evening shift, at Halvian's main ED. The pilot starts with the queue and fast-track scoring. Patient-facing SMS starts in English and Spanish, including the "describe it in your own words" box (AI-sorted, nurse-confirmed) and nurse-approved "leave with a plan" messages.

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
4. Same-acuity equity gaps for uninsured and Medicaid patients no wider than baseline, and trending down
5. ≥ 70% of pilot nurses rate the tool useful, and the override rate is between 10% and 30%

If a criterion is missed, extend the pilot by up to 3 months with a fix plan. If two are still missed after the extension, stop (Risk §4.3).

**Adoption plan for skeptical clinicians:**
- **Nurses own it:** champions co-design the weights, and nurses can change them on screen.
- **Silent mode first:** nurses see how the AI compared with their own decisions before it goes live.
- **No black box:** every score shows its reasons, point by point.
- **Overriding is easy and never penalized.** We review overrides to improve the tool, not to judge nurses.
- **Results shared openly** at huddles, including where the AI was wrong.
- **Patients:** plain-language messages, multiple languages, a kiosk for people without phones, and a human always available.
- **Patients wary of identity checks** (for example, some undocumented or uninsured patients): the wristband link carries only a visit ID, with no name, birthday or address. A translated privacy notice says the data is used only for their care here and shared only where the law requires. The tool is **optional, never an advantage**: a waiting-room nurse can log the same symptom update for anyone who skips it, and the AI learns from every patient's visit record, not just app users. Uptake is tracked by payer group and language.

## 2.3 Phase 2: Scale (months 7–18)
| Months | Milestone | Uses pilot results by… |
|---|---|---|
| 7–9 | Adjust weights and cutoff from pilot data. **Train weekend and remaining evening staff before each expansion.** Expand to **all day and evening shifts** and weekends. | Retuning anything nurses overrode most often; raising the cutoff if bounce-back neared 5% |
| 10–12 | **Train night staff, then go live on night shift.** **Winter surge readiness** (+20% volume): surge playbook, extra fast-track APP hours triggered by the queue length. **Month-12 formal review** by the committee | Using pilot Monday-peak data to set surge triggers; expanding nurse rounding if an equity gap was amber |
| 13–15 | Kiosks + SMS in **all top languages** (adding Vietnamese, Chinese, Somali). **First model retraining** on Halvian's data: runs in **silent mode for 2–4 weeks** and goes live only after committee approval | Retraining on real outcomes and overrides |
| 16–18 | Full review against the Month-18 goals. Year-2 plan and budget. | Deciding whether to extend to urgent care |

**Metrics while scaling** (reviewed monthly by the committee, with Month-18 targets from §2.1):
- door-to-provider (≤ 40 min) and LWBS (≤ 2.5%), by shift
- same-acuity equity gaps (halved) and LWBS for uninsured (≤ 3.5%) and Medicaid (≤ 3.3%) patients
- fast-track bounce-back (< 5%) and 72-hr returns (not above baseline)
- override rate (10–30%)
- cost per visit (≈ $1.65 in Year 2)

**Long-term ownership and funding:**
- **Day to day:** the ED nurse manager.
- **Configuration and safety:** the ED medical director.
- **Maintenance:** clinical informatics (≈0.3 FTE).
- **Oversight:** the ED clinical committee reviews the tool quarterly.
- **Funding:** months 1–18 come from the AI budget. From Year 2, the ≈$140K/yr run cost moves into the ED operating budget. It's covered by the contribution margin on recovered visits (≈$383K/yr at target, see Budget §3.2), and it breaks even at an LWBS drop of just 0.55 points.
- **Retire or pause criteria** are in Risk §4.3.
