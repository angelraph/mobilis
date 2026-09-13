# Mobilis: Business Brief

One page, as required by the RWA & Business Workflows track.

## The problem

Institutions moving collateral against margin and repo exposures still run
this operationally by hand: reconciling eligibility and haircuts across
spreadsheets, chasing counterparties for substitution agreement, and
producing regulator reports from data no single party fully trusts.
Industry estimates put manual corporate-action and collateral processing
cost at €1.6 to 8B a year, with $4.7B a year in operational risk carried by
custodians, and 46% of corporate-action data still processed manually (SIX
Group). Meanwhile the actual asset-tokenization problem, whether a security
can be represented on a ledger, is largely solved. The bottleneck has moved
to the lifecycle and operational layer.

## The product

Mobilis is a Canton-native collateral mobility engine: an eligibility-gated,
atomic, multi-party workflow for delivering, substituting, and returning
collateral against a margin obligation, with a custodian-computed audit
report as the only channel of information reaching a regulator or auditor.
It does not ask an institution to trust a shared, transparent ledger with
its full book. Each party's participant node holds only what it is entitled
to.

## ICP: who this is for

Mid-size custodians and triparty agents, and asset managers or dealers
running bilateral or triparty collateral and margin relationships, who want
a controlled, low-risk pilot before committing to a full internal system
rebuild. Not retail. Not a public DeFi audience.

## Who pays, and why

The custodian or triparty agent is the natural commercial buyer: it already
owns the operational cost and regulatory exposure this replaces. The value
is concrete and measurable.

- Reduced reconciliation cost: one atomic settlement record instead of
  bilateral spreadsheets reconciled after the fact.
- Lower operational risk: eligibility is checked and enforced before a
  substitution can be agreed, not discovered after settlement.
- Faster margin-call turnaround: delivery, substitution, and return move
  through a shared state machine instead of email and fax-era workflows.
- Cleaner, cheaper audit: a regulator gets a report on demand instead of a
  custodian assembling one manually from multiple internal systems.

## Why Canton, why now

Collateral movement is inherently multi-party and privacy-sensitive. A
pledgor and a secured party must never see each other's full book, and a
regulator needs assurance without needing full visibility either. Public
chains and single-shared-ledger systems cannot safely provide this for
regulated collateral. Canton's atomic multi-party settlement and
sub-transaction privacy can.

This is not hypothetical. Broadridge's Distributed Ledger Repo platform
already runs $8T+/month in repo volume on Canton infrastructure. DTCC is
moving tokenized U.S. Treasuries toward production in 2026. HQLAx, a
collateral-mobility specialist, has taken strategic investment from
Broadridge and Digital Asset. Canton's own Industry Working Group is
actively advancing cross-border collateral mobility this year. The market
and the appetite already exist on this network. The operational tooling is
the gap.

## Pilot plan

1. Stand up on DevNet with four parties: pledgor, secured party, custodian,
   regulator/observer, using a realistic eligibility schedule (asset types
   and haircuts) for one test collateral agreement.
2. Run one full cycle, delivery to margin call to substitution to return,
   and generate the automated regulator report at each checkpoint.
3. Measure and compare turnaround time and reconciliation effort against a
   manual/spreadsheet baseline for the same cycle, and identify one
   integration point (a pricing/exposure feed, or an existing Canton
   collateral participant) for a live pilot after the hackathon.

## Post-hackathon path

AppsFactory Accelerator (mentor-led path to weekly traction), then
Crowdloans (funding the next stage of development), then Featured App
status, consistent with how prior HackCanton projects have progressed on
Canton.
