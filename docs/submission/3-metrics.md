# Metrics

## 1. North Star metric

- **Metric:** collateral movements settled through Mobilis per week without a manual reconciliation step.
- **Why this one:** it only grows if operations teams actually move collateral through the ledger instead of spreadsheets and email, and every one of those movements has passed the full rulebook.
- **How you measure it:** count of settled `CollateralCall` contracts (deliveries, substitutions, returns) per week per custodian, read from the ledger.

---

## 2. What we needed to validate

| Assumption | Why it matters | Status |
| --- | --- | --- |
| Users have this problem | Without real pain there is no pilot | ⏳ testing: interviews planned (public cost data supports it) |
| The rules can be enforced on-ledger without breaking the workflow | Core technical bet | ✅ confirmed: 20 Daml tests plus 16 rulebook cases checked on both ledger and browser; end-to-end runs on a Canton sandbox |
| A bad move is stopped before settlement, not after | The key value over today | ✅ confirmed: undercollateralising and over-concentrated swaps are refused at Agree; settlement re-checks |
| A price drop is caught at once, not at month-end | Collateral value moves daily | ✅ confirmed: custodian marks re-value the whole book in one transaction; releases are refused until a top-up (tested live: mark to 80, 40,000 short, top-up restored coverage) |
| The regulator can get assurance without the book | Privacy thesis | ✅ confirmed: regulator node sees 1 report and 0 raw contracts (tested) |
| They would use our solution | Adoption | ⏳ testing: demos to collateral ops contacts |
| They would pay or switch | Business model | ⏳ testing: pricing questions in interviews |

---

## 3. Conversations

| # | Who (role, company type) | Date | Key takeaway |
| --- | --- | --- | --- |
| 1 | To be added | | Outreach to collateral operations and treasury contacts planned for the week of Sep 30, 2026 |
| 2 | To be added | | |
| 3 | To be added | | |

**Strongest quote:** to be added after interviews, with permission.

---

## 4. Tests and results

- **What we tried:** a timed run of a full margin cycle through the real UI on a Canton sandbox (margin call, top-up delivery, fulfilment check, substitution, regulator report), three runs; a negative-path test suite; a recorded end-to-end demo.
- **What happened:** full cycle in 2.35 s, 2.17 s and 1.78 s of ledger time (about 2 s), with every rule checked at every step. 20 of 20 Daml tests and 16 of 16 parity cases pass. In the demo, "fulfilled" was refused while the book was short, and a swap that would leave the book short was refused at Agree.
- **What we changed because of it:** made the ledger compute value from haircuts (it had trusted the caller); added coverage and concentration checks, the settlement-time re-check, and a margin call that can only be fulfilled when covered; fixed a regulator view that didn't render before its first report.

---

## 5. Product and on-ledger metrics

| Metric | How we measure it | Now | Target by submission |
| --- | --- | --- | --- |
| Users who tried the demo | Demo sessions and call notes | Internal only | 5+ external viewers |
| Users who completed the core flow | Full margin cycle through the UI | Completed on sandbox | Repeated with a design-partner contact |
| Transactions on DevNet / MainNet | Settled calls on the network | Sandbox only (DevNet next) | DevNet deployment in progress |
| Active parties | Allocated parties in the workflow | 4 (pledgor, secured party, custodian, regulator) | 4 on DevNet |

---

## 6. Success criteria after the hackathon

| Metric | Target in 90 days |
| --- | --- |
| Design partners (custodian or triparty agent) | 1 signed pilot |
| Settled collateral movements on DevNet | 100+ across one live agreement |
| Cycle time vs the partner's current process | Measured and documented |

---

## 7. What we still don't know

- **Open questions, and how we'll answer them next:** which role (custodian or pledgor) feels the pain most and signs first; willingness to pay and pricing; which pricing feed and custody integrations a pilot needs. We'll answer these in 5–8 interviews with collateral operations people, then in the design-partner pilot.

---

## Checklist

- [x] One North Star metric with a clear definition
- [ ] At least 3 conversations with potential users (in progress)
- [x] Assumptions are marked confirmed, rejected or still testing
- [x] At least one test with a number attached
- [x] Current values and targets
