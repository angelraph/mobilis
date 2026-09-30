# Mobilis FAQ

## The idea

**What is collateral, and what does "mobility" mean?**
When one institution lends to another, the borrower (the pledgor) pledges
assets such as government bonds, corporate bonds or cash as security. A
custodian holds and moves those assets. Values change every day, so the
lender (the secured party) calls for more collateral (a margin call). The
borrower often wants a specific asset back to use elsewhere and offers a
replacement (a substitution). Mobility means moving collateral quickly and
safely. Today it runs largely on spreadsheets and email.

**What problem does Mobilis solve?**
Every move needs four checks: is the asset eligible, what is it worth
after the haircut, is the exposure still covered, and is the book too
concentrated in one asset type. Each party runs these on its own data and
reconciles afterwards, so breaches are found after settlement. Mobilis
puts the rulebook on the Canton ledger, so a move that breaks it can't
even be agreed.

**Who is it for?**
The buyer is collateral operations at custodians and triparty agents. The
users are treasury desks (pledgors), lenders (secured parties), and
regulators and auditors. It isn't for retail or DeFi trading.

## The technology

**Is it really running on Canton?**
Yes. The rules are Daml smart contracts (`daml/daml/`), and the demo video
was recorded from a Canton sandbox through the real UI over the JSON API.
The public web preview uses sample data because a static host can't run a
ledger. DevNet is the next milestone ([ROADMAP.md](ROADMAP.md)).

**Why Canton, and not a public chain or a shared database?**
Collateral books are confidential, so a public chain exposes too much. A
shared database needs one operator everyone trusts. Canton gives each
party its own node, sends each only the contracts it is a stakeholder on,
and settles multi-party moves atomically.

**How does the regulator see a report but not the book?**
The regulator is an observer only on the `AuditReport` contract. The
agreement, the live schedule, the calls and the margin calls never name
it, so its node never receives them. `Tests.daml` queries the ledger as
the regulator and asserts it sees zero of each.

**What exactly does the ledger enforce?**
Six things, in `Valuation.daml` and `CollateralAgreement.daml`:
1. eligibility of every incoming asset type
2. value computed from the agreed haircut, whatever the caller sent
3. coverage: no return or substitution may leave the book short of what's required
4. per-asset-type concentration limits
5. a margin call is fulfilled only when coverage is really there
6. settlement re-checks all of the above against the book at that moment

**What happens if the book changes between agreeing and settling?**
Settlement runs the same rules again against the current book. If, for
example, a margin call landed in between and the swap would now leave the
book short, settlement is refused. `test_settleRechecksAgainstCurrentState`
covers exactly this.

## The AI

**What does the AI do? Can it move assets?**
It can't move anything. The optimiser (`ui/rules.js`, a mirror of the
on-ledger rules) lists every one-for-one swap from the pledgor's inventory
that the agreement allows, scored by funding cost. The AI chooses one of
those by number and explains why, given the treasurer's goal. A person
proposes it, the counterparty agrees and the custodian settles, and the
ledger re-checks it each time. Without an AI key, the best-scoring valid
swap is used. The custodian can also have the AI draft the report's
plain-English narrative. Every number in the report is computed on the
ledger.

**What if the AI and the ledger disagree?**
The ledger wins, and the call is rejected. The AI only ever makes
suggestions.

## The business

**Who pays, and how much?**
Custodians and triparty agents, which already carry the operational cost
and regulatory exposure. The working model is a platform fee per custodian
plus a fee per active agreement. We are validating pricing in customer
interviews ([validation.md](validation.md)).

**How does it reach customers?**
Through one design partner already active on Canton, then a paid pilot,
then more agreements per custodian. Channels are the Canton Industry
Working Group, the AppsFactory partner network and Accelerator, and direct
outreach to collateral operations leaders. See the GTM draft in
[materials.md](materials.md) (section 4).

## The hackathon

**What was built during HackCanton?**
A first version existed before the delivery phase and is tagged
`pre-hackathon-baseline`. Built during the delivery phase: on-ledger
valuation, coverage, concentration limits, the settlement re-check, the
margin-call lifecycle, the optimiser, 14 tests, the demo tooling and this
interface. The README lists everything, and
`git diff pre-hackathon-baseline..HEAD` shows the full change.

**How do I run it myself?**
See [setup-guide.md](setup-guide.md). For a clean demo, run
`scripts/demo-ledger.sh`, then open `http://localhost:7575/ui/demo-wall.html`.
