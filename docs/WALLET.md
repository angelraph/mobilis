# Connecting a Canton wallet

Mobilis has a **Connect wallet** button built on the Canton dApp SDK
(CIP-103). It works with browser-extension wallets, remote wallets such as
the Canton Wallet Gateway, and WalletConnect. Once you're connected, the
app acts as your own party: reads go through your wallet session, and
every action is approved and signed in your wallet.

## What works today

- **Connect and see your party.** Any CIP-103 wallet can connect. The app
  shows your party and network.
- **Start a test agreement, on your own terms.** If your party isn't in a
  Mobilis agreement yet, you list the assets it accepts, the haircut on
  each and the largest share of the book each may make up, and one click
  (and one approval in your wallet) creates a solo test agreement on those
  terms. Your party takes every role: pledgor, secured party, custodian
  and regulator. Then you switch roles with the "Act as" menu and walk the
  whole cycle yourself: deliver collateral, raise a margin call, top up,
  swap, mark prices down and produce the regulator report. The ledger
  enforces every rule exactly as it would between four firms.
- **Real multi-party agreements.** If a custodian opens an agreement that
  names your party, it appears when you connect, and you get that role's
  view.

## The one requirement: Mobilis must be installed on your network

A Canton contract can only run on a participant node that has its package
(the `.dar` file) uploaded. Today that's true on a local sandbox started
with `scripts/demo-ledger.sh`, and nowhere public yet. So on a hosted wallet
pointed at DevNet or MainNet, **Start a test agreement** will say Mobilis
isn't installed on that network. That's expected until the step below is
done.

## What it takes to make it work for anyone

1. **Get DevNet access.** Either our own validator node on DevNet, or a
   validator operator willing to host the Mobilis package. (Requested in
   the HackCanton channels; see docs/devnet-deployment.md.)
2. **Upload the package to that validator.** One call to the participant's
   Ledger API (`POST /v2/packages` with `daml/.daml/dist/mobilis-0.1.0.dar`),
   or `dpm` against that participant. Package names are stable across
   rebuilds, so the app needs no change.
3. **Host test users on that validator.** A tester's wallet party has to be
   hosted on a participant that has the package. The simplest path is the
   validator's own wallet, or the Canton Wallet Gateway pointed at that
   validator's Ledger API.
4. **Serve the app over HTTPS.** Already done on Vercel. Wallet pop-ups
   must be allowed for the site.

After that, anyone with a wallet on that validator can open the site,
connect, click **Start a test agreement** and run the full cycle, with no
local install.

## Trying it locally today

1. Start the ledger: `sh scripts/demo-ledger.sh` (see docs/RUN-LOCALLY.md).
2. Run the Canton Wallet Gateway (from the Canton Network wallet project)
   pointed at the sandbox's Ledger API, and create a party in it.
3. Open the app at http://localhost:7575/ui/, click **Connect wallet**, pick
   the gateway, then **Start a test agreement**.

The demo roles in the role menu work without any wallet.

## Status, honestly

The wallet flow is built against the dApp SDK's documented API. The test
agreement and the role switching were tested on a local Canton 3.x ledger
through the same command path the wallet uses. It hasn't yet been tested
end to end with a real wallet on DevNet, which is the next milestone.
