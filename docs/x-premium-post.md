I spent the last three weeks building Mobilis for #HackCanton Season 3, and it's now submitted for judging. Here's what it is and why I think it matters.

Collateral is the plumbing nobody sees. When a dealer borrows against a bond, or a fund posts margin, someone has to check the collateral is eligible, value it with the right haircut, make sure no single asset type takes up too much of the book, and keep it all covered when prices move. Today a lot of that still runs on spreadsheets and email. So when someone swaps in an asset that breaks the agreement, it often isn't caught until days later, when someone reconciles. By then it has already settled.

Mobilis puts the collateral agreement's rules on @cantonnetwork, so the ledger enforces them instead of a person checking them afterwards.

What's built and working:

→ One agreement, four parties: Pledgor, Secured Party, Custodian and Regulator, each with their own view of the same ledger.
→ Margin calls with a real lifecycle. A call only flips to Fulfilled once the ledger has checked the book is actually covered.
→ Valuation from agreed haircuts, done on-ledger. The numbers a caller sends in are ignored.
→ Eligibility and concentration limits checked inside the Daml contract. Try to swap in paper that breaks the limit and the contract refuses it. No app code in the way.
→ Atomic substitution. The old collateral is released and the new one locked in a single step, or neither happens.
→ Custodian price marks. Drop a price and the whole book re-values at once, the shortfall shows up straight away with the cheapest top-up to fix it, and releases stay blocked until it's covered.
→ A regulator view that holds only a computed audit report (coverage, positions, share of book, breaches). Not a redacted screen. Their node simply never receives the raw contracts.
→ Wallet connect through Canton's dApp SDK, so you can act as your own party.

The part I'm proudest of is that the rules live in one place. The browser uses the same rulebook to suggest moves, and I proved the two agree: 20 Daml tests, plus 16 cases checked on both the ledger and the browser that give the same answer every time. A full margin cycle takes about 2 seconds of ledger time on Canton 3.x.

What it's for: collateral and margin ops teams at custodians and triparty agents, and the dealers and asset managers who pledge through them. The volume is already on Canton (Broadridge's repo platform alone moves trillions a month). What's missing is the day-to-day operational tooling around it.

To be straight about where it stands: it runs on a local Canton sandbox today, not DevNet yet, and prices come from custodian marks rather than a live feed. DevNet and a first pilot on one real agreement are next.

If you work in collateral, margin or securities finance ops, I'd really like 15 minutes of your time. Tell me where this breaks.

Site and 3-min demo: https://mobilis-angelraphs-projects.vercel.app
Code (open source): https://github.com/angelraph/mobilis

#Canton #Daml #RWA #HackCanton
