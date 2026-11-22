# 2. Roadmap & Milestones

**Owner:** Arabella · **Rubric:** 8 pts (Goals 3 · Pilot 3 · Scale 2)
Status: 🟡 draft skeleton. The targets below are starting points to refine.

---

## 2.1 Month-18 goals (3 pts)
| # | Goal | Baseline | Month-18 target | How tracked |
|---|---|---|---|---|
| 1 | Median door-to-provider | 55 min | ≤ 40 min | EHR timestamps, weekly |
| 2 | LWBS rate | 4.0% | ≤ 2.5% | Registration vs provider-seen, weekly |
| 3 | **Equity:** uninsured vs commercial door-to-provider gap | 16 min (64 vs 48) | ≤ 8 min | Same data split by payer, monthly |
| 3b | **Equity:** uninsured LWBS | 5.8% | ≤ 3.5% | Same, monthly |
| 4 | Safe AI use: nurse override rate | n/a | 10–30%, with bounce-back from fast-track < 5% | Override log, monthly |

**If a goal is off track:** define a trigger and action for each goal. Example: if the equity gap doesn't shrink for 2 months, review the scoring weights and patient-link uptake by payer, and add kiosk staffing and more languages.

## 2.2 Phase 1: Pilot (months 1–6)
_Safe, supervised deployment in part of the ED, e.g. weekday day shift only, or fast-track stream only._

| Month | Milestone |
|---|---|
| 1 | Governance committee formed, BAA and security review, data pipeline, bias test on historical data |
| 2 | **Silent mode:** the AI scores patients but nurses don't see it; compare against nurse decisions |
| 3 | Training (nurse champions, 1-hr sessions), go-live on pilot shift |
| 4–5 | Live pilot, weekly huddles, override reasons reviewed |
| 6 | Pilot review → go / no-go decision |

**Success metrics:** operations (door-to-provider and LWBS on pilot shifts), adoption (% of suggestions viewed, override rate), patient experience (patient-link uptake, satisfaction), equity (all metrics split by payer group and language).

**Criteria to move to Phase 2:** e.g. no safety events attributed to the tool · bounce-back < 5% · door-to-provider down ≥ 10% on pilot shifts · equity gap not wider · ≥ 70% nurse adoption.

**Adoption plan for skeptics:**
- Nurse champions co-design the scoring weights.
- Silent mode first, so nurses can check the AI against their own decisions.
- Every suggestion shows its reasons.
- Overrides are easy and never penalized.
- Results are shared openly at huddles.
- For patients: plain-language explanations, multiple languages, and a human is always available.

## 2.3 Phase 2: Scale (months 7–18)
| Months | Milestone |
|---|---|
| 7–9 | Adjust using pilot results; expand to all day and evening shifts |
| 10–12 | Nights + **winter surge readiness** |
| 13–15 | Kiosk + SMS in all languages; first retraining of the model |
| 16–18 | Full review against Month-18 goals; plan for year 2 |

**Metrics while scaling:** efficiency, patient outcomes (bounce-backs, 72-hr returns), clinician override rates, cost-to-serve, equity gaps.

**Long-term ownership:** the ED nurse manager owns the tool day to day, the clinical informatics team handles maintenance, and the committee reviews it quarterly. The operating budget comes from part of the LWBS revenue recovered. Set retire/pause criteria (see Risk §4.3).
