# Run Mobilis locally

The public website runs on sample data, because a static host can't run a
Canton ledger. These steps start a **real Canton ledger on your machine**
and connect the same interface to it, so every button runs a real Daml
transaction and the ledger enforces the rules itself.

It takes about 10 minutes the first time, most of it installing the SDK.

## 1. Install the prerequisites (once)

| Tool | Version | How to get it |
|---|---|---|
| Git | any | https://git-scm.com (on Windows this also gives you **Git Bash**, which you'll use below) |
| Java (JDK) | 17 or newer | https://adoptium.net (Temurin) |
| Node.js | 18 or newer | https://nodejs.org |
| Canton 3.x SDK (`dpm`) | 3.5.x | macOS / Linux: `curl https://get.digitalasset.com/install/install.sh \| sh` · Windows: the installer from https://get.digitalasset.com/install/latest-windows.html |

Open a **new** terminal afterwards so the new commands are on your PATH. On
Windows, use **Git Bash** for every command below.

Check that everything is installed:

```bash
java -version
node --version
dpm version
```

(On Windows Git Bash, `dpm version` may need to be `dpm.cmd version`.
The scripts handle this for you.)

## 2. Get the code

```bash
git clone https://github.com/angelraph/mobilis.git
cd mobilis
```

## 3. Run the tests (optional, about 1 minute)

```bash
dpm build --all
cd daml-test
dpm test
cd ..
```

You should see the `Setup:setup` scenario, all 20 tests in `Tests.daml` and
the `ParityCases` check finish with `ok`, on Canton 3.x. To check the browser's copy of the
rules too: `node --test ui/rules.test.js`.

## 4. Start the ledger

```bash
sh scripts/demo-ledger.sh
```

This builds the Daml packages, starts a Canton 3.x sandbox with the JSON
Ledger API v2, creates the four parties with an empty collateral agreement,
and starts a small server (`scripts/serve-ui.js`) for the interface.
Wait until you see:

```
Demo ledger ready: http://localhost:7575/ui/demo-wall.html
```

Leave this terminal open. Press **Ctrl+C** in it to stop everything.

## 5. Open the interface

- **All four roles on one screen:** http://localhost:7575/ui/demo-wall.html
- **One role per tab:**
  - http://localhost:7575/ui/index.html?role=Pledgor
  - http://localhost:7575/ui/index.html?role=SecuredParty
  - http://localhost:7575/ui/index.html?role=Custodian
  - http://localhost:7575/ui/index.html?role=Regulator

## 6. Walk through the demo

1. **Pledgor:** in *Propose a movement*, deliver `UST-BILL` with face value `1000000`. The ledger will value it at 980,000 after the 2% haircut.
2. **Secured party:** click **Agree**. **Custodian:** click **Settle**.
3. **Secured party:** request a margin call of `1400000`. **Custodian:** click **Apply to schedule**. Coverage drops to 70%.
4. **Custodian:** try **Mark fulfilled**. The ledger refuses, because the book is short.
5. **Pledgor:** deliver `IG-CORP-BOND` with face value `500000`, then agree and settle it. Now **Mark fulfilled** works.
6. **Pledgor:** in *Collateral optimiser*, choose "Get back UST-BILL" and click **Suggest**, then **Propose this substitution**. Agree and settle it.
7. **Pledgor:** propose a bad swap: `IG-CORP-BOND` → `CASH-USD` with face value `100`. **Secured party:** click **Agree** and watch the ledger refuse it.
8. **Custodian:** in *Mark to market*, mark `IG-CORP-BOND` at `80`. The book re-values and falls short, and releases are now refused. The **Pledgor**'s *Collateral actions* card proposes the cheapest top-up; agree and settle it.
9. **Custodian:** click **Generate audit report**. The **Regulator** sees that report, with the valuation date, and nothing else.

## 7. Optional: the AI features

Without an API key, the optimiser uses its built-in rules engine and the
report narrative uses the default text, so everything above works as is.
To turn on the AI, open a second terminal:

```bash
cd proxy
echo "OPENAI_API_KEY=your-key-here" > .env
node server.js
```

## Troubleshooting

- **`dpm: command not found`:** open a new terminal after installing. On Windows, use Git Bash; the SDK lives in `%APPDATA%\dpm\bin`.
- **The first click takes a while:** the first transactions after a fresh start can take up to 30 seconds while the ledger warms up. After that, each step takes about a second.
- **Port 6865, 7575 or 7576 is already in use:** a previous run is still going. Stop it with Ctrl+C in its terminal, or restart your machine.
- **You want to start over:** stop with Ctrl+C and run `sh scripts/demo-ledger.sh` again. Every start is a fresh, empty ledger.
