# Mobilis: Pitch Outline

Target: about 4 to 5 minutes for the live Grand Final. Trim the middle for
a shorter submission-round version.

## 1. The problem (30s)

Open with a number, not a slide of logos. €1.6 to 8B a year in manual
collateral and corporate-action processing cost, industry-wide, and 46% of
it still done by hand. Institutions have already solved "can we put an
asset on a ledger." The money is bleeding out in the operational layer:
margin calls, substitutions, and reconciling who's allowed to hold what.

## 2. Who it's for (20s)

Custodians, triparty agents, and asset managers running real collateral
relationships. Not retail, not a trading audience. Name the ICP explicitly;
judges reward founder thinking, not just working code.

## 3. Why now, why Canton (30s)

This isn't a hypothetical. Broadridge already runs $8T+/month in repo
volume on Canton. DTCC is moving tokenized Treasuries to production this
year. Canton's own Industry Working Group is actively advancing
cross-border collateral mobility in 2026. This is the live edge of the
ecosystem, not a speculative corner of it.

## 4. The demo: the moment that matters (90 to 120s)

This is the core of the pitch. Show, don't tell.

1. Pledgor posts collateral (Delivery). Show it land instantly on the
   Custodian's screen too.
2. Secured Party calls for more collateral (MarginCall).
3. Pledgor proposes a Substitution: swap the posted asset for a different
   eligible one. Secured Party agrees, Custodian settles.
4. The moment: four screens on stage, Pledgor, Secured Party, Custodian,
   Regulator, all refresh off that one atomic transaction. The regulator's
   screen shows a computed report. Nothing else. Say it out loud: the
   regulator's node holds exactly one contract type for this relationship,
   not because we hid a column, but because that's what it was ever given
   visibility into.
5. Optional second beat: propose a substitution into an asset that was
   never on the eligibility schedule, and watch it get rejected before it
   can settle, not discovered after the fact.

## 5. Why this is hard to fake (20s)

This is Canton's actual differentiator, atomic multi-party state change
plus sub-transaction privacy, used as the mechanism of the product, not a
slide bullet. A public chain or a single shared ledger cannot honestly make
this same claim for regulated collateral.

## 6. The pilot plan (20s)

DevNet stand-up with four parties, one full lifecycle cycle, compare
turnaround and reconciliation effort against a manual baseline, identify
one integration point for a real pilot.

## 7. The ask, and the close (10 to 15s)

What you want next: Accelerator support to build out a second workflow
(netting across agreements, or a real pricing feed), and an introduction to
one custodian or triparty agent already active in the Canton ecosystem for
a pilot conversation.

## Rehearsal notes

The four-screen demo is the whole pitch. Rehearse it until it cannot fail,
and have a recorded backup video ready in case of live network issues. The
demo needs to read cleanly on a phone screen as well as a laptop or a
projector; check it on a small screen before the final, not the morning of.

Don't lead with "we used AI." If the light AI feature (report narrative or
eligibility anomaly flag) is in, mention it as one sentence, not a section.

Cut scope before cutting demo polish. One flawless full lifecycle beats
three half-finished features.
