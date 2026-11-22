# 4. Risk Assessment & Mitigation

**Owner:** Everyone. Each person fills in the rows for their own component. Sophie leads 4.2 Data security.
**Rubric:** 7 pts (Risk ID 2 · Data security 2 · Oversight & contingency 3)
Status: 🔴 not started

## 4.1 Clinical & ethical risks
| Risk | Component | Mitigation | Owner |
|---|---|---|---|
| Algorithmic bias (model learns historical under-triage) | Fast-track / ranking | Insurance excluded from the model; pre-launch bias test by payer, language, age, sex | |
| Patients gaming symptom updates | Ranking | Nurse confirms before points count, pain cap, 1 update / 30 min | Arabella |
| Over-reliance on AI (automation bias) | All | Show the reasons; silent-mode period; audit override rates | |
| Loss of human connection | Patient view | A nurse always confirms; human handoff; the AI never gives a diagnosis | |
| Fast-tracking a complex case | Fast-track | Conservative cutoff, bounce-back monitoring | Sophie |
| Wrong wait estimate | Capacity | Show ranges; hide estimates for acuity 1–2 | Priya |

## 4.2 Data security (lead: Sophie)
- **Protection:** BAA, runs in Halvian's own cloud tenant, encryption, role-based access, audit logs, collect only the identifiers needed, wristband tokens expire at discharge.
- **If Halvian or a vendor is compromised:** disconnect the integration, switch to paper downtime triage, notify the privacy officer and follow the HIPAA breach rules, restore from backups, and keep the tool off until a security review clears it.

## 4.3 Oversight
- Bias testing before launch · monthly monitoring after launch · quarterly fairness audit
- **Pause triggers:** a safety event attributed to the tool, bounce-back above threshold, or an equity gap widening for 2 months
- How clinicians override without simply going along with the AI: show the reasons, require a reason code on overrides, and review cases where nurses agreed with the AI and the outcome was bad

## 4.4 Contingency
- Downtime procedure: printed triage protocol, whiteboard queue, standard ESI triage. This is how the ED runs today, so staff are already trained on it.
- The dashboard shows a clear "AI offline" banner, and the queue falls back to ESI then arrival time.
