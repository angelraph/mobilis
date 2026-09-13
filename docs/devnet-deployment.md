# DevNet Deployment Checklist

Real Canton DevNet access is gated behind the hackathon's own onboarding,
not something to self-provision. The public path (get sponsored by a Super
Validator, submit a static egress IP, wait 2 to 7 days for whitelisting) is
built for running validator infrastructure, not for a team shipping an
app, and HackCanton's own program explicitly provides "DevNet environment
and support" starting with the Delivery phase (opening ceremony,
then workshops). Use that path, not the public one, unless a mentor
specifically says otherwise.

This doc is what to do the moment that access lands, so it's a fast
turnaround instead of a scramble. It also flags the one piece of this
project that is explicitly not ready for a real network: local-dev auth.

## Before delivery week starts

- [x] Daml SDK and a JDK installed, `daml build` clean (see
      [setup-guide.md](setup-guide.md))
- [x] Full lifecycle verified locally against a sandbox, privacy model
      confirmed
- [x] Role-switcher UI built and verified, including mobile
- [x] AI narrative feature working against a local proxy
- [ ] Real auth flow for a shared/authenticated ledger (see below; this is
      the one hard blocker, not optional)
- [ ] DevNet endpoint, credentials, and party-allocation process obtained
      from HackCanton onboarding
- [ ] A plan for where the AI-narrative proxy runs if the demo needs to be
      reachable from somewhere other than one laptop

## Questions to ask at the first DevNet workshop or office hours

Ask these directly rather than guessing; the answers determine several of
the steps below:

1. How does a hackathon team get parties allocated on DevNet? Self-service
   UI, a Discord bot, a validator operator dashboard, something else?
2. What auth mechanism does the JSON API (or whichever ledger API surface
   we're given) actually enforce? OAuth2 client-credentials against a real
   identity provider, a provided per-team API token, something else?
3. Is there one shared JSON API / participant endpoint per team, or does
   each team run its own participant node?
4. Does submitting transactions or allocating parties on DevNet require
   holding any CC for fees, and if so how does a team get some?

## The one hard blocker: replace local-dev auth before touching DevNet

`ui/app.js`'s `mintToken()` signs its own JWTs client-side with a fixed,
public string, because the local sandbox this was built against doesn't
verify token signatures at all (confirmed directly: a tampered signature
was still accepted). This is called out at the top of that file and in the
main README as local-dev-only, not access control.

**A real DevNet participant will verify signatures.** That token-minting
code will simply fail against it, which is the correct outcome, not a bug
to route around. Before pointing this UI at DevNet:

1. Get the actual auth requirements from the workshop (question 2 above).
2. Replace `mintToken()` with whatever real flow that requires, most
   likely an OAuth2 token fetched from a real identity provider rather
   than minted in the browser.
3. If the flow needs a client secret, that secret goes in the AI-narrative
   proxy (`proxy/server.js`), never in `ui/app.js`. The same reasoning
   that already keeps the OpenAI key server-side applies here. The browser
   would need to get a short-lived, scoped token from the proxy, not the
   secret itself.

## Steps once credentials are in hand

1. **Point the DAR at DevNet.** Instead of `daml sandbox` /
   `daml start`, upload the built DAR to the DevNet participant with
   whatever tool the onboarding materials specify (a Canton console
   command like `participant.dars.upload`, or `daml ledger upload-dar
   --host <devnet-host> --port <port>` if the JSON API path is exposed
   the same way). Re-run `scripts/generate-config.sh` against that DAR if
   it was rebuilt, since the package ID is a content hash.
2. **Allocate the four parties** (Pledgor, SecuredParty, Custodian,
   Regulator) using whatever process the workshop describes, rather than
   `allocatePartyWithHint` in a script (that call works today because the
   sandbox is single-tenant and unauthenticated).
3. **Re-point the UI's endpoints.** `AI_PROXY_BASE` and the JSON API base
   in `ui/config.js` currently assume `localhost`. Update both to the
   DevNet-reachable addresses. If CORS is enforced there (unlike the local
   sandbox), either serve the UI from the same origin as the JSON API
   again, or add the UI's origin to the JSON API's CORS config if that's
   configurable in the provided environment.
4. **Re-run the full lifecycle** (`Setup.daml`'s scenario, adapted to
   allocate parties the DevNet way instead of via `allocatePartyWithHint`)
   and re-verify the privacy check the same way it was verified locally:
   query as each party, confirm the regulator sees only `AuditReport`.
5. **Decide where the AI-narrative proxy runs.** If the live demo only
   ever happens from one laptop, running it locally as today is fine. If
   multiple people need to hit "Draft with AI" from different machines
   (e.g. judges poking at it independently), it needs a real host with the
   API key held there, not on a laptop that might be closed mid-demo.

## What not to do

Don't attempt the public Super-Validator-sponsorship path to get ahead of
the hackathon's own onboarding. Best case it duplicates work the program
already does for every team; worst case a team ends up running (and being
responsible for) infrastructure that isn't what a hackathon submission
needs.
