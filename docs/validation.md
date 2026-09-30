# Validation: interviews, tests, metrics

Evidence for the "Metrics / Validation" judging criterion. Record only
what actually happened. Anonymise people by role and firm type, and get
permission before quoting anyone, even anonymously.

## 1. Who we're talking to

Target: 5 to 8 conversations of 15 minutes each with people who run or buy
collateral operations:

- collateral / margin operations at a custodian or triparty agent
- treasury or funding desk at a dealer or asset manager (the pledgor side)
- risk or compliance people who receive collateral reports
- Canton ecosystem builders and validators working near collateral or repo

Channels: LinkedIn (search "collateral management", "margin operations",
"triparty", "securities financing"), the HackCanton Discord and mentors,
and Canton ecosystem contacts.

## 2. Interview script (15 minutes)

1. Walk me through the last collateral substitution you handled. Who was
   involved, and how long did it take from request to settled?
2. Where does it break? (eligibility disputes, valuation or haircut
   disagreements, reconciliation breaks, chasing counterparties)
3. How do you decide which asset to post or substitute today? Who decides?
4. How is the regulator or auditor view produced today, and how long does
   it take?
5. (Show the 4-screen demo or the preview link.) What's wrong or missing?
6. Would you take part in a pilot on Canton DevNet? What would have to be
   true for you to say yes?

## 3. Interview log

| # | Date | Role / firm type | Current process, time per substitution | Top pain | Reaction to demo | Would pilot? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## 4. Quotes (with permission)

-

## 5. Baseline test: manual cycle vs. Mobilis

The same cycle both ways: delivery, then a margin call, top-up,
substitution and return, then a regulator report.

| Step | Manual (spreadsheet + email) | Mobilis | Notes |
|---|---|---|---|
| Eligibility and haircut check | | | |
| Counterparty agreement | | | |
| Settlement and schedule update | | | |
| Margin call fulfilment check | | | |
| Regulator report | | | |
| **Total** | | | |

Method: who ran each side, what counted as start and end, and how many
runs.

## 6. Key metrics

| Metric | Value | Source |
|---|---|---|
| Interviews completed | | |
| Would-pilot answers | | |
| Letters of intent / design partners | | |
| Cycle time, manual vs. Mobilis | | |
| Rule violations caught on-ledger in the demo | 3 kinds (coverage, concentration, eligibility) | Tests.daml |
