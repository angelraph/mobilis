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
| Java (JDK) | 17 | https://adoptium.net (Temurin 17) |
| Daml SDK | 2.10.6 | macOS / Linux: `curl -sSL https://get.daml.com/ \| sh -s 2.10.6` · Windows: the installer from https://docs.daml.com/getting-started/installation.html |

Open a **new** terminal afterwards so the new commands are on your PATH. On
Windows, use **Git Bash** for every command below.

Check that everything is installed:

```bash
java -version
daml version
```

(On Windows Git Bash, `daml version` may need to be `daml.cmd version`.
The scripts handle this for you.)

## 2. Get the code

```bash
git clone https://github.com/angelraph/mobilis.git
cd mobilis
```

## 3. Run the tests (optional, about 1 minute)

```bash
cd daml
daml test
cd ..
```

You should see the `Setup:setup` scenario and all 14 tests in
`Tests.daml` finish with `ok`.

## 4. Start the ledger

```bash
sh scripts/demo-ledger.sh
```

This builds the Daml model, starts a Canton sandbox, creates the four
parties with an empty collateral agreement, and serves the interface.
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
8. **Custodian:** click **Generate audit report**. The **Regulator** sees that report and nothing else.

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

- **`daml: command not found`:** open a new terminal after installing. On Windows, use Git Bash; the SDK lives in `%APPDATA%\daml\bin`.
- **The first click takes a while:** the first transactions after a fresh start can take up to 30 seconds while the ledger warms up. After that, each step takes about a second.
- **Port 6865 or 7575 is already in use:** a previous run is still going. Stop it with Ctrl+C in its terminal, or restart your machine.
- **You want to start over:** stop with Ctrl+C and run `sh scripts/demo-ledger.sh` again. Every start is a fresh, empty ledger.
