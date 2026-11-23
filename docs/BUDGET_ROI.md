# 3. Budget & ROI

**Owner:** Sophie · **Rubric:** 7 pts (Assumptions 3 · Value vs traditional 2 · KPIs & ROI 2)
Status: 🟢 complete draft. All rates are the case's cost figures (see [CONTEXT_BUNDLE.md](../CONTEXT_BUNDLE.md) §1). Our assumptions are marked **(A)**.

---

## 3.1 Costs by phase ($K)
| Item | Pilot (M1–6) | Scale (M7–18) | 18-mo total | Notes / assumption |
|---|---|---|---|---|
| Cloud AI + hosting (Azure OpenAI / Bedrock under BAA) | 18 | 54 | 72 | ≈$3K/month **(A)** |
| EHR integration (FHIR/HL7 interfaces) | 110 | 30 | 140 | Interface-engine build + EHR vendor fees; **largest cost uncertainty** **(A)** |
| App build & configuration (dashboard, patient page) | 90 | 30 | 120 | ≈720 hrs contract developer at $125/hr in the pilot **(A)** |
| SMS platform + 4 kiosks | 5 | 25 | 30 | SMS ≈$1.2K/month at full scale; kiosks ≈$3K each **(A)** |
| **Hidden:** clinician training time | 20 | 35 | 55 | ~95 nurses × 2 hrs × $65 = $12K; 6 champions × 40 hrs × $65 = $16K; providers + refreshers + new hires |
| **Hidden:** security review, BAA, penetration test | 40 | 15 | 55 | External pen test + privacy review; re-test before scale **(A)** |
| **Hidden:** governance + silent-mode time | 15 | 15 | 30 | Committee: physicians at $200/hr and nurses at $65/hr, ≈2 hrs/month each |
| Monitoring, bias audits, model retraining | 20 | 40 | 60 | Data scientist contract; quarterly audits |
| Clinical informatics lead (0.3 FTE) | 25 | 50 | 75 | Internal staff time **(A)** |
| Contingency (10%) | 34 | 29 | 63 | |
| **Total** | **377** | **323** | **≈ 700** | **Within the $750K / 18-month budget, with $50K headroom** |

**Year-2 run cost: ≈$140K/yr** (cloud $36K, SMS $15K, interface upkeep $15K, monitoring and audits $30K, 0.3 FTE informatics $33K, refresher training $10K).

**Lower-cost alternatives:**
- **EHR vendor's built-in AI module:** could cut integration and build costs by about half if Halvian already licenses it, but it's less transparent and less customizable.
- **Self-hosted open-source model:** removes the ≈$36K/yr cloud AI fee, but adds IT workload.
- **Existing Power BI / low-code licence for the dashboard:** saves ≈$60K of build.
- **Rules only, no ML:** cheapest, but loses fast-track accuracy.

## 3.2 Value vs the traditional approach
**How we value a recovered visit.** The case gives $1,500 as average *revenue* per ED visit. Revenue isn't profit: treating a patient who would otherwise have left also costs money. So we value each recovered visit at its **contribution margin**, in two steps:
1. **Payer-mix haircut:** recovered patients skew uninsured and low-acuity, so they bring in about half the average: $1,500 × 50% = **$750 net revenue** **(A)**.
2. **Contribution margin:** most ED costs (building, staff on shift, equipment) are already paid. The extra cost of one more low-acuity visit is mainly supplies, tests and staff minutes. We assume **40% of net revenue is margin**: $750 × 40% = **$300 per recovered visit** **(A)**.

**Value at full scale (annual, conservative):**
| Source | Math | Value/yr |
|---|---|---|
| LWBS recovery | 4.0% → 2.5% of 85,000 = 1,275 recovered visits × $300 contribution | **$383K** |
| Nurse time freed | ≈1 hr per shift on manual sorting, re-checks and "how long?" questions × 3 shifts × 365 = 1,095 hrs × $65 | **$71K** (capacity, not cash) |
| **Total (conservative)** | | **≈ $454K** |
| *For reference: net revenue recovered* | *1,275 × $750* | *$956K (cash collected, before costs of care)* |

We do **not** count boarding savings ($350 per bed-hour). Boarding isn't our focus area, so leaving it out keeps the case conservative.

**Traditional alternative: add one triage nurse 24/7**
- 8,760 hrs × $65 = **$569K/yr**, or **$854K/yr** if covered with overtime at 1.5×. Benefits are excluded, so this understates the true cost.
- That's every year, permanently, and it doesn't fix how the queue is ordered, the equity gap, or the lack of patient updates.
- **Our tool:** ≈$700K over 18 months, then ≈$140K/yr.
- **Cumulative cost crossover:** by **Month 11**, the tool has cost less in total than the extra nurse would have ($512K vs $522K). After that, the gap widens by about **$430K a year**.

**Least certain assumptions (most uncertain first):**
1. **How much of the LWBS drop is due to the tool.** Other changes (staffing, seasonal volume) also move LWBS. *Check:* compare pilot shifts with the same shifts last year, adjusted for volume (see Roadmap gate criteria).
2. **Contribution margin per recovered visit ($300).** It depends on Halvian's cost structure; finance can confirm it in Month 1. At 25% margin the Year-2 ROI is still about 120%.
3. **Revenue per recovered visit.** Recovered visits skew uninsured and low-acuity, so they earn less than the $1,500 average. That's why we apply the 50% haircut.
4. **EHR integration cost.** Vendor quotes vary widely. A 50% overrun ($70K) still fits within contingency plus headroom.
5. **Nurse adoption.** Value depends on nurses actually using the suggestions; adoption is a pilot gate.
6. **Patient-link uptake** among patients without smartphones. Kiosks and nurse rounding are our hedge.

## 3.3 KPIs & ROI
| KPI | Baseline | Month-18 target |
|---|---|---|
| Median door-to-provider | 55 min | ≤ 40 min |
| LWBS | 4.0% | ≤ 2.5% |
| Fast-track share of ESI 4–5 visits | measured in silent mode | +25% over baseline **(A)** |
| Cost per ED visit for the tool | — | ≈ $1.65 in Year 2 ($140K / 85,000) |
| **Equity KPI:** same-acuity wait gap, uninsured and Medicaid vs commercial | Overall gap 16 min (uninsured), 10 min (Medicaid); same-acuity baseline set in Month 2 | Halved (overall uninsured gap ≤ 8 min) |
| **Equity KPI:** uninsured LWBS | 5.8% | ≤ 3.5% |
| **Equity KPI:** Medicaid LWBS | 4.6% | ≤ 3.3% |
| **Equity KPI:** patient-link reach by payer group | — | Within 10 points across groups |

**Headline: break-even, not ROI percentages.**
- **Year 2:** the $140K run cost is covered by **467 recovered visits** at $300 each. That's an LWBS drop of just **0.55 points (4.0% → 3.45%)**, well short of our 1.5-point target.
- **Against hiring:** the tool is cheaper than one added 24/7 triage nurse from **Month 11** onward.

**ROI (contribution-margin basis):**
- **Year 2** (run cost $140K): ($454K − $140K) / $140K ≈ **224%**
- **During the 18-month build** (annualized cost $467K): value roughly equals cost (≈ −3%). On margin alone, cumulative payback comes around **Month 29**, allowing for the pilot ramp-up.
- **Including the avoided cost of the extra nurse** (the realistic alternative if Halvian acts on its 4% LWBS), payback comes within the first year.
- **Sensitivity:**
  - At 25% contribution margin: Year-2 ROI ≈ 120%.
  - If LWBS only falls to 3.0% (850 visits): Year-2 ROI ≈ 133%.
  - On a revenue basis ($750 per visit, before costs of care): Year-2 ROI would be about 630%. We don't headline this number because it ignores the cost of treating recovered patients.
