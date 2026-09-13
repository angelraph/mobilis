# Mobilis: X (Twitter) Announcement Thread

Copy-paste ready, one tweet per numbered block. Written tight enough to
fit inside the classic 280-character limit; check length in the composer
before posting since exact wrapping varies.

Before posting: the GitHub repo is currently **private**, and tweet 10
links straight to it. Make it public before posting, or the link is
useless to anyone who clicks it.

Suggested visuals: attach a screenshot or short screen recording to tweet
5 (the regulator's one-report screen) and tweet 6 (the rejected
substitution). Those two moments are the ones worth seeing, not just
reading about.

## The thread

**1/**
Building Mobilis for #HackCanton S3: an atomic, privacy-preserving
collateral mobility engine on Canton.

Not another "tokenize an asset" demo. The operational layer institutions
are actually stuck on: margin calls, substitutions, and who's allowed to
see what.

Thread 🧵

**2/**
The problem: custodians and triparty agents still run collateral ops by
spreadsheet and email. Industry estimates put manual collateral and
corporate-action processing at €1.6 to 8B a year, with 46% of it still
done by hand.

**3/**
Not hypothetical, not niche. Broadridge's Distributed Ledger Repo
platform moves $8T+/month in repo volume on Canton. DTCC takes tokenized
Treasuries to production this year. Canton's Industry Working Group is
advancing cross-border collateral mobility in 2026.

**4/**
Mobilis: a pledgor and secured party deliver, substitute, or return
eligible collateral against a live margin obligation. A custodian settles
it. A regulator gets an automated report and nothing else.

Not a redacted view. Nothing else.

**5/**
That last part is the whole thesis. The regulator's participant genuinely
holds exactly one contract type for this agreement: a computed audit
report.

Not because a UI hid a column. Because Canton enforces it at the protocol
level.

**6/**
Eligibility is enforced on-ledger, not just in the UI. Propose a
substitution into an asset never on the agreed schedule and try to agree
it: the Daml choice itself rejects it before it can ever settle.

Caught here. Not in a quarterly audit six months later.

**7/**
Built a role-switcher UI too: plain HTML/CSS/JS, no framework, served
same-origin by Daml's own JSON API. Four tabs, one per party, each
showing only what that party can see. Works down to a phone screen.

**8/**
Added a real AI feature, not a fake one. The custodian's "Draft with AI"
sends the computed facts to an LLM for a plain-English narrative, reviewed
before it's committed.

Every number in the report is still computed on-ledger. The AI drafts a
sentence, never a fact.

**9/**
Ported the domain model from Digital Asset's ex-collateral reference
(eligibility, haircuts, the Delivery/Substitution/Return state machine)
into current Daml syntax, then built the audit/reporting layer on top,
the part institutions need that the reference doesn't ship.

**10/**
Full source, architecture diagram, and how to run it yourself:
https://github.com/angelraph/mobilis

Solo build. Started from zero Daml experience about a week and a half
ago.

**11/**
Next up: DevNet, once HackCanton's own onboarding opens it up properly.
Then a pilot conversation with an actual custodian or triparty agent
already active on Canton.

**12/**
If you're a mentor, judge, or builder on Canton and want to poke at the
demo, or watch the eligibility rejection happen live, happy to walk
through it.

#HackCanton #CantonNetwork #Daml
