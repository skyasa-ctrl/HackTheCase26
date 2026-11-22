# 4. Risk Assessment & Mitigation

**Owner:** Everyone. Each person covers their own component; Sophie leads 4.2 Data security.
**Rubric:** 7 pts (Risk ID 2 · Data security 2 · Oversight & contingency 3)
Status: 🟢 complete draft

## 4.1 Clinical & ethical risks
| Risk | Component | How it could happen | Mitigation (built into the demo where marked ✅) | Owner |
|---|---|---|---|---|
| **Algorithmic bias** | Fast-track / ranking | The model learns from history where uninsured and non-English-speaking patients were under-triaged | ✅ Insurance is never an input. ✅ Live fairness panel by payer group. Pre-launch bias test by payer, language, age and sex. Quarterly audit. | Arabella / Sophie |
| **Points can never outrank acuity** | Ranking | A low-acuity patient scores high and jumps ahead of a sicker patient | ✅ Points only reorder patients *within* the same ESI level | Arabella |
| **Gaming symptom updates** | Ranking / patient view | Patients over-report to move up | ✅ A nurse confirms before points count. ✅ Pain-only updates are capped. ✅ One update per 30 min. ✅ The button says "Update my symptoms," never "see me sooner." | Arabella / Sophie |
| **Missed deterioration** | Patient view | A patient's update sits unread | ✅ Red-flag symptoms page a nurse immediately and bypass scoring | Sophie |
| **Over-reliance (automation bias)** | All | Nurses accept suggestions without thinking | ✅ Reasons shown for every score. Silent-mode period. Override rate monitored (below 10% triggers an audit). Review of cases where the nurse agreed with the AI and the outcome was bad. | Everyone |
| **Fast-tracking a complex case** | Fast-track | The model under-calls a sick patient | ✅ Conservative 86% cutoff (bounce-back 3.3%, target < 5%). ✅ ESI 1–2 never eligible. ✅ Nurse accepts each suggestion. | Sophie |
| **Wrong wait estimate** | Capacity | Patients leave, or complain, when estimates are wrong | ✅ Shown as ranges, not promises. ✅ Never shown to ESI 1–2. ✅ Hidden when AI is offline. | Priya |
| **Loss of human connection** | Patient view | The patient page replaces nurse contact | Supports staff, doesn't replace them: the page never gives a diagnosis. ✅ "I'm thinking of leaving" alerts a nurse to talk in person. ✅ A kiosk with staff help. | Everyone |
| **Digital divide** | Patient view | Patients without phones or who speak other languages are left out | No app or account. ✅ Wristband QR + SMS + kiosk. ✅ English/Spanish now, more languages in Phase 2. Uptake tracked by payer group. | Sophie |
| **Legal (EMTALA)** | All | The tool steers patients away | No redirecting patients to other hospitals once they arrive | Everyone |

## 4.2 Data security (lead: Sophie)
**Protection plan**
- **Contracts:** a BAA with every vendor that touches patient data (cloud, SMS).
- **Where it runs:** inside Halvian's own cloud tenant, so patient data stays in Halvian's environment.
- **Encryption:** TLS 1.2+ in transit; AES-256 at rest.
- **Access:** role-based (triage nurse, charge nurse, committee, admin), single sign-on through the EHR, multi-factor authentication for admins, and an audit log of every view and override.
- **Minimum data:** the patient page shows only a visit ID, status and wait range. No name and no diagnosis. The wristband token expires at discharge.
- **Language model use:** only through the tenant's private endpoint, with no data retained for training. Free text is screened for identifiers before it is sent.
- **Testing:** an external penetration test before go-live and again before scale, plus annual security review.

**Breach or ransomware response**
| When | Action | Who |
|---|---|---|
| 0–1 hr | **Contain:** disconnect the tool's EHR feed and SMS integration; revoke API keys and tokens. The dashboard shows "AI offline." | IT security on call |
| 0–1 hr | **Keep caring for patients:** switch to the paper/whiteboard downtime triage protocol, which is how the ED runs today | Charge nurse |
| 1–24 hrs | **Escalate:** notify the privacy officer, CISO and leadership; contact cyber insurance; report ransomware to the FBI and coordinate with HHS. Do not pay a ransom without leadership and legal decision. | Privacy officer / CISO |
| 1–7 days | **Investigate and recover:** forensic review, restore from offline encrypted backups, rotate all credentials | IT / vendor |
| ≤ 60 days | **Notify** affected patients and HHS under the HIPAA Breach Notification Rule (plus media if ≥500 people in a state) | Privacy officer |
| Before restart | The tool stays off until a **security review signs off** and the committee approves restart | CISO + committee |

## 4.3 Oversight
- **Before launch:**
  - Bias test on historical data by payer, language, age and sex.
  - At least 2 weeks of silent mode comparing AI suggestions with nurse decisions.
- **After launch:**
  - Weekly override review at huddles.
  - Monthly committee report covering overrides, bounce-back, 72-hr returns, and equity metrics.
  - Quarterly fairness audit.
- **Overriding without simply going along with the AI:**
  - Nurses see the reasons, not just a score.
  - Every override needs a reason code.
  - Overrides are never penalized.
  - We also review *agreements* that ended badly, not just overrides.
- **Pause triggers** (the medical director can pause the tool immediately):
  1. Any safety event attributed to the tool.
  2. Bounce-back ≥ 5% for 2 weeks.
  3. The equity gap widens for 2 consecutive months.
  4. Override rate outside 10–30% for a month, until reviewed.
  5. A security incident.
- **Retire criteria:**
  - Phase-2 criteria still not met after the pilot extension.
  - A safer or cheaper option becomes available (e.g. a validated EHR-native module).

## 4.4 Contingency
- **Manual fallback:** printed triage protocol, whiteboard queue, standard ESI triage. This is how the ED runs today, so staff are already trained on it.
- **In the tool:** an **"AI offline"** switch (✅ in the demo) hides all suggestions and estimates, and the queue falls back to ESI level, then arrival time. Nurse overrides are paused and the room board still works by hand.
- **Recovery:** the tool restarts only after a check that its data feed matches the EHR.
