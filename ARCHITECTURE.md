# 1. AI Tool Architecture

**Owner:** Priya · **Rubric:** 9 pts (Focus 2 · Oversight 2 · Tools 2 · Technical design 3)
Status: 🟡 draft skeleton. Replace the bullets with final content and keep numbers consistent with [CONTEXT_BUNDLE.md](CONTEXT_BUNDLE.md).

---

## 1.1 Focus area & rationale (2 pts)
**Intake & Triage.**
- Door-to-provider is 55 min vs 30–40 nationally, and LWBS is 4% vs 2–3%. That's about 3,400 patients a year leaving unseen.
- The equity gap is largest here: uninsured patients wait 64 min with 5.8% LWBS, versus 48 min and 3.0% for commercially insured.
- Who is affected: low-urgency patients who wait 2+ hours on surge days, and triage nurses sorting arrivals by hand.
- Why not the other areas: Patient Flow/boarding platforms are enterprise-priced (Tampa General's GE command center cost about $13M). Staffing forecasting alone doesn't fix how the queue is ordered. Patient communication is built into our tool through the QR/SMS updates.

## 1.2 What AI does vs what stays human (2 pts)
| Step | AI does | Human does / owns |
|---|---|---|
| Queue ordering | Suggests order within each acuity level and shows the reasons | **Charge nurse** confirms; can override with a logged reason |
| Fast-track | Gives an eligibility score (e.g. "82% likely quick case") | **Triage nurse** accepts or overrides; **APP** owns care in fast-track |
| Symptom updates | Maps patient input to a provisional score and flags red-flag symptoms | **Nurse** re-assesses and confirms before any points count |
| Wait-time range | Estimates from current flow and open rooms | Staff can correct it |
| Leaving patients | Drafts a "leave with a plan" message | **Nurse** edits and sends |
| Weights & thresholds | Monthly report on outcomes vs suggestions | **ED clinical committee** approves changes |

**Accountability when the AI is wrong:** the clinician who accepted the suggestion is accountable for the clinical decision, as with any decision-support tool. The **ED medical director + nurse manager** own the tool's configuration and performance. The vendor or IT owns uptime.

## 1.3 Tools (2 pts)
_Name real products, give rough costs, and say why each fits a small ED team._
- **Cloud + AI model:** e.g. Azure OpenAI or AWS Bedrock (Claude) inside Halvian's own cloud tenant under a BAA (the HIPAA contract that covers vendors). Used for the symptom-text-to-category mapping and drafting messages.
- **Prediction model:** fast-track eligibility via logistic regression or gradient-boosted trees, trained on Halvian's historical triage data. It's simple, explainable and cheap to run.
- **EHR integration:** FHIR APIs (the standard health-records data interface) or HL7 feeds from the existing EHR and registration system. Results are written back into the EHR so nurses don't need a separate login.
- **Patient messaging:** an SMS platform with a BAA (e.g. Twilio), plus a hospital-hosted web page reached by wristband QR code, plus a kiosk.
- **Dashboard / low-code:** e.g. Power BI or a low-code app platform the hospital already licenses.
- _Lower-cost alternatives to mention:_ the EHR vendor's built-in AI modules, and open-source models self-hosted.

## 1.4 Technical design (3 pts)
_Add a diagram: Registration/EHR → integration layer → scoring + fast-track model → dashboard / patient page → nurse decision → written back to EHR._
- **Data used:** arrival time, age, arrival mode, chief complaint, vitals, ESI (acuity level), re-check times, confirmed symptom updates, room status. **Insurance is excluded from the model** and used only for fairness monitoring.
- **Information flow:** describe each step and how often it refreshes (e.g. queue recalculated every minute).
- **Where it runs:** Halvian's cloud tenant, so patient data stays in Halvian's environment.
- **Cost:** link to [docs/BUDGET_ROI.md](docs/BUDGET_ROI.md).
- **Scalability:** handles the winter surge (+20%) and Monday peaks; can later extend to other departments.
- **Reliability:** if the tool goes down, triage continues as it does today: nurse-assigned ESI and a manual queue (see Risk §4.4).
- **Maintenance:** owner, monthly model review, quarterly bias audit.
- **Privacy & clinical risk:** collect only the identifiers needed, encrypt data in transit and at rest, use role-based access with audit logs, and tie the patient link to the wristband token, which expires at discharge.
