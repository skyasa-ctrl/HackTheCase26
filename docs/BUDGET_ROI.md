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
**Value at full scale (annual):**
| Source | Math | Value/yr |
|---|---|---|
| LWBS recovery (full) | 4.0% → 2.5% of 85,000 = 1,275 visits × $1,500 | $1.91M |
| LWBS recovery (**conservative**, used for ROI) | Same visits × $750 (50% haircut, because recovered patients skew uninsured and low-acuity) | **$0.96M** |
| Nurse time saved | ≈1 hr per shift on manual sorting, re-checks and "how long?" questions × 3 shifts × 365 = 1,095 hrs × $65 | **$0.07M** |
| **Total (conservative)** | | **≈ $1.03M** |

We do **not** count the boarding savings ($350 per bed-hour). Boarding isn't our focus area, so leaving it out keeps the case conservative.

**Traditional alternative: add one triage nurse 24/7**
- 8,760 hrs × $65 = **$569K/yr**, or **$854K/yr** if covered with overtime at 1.5×.
- That's every year, permanently, and it doesn't fix how the queue is ordered, the equity gap, or the lack of patient updates.
- **Our tool costs ≈$467K/yr while it's being built (≈$700K over 18 months), then ≈$140K/yr**, which is about a quarter of the cost of one added nurse at year-2 run cost.

**Least certain assumptions (most uncertain first):**
1. **How much of the LWBS drop is due to the tool.** Other changes (staffing, seasonal volume) also move LWBS. *Check:* compare pilot shifts with non-pilot shifts.
2. **Revenue per recovered visit.** Recovered visits skew uninsured and low-acuity, so they earn less than the $1,500 average. That's why we use a 50% haircut.
3. **EHR integration cost.** Vendor quotes vary widely. A 50% overrun ($70K) still fits within contingency plus headroom.
4. **Nurse adoption.** Value depends on nurses actually using the suggestions.
5. **Patient-link uptake** among patients without smartphones. The kiosks are our hedge.

## 3.3 KPIs & ROI
| KPI | Baseline | Month-18 target |
|---|---|---|
| Median door-to-provider | 55 min | ≤ 40 min |
| LWBS | 4.0% | ≤ 2.5% |
| Fast-track share of ESI 4–5 visits | measured in silent mode | +25% over baseline **(A)** |
| Cost per ED visit for the tool | — | ≈ $1.65 in year 2 ($140K / 85,000) |
| **Equity KPI:** uninsured vs commercial wait gap | 16 min | ≤ 8 min |
| **Equity KPI:** uninsured LWBS | 5.8% | ≤ 3.5% |
| **Equity KPI:** patient-link uptake by payer group | — | Within 10 points across groups |

**ROI**
- **During build** (annualized cost $467K): ROI = ($1.03M − $0.47M) / $0.47M ≈ **121%**
- **Year 2** (run cost $140K): ROI = ($1.03M − $0.14M) / $0.14M ≈ **640%**
- **Using full LWBS value, no haircut** ($1.98M): build-phase ROI ≈ **324%**

**Break-even:**
- At $1,500/visit, $467K/yr is covered by **311 recovered visits**. That's an LWBS drop of only **0.4 points (4.0% → 3.6%)**.
- Even at the conservative $750/visit, 623 visits are needed, an LWBS drop to **3.3%**.
