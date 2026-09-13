# Setup Guide

Status: done. The SDK and a JDK are installed on this machine, the project
builds clean, and the full lifecycle script has been run end to end against
a live sandbox. The privacy check passed exactly as designed. This doc also
records what's installed and the exact commands to reproduce or extend it.

## 1. What's installed

- Daml SDK 2.10.6 (native Windows build), installed via the official
  release tarball into `%APPDATA%\daml`. The assistant is at
  `%APPDATA%\daml\bin\daml.cmd`, added to the user PATH. Open a new shell
  for it to be picked up automatically.
- Eclipse Temurin JDK 17.0.20.1+1, extracted to
  `%LOCALAPPDATA%\Programs\Temurin17\jdk-17.0.20.1+1`. `JAVA_HOME` is set
  and its `bin` folder is on the user PATH. This is needed because
  `daml test`, `daml script`, and `daml sandbox` all run on the JVM, even
  though `daml build` itself (via the native `damlc` compiler) does not.

A new terminal will have both on PATH automatically.

## 2. Build

From the `daml/` directory:

```bash
daml build
```

This has been run successfully. `.daml/dist/mobilis-0.1.0.dar` builds clean
with zero warnings.

## 3. Run it

`daml.yaml` now sets `init-script: Setup:setup`, so:

```bash
daml start --navigator-option="--feature-user-management=no"
```

builds the project, starts a sandbox, runs the full lifecycle script, and
opens Navigator so you can click through the four parties' views by hand.
The `--navigator-option` flag matters: by default Navigator's login screen
lists Daml user-management identities, which this project doesn't create,
so the role dropdown shows nothing to sign in as. Pointing it at party
management instead makes it list Pledgor, SecuredParty, Custodian, and
Regulator directly.

This has been run and confirmed. Logged in as Regulator, the contracts list
shows exactly one row: `AuditReport`. Logged in as Pledgor, it shows six:
the agreement, its live schedule, the margin call, and all three collateral
calls. Same ledger, same transactions, different views, by construction.

To see the script's `debug` output (the privacy-check counts), run the
script separately against a running sandbox instead, since `daml start` and
`daml test` don't print it to the terminal:

```bash
# terminal 1, leave running
daml sandbox --port 6865 --dar .daml/dist/mobilis-0.1.0.dar

# terminal 2
daml script --dar .daml/dist/mobilis-0.1.0.dar --script-name Setup:setup \
  --ledger-host localhost --ledger-port 6865
```

Confirmed output from the last run:

```
Regulator sees 1 audit report(s), expect 1
Regulator sees 0 raw collateral call(s), expect 0
Regulator sees 0 raw schedule state(s), expect 0
Pledgor sees 3 collateral call(s) it is party to
Custodian sees 1 live schedule state(s)
```

A sandbox keeps ledger state between script runs, so running `Setup:setup`
a second time against the same sandbox fails on `allocatePartyWithHint`
(the party already exists). Restart the sandbox for a clean run each time.

## 4. Run the role-switcher UI

The UI (`ui/`) is a static page with no build step, served same-origin by
the JSON API so there's no CORS to configure:

```bash
scripts/generate-config.sh   # run this after every 'daml build'; package IDs
                              # are content hashes and change on rebuild

daml start \
  --navigator-option="--feature-user-management=no" \
  --json-api-option="--static-content=prefix=ui,directory=$(pwd)/../ui"
```

(Run `generate-config.sh` from the repo root; run `daml start` from
`daml/`. On Windows, pass an absolute Windows-style path to `directory=`,
e.g. `directory=C:\Users\<you>\...\prism\ui`.)

Open one tab per role to run the live four-screen demo:

```
http://localhost:7575/ui/index.html?role=Pledgor
http://localhost:7575/ui/index.html?role=SecuredParty
http://localhost:7575/ui/index.html?role=Custodian
http://localhost:7575/ui/index.html?role=Regulator
```

This has been run and confirmed, including through the UI's own buttons,
not just the seed script: proposing a delivery as Pledgor, agreeing as
SecuredParty, settling as Custodian, and generating a report as Custodian
all worked end to end, and the Regulator tab picked up the new report
while continuing to show nothing else. A substitution into an asset never
on the eligibility schedule was rejected by the Daml choice itself when
SecuredParty tried to agree to it, not by a UI convention, confirmed from
the actual ledger error.

## 5. Next

1. Installed SDK, built, ran the lifecycle script, verified the privacy
   model. Done.
2. Built and verified the role-switcher UI, including on a phone-width
   viewport. Done.
3. Pick and build one light AI feature, either the report narrative or the
   eligibility anomaly flag, not both.
