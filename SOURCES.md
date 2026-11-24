# Sources

Evidence behind the design choices in the demo, model and docs. Footnote 1–2 of these on the matching slides.

**How to read our model numbers:** published triage models reach AUC 0.82–0.91 on real data. Our demo shows 0.98 on synthetic data, which overstates real accuracy. Go-live requires AUC ≥ 0.85 and fast-track bounce-back < 5% on Halvian's own data in silent mode.

## 1. AUC benchmarks (fast-track model, go-live bar)
- Kaiser Permanente fast-track eligibility model, AUC 0.87. [Automated analysis of unstructured clinical assessments improves emergency department triage performance, JACEP Open 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10337523)
- Admission prediction from triage data: logistic regression, XGBoost and neural networks all AUC 0.87. [Hong, Haimovich & Taylor, PLoS ONE 2018](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6054406/)
- ML beats ESI alone for hospitalisation (AUC 0.82 vs 0.69). [Raita et al., Critical Care 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6387562)
- Public benchmark: AUC 0.88 critical outcome, 0.82 hospitalisation. [Benchmarking ED triage prediction models (MIMIC-IV-ED)](https://arxiv.org/pdf/2111.11017) *(preprint)*

## 2. Why logistic regression
- Systematic review of 71 studies: no performance benefit of ML over logistic regression in low-bias comparisons. [Christodoulou et al., Journal of Clinical Epidemiology 2019](https://ora.ox.ac.uk/objects/uuid:4167c905-5171-4fc7-b157-ff36d56a73db)

## 3. Wait-time points and "thinking of leaving" alerts
- Walk-out risk that updates as the wait goes on identifies more patients who leave. [Ravid et al., American Journal of Emergency Medicine 2025](https://discovery.ucl.ac.uk/id/eprint/10213281)

## 4. LLM reads patient messages; a nurse always confirms
- Gemini 2.5 Flash: 73.8% accuracy on 1,057 real ED triage conversations. Useful, but not good enough to act alone. [BMC Emergency Medicine 2025](https://pubmed.ncbi.nlm.nih.gov/40890624/)
- LLMs did not reach gold-standard ED triage performance. [JMIR 2024](https://pubmed.ncbi.nlm.nih.gov/38875696/)

## 5. AI-drafted messages in Spanish, approved by a nurse
- LLM Spanish translations of ED discharge instructions judged clinically acceptable by physicians and certified interpreters. [JMIR Formative Research 2026](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12835839/)
- AI translation similar to professional translation for Spanish, but needs validation for other languages. [JAMA Network Open 2025](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12444566/)

## 6. Fairness checks by insurance group; insurance never a scoring input
- Fairness audit of an ED wait-time model by sex, race/ethnicity and insurance status. [PLOS Digital Health 2025](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11925291/)
- ESI assignment differs by sex, race, ethnicity, language and insurance; insurance can encode structural inequities. [Counterfactual Auditing of Bias in LLMs for Clinical Triage, 2026](https://arxiv.org/pdf/2610.01963) *(preprint)*
- Per-model counterfactual auditing should precede deployment (tested Gemini 3 Flash among others). [EQUITRIAGE, 2026](https://arxiv.org/pdf/2605.03998) *(preprint)*
- About 33% of high-acuity (ESI 1–2) cases mistriaged under ESI v4. Cited in [Uncovering Latent Bias in LLM-Based ED Triage, 2026](https://arxiv.org/html/2601.15306v1) *(preprint)*

## 7. Equity framing (uninsured and Medicaid)
- Uninsured and public-coverage visits are more often non-urgent or primary-care-sensitive. [AJMC](https://www.ajmc.com/view/insurance-impact-on-nonurgent-and-primary-caresensitive-emergency-department-use)
- Fast track and streaming show the most consistent reductions in length of stay and walk-outs. [Throughput interventions systematic review, CJEM 2020](https://static.cambridge.org/content/id/urn:cambridge.org:id:article:S1481803520004261/resource/name/S1481803520004261sup003.pdf); [Triage-related interventions systematic review, 2011](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3152510/)

## 8. Silent mode before go-live
- Epic's sepsis model fell from a reported 76–83% to 63% on University of Michigan patients. Search: *"External Validation of a Widely Implemented Proprietary Sepsis Prediction Model in Hospitalized Patients"*, JAMA Internal Medicine 2021.

*Preprints are not peer-reviewed. Prefer the journal papers on slides.*
