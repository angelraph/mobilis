# Mobilis roadmap

From one collateral agreement on a sandbox to a custodian's whole book on
Canton MainNet. This is a plan, not a promise. Everything after October
2026 depends on the pilot partner and on what the customer interviews show.

## Where we are: October 2026, built

The rulebook MVP, working end to end on a local Canton sandbox:

- On-ledger valuation from agreed haircuts. The caller's figures are ignored.
- Required collateral driven by margin calls, and coverage enforced on
  every return and substitution.
- Concentration limits per asset type.
- Settlement re-checks every rule against the book as it stands then.
- Margin-call lifecycle: Requested, Applied, Fulfilled only when covered.
- Collateral optimiser: the AI picks among rule-checked swaps, and the
  ledger re-validates its pick.
- Regulator audit report: coverage, positions, share of book and breaches,
  with no access to raw contracts.
- Custodian price marks: the whole book re-values at once, and a drop that
  leaves it short blocks releases until the pledgor tops up.
- Returns and excess-collateral suggestions, and the cheapest top-up.
- 20 Daml Script tests, 16 rulebook cases checked on both ledger and
  browser, a demo video, and a measured cycle time of about 2 seconds of
  ledger time.

## Q4 2026: DevNet

**Goal:** the same workflow across real, separate participant nodes.

- Port to Canton 3.x and the JSON Ledger API v2.
- Replace the local-dev token minting with real authentication (OAuth2 via
  the participant's identity provider).
- Four parties on DevNet, one agreement, one full margin cycle. Measure
  cycle time again with real network latency.
- Harden the demo into a self-serve sandbox that design partners can click
  through.

**Done when:** a design partner can run a full cycle on DevNet without us
in the room.

## Q1 2027: design-partner pilot

**Goal:** one custodian or triparty agent, and one of its pledgor clients,
on one real agreement.

- A live pricing feed for valuation, so haircuts apply to market value,
  not face value.
- Holdings as tokenised assets through the Canton Network token standard,
  so collateral movements carry real asset transfers.
- The custodian's own participant node.
- Measure cycle time, reconciliation effort and breaches caught against
  the partner's current process. That becomes the case study.

**Done when:** the partner signs a paid pilot, or tells us exactly why not.

## Q2 2027: portfolio scale

**Goal:** from one agreement to a custodian's book.

- Many agreements per custodian, with a portfolio view across them.
- Netting and collateral reuse across agreements.
- Intraday margin calls triggered by price moves.
- Portfolio-level optimisation: cheapest-to-deliver across every agreement
  at once.
- A regulator dashboard that aggregates reports across agreements, still
  as summaries only.

## H2 2027: production

- Canton MainNet.
- An application for Featured App status, and an AppsFactory Crowdloan
  for the next build stage.
- A second and third custodian or triparty agent.
- Security review and operational runbooks for regulated clients.

## What stays true at every stage

- The ledger is the authority. No UI, AI or integration can move
  collateral that breaks the agreement.
- Each party sees only what it is entitled to. The regulator gets
  assurance, not the book.
- Every rule has a test that proves it refuses what it should.
