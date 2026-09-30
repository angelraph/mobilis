# GTM — Go-to-Market

## 1. Positioning

**In one sentence:**
For **collateral operations teams at custodians and triparty agents** who **check and reconcile every collateral move by hand**, **Mobilis** is a **Canton-native collateral mobility engine** that **enforces eligibility, haircuts, coverage and concentration on the ledger and settles each move atomically**. Unlike **spreadsheets, email and internal systems reconciled against each other**, we **give every party one correct record while each sees only its own slice, and give the regulator a report without the book**.

- **What do users do today instead?** Internal collateral systems plus spreadsheets and email, reconciled after the fact.
- **Why Canton, and not any other chain?** Collateral is multi-party and confidential. Canton gives each party its own node, shares only what each is entitled to see, and settles multi-party moves atomically. Regulated securities finance is already moving onto Canton (Broadridge DLR, DTCC).

---

## 2. First customers

- **Segment:** mid-size custodians and triparty agents already active on, or exploring, Canton, together with one of their pledgor clients.
- **Why them first:** they own the operational cost and regulatory exposure, they are the natural settlement agent (the custodian role in Mobilis), and a mid-size firm can approve a pilot faster than a global bank.
- **First 3–5 targets:** Canton participants in securities finance met through the Canton Industry Working Group and the AppsFactory partner network; to be named as intros land.

---

## 3. Distribution channels

| Channel | Why it reaches our users | First concrete action | Effort / cost |
| --- | --- | --- | --- |
| Canton Industry Working Group (collateral mobility) | Where Canton institutions working on this problem meet | Share the demo and ask for one custodian intro | Low |
| AppsFactory Accelerator and partner network | Direct intros to Canton institutions and investors | Apply after the hackathon; request partner intros | Low |
| Direct outreach to collateral ops leaders | Reaches the buyer and users directly | 25–30 LinkedIn messages; 5–8 interviews (kit in docs/outreach.md) | Medium (time) |
| Canton validators and node operators | Already run participants for institutions | Offer Mobilis as a ready workflow for their clients | Low |

---

## 4. Acquisition hypotheses

| Hypothesis | How we test it | Success metric | Status |
| --- | --- | --- | --- |
| We believe collateral ops leaders will take a 15-minute call because substitution pain is daily | LinkedIn and ecosystem outreach | 5+ calls from 30 messages | ⏳ testing |
| We believe a custodian on Canton will pilot one agreement because it needs no core-system rebuild | Pilot offer after demos | 1 signed design partner | ⏳ testing |
| We believe the demo converts interest into a pilot conversation because "the ledger refuses a bad swap" is concrete | Show the narrated demo in calls | 50% of calls ask for a next step | ⏳ testing |

---

## 5. Business model

- **Who pays, and for what:** the custodian or triparty agent pays for the platform, since it removes their operational cost and regulatory risk.
- **Pricing hypothesis:** an annual platform fee per custodian plus a fee per active collateral agreement (to be validated in interviews).
- **Revenue on Canton:** B2B licensing plus Featured App rewards as settlement activity grows.
- **Why now:** tokenised collateral is arriving on Canton, and the operational layer is the gap.

---

## 6. First 90 days after the hackathon

| Period | Milestone | How we'll know it's done |
| --- | --- | --- |
| Weeks 1–4 | DevNet deployment (Canton 3.x, JSON Ledger API v2, real auth); 8+ interviews | A full cycle runs on DevNet across separate nodes; interview log complete |
| Weeks 5–8 | Design partner signed; pricing feed integrated | Signed pilot scope; valuation from market prices |
| Weeks 9–12 | Live pilot on one agreement; Accelerator; Featured App application | 100+ settled movements; case study with measured cycle time |

---

## 7. Risks and what you need

- **What could block adoption:** compliance review at regulated institutions, integration with existing collateral and pricing systems, and counterparties not yet on Canton.
- **What you need from the ecosystem:** an intro to one custodian or triparty agent on Canton, DevNet access and support, and mentors from securities finance.

---

## Checklist

- [x] Positioning fits in one sentence
- [x] First segment is specific, not "everyone in DeFi"
- [x] At least two channels with a concrete first action
- [x] At least three hypotheses, each with a metric
- [x] It's clear who pays and why
- [x] You can explain why Canton and not any chain
