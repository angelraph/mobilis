Update on Mobilis: you can now try it live, no install.

A few days ago I shared Mobilis, my #HackCanton build that puts collateral agreement rules on @cantonnetwork so a move that breaks the agreement can't settle. Back then you had to run it on your own machine to use it for real. Not anymore.

What's new:

→ A live public Canton ledger. Real Canton 3.x, running the real contracts. Open the four views (pledgor, secured party, custodian, regulator) side by side and run a full margin cycle in your browser.

→ Your own agreement terms. Type in the assets your agreement accepts, the haircut on each and the largest share of the book each may take, and create the agreement. The ledger then enforces exactly those terms. I tested it with gilts and bunds: put 100% of the book in gilts against a 50% limit and it's refused, post 500k of gilts at a 3% haircut and 485k lands. No code needed.

→ A test agreement from your own wallet. Connect a Canton wallet, and if you're not in an agreement yet, one approval creates one with your party in every role, so you can walk the whole cycle yourself.

→ A bug I caught while testing: the regulator report could still say "fully collateralised" right after a margin call or a price drop. It now follows the real numbers.

Something to try: deliver some Treasuries and settle them, then propose swapping them all for corporate bonds, which breaks the 60% concentration limit. Agree it as the other side. The ledger says no, and tells you why.

It's a shared demo ledger that resets every few hours, not DevNet yet. That's the next step, along with talking to the people who actually run collateral desks. If that's you, I'd love one honest minute of feedback, even if it's "this wouldn't work because…"

Try it live: https://mobilis-demo-production.up.railway.app/ui/demo-wall.html
Feedback (1 minute): https://mobilis-angelraphs-projects.vercel.app/feedback.html
Code: https://github.com/angelraph/mobilis

@appsfactory_cc #Canton #Daml #RWA #HackCanton
