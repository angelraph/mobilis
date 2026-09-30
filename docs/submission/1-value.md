# Value

## 1. The problem in one sentence

**Collateral operations teams at custodians, triparty agents and their dealer and asset-manager clients** struggle to **move and substitute collateral quickly and safely** because **every party checks eligibility, haircuts, coverage and concentration on its own copy of the data and reconciles afterwards**, which costs them **slow substitutions, disputes over whose numbers are right, breaches found after settlement, and manual regulator reporting**.

---

## 2. The value you create

| | Today | With Mobilis |
| --- | --- | --- |
| **What the user does** | Checks eligibility and haircuts in spreadsheets, agrees the move by email, settles, then reconciles books and assembles the regulator's view by hand | Proposes the move; the counterparty agrees; the custodian settles in one atomic Canton transaction. The ledger checks every rule, and the regulator report is generated from the live book |
| **Time / cost / risk** | Multi-step, multi-party, error-prone; breaches discovered after settlement | About 2 seconds of ledger time for a full margin cycle (measured, local sandbox); a move that breaks the agreement can't even be agreed |

- **Value proposition in one line:** Collateral that moves in one atomic transaction, with every rule enforced by the ledger and every party seeing only its own slice.
- **Why users would switch from what they do today:** one shared, correct record instead of several reconciled copies; breaches prevented instead of reported; regulator reporting as a by-product of settlement.

---

## 3. Why it matters

- **Cost of the problem:** industry estimates put manual collateral and corporate-action processing at €1.6–8B a year, and 46% of corporate-action data is still handled manually (SIX).
- **How many people or companies have it:** every institution running margin, repo or securities-lending relationships: dealers, asset managers, custodians and triparty agents.
- **Evidence:** the public figures above; the ongoing industry investment in collateral mobility (Broadridge DLR, DTCC tokenised Treasuries, HQLAx). Customer interviews are in progress and are logged in `docs/validation.md` in the repo.

---

## 4. Why now

- **What changed:** regulated securities finance is moving onto Canton. Broadridge's Distributed Ledger Repo runs on Canton infrastructure, DTCC is taking tokenised US Treasuries toward production, and Canton's Industry Working Group is working on collateral mobility. The assets are arriving on the network; the operational tooling is not.
- **Why this couldn't be solved well before:** without a ledger that settles multi-party moves atomically and keeps each party's data private, the rulebook had to live in each firm's own systems, so reconciliation was unavoidable.

---

## 5. Why Canton

- **What Canton makes possible here:** privacy between parties (each node receives only the contracts it is a stakeholder on), multi-party workflows between institutions, and atomic settlement: one asset out and one in, with no moment where the lender is unprotected.
- **Why a public chain or a plain database wouldn't do:** collateral books are confidential, so a public chain exposes too much; a shared database needs one operator everyone trusts. In Mobilis the regulator's node holds no agreement, schedule or call, only an audit report, and the tests prove it.

---

## Checklist

- [x] The problem fits in one sentence
- [x] It names a specific user, not "everyone"
- [x] The value is shown as a before and after
- [x] There is evidence the problem is real
- [x] "Why now" is answered
- [x] It's clear why this belongs on Canton
