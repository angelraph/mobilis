# Mobilis

An atomic, privacy-preserving collateral mobility engine for Canton.

Built for HackCanton Season 3, RWA & Business Workflows track.

Repo: [github.com/angelraph/mobilis](https://github.com/angelraph/mobilis) (private)
Static UI preview (sample data, no live ledger; see below): [mobilis-angelraphs-projects.vercel.app](https://mobilis-angelraphs-projects.vercel.app)

## The one-line pitch

Mobilis lets a pledgor, a secured party, and a custodian move, substitute,
and recall eligible collateral against a live margin obligation. Each party
sees only their slice of the truth. A regulator gets an automated exposure
and compliance report without ever seeing anyone's full book.

## Why this, why now

Canton's own ecosystem is currently focused on exactly this problem, not
generic asset issuance. Canton Network's Industry Working Group is actively
advancing cross-border collateral mobility in 2026. Broadridge's
Distributed Ledger Repo platform already runs $8T+/month in repo volume on
Canton infrastructure. DTCC is moving tokenized Treasuries toward
production this year. HQLAx, a collateral-mobility specialist, just took
strategic investment from Broadridge and Digital Asset.

The pain is quantified and large: an estimated €1.6 to 8B a year
industry-wide in manual corporate-action and collateral processing cost,
$4.7B a year in operational risk for custodians, and 46% of corporate-action
data still handled manually (SIX).

See [docs/business-brief.md](docs/business-brief.md) for the full ICP,
who-pays, and pilot-plan writeup, and
[docs/pitch-outline.md](docs/pitch-outline.md) for the live-pitch structure.

## The workflow

```
 Issuance             State change        Transfer / fulfillment      Audit

 CollateralAgreement  MarginCall     CollateralCall (Delivery,      AuditReport
 (terms and           (a demand      Substitution, or Return)      (custodian-
 eligibility)         for more or    Outstanding to Agreed or      computed
                       less           Disputed to Settled           summary; the
                       collateral)                                  only contract
                                                                     type the
                                                                     regulator
                                                                     ever sees)
```

Four roles, four different views of the same ledger:

| Role | Sees | Never sees |
|---|---|---|
| Pledgor | The agreement, the live schedule, every call it's party to | The regulator's report |
| Secured Party | Same as pledgor (it's the counterparty) | The regulator's report |
| Custodian | Everything operational: agreement, schedule, calls, because it settles them | Nothing hidden from it; it's the settlement agent |
| Regulator | Only `AuditReport`: a computed summary of totals, positions by asset type, eligibility breaches, and a plain-English narrative | The raw schedule, the raw calls, any party's full book |

That last row is the whole thesis and the live-demo moment: refresh four
screens off one atomic transaction and watch the regulator's screen show
less, correctly, by construction. Not because a UI hid a column, but because
that participant's ledger literally holds no other contract type for this
agreement.

## Repo layout

```
daml/               the Daml model
  daml/
    Types.daml                shared data types
    CollateralAgreement.daml  CollateralAgreement, CollateralAgreementState, MarginCall, CollateralCall
    AuditReport.daml          the regulator-facing summary contract
    Setup.daml                a Daml Script that runs one full lifecycle and
                               proves the privacy model by querying the ledger
                               as each party
  daml.yaml
ui/                  the role-switcher UI, a static page served by the JSON API
  index.html
  app.js
  styles.css
  config.js          generated; see scripts/generate-config.sh
scripts/
  generate-config.sh   regenerates ui/config.js after every 'daml build'
docs/
  business-brief.md   the track's required 1-page business brief
  pitch-outline.md    the live-final pitch structure
  setup-guide.md      how the Daml SDK is set up and how to run this project
```

## The role-switcher UI

A plain HTML, CSS, and JavaScript page, no build step and no framework,
served same-origin by Daml's JSON API so there's no separate dev server or
CORS to fight. Open it once per role in separate tabs to run the live
four-screen demo:

```
http://localhost:7575/ui/index.html?role=Pledgor
http://localhost:7575/ui/index.html?role=SecuredParty
http://localhost:7575/ui/index.html?role=Custodian
http://localhost:7575/ui/index.html?role=Regulator
```

Each tab shows only what that party can see, polls for updates, and can
drive the full lifecycle (propose delivery or substitution, agree or
dispute, settle, generate the report) with real buttons hitting real Daml
choices. Party IDs and the current package ID are discovered at runtime,
not hardcoded, so it survives sandbox restarts; see
[docs/setup-guide.md](docs/setup-guide.md) for exactly how to run it and
the one thing to regenerate after a Daml rebuild.

It's responsive down to a phone-width screen: the data tables collapse
into stacked label/value cards below 640px instead of overflowing.

The same static files are also deployed to Vercel at
[mobilis-angelraphs-projects.vercel.app](https://mobilis-angelraphs-projects.vercel.app)
for a quick look without installing anything. There's no Daml ledger
behind that deployment (Vercel hosts static sites, not a JVM sandbox), so
it automatically falls back to a bundled sample dataset, a real snapshot
captured from a local run, clearly labeled as a static preview. Actions
show an honest message instead of failing. Run it locally per the setup
guide for the real, live, interactive version.

One thing worth knowing before showing this to anyone outside a local
sandbox: the UI authenticates by minting its own tokens in the browser
with a fixed, public string, because the local sandbox doesn't verify
token signatures at all. That's normal and fine for a single-user local
demo. It is not access control, and `ui/app.js` says so at the top in
plain terms. Before this ever points at a shared environment or DevNet,
that needs replacing with a real per-user login.

## Status

The Daml model layer is built, running, and verified. It was ported into
current Daml syntax from the domain concepts in Digital Asset's official
`ex-collateral` reference; that repo is archived and written in 2020-era
syntax, so it was used as a conceptual reference (eligibility and haircuts,
the Delivery/Substitution/Return call lifecycle, Outstanding to
Agreed/Disputed to Settled), not literal starter code.

`daml build` compiles clean with zero warnings, and the full lifecycle
script (`daml/daml/Setup.daml`) has been run end to end against a live
sandbox. The privacy check, the entire thesis of this product, passed
exactly as designed:

```
Regulator sees 1 audit report(s), expect 1
Regulator sees 0 raw collateral call(s), expect 0
Regulator sees 0 raw schedule state(s), expect 0
```

See [docs/setup-guide.md](docs/setup-guide.md) for the exact commands (a
Daml SDK and JDK are installed on this machine) and what's next.

## Not yet built

The light AI feature (report narrative or eligibility anomaly flag) and
DevNet deployment. The role-switcher UI is done: see above.

See the plan file this was scaffolded from for the week-by-week build order.
