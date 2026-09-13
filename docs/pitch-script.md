# Mobilis: Full Pitch Script

Word for word, timed at a natural speaking pace (about 130 words a
minute). Use this to internalize the story once, then present from
[pitch-outline.md](pitch-outline.md) as your cue card. Nobody should watch
you read a script on stage; they should watch you tell a story you've
told to yourself a dozen times already.

Total run time: about 4:40, built for the live final's 4 to 5 minute
slot. A trimmed cut for the async submission round is at the bottom.

## Cold open (0:00 to 0:30)

> It's 4:40 on a Friday. Priya runs collateral operations at a mid-size
> custodian. A price move just triggered a margin call on a repo book
> worth a few hundred million. She has until close of business to get
> eligible collateral moved, agreed, and settled, or her firm is carrying
> uncovered exposure into the weekend.
>
> She opens a spreadsheet. Eligibility criteria in one tab, haircuts in
> another, the current schedule in a third, none of them synced. She
> emails the counterparty's ops desk to propose a substitution. She waits.

Pause half a beat here. Let it land that this is mundane, not dramatic,
and that's the point.

> This isn't a rare failure. It's Friday at every custodian, every week.
> Industry estimates put the cost of this kind of manual collateral and
> corporate-action processing at €1.6 to 8 billion a year, with $4.7
> billion a year in operational risk sitting on custodians' books, and
> 46% of it is still done exactly like this: by hand, in spreadsheets,
> over email.

## The turn: who this is for (0:30 to 1:00)

> We're not building for a trading desk, and we're not building for
> retail. We built Mobilis for Priya: custodians, triparty agents, and
> asset managers running real bilateral or triparty collateral
> relationships, who need this to be faster and provably correct, not
> just faster.
>
> The part that's actually hard here isn't "can we put an asset on a
> ledger." That's solved. It's what happens after: who's allowed to hold
> what, who has to agree before it moves, and who gets to see any of it
> without being handed the whole book.

## Why now, why Canton (1:00 to 1:30)

> This isn't a bet on the future of Canton. It's already running.
> Broadridge's Distributed Ledger Repo platform moves over $8 trillion a
> month in repo volume on Canton infrastructure. DTCC is taking tokenized
> U.S. Treasuries into production this year. HQLAx, a collateral mobility
> specialist, just took strategic investment from Broadridge and Digital
> Asset. And right now, in 2026, Canton's own Industry Working Group is
> actively advancing cross-border collateral mobility.
>
> We're not proposing a new idea to this ecosystem. We're building the
> operational layer for a problem this ecosystem is already spending real
> money to solve.

## The demo (1:30 to 3:20)

> Let me show you Priya's Friday, done right.

Four screens, one per party: Pledgor, Secured Party, Custodian, Regulator.
Narrate each beat as it happens; don't let it run silent.

> Pledgor proposes a substitution: swap out the posted Treasury bill for
> an investment-grade corporate bond. Watch the Custodian's screen. It's
> already there, no refresh, because this isn't three systems syncing,
> it's one ledger.
>
> Secured Party agrees. Custodian settles. That's the whole cycle, delivery
> to agreement to settlement, and it just happened in about the time it
> took me to describe it.
>
> Now the moment that matters. Custodian generates the audit report, and
> an AI drafts the narrative from the actual computed numbers, no invented
> figures, reviewed before it's ever committed. Switch to the Regulator's
> screen.
>
> This is the entire thesis in one screen: the regulator sees exactly one
> thing. Not a redacted version of the full book. Not a filtered view.
> One contract, a computed summary, and nothing else, because that
> participant's ledger genuinely holds nothing else for this agreement.
> That's not a UI choice we made. That's Canton enforcing it at the
> protocol level.

If you have time, add the second beat:

> One more thing. Watch what happens if Pledgor proposes moving in an
> asset that was never on the eligibility schedule. [Propose it, click
> Agree.] Rejected, by the ledger itself, before it can ever settle. Not
> caught in a quarterly audit six months from now. Caught here.

## Why this is hard to fake (3:20 to 3:40)

> A spreadsheet can't do any of this. A shared database can't either,
> because a shared database means everyone sees everything, and
> regulated collateral can't work that way. This needed atomic
> multi-party settlement and real sub-transaction privacy at the same
> time. That's Canton's actual differentiator, and we built the product
> around it instead of bolting it on as a feature.

## The pilot plan (3:40 to 4:00)

> Here's how this leaves the hackathon and becomes real: stand it up on
> DevNet with four parties, run one full cycle on a realistic eligibility
> schedule, and measure the turnaround against Priya's spreadsheet
> baseline. We already know what that baseline costs the industry. Now we
> can show what replacing it looks like.

## The close (4:00 to 4:40)

> Priya doesn't need a blockchain. She needs Friday at 4:40 to stop being
> the worst part of her week. Multiply her by every custodian, every
> triparty agent, every collateral desk doing this by hand today, and
> you're looking at the actual size of this problem: not a new asset
> class, an old, expensive, manual process that Canton is finally built to
> replace.
>
> We're asking for two things: Accelerator support to build out a second
> workflow, and an introduction to one custodian or triparty agent already
> active on Canton, so Priya's Friday is the first one we actually fix.

## Trimmed cut for the async submission round (about 90 seconds)

Use this when there's no live stage, just a recorded or written
walkthrough with a strict time limit.

> It's 4:40 on a Friday, and Priya, who runs collateral operations at a
> mid-size custodian, is chasing a margin call through spreadsheets and
> email. This costs the industry an estimated €1.6 to 8 billion a year,
> and it's not a hypothetical problem: Broadridge alone already moves $8
> trillion a month in repo volume on Canton, and Canton's own Industry
> Working Group is actively working on exactly this, cross-border
> collateral mobility, right now in 2026.
>
> Mobilis is the operational layer for that problem: an eligibility-gated,
> atomic collateral movement engine where a pledgor and a secured party
> can deliver, substitute, or return collateral, a custodian settles it,
> and a regulator gets an automated report and nothing else. Not a
> redacted view. Nothing else. That participant's ledger genuinely holds
> one contract type, because Canton enforces it at the protocol level, not
> because we hid a column.
>
> [30 to 45 seconds of screen recording: propose, agree, settle, generate
> report, cut to the Regulator's screen showing exactly one report.]
>
> This is built for custodians and triparty agents running real
> collateral relationships, and the path forward is simple: DevNet pilot,
> one full lifecycle, measured against the manual baseline every
> custodian is already living with today.

## Delivery notes

- Say Priya's name early and use it more than once. A named person a
  judge can picture is doing more work than any statistic in this script.
- The pause after the cold open is doing real work. Don't rush into the
  statistics; let the mundane Friday-afternoon image sit for a second
  first.
- Practice the demo narration out loud with the actual clicks, not just
  the words. The rhythm of "propose, watch it appear, agree, settle" only
  lands if your talking and your clicking are in the same tempo.
- If a question comes up about the AI feature, the honest one-line answer
  is: it drafts the sentence, not the numbers. Every figure in the report
  is computed on-ledger regardless of what the AI does.
