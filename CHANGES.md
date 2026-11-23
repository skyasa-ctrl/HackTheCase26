# Changes, Nov 22 (pre-recording fixes)

## 1. Real AI in the demo (`src/shared/ai.js`, new)
- **"Describe it in your own words"** box on the Patient view. Claude returns a symptom category, a red-flag check and a one-line nurse summary, plus a short reply to the patient in their language. A keyword safety net runs alongside, and either one can page a nurse. A nurse still confirms before any points count.
- **"Leave with a plan"** is now drafted by Claude in the patient's language. A new **"Thinking of leaving"** card on the Queue lets a nurse edit and approve the message. The patient sees it only after approval; until then they see standard hospital advice. Edits are logged as overrides.
- **Connecting:** click the **AI** pill in the header and paste an Anthropic API key. It's kept in memory only and never saved. Running as a Claude artifact connects automatically. Without a key, both features use keyword rules and **say so on screen**.
- Removed the old hard-coded "Drafted by AI" claim.

## 2. Budget: ROI now uses contribution margin, not revenue
- Value per recovered visit: $1,500 × 50% payer haircut × 40% margin = **$300**. Conservative value ≈ **$454K/yr**; net revenue (≈$956K) is shown for reference only.
- **Headline is break-even:** an LWBS drop of 0.55 points covers the Year-2 run cost. The tool is cheaper than one added 24/7 nurse from **Month 11**. Year-2 ROI ≈ **224%**, with sensitivities.

## 3. Model numbers are labelled honestly
- Added a stricter AUC (ESI 3–5 only, 0.97), the published real-world benchmark (0.87), and a "synthetic data overstates accuracy" warning on the Fast-track model card.
- Go-live bar in silent mode: AUC ≥ 0.85 and bounce-back < 5%.
- The fairness result is now described as a hypothesis to confirm in silent mode.

## 4. Equity includes Medicaid and the same-acuity gap
- Roadmap goal 3 and the Budget equity KPIs add Medicaid (LWBS 4.6% → ≤3.3%). The wait gap is measured within the same ESI level.
- The Queue fairness panel adds a "wait vs same-ESI average" column and Medicaid notes.

## 5. Also
- **Risk:** three new rows: AI misreads a patient's words; an AI-written message is wrong; patients wary of identity checks skip the tool.
- **Roadmap:** training before each expansion, a Month-12 review, silent mode for retrained models, Month-18 targets on the scale metrics, and fixed funding wording.
- **Video script:** target 7:15. Hook cut to 20 s, Risk raised to 1:15, one demo driver. New AI demo steps and revised budget lines.
- **Still to do by hand:** update slides 6, 10, 11 and 15 in the Claude Slides deck to match, and fill in last names on slides 1 and 15.

Nothing in `data/patients`, `history` or `rooms` changed. Only the model file gained the new metric and caveat.
