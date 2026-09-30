# HackCanton submission materials (drafts)

Paste-ready drafts for the six required materials on the HackCanton
dashboard. Each dashboard section is a markdown editor, so paste one
section at a time, from the line after its `---` marker to the end of that
section.

Sections marked **[FILL]** need real evidence you collect yourself. Judges
score validation on real interviews and tests, so never fill these with
guesses.

---

## 1. Value / problem statement

---

### The problem

Moving collateral against margin and repo exposures is still handled
mostly by hand. When a pledgor wants to post, swap or recall collateral,
operations teams check four things across spreadsheets, emails and
separate internal systems:

1. **Eligibility:** is this asset type allowed under the agreement?
2. **Valuation:** what is it worth after the agreed haircut?
3. **Coverage:** does the book still cover the exposure after the move?
4. **Concentration:** is any one asset type now too big a share of the book?

Each party checks these on its own copy of the data. Then they reconcile
afterwards, and a custodian assembles the regulator's view by hand. The
result is slow substitutions, disputes over whose numbers are right, and
breaches that are found after settlement instead of prevented before it.
Industry estimates put manual collateral and corporate-action processing
at €1.6 to 8B a year, and 46% of corporate-action data is still handled
manually (SIX).

### Why it matters now

Tokenising an asset is largely solved. The bottleneck has moved to the
operational layer. Canton is where regulated securities finance is already
moving: Broadridge's Distributed Ledger Repo runs on Canton infrastructure,
DTCC is taking tokenised Treasuries toward production, and Canton's
Industry Working Group is working on collateral mobility this year. The
assets are arriving on the network, but the operational tooling for
collateral isn't there yet.

### The value

Mobilis is a collateral mobility engine on Canton. Every rule is enforced
by the ledger itself, in one atomic multi-party transaction:

- **Value is computed on the ledger** from the agreed haircut. A caller
  can't overstate what an asset is worth.
- **Undercollateralising or over-concentrated moves can't be agreed**, and
  settlement re-checks the book as it stands at that moment.
- **A margin call can only be marked fulfilled when it really is covered.**
- **A collateral optimiser** suggests the cheapest swap the rules allow.
  The AI chooses only among rule-checked moves, and the ledger checks its
  choice again.
- **Privacy by construction:** each party sees only its slice. The
  regulator receives an automatic audit report (coverage, positions,
  breaches) and holds no other contract for the relationship.

So there's one shared, correct record instead of several reconciled
copies, rules that prevent breaches instead of reporting them later, and
regulator reporting as a by-product of settlement.

---

## 2. ICP / Audience definition

---

### Primary buyer: mid-size custodians and triparty agents

- **Who:** heads of collateral operations or securities-financing
  operations at custodians and triparty agents that run collateral
  schedules for several client relationships.
- **Why them:** they already carry the operational cost and the regulatory
  exposure. They settle the movements, reconcile the books and produce the
  reports. They're also the natural Canton participant: the settlement
  agent in Mobilis is the custodian.
- **Trigger:** growing tokenised-collateral volume, a regulator asking for
  better collateral reporting, or a dispute or breach caused by manual
  reconciliation.
- **What they want:** a controlled, low-risk pilot on one agreement before
  any rebuild of their core systems.

### Users in the workflow

| Role | Who | What they get |
|---|---|---|
| Pledgor | Treasury or funding desk at a dealer or asset manager | Faster substitutions, and a suggested cheapest valid swap |
| Secured party | Lender or repo counterparty | Can't be left undercollateralised by a swap it agreed to |
| Custodian | Collateral operations (the buyer) | One atomic settlement record, and reporting generated automatically |
| Regulator / auditor | Supervisor or auditor | A trustworthy summary report without access to anyone's book |

### Not the audience

Retail users, DeFi traders, and firms with no collateral or margin
relationships.

### Open questions we're testing

**[FILL]** after the interviews: which role feels the pain most sharply,
who signs off on a pilot, and whether the custodian or the pledgor is the
easier first customer.

---

## 3. Metrics / Validation evidence

---

### What the product demonstrably does (verified)

- **14 automated Daml Script tests** pass, most of them on rejection paths:
  ineligible assets, undercollateralising substitutions and returns,
  concentration breaches, releasing an asset that isn't posted, a margin
  call applied twice or marked fulfilled while short, wrong controllers,
  settlement after the book moved, and the regulator seeing only its
  report.
- **End-to-end run on a live local Canton sandbox** through the real UI: a
  margin call was applied, "fulfilled" was refused by the ledger while the
  book was short, a top-up settled, an undercollateralising return was
  refused at Agree, and an optimiser-suggested substitution was proposed,
  agreed and settled. The regulator saw 1 report and 0 raw contracts.
- **Privacy check:** the regulator's participant holds 0 agreements, 0
  schedules, 0 calls and 0 margin calls, only audit reports.

### Customer discovery **[FILL]**

- Interviews completed: **[FILL]** (target 5 to 8: custodian ops, treasury
  desks, risk and compliance, Canton builders)
- Key findings: **[FILL]**, for example current time per substitution, how
  often reconciliation breaks happen, and how reports are produced today
- Quotes (with permission): **[FILL]**
- Would-pilot answers or letters of intent: **[FILL]**

### Baseline test: manual vs. Mobilis

Mobilis side measured: a full margin cycle (margin call, top-up,
fulfilment, substitution, report) takes **about 2 seconds of ledger time**
(3 runs on a local Canton sandbox, 1.8 to 2.3 s), with every rule checked
at every step. That excludes human reading and clicking time. The manual
side is **[FILL]**.

The same cycle run both ways: delivery, then a margin call, top-up,
substitution and return, then a regulator report.

| | Manual (spreadsheet + email) | Mobilis |
|---|---|---|
| Time for the full cycle | **[FILL]** | ~2 s ledger time + human review |
| Reconciliation steps | **[FILL]** | 0 (one shared record) |
| Rule breaches caught before settlement | **[FILL]** | All three rule types (eligibility, coverage, concentration) |

Full interview log and method: `docs/validation.md` in the repo.

---

## 4. GTM materials

---

### Positioning

"The operations layer for collateral on Canton: every rule enforced by the
ledger, every party seeing only its own slice."

### Go-to-market path

1. **Design partners (months 0 to 3):** one custodian or triparty agent
   already active on Canton, plus one of its pledgor clients. Run a single
   collateral agreement on DevNet with a realistic eligibility schedule.
   Measure cycle time and reconciliation effort against their current
   process.
2. **Paid pilot (months 3 to 9):** production-grade integration on one
   relationship: a pricing feed for valuation, the custodian's existing
   Canton participant, and real authentication.
3. **Expand (months 9+):** more agreements per custodian, then
   cross-agreement features such as netting and portfolio-level
   optimisation.

### Channels

- **The Canton ecosystem:** the Industry Working Group on collateral
  mobility, validator and participant operators, and intros through the
  AppsFactory partner network.
- **AppsFactory Accelerator:** a mentor-led path to weekly traction, then
  Crowdloans and Featured App status under CIP-0116, as earlier HackCanton
  projects have done.
- **Direct outreach:** collateral operations leaders at custodians and
  triparty agents (LinkedIn, securities-finance industry events).

### Business model

- **The buyer is the custodian or triparty agent**, which owns the cost
  being removed.
- **Pricing (hypothesis to validate):** an annual platform fee per
  custodian plus a fee per active collateral agreement, so cost scales with
  the value delivered. **[FILL]** once interviews show willingness to pay.
- **Canton-native upside:** Featured App rewards as settlement activity
  grows.

### Why we win

Incumbent collateral systems are internal databases reconciled against
each other. Mobilis runs on Canton's atomic multi-party settlement with
sub-transaction privacy, which a public chain or a single shared database
can't offer for regulated collateral.

---

## 5. Demo

---

**Live preview (sample data, no ledger):** https://mobilis-angelraphs-projects.vercel.app
**Demo video (2.5 min, captioned, recorded from a live Canton ledger):** https://mobilis-angelraphs-projects.vercel.app/media/mobilis-demo.webm
**Repository:** https://github.com/angelraph/mobilis (run it locally: `docs/setup-guide.md`)

### What the video shows

All four roles on one screen, each reading the same Canton ledger:

1. **Delivery:** the pledgor posts a UST bill with 1,000,000 face value.
   The ledger values it at 980,000 after the 2% haircut, whatever the
   browser sent.
2. **Margin call:** the secured party calls for 1,400,000. The custodian
   applies it, and coverage drops to 70%. The custodian tries to mark it
   fulfilled, and the ledger refuses.
3. **Top-up:** the pledgor delivers a corporate bond. Coverage is back
   above 100%, and now the margin call can be marked fulfilled.
4. **Optimiser:** the pledgor wants its Treasuries back. The optimiser
   rules out the tempting swaps (the corporate bond would break its 60%
   concentration limit, and the high-yield bond isn't eligible) and
   suggests cash. One click proposes it, the secured party agrees, and the
   custodian settles it atomically.
5. **A bad move is blocked:** a swap that would leave the book short is
   rejected by the ledger at Agree.
6. **The regulator's screen:** one audit report showing coverage,
   positions, share of book and breaches, and nothing else. The regulator
   isn't hidden from the rest by the UI. Its node simply holds no other
   contracts.

### Built during HackCanton

On-ledger valuation, coverage, concentration limits, the settlement
re-check, the margin-call lifecycle, the collateral optimiser and 14
tests. The pre-hackathon baseline is disclosed in the README and tagged
`pre-hackathon-baseline`.

---

## 6. Pitch

---

**Pitch deck:** **[FILL: public link to slides]**

### Mobilis in 60 seconds

**Problem.** Collateral operations still run on spreadsheets and email:
eligibility, haircuts, coverage and concentration are checked separately
by each party and reconciled afterwards. That costs the industry an
estimated €1.6 to 8B a year, and breaches are found after settlement
instead of before it.

**Solution.** Mobilis puts that rulebook on Canton. Delivery, substitution
and return happen in one atomic multi-party transaction. The ledger values
every asset, refuses any move that breaks eligibility, coverage or
concentration, and only lets a margin call be marked fulfilled when it
really is covered. A collateral optimiser suggests the cheapest swap the
rules allow.

**Why Canton.** Collateral is multi-party and confidential. Canton's
atomic settlement and sub-transaction privacy let every party share one
correct record while seeing only its own slice. The regulator gets an
automatic report and never touches anyone's book. Broadridge, DTCC and
HQLAx are already bringing securities finance to Canton, and Mobilis is
the operations layer they need.

**Who pays.** Custodians and triparty agents, which already carry the
operational cost and regulatory exposure. Pricing is a platform fee plus a
fee per agreement.

**Traction.** Working MVP, 14 passing tests, and an end-to-end run on a
Canton sandbox. **[FILL: interviews and pilot interest]**

**The ask.** Accelerator support and an introduction to one custodian or
triparty agent active on Canton for a DevNet pilot.
