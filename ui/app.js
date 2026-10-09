"use strict";

/*
 * Mobilis role-switcher UI.
 *
 * DEV/DEMO AUTH ONLY, READ THIS FIRST:
 * The local Daml sandbox this UI talks to runs with no ledger-side
 * authentication, so any structurally valid JWT is accepted regardless of
 * its signature. To keep this a zero-backend static page, mintToken() below
 * signs tokens client-side with a fixed, public, non-secret string. That is
 * fine and normal for a local single-user sandbox demo. It is NOT an access
 * control mechanism: anyone with this page open can mint a token for any
 * party. Before this ever talks to a real DevNet or a shared environment,
 * replace mintToken() with a real per-user login against a real identity
 * provider that only issues a party's token to that party's own operator.
 */

const CFG = window.MOBILIS_CONFIG;
const DEV_TOKEN_SECRET = "mobilis-local-dev-only";
// The narrative-drafting proxy (proxy/server.js) holds the real API key
// server-side and is never reachable from anywhere but this machine.
const AI_PROXY_BASE = "http://localhost:8787";

// Canton 3.x (JSON Ledger API v2) addresses templates by package name, so
// a rebuild never changes the IDs; Canton 2.x (v1) uses the package hash.
const API_V2 = CFG.apiVersion === "v2";
const PKG = API_V2 ? "#mobilis" : CFG.packageId;
const MODULE = (name) => `${PKG}:CollateralAgreement:${name}`;
const TEMPLATE = {
  Agreement: MODULE("CollateralAgreement"),
  AgreementState: MODULE("CollateralAgreementState"),
  MarginCall: MODULE("MarginCall"),
  Call: MODULE("CollateralCall"),
  AuditReport: `${PKG}:AuditReport:AuditReport`,
};

const ROLES = ["Pledgor", "SecuredParty", "Custodian", "Regulator"];

// The pledgor's off-ledger inventory for the substitution optimiser: what it
// could deliver, and what pledging each asset costs it per year in basis
// points (the funding it could raise with that asset elsewhere). Illustrative
// treasury-desk inputs for the demo; a pilot would read these from the
// pledgor's own inventory and funding systems.
const DEMO_INVENTORY = [
  { assetType: "UST-BILL", available: 3000000, costBps: 40 },
  { assetType: "IG-CORP-BOND", available: 2000000, costBps: 8 },
  { assetType: "CASH-USD", available: 1500000, costBps: 25 },
  { assetType: "HY-BOND", available: 1000000, costBps: 3 },
];

// ---------------------------------------------------------------------
// JWT (see warning above)
// ---------------------------------------------------------------------

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintToken(actAs) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    "https://daml.com/ledger-api": {
      ledgerId: CFG.ledgerId,
      applicationId: CFG.applicationId,
      actAs,
      readAs: actAs,
    },
  };
  const enc = new TextEncoder();
  const h = base64url(enc.encode(JSON.stringify(header)));
  const p = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(DEV_TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`));
  const s = base64url(new Uint8Array(sig));
  return `${h}.${p}.${s}`;
}

// ---------------------------------------------------------------------
// JSON API
// ---------------------------------------------------------------------

// The ledger reports a rejected Daml assertion as a long interpretation-error
// string with the actual message buried inside `message = "..."`. Pull that
// out so a live demo shows the one sentence that matters, not a stack trace.
function friendlyError(raw) {
  const v1 = raw.match(/message = "([^"]+)"/);
  if (v1) return v1[1];
  // v2: "... GeneralError (error category 9): Rejected: <the rule's message>"
  const v2 = raw.match(/\(error category \d+\): (.*)$/s);
  if (v2) return v2[1].trim();
  if (/requires authorizers/.test(raw)) return "Not authorised: this step has to be taken by another party.";
  return raw;
}

async function api(path, token, body) {
  const res = await fetch(`${CFG.jsonApiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.status >= 400) {
    const raw = (json.errors && json.errors.join("; ")) || res.statusText;
    throw new Error(friendlyError(raw));
  }
  return json.result;
}

async function apiGet(path, token) {
  const res = await fetch(`${CFG.jsonApiBase}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || json.status >= 400) {
    const message = (json.errors && json.errors.join("; ")) || res.statusText;
    throw new Error(message);
  }
  return json.result;
}

// ---- JSON Ledger API v2 (Canton 3.x) ----

async function v2(method, path, body) {
  // Connected through a Canton wallet: every ledger read goes through the
  // wallet's authenticated session, to whatever network the wallet is on.
  if (state.wallet) return walletLedgerApi(method, path, body);
  const res = await fetch(`${CFG.jsonApiBase}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(state.token && !CFG.noAuth ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendlyError((json && (json.cause || json.message)) || res.statusText));
  return json;
}

// Active contracts of the given templates visible to the current party,
// returned in the same { contractId, payload } shape the v1 query gave.
async function v2Query(templateIds) {
  const { offset } = await v2("GET", "/v2/state/ledger-end");
  const cumulative = templateIds.map((templateId) => ({
    identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } } },
  }));
  const entries = await v2("POST", "/v2/state/active-contracts", {
    activeAtOffset: offset,
    eventFormat: { filtersByParty: { [state.partyId]: { cumulative } }, verbose: false },
  });
  return entries
    .map((e) => e.contractEntry && e.contractEntry.JsActiveContract)
    .filter(Boolean)
    .map(({ createdEvent: c }) => ({ contractId: c.contractId, templateId: c.templateId, payload: c.createArgument }));
}

async function v2Submit(command, actAs = [state.partyId]) {
  if (state.wallet) {
    // The wallet prepares the transaction, the user approves and signs it
    // there, and the wallet submits it.
    const sdk = await loadWalletSdk();
    return sdk.prepareExecute({ commands: [command], actAs });
  }
  return v2("POST", "/v2/commands/submit-and-wait-for-transaction", {
    commands: {
      commandId: crypto.randomUUID(),
      userId: CFG.applicationId,
      actAs,
      commands: [command],
    },
  });
}

async function v2Exercise(templateId, contractId, choice, choiceArgument) {
  return v2Submit({ ExerciseCommand: { templateId, contractId, choice, choiceArgument } });
}

// The terms a new agreement starts from: the same eligibility schedule as
// Setup.daml's demoCriteria, as percentages for the terms form.
const DEFAULT_TERMS = [
  { assetType: "UST-BILL", haircut: "2", limit: "100" },
  { assetType: "IG-CORP-BOND", haircut: "5", limit: "60" },
  { assetType: "CASH-USD", haircut: "0", limit: "100" },
];

// The terms form as the ledger expects it, or an error message. Mirrors
// the `ensure` clause on CollateralAgreement so mistakes are explained
// here instead of as a ledger rejection.
function termsToCriteria(terms) {
  const seen = new Set();
  const criteria = [];
  for (const t of terms) {
    const assetType = t.assetType.trim().toUpperCase();
    if (!assetType) return { error: "Every eligible asset needs a name." };
    if (seen.has(assetType)) return { error: `${assetType} is listed twice.` };
    seen.add(assetType);
    const haircut = parseFloat(t.haircut);
    const limit = parseFloat(t.limit);
    if (!(haircut >= 0 && haircut < 100)) return { error: `${assetType}: the haircut must be at least 0% and below 100%.` };
    if (!(limit > 0 && limit <= 100)) return { error: `${assetType}: the concentration limit must be above 0% and at most 100%.` };
    criteria.push({ assetType, haircut: (haircut / 100).toFixed(6), concentrationLimit: (limit / 100).toFixed(6) });
  }
  if (!criteria.length) return { error: "Add at least one eligible asset." };
  return { criteria };
}

// Creates an agreement with the terms from the form and opens its live
// state, in one transaction. With a wallet, the wallet's party takes every
// role (a solo test agreement: one signature, and every rule enforced
// exactly as between four firms). On the local ledger it is made between
// the four demo parties.
async function startAgreement() {
  const { criteria, error } = termsToCriteria(state.terms);
  if (error) {
    state.errorKind = "info";
    state.error = error;
    render();
    return;
  }
  const solo = !!state.wallet;
  const parties = solo
    ? { pledgor: state.partyId, securedParty: state.partyId, custodian: state.partyId, regulator: state.partyId }
    : { pledgor: state.parties.Pledgor, securedParty: state.parties.SecuredParty, custodian: state.parties.Custodian, regulator: state.parties.Regulator };
  const agreementId = `MOBILIS-${solo ? "TEST" : "CA"}-${Date.now().toString(36).toUpperCase()}`;
  await runAction(async () => {
    try {
      await v2Submit(
        {
          CreateAndExerciseCommand: {
            templateId: TEMPLATE.Agreement,
            createArguments: { ...parties, agreementId, eligibilityCriteria: criteria },
            choice: "CollateralAgreement_OpenState",
            choiceArgument: {},
          },
        },
        solo ? [state.partyId] : [parties.pledgor, parties.securedParty, parties.custodian]
      );
    } catch (e) {
      if (/PACKAGE|package|TEMPLATES_OR_INTERFACES_NOT_FOUND|not.*vetted/i.test(e.message)) {
        throw new Error("Mobilis isn't installed on your wallet's network yet: its participant node needs the Mobilis package uploaded first. See docs/WALLET.md.");
      }
      throw e;
    }
    selectAgreement(agreementId);
    if (solo) state.role = "Pledgor";
  });
}

function selectAgreement(agreementId) {
  state.agreementId = agreementId;
  try { localStorage.setItem("mobilis-agreement", agreementId); } catch (e) { /* storage blocked */ }
}

// The terms form: one row per eligible asset type, with its haircut and the
// largest share of the book it may make up.
function renderTermsEditor(intro, startLabel) {
  const rows = state.terms.map((t, i) => {
    const input = (key, attrs) =>
      el("input", { ...attrs, value: t[key], oninput: (e) => { state.terms[i][key] = e.target.value; } });
    return el("div", { class: "form-row terms-row" }, [
      input("assetType", { placeholder: "Asset type, e.g. GILT", "aria-label": "Asset type" }),
      el("label", { class: "terms-field" }, [document.createTextNode("Haircut %"), input("haircut", { inputmode: "decimal", "aria-label": "Haircut %" })]),
      el("label", { class: "terms-field" }, [document.createTextNode("Max % of book"), input("limit", { inputmode: "decimal", "aria-label": "Max % of book" })]),
      state.terms.length > 1
        ? el("button", { class: "action secondary", text: "Remove", onclick: () => { state.terms.splice(i, 1); render(); } })
        : null,
    ]);
  });
  return card("Your agreement terms", [
    el("p", { class: "hint", text: intro }),
    ...rows,
    el("div", { class: "form-row" }, [
      el("button", { class: "action secondary", text: "Add an asset", onclick: () => { state.terms.push({ assetType: "", haircut: "0", limit: "100" }); render(); } }),
      el("button", { class: "action", text: state.busy ? "Starting…" : startLabel, onclick: () => startAgreement() }),
    ]),
  ]);
}

// The roles a wallet's party holds in the agreement it can see.
function walletRoles() {
  const a = state.data.agreement && state.data.agreement.payload;
  const p = state.partyId;
  const roles = [];
  if (a) {
    if (a.pledgor === p) roles.push("Pledgor");
    if (a.securedParty === p) roles.push("SecuredParty");
    if (a.custodian === p) roles.push("Custodian");
    if (a.regulator === p) roles.push("Regulator");
  }
  if (!roles.includes("Regulator") && state.data.reports.some((r) => r.payload.regulator === p)) roles.push("Regulator");
  return roles;
}

// ---- Canton wallet (dApp SDK, CIP-103) ----
//
// "Connect wallet" lets a user act as their own Canton party, held in their
// wallet (browser extension, remote wallet or WalletConnect), instead of
// picking one of the four demo roles. Reads go through the wallet session
// and every action is approved and signed in the wallet. The SDK is loaded
// only when needed, so the demo and the static preview don't depend on it.

const DAPP_SDK_URL = "https://esm.sh/@canton-network/dapp-sdk@1.7.1";
const WALLET_FLAG = "mobilis-wallet";
let walletSdk = null;

async function loadWalletSdk() {
  if (!walletSdk) {
    const sdk = await import(DAPP_SDK_URL);
    await sdk.init();
    walletSdk = sdk;
  }
  return walletSdk;
}

async function walletLedgerApi(method, path, body) {
  const sdk = await loadWalletSdk();
  const result = await sdk.ledgerApi({ requestMethod: method.toLowerCase(), resource: path, ...(body === undefined ? {} : { body }) });
  const json = result && typeof result.response === "string" ? JSON.parse(result.response) : result;
  if (json && json.code && json.cause) throw new Error(friendlyError(json.cause));
  return json;
}

// Which role does this party play? Look for a Mobilis agreement naming it,
// or (for a regulator, who sees no agreement) an audit report addressed to it.
async function roleForParty(partyId) {
  const agreements = await v2Query([TEMPLATE.Agreement]);
  for (const a of agreements) {
    if (a.payload.pledgor === partyId) return "Pledgor";
    if (a.payload.securedParty === partyId) return "SecuredParty";
    if (a.payload.custodian === partyId) return "Custodian";
  }
  const reports = await v2Query([TEMPLATE.AuditReport]);
  if (reports.some((r) => r.payload.regulator === partyId)) return "Regulator";
  return null;
}

async function connectWallet() {
  state.walletBusy = true;
  state.error = null;
  render();
  try {
    const sdk = await loadWalletSdk();
    // Closing the picker window doesn't settle connect(), so the button
    // offers Cancel while it waits.
    const cancelled = new Promise((_, reject) => {
      state.cancelWallet = () => reject(new Error("Connection cancelled."));
    });
    const result = await Promise.race([sdk.connect(), cancelled]);
    if (!result || !result.isConnected) throw new Error("The wallet connection was cancelled.");
    const account = await sdk.getPrimaryAccount();
    const network = await sdk.getActiveNetwork().catch(() => null);
    state.wallet = { partyId: account.partyId, network: network && (network.networkId || network.id) };
    state.partyId = account.partyId;
    state.token = "wallet";
    state.mock = false;
    try { localStorage.setItem(WALLET_FLAG, "1"); } catch (e) { /* storage blocked */ }
    state.role = (await roleForParty(account.partyId)) || "Wallet";
    startPolling();
    await refresh(true);
  } catch (e) {
    state.wallet = null;
    state.errorKind = "info";
    state.error = /popup/i.test(e.message)
      ? "Wallet: the browser blocked the wallet window. Allow pop-ups for this site, then click Connect wallet again."
      : `Wallet: ${e.message}`;
  } finally {
    state.walletBusy = false;
    state.cancelWallet = null;
    render();
  }
}

async function disconnectWallet() {
  try { await (await loadWalletSdk()).disconnect(); } catch (e) { /* already gone */ }
  try { localStorage.removeItem(WALLET_FLAG); } catch (e) { /* storage blocked */ }
  location.reload();
}

async function queryAll(token, templateIds) {
  if (API_V2) return v2Query(templateIds);
  return api("/v1/query", token, { templateIds });
}

async function exerciseChoice(token, templateId, contractId, choice, argument) {
  if (API_V2) return v2Exercise(templateId, contractId, choice, argument);
  return api("/v1/exercise", token, { templateId, contractId, choice, argument });
}

async function fetchPartyDirectory() {
  if (API_V2) {
    // Canton 3.x has no display names; a party ID is "<hint>::<fingerprint>".
    const { partyDetails } = await v2("GET", "/v2/parties");
    const byRole = {};
    for (const { party } of partyDetails) {
      const hint = party.split("::")[0];
      if (ROLES.includes(hint)) byRole[hint] = party;
    }
    return byRole;
  }
  const bootstrapToken = await mintToken(["public"]);
  const parties = await apiGet("/v1/parties", bootstrapToken);
  const byRole = {};
  for (const p of parties) {
    if (ROLES.includes(p.displayName)) byRole[p.displayName] = p.identifier;
  }
  return byRole;
}

// ---------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------

const state = {
  role: null,
  partyId: null,
  token: null,
  parties: {},
  data: { agreement: null, agreementState: null, marginCalls: [], calls: [], reports: [] },
  error: null,
  busy: false,
  mock: false,
  aiBusy: false,
  draftNarrative: null, // the custodian's in-progress report narrative; reset to null after each successful report
  refreshLabel: "Refresh", // the Refresh button shows progress and confirms it ran
  wallet: null, // { partyId, network } when connected through a Canton wallet
  agreementId: null, // the agreement on screen when the party can see more than one
  agreementIds: [], // every agreement this party can see
  terms: DEFAULT_TERMS.map((t) => ({ ...t })), // the "Your agreement terms" form
  walletBusy: false,
  errorKind: "ledger", // "ledger" = the ledger refused an action; "info" = anything else
  lastCoverage: null, // coverage ratio at the previous render, so the gauge animates from it
  seenStatus: {}, // contractId -> last rendered status, to flash rows that just changed
  suggestion: null, // the pledgor's latest optimiser result
  suggestRelease: "", // asset type the pledgor wants back ("" = any)
  suggestGoal: "Free up our Treasuries for a repo this afternoon at the lowest funding cost",
};

// Mirrors Valuation.daml so forms can preview what the ledger will compute.
// Display only: the ledger recomputes every postedValue from the agreement's
// own haircuts and ignores whatever the browser sends.
function criteria() {
  return state.data.agreement ? state.data.agreement.payload.eligibilityCriteria : [];
}

// The custodian's latest price marks, as the JSON API sends them ({_1, _2} tuples).
function prices() {
  return state.data.agreementState ? state.data.agreementState.payload.prices || [] : [];
}

function previewPosted(assetType, faceValue) {
  return window.MobilisRules.valueAsset(criteria(), { assetType, faceValue: parseFloat(faceValue) || 0 }, prices()).postedValue;
}

// The inputs every rules.js helper takes, from the live state.
function rulesInput(extra) {
  const s = state.data.agreementState.payload;
  return {
    criteria: s.eligibilityCriteria,
    prices: s.prices || [],
    required: s.requiredCollateral,
    schedule: s.schedule,
    inventory: inventory(),
    ...extra,
  };
}

// The pledgor's inventory for the optimiser. An agreement on custom terms
// can accept asset types the demo inventory doesn't hold: those get a
// sample position (off-ledger, like the rest of the inventory), and the
// demo-only types it doesn't accept are left out rather than listed as
// ruled out.
function inventory() {
  const held = new Set(DEMO_INVENTORY.map((i) => i.assetType));
  const extra = criteria()
    .filter((c) => !held.has(c.assetType))
    .map((c) => ({ assetType: c.assetType, available: 2000000, costBps: 20 }));
  if (!extra.length) return DEMO_INVENTORY;
  const eligible = new Set(criteria().map((c) => c.assetType));
  return [...DEMO_INVENTORY.filter((i) => eligible.has(i.assetType)), ...extra];
}

function totalPosted(schedule) {
  return schedule.reduce((sum, a) => sum + parseFloat(a.postedValue), 0);
}

function formatPct(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `${(n * 100).toFixed(1)}%`;
}

// A call's stored postedValue is its value when proposed; show what the lot
// is worth at the current marks instead, which is what the rules use.
function assetLabel(a) {
  return `${a.assetType} · face ${formatMoney(a.faceValue)} (${formatMoney(previewPosted(a.assetType, a.faceValue))} at current marks)`;
}

function formatMoney(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function actionLabel(action) {
  if (action.tag === "Delivery") return `Delivery: ${assetLabel(action.value.asset)}`;
  if (action.tag === "Return") return `Return: ${assetLabel(action.value.asset)}`;
  if (action.tag === "Substitution") {
    return `Substitution: ${action.value.outgoing.assetType} → ${action.value.incoming.assetType}`;
  }
  return action.tag;
}

function statusBadge(status) {
  const tag = typeof status === "string" ? status : status.tag;
  return tag;
}

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

async function loadRole(role) {
  state.role = role;
  state.partyId = state.parties[role];
  state.error = null;
  if (!state.partyId) {
    state.errorKind = "info";
    state.error = `No party found for role "${role}". Has the Setup:setup script been run?`;
    render();
    return;
  }
  state.token = await mintToken([state.partyId]);
  localStorage.setItem("mobilis-role", role);
  const url = new URL(location.href);
  url.searchParams.set("role", role);
  history.replaceState(null, "", url);
  // Draw the role's (possibly empty) view now: refresh() skips redrawing
  // when the data hasn't changed, which for a role with nothing visible
  // yet (a regulator before its first report) would leave the intro up.
  // Cards rise in once per role switch, not on every refresh.
  state.lastCoverage = null;
  state.seenStatus = {};
  document.body.classList.add("entering");
  setTimeout(() => document.body.classList.remove("entering"), 1200);
  render();
  await refresh();
}

function sampleDataFor(role) {
  const s = window.MOBILIS_SAMPLE;
  if (role === "Regulator") {
    return { agreement: null, agreementState: null, marginCalls: [], calls: [], reports: s.reports };
  }
  return { agreement: s.agreement, agreementState: s.agreementState, marginCalls: s.marginCalls, calls: s.calls, reports: s.reports };
}

async function refresh(force = false) {
  if (state.mock) {
    state.data = sampleDataFor(state.role);
    state.error = null;
    render();
    return;
  }
  if (!state.token) return;
  try {
    const [agreements, states, marginCalls, calls, reports] = await Promise.all([
      queryAll(state.token, [TEMPLATE.Agreement]),
      queryAll(state.token, [TEMPLATE.AgreementState]),
      queryAll(state.token, [TEMPLATE.MarginCall]),
      queryAll(state.token, [TEMPLATE.Call]),
      queryAll(state.token, [TEMPLATE.AuditReport]),
    ]);
    // A party can see several agreements: show the selected one (or the
    // first) and only the contracts that belong to it.
    // The choice is shared across tabs, so the four-view wall follows it.
    try { state.agreementId = localStorage.getItem("mobilis-agreement") || state.agreementId; } catch (e) { /* storage blocked */ }
    const agreement = agreements.find((a) => a.payload.agreementId === state.agreementId) || agreements[0] || null;
    const id = agreement ? agreement.payload.agreementId : state.agreementId;
    const mine = (c) => !id || c.payload.agreementId === id;
    state.agreementIds = [...new Set([...agreements, ...reports].map((c) => c.payload.agreementId))];
    const nextData = {
      agreement,
      agreementState: states.find(mine) || null,
      marginCalls: marginCalls.filter(mine),
      calls: calls.filter(mine),
      reports: reports.filter(mine),
    };
    const unchanged = !state.error && JSON.stringify(nextData) === JSON.stringify(state.data);
    state.data = nextData;
    state.error = null;
    if (unchanged && !force) return; // nothing to redraw; avoids flicker and scroll jumps on idle polling
  } catch (e) {
    state.errorKind = "info";
    state.error = e.message;
  }
  render();
}

// The Refresh button: re-query the ledger (or reload the sample data) and
// say so, so a click always visibly does something even if nothing changed.
async function manualRefresh() {
  if (state.refreshLabel === "Refreshing…") return;
  state.refreshLabel = "Refreshing…";
  state.error = null;
  render();
  await refresh(true);
  state.refreshLabel = state.error ? "Retry" : state.mock ? "Sample data ✓" : "Up to date ✓";
  render();
  setTimeout(() => {
    state.refreshLabel = "Refresh";
    render();
  }, 1600);
}

async function runAction(fn) {
  if (state.mock) {
    state.errorKind = "info";
    state.error = "This is a static preview with sample data. No ledger is connected. To try the actions on a real Canton ledger, run it locally: see the Run locally page (run-locally.html).";
    render();
    return;
  }
  state.busy = true;
  render();
  try {
    await fn();
    await refresh();
  } catch (e) {
    state.errorKind = "ledger";
    state.error = e.message;
    render();
  } finally {
    state.busy = false;
    render();
  }
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

// postedValue defaults to 0: CollateralAgreement_ProposeCall recomputes it
// on-ledger from the agreement's haircut, whatever is sent here.
function assetPayload(assetType, faceValue, postedValue) {
  return {
    assetType,
    faceValue: String(faceValue),
    postedValue: String(postedValue || 0),
  };
}

async function proposeDelivery(assetType, faceValue, postedValue) {
  const agreementCid = state.data.agreement.contractId;
  await exerciseChoice(state.token, TEMPLATE.Agreement, agreementCid, "CollateralAgreement_ProposeCall", {
    proposer: state.partyId,
    action: { tag: "Delivery", value: { asset: assetPayload(assetType, faceValue, postedValue) } },
  });
}

async function proposeReturn(assetType, faceValue, postedValue) {
  const agreementCid = state.data.agreement.contractId;
  await exerciseChoice(state.token, TEMPLATE.Agreement, agreementCid, "CollateralAgreement_ProposeCall", {
    proposer: state.partyId,
    action: { tag: "Return", value: { asset: assetPayload(assetType, faceValue, postedValue) } },
  });
}

async function proposeSubstitution(outType, outFace, outPosted, inType, inFace, inPosted) {
  const agreementCid = state.data.agreement.contractId;
  await exerciseChoice(state.token, TEMPLATE.Agreement, agreementCid, "CollateralAgreement_ProposeCall", {
    proposer: state.partyId,
    action: {
      tag: "Substitution",
      value: {
        outgoing: assetPayload(outType, outFace, outPosted),
        incoming: assetPayload(inType, inFace, inPosted),
      },
    },
  });
}

async function requestMarginCall(amount, direction) {
  const agreementCid = state.data.agreement.contractId;
  await exerciseChoice(state.token, TEMPLATE.Agreement, agreementCid, "CollateralAgreement_RequestMarginCall", {
    amount: String(amount),
    direction,
  });
}

// Agree runs the full rulebook (eligibility, coverage, concentration)
// against the live state, so the counterparty passes the current state.
async function agreeCall(callId) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Agree", { stateCid });
}

async function disputeCall(callId, reason) {
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Dispute", { reason });
}

async function settleCall(callId) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Settle", { stateCid });
}

// The custodian marks a price to market; the ledger re-values the whole book.
async function markPrice(assetType, price, asOf) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.AgreementState, stateCid, "State_MarkPrices", {
    marks: [{ assetType, price: String(price) }],
    asOf,
  });
}

async function applyMarginCall(marginCallId) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.AgreementState, stateCid, "State_ApplyMarginCall", {
    marginCallCid: marginCallId,
  });
}

// The ledger refuses this unless posted value covers required collateral.
async function markMarginCallFulfilled(marginCallId) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.MarginCall, marginCallId, "MarginCall_MarkFulfilled", { stateCid });
}

async function generateReport(asOfNote, narrativeText) {
  const stateCid = state.data.agreementState.contractId;
  const agreementCid = state.data.agreement.contractId;
  const narrativeOverride = narrativeText && narrativeText.trim() ? narrativeText.trim() : null;
  await exerciseChoice(state.token, TEMPLATE.AgreementState, stateCid, "State_GenerateAuditReport", {
    agreementCid,
    asOfNote,
    narrativeOverride,
  });
}

// Mirrors the deterministic default computed on-ledger in
// State_GenerateAuditReport, so the draft box has a sensible starting point
// even before anyone clicks "Draft with AI".
// The same figures State_GenerateAuditReport computes on-ledger, for the
// coverage bar, the draft box and the AI prompt. A committed report never
// uses these: the ledger recomputes every number itself.
function positionSummary() {
  const s = state.data.agreementState;
  if (!s) return null;
  const schedule = s.payload.schedule;
  const total = totalPosted(schedule);
  const required = parseFloat(s.payload.requiredCollateral);
  const positions = {};
  for (const asset of schedule) {
    positions[asset.assetType] = (positions[asset.assetType] || 0) + parseFloat(asset.postedValue);
  }
  const limits = Object.fromEntries(
    s.payload.eligibilityCriteria.map((c) => [c.assetType, parseFloat(c.concentrationLimit)])
  );
  const concentration = Object.fromEntries(
    Object.entries(positions).map(([t, v]) => [t, total ? v / total : 0])
  );
  return {
    total,
    required,
    coverageRatio: required > 0 ? total / required : 1,
    shortfall: Math.max(0, required - total),
    excess: required > 0 ? Math.max(0, total - required) : 0,
    pricesAsOf: s.payload.pricesAsOf || "Par (no marks yet)",
    positions,
    concentration,
    eligibilityBreaches: Object.keys(positions).filter((t) => !(t in limits)),
    concentrationBreaches: Object.keys(concentration).filter((t) => t in limits && concentration[t] > limits[t]),
  };
}

function defaultNarrative() {
  const p = positionSummary();
  if (!p) return "";
  if (p.eligibilityBreaches.length)
    return `Attention: ${p.eligibilityBreaches.length} posted asset type(s) fall outside the agreed eligibility schedule.`;
  if (p.concentrationBreaches.length)
    return `Attention: concentration limit exceeded for ${p.concentrationBreaches.join(", ")}.`;
  if (p.shortfall > 0) return `Attention: posted collateral is ${formatMoney(p.shortfall)} short of the required amount.`;
  return "Fully collateralised: all posted collateral is eligible, within concentration limits, and covers the requirement.";
}

async function draftNarrativeWithAI(asOfNote) {
  const a = state.data.agreement;
  const p = positionSummary();
  const res = await fetch(`${AI_PROXY_BASE}/draft-narrative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agreementId: a.payload.agreementId,
      asOfNote,
      totalPostedValue: p.total,
      requiredCollateral: p.required,
      coverageRatio: p.coverageRatio,
      valuationAsOf: p.pricesAsOf,
      positionsByAssetType: p.positions,
      concentrationByAssetType: p.concentration,
      eligibilityBreaches: p.eligibilityBreaches,
      concentrationBreaches: p.concentrationBreaches,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "The AI drafting proxy is not reachable.");
  return json.narrative;
}

// Ask the proxy to rank substitutions (AI picks among rule-checked moves).
// If the proxy isn't reachable, including in the static preview, run the
// same rules locally and take the best-scoring valid move, so the panel
// always works. Either way the ledger re-checks whatever gets proposed.
async function suggestSubstitution() {
  const input = rulesInput({ release: state.suggestRelease || null, goal: state.suggestGoal });
  if (!state.mock) {
    try {
      const res = await fetch(`${AI_PROXY_BASE}/suggest-substitution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (res.ok) return json;
    } catch (e) {
      // fall through to local rules
    }
  }
  const all = window.MobilisRules.suggestSubstitutions(input);
  const valid = all.filter((c) => c.valid).slice(0, 5);
  const rejected = all.filter((c) => !c.valid);
  return {
    choice: valid.length ? 0 : null,
    explanation: valid.length
      ? `Best valid swap by estimated annual funding benefit. Keeps coverage at ${formatPct(valid[0].coverageAfter)} and inside every limit.`
      : "No one-for-one substitution from the available inventory keeps this book covered and within limits.",
    valid,
    rejected,
    source: "rules",
  };
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

const app = document.getElementById("app");

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children || []) {
    if (child) node.appendChild(child);
  }
  return node;
}

function card(title, children) {
  return el("section", { class: "card" }, [
    el("h2", { text: title }),
    ...children,
  ]);
}

function emptyState(text) {
  return el("p", { class: "empty", text });
}

function renderRoleSwitcher() {
  const bar = el("div", { class: "role-bar" }, [
    el("a", { class: "brand", href: "home.html" }, [
      el("img", { class: "brand-mark", src: "media/mark.png", alt: "" }),
      el("span", { text: "Mobilis" }),
    ]),
    el("a", { class: "nav-link", href: "demo-wall.html", text: "Four views" }),
    state.wallet
      ? el("span", { class: "wallet-chip", title: state.wallet.partyId }, [
          el("span", { class: "wallet-dot" }),
          document.createTextNode(`${state.wallet.partyId.split("::")[0]}${state.wallet.network ? ` · ${state.wallet.network}` : ""}`),
          el("button", { class: "wallet-off", text: "Disconnect", onclick: () => disconnectWallet() }),
        ])
      : el("button", {
          class: "wallet-btn",
          text: state.walletBusy ? "Cancel connecting" : "Connect wallet",
          onclick: () => (state.walletBusy ? state.cancelWallet && state.cancelWallet() : connectWallet()),
        }),
    state.wallet
      ? walletRoles().length > 1
        ? el(
            "select",
            { class: "role-select", "aria-label": "Act as", onchange: (e) => { state.role = e.target.value; render(); refresh(true); } },
            walletRoles().map((r) => el("option", { value: r, text: `Act as ${r}`, ...(r === state.role ? { selected: "selected" } : {}) }))
          )
        : null
      : el(
      "select",
      {
        class: "role-select",
        onchange: (e) => loadRole(e.target.value),
      },
      [
        el("option", { value: "", text: "Choose your role…" }),
        ...ROLES.map((r) =>
          el("option", { value: r, text: r, ...(r === state.role ? { selected: "selected" } : {}) })
        ),
      ]
    ),
    state.agreementIds.length > 1
      ? el(
          "select",
          { class: "role-select", "aria-label": "Agreement", onchange: (e) => { selectAgreement(e.target.value); refresh(true); } },
          state.agreementIds.map((id) => {
            const current = state.data.agreement ? state.data.agreement.payload.agreementId : state.agreementId;
            return el("option", { value: id, text: id, ...(id === current ? { selected: "selected" } : {}) });
          })
        )
      : null,
    el("button", { class: `refresh-btn${state.refreshLabel === "Refresh" ? "" : " is-active"}`, onclick: () => manualRefresh(), text: state.refreshLabel }),
  ]);
  return bar;
}

function renderAgreementCard() {
  const a = state.data.agreement;
  const s = state.data.agreementState;
  if (!a) return card("Agreement", [emptyState("No agreement visible to this party yet.")]);
  const rows = [
    ["Agreement ID", a.payload.agreementId],
    ["Pledgor", a.payload.pledgor.split("::")[0]],
    ["Secured party", a.payload.securedParty.split("::")[0]],
    ["Custodian", a.payload.custodian.split("::")[0]],
    [
      "Eligible assets",
      a.payload.eligibilityCriteria
        .map((c) => `${c.assetType} (haircut ${formatPct(c.haircut)}, max ${formatPct(c.concentrationLimit)} of book)`)
        .join(", "),
    ],
  ];
  const table = el("table", { class: "kv" }, [
    el(
      "tbody",
      {},
      rows.map(([k, v]) => el("tr", {}, [el("th", { text: k }), el("td", { text: v })]))
    ),
  ]);
  const p = positionSummary();
  const coverage = p
    ? el("div", { class: `coverage ${p.shortfall > 0 ? "coverage-short" : "coverage-ok"}` }, [
        el("div", { class: "coverage-figures" }, [
          el("span", { text: `Posted ${formatMoney(p.total)}` }),
          el("span", { text: `Required ${formatMoney(p.required)}` }),
          // Starts at the previous value; animateCoverage() ticks it to the new one.
          el("strong", {
            class: "coverage-value",
            "data-to": String(p.coverageRatio),
            text: formatPct(state.lastCoverage ?? p.coverageRatio),
          }),
        ]),
        el("div", { class: "coverage-bar" }, [
          el("div", {
            class: "coverage-fill",
            "data-to": String(p.coverageRatio),
            style: `width: ${Math.min(100, (state.lastCoverage ?? 0) * 100).toFixed(1)}%`,
          }),
        ]),
        p.shortfall > 0
          ? el("p", {
              class: "warning",
              text: `Shortfall: ${formatMoney(p.shortfall)}. The ledger refuses any return or swap that releases value until the book is topped up.`,
            })
          : null,
        p.excess > 0 ? el("p", { class: "excess-note", text: `Excess: ${formatMoney(p.excess)} above the requirement, available to return.` }) : null,
        el("div", { class: "marks" }, [
          el("span", { class: "marks-label", text: `Valued at: ${p.pricesAsOf}` }),
          ...criteria().map((c) => {
            const px = window.MobilisRules.priceFor(prices(), c.assetType);
            return el("span", { class: `mark-chip${px < 1 ? " down" : px > 1 ? " up" : ""}`, text: `${c.assetType} ${(px * 100).toFixed(2)}` });
          }),
        ]),
      ])
    : null;
  const schedule = s
    ? el("div", { class: "schedule" }, [
        coverage,
        el("h3", { text: "Live schedule" }),
        s.payload.schedule.length
          ? el(
              "table",
              { class: "data" },
              [
                el("thead", {}, [
                  el("tr", {}, [
                    el("th", { text: "Asset type" }),
                    el("th", { text: "Face value" }),
                    el("th", { text: "Posted value" }),
                  ]),
                ]),
                el(
                  "tbody",
                  {},
                  s.payload.schedule.map((asset) =>
                    el("tr", {}, [
                      el("td", { "data-label": "Asset type", text: asset.assetType }),
                      el("td", { "data-label": "Face value", class: "num", text: formatMoney(asset.faceValue) }),
                      el("td", { "data-label": "Posted value", class: "num", text: formatMoney(asset.postedValue) }),
                    ])
                  )
                ),
              ]
            )
          : emptyState("No collateral posted yet."),
      ])
    : emptyState("No live schedule visible to this party.");
  return card("Agreement", [table, schedule]);
}

function renderMarginCalls() {
  const calls = state.data.marginCalls;
  if (!calls.length) return card("Margin calls", [emptyState("No margin calls yet.")]);
  const rows = calls.map((mc) =>
    el("tr", { class: rowClass(mc.contractId, mc.payload.status) }, [
      el("td", { "data-label": "Direction", text: mc.payload.direction }),
      el("td", { "data-label": "Amount", class: "num", text: formatMoney(mc.payload.amount) }),
      el("td", { "data-label": "Status" }, [
        el("span", { class: `status status-${mc.payload.status.toLowerCase()}`, text: mc.payload.status }),
      ]),
      el(
        "td",
        { "data-label": "", class: "actions" },
        [
          mc.payload.status === "Requested" && state.role === "Custodian"
            ? el("button", {
                class: "action",
                onclick: () => runAction(() => applyMarginCall(mc.contractId)),
                text: "Apply to schedule",
              })
            : null,
          mc.payload.status === "Applied" && state.role === "Custodian"
            ? el("button", {
                class: "action",
                onclick: () => runAction(() => markMarginCallFulfilled(mc.contractId)),
                text: "Mark fulfilled",
              })
            : null,
        ]
      ),
    ])
  );
  return card("Margin calls", [
    el("table", { class: "data" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "Direction" }),
          el("th", { text: "Amount" }),
          el("th", { text: "Status" }),
          el("th", { text: "" }),
        ]),
      ]),
      el("tbody", {}, rows),
    ]),
  ]);
}

function renderCalls() {
  const calls = state.data.calls;
  if (!calls.length) return card("Collateral calls", [emptyState("No delivery, substitution, or return calls yet.")]);
  const rows = calls.map((c) => {
    // In a solo test agreement one party is both sides, so whichever side
    // the user is acting as may agree.
    const solo = c.payload.pledgor === c.payload.securedParty;
    const isCounterparty = (solo || c.payload.proposer !== state.partyId) && (state.role === "Pledgor" || state.role === "SecuredParty");
    const status = statusBadge(c.payload.status);
    const canAgree = status === "Outstanding" && isCounterparty;
    const canSettle = status === "Agreed" && state.role === "Custodian";
    return el("tr", { class: rowClass(c.contractId, status) }, [
      el("td", { "data-label": "Call", text: actionLabel(c.payload.action) }),
      el("td", { "data-label": "Proposed by", text: c.payload.proposer.split("::")[0] }),
      el("td", { "data-label": "Status" }, [el("span", { class: `status status-${status.toLowerCase()}`, text: status })]),
      el(
        "td",
        { "data-label": "", class: "actions" },
        [
          canAgree
            ? el("button", { class: "action", onclick: () => runAction(() => agreeCall(c.contractId)), text: "Agree" })
            : null,
          canAgree
            ? el("button", {
                class: "action secondary",
                onclick: () =>
                  runAction(() => disputeCall(c.contractId, "Disputed by counterparty")),
                text: "Dispute",
              })
            : null,
          canSettle
            ? el("button", { class: "action", onclick: () => runAction(() => settleCall(c.contractId)), text: "Settle" })
            : null,
        ]
      ),
    ]);
  });
  return card("Collateral calls", [
    el("table", { class: "data" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "Call" }),
          el("th", { text: "Proposed by" }),
          el("th", { text: "Status" }),
          el("th", { text: "" }),
        ]),
      ]),
      el("tbody", {}, rows),
    ]),
  ]);
}

function renderProposeForm() {
  if (state.role !== "Pledgor" && state.role !== "SecuredParty") return null;

  // Default the substitution fields to what is actually posted right now,
  // not a fixed guess -- a live demo shouldn't depend on the presenter
  // remembering to retype the correct outgoing asset type every time.
  const currentSchedule = state.data.agreementState ? state.data.agreementState.payload.schedule : [];
  const currentAsset = currentSchedule[0];
  const eligibleTypes = state.data.agreement
    ? state.data.agreement.payload.eligibilityCriteria.map((c) => c.assetType)
    : ["UST-BILL", "IG-CORP-BOND"];
  const defaultOutType = currentAsset ? currentAsset.assetType : eligibleTypes[0] || "UST-BILL";
  const defaultInType = eligibleTypes.find((t) => t !== defaultOutType) || eligibleTypes[0] || "IG-CORP-BOND";
  const defaultInFace = currentAsset ? currentAsset.faceValue : "1000000";

  // A live preview of the value the ledger will assign after haircut.
  const preview = (typeInput, faceInput) => {
    const out = el("span", { class: "preview" });
    const update = () => {
      out.textContent = `posts ${formatMoney(previewPosted(typeInput.value, faceInput.value))}`;
    };
    typeInput.addEventListener("input", update);
    faceInput.addEventListener("input", update);
    update();
    return out;
  };

  const assetTypeIn = el("input", { placeholder: "Asset type, e.g. UST-BILL", value: eligibleTypes[0] || "UST-BILL" });
  const faceIn = el("input", { placeholder: "Face value", value: "1000000" });
  const outTypeIn = el("input", { placeholder: "Outgoing asset type", value: defaultOutType });
  const inTypeIn = el("input", { placeholder: "Incoming asset type", value: defaultInType });
  const inFaceIn = el("input", { placeholder: "Incoming face value", value: defaultInFace });

  const deliveryRow = el("div", { class: "form-row" }, [
    assetTypeIn,
    faceIn,
    preview(assetTypeIn, faceIn),
    el("button", {
      class: "action",
      onclick: () => runAction(() => proposeDelivery(assetTypeIn.value, faceIn.value)),
      text: "Propose delivery",
    }),
  ]);

  const substitutionRow = el("div", { class: "form-row" }, [
    outTypeIn,
    el("span", { class: "arrow", text: "→" }),
    inTypeIn,
    inFaceIn,
    preview(inTypeIn, inFaceIn),
    el("button", {
      class: "action",
      onclick: () =>
        runAction(() => {
          const schedule = state.data.agreementState ? state.data.agreementState.payload.schedule : [];
          const outgoing = schedule.find((a) => a.assetType === outTypeIn.value) || {
            assetType: outTypeIn.value,
            faceValue: "0",
            postedValue: "0",
          };
          return proposeSubstitution(
            outgoing.assetType,
            outgoing.faceValue,
            outgoing.postedValue,
            inTypeIn.value,
            inFaceIn.value
          );
        }),
      text: "Propose substitution",
    }),
  ]);

  // Return any posted lot (the ledger refuses it if the book would be left short).
  const lotSel = el(
    "select",
    { "aria-label": "Posted lot to return" },
    currentSchedule.length
      ? currentSchedule.map((lot, i) => el("option", { value: String(i), text: `${lot.assetType} · face ${formatMoney(lot.faceValue)}` }))
      : [el("option", { value: "", text: "Nothing posted yet" })]
  );
  const returnRow = el("div", { class: "form-row" }, [
    lotSel,
    el("button", {
      class: "action secondary",
      text: "Propose return",
      onclick: () =>
        runAction(() => {
          const lot = currentSchedule[parseInt(lotSel.value, 10)];
          if (!lot) throw new Error("Nothing is posted to return.");
          return proposeReturn(lot.assetType, lot.faceValue);
        }),
    }),
  ]);

  const marginCallRow =
    state.role === "SecuredParty"
      ? (() => {
          const amountIn = el("input", { placeholder: "Amount", value: "1400000" });
          const directionSel = el("select", {}, [
            el("option", { value: "NeedsMoreCollateral", text: "Needs more collateral" }),
            el("option", { value: "ExcessCollateral", text: "Excess collateral" }),
          ]);
          return el("div", { class: "form-row" }, [
            amountIn,
            directionSel,
            el("button", {
              class: "action",
              onclick: () => runAction(() => requestMarginCall(amountIn.value, directionSel.value)),
              text: "Request margin call",
            }),
          ]);
        })()
      : null;

  return card("Propose a movement", [
    el("p", { class: "hint", text: "Delivery, substitution and return are proposed by either party and must be agreed by the counterparty, then settled by the custodian. The ledger values every asset from the agreed haircuts and refuses any move that breaks eligibility, coverage, or concentration limits." }),
    deliveryRow,
    substitutionRow,
    returnRow,
    marginCallRow,
  ]);
}

function renderCollateralActions() {
  if ((state.role !== "Pledgor" && state.role !== "SecuredParty") || !state.data.agreementState) return null;
  const p = positionSummary();
  const R = window.MobilisRules;
  const moneyFace = (a) => `${formatMoney(a.faceValue)} face of ${a.assetType}`;

  if (state.role === "SecuredParty") {
    if (p.shortfall <= 0) return null;
    return card("Collateral actions", [
      el("p", {
        class: "warning",
        text: `The book is ${formatMoney(p.shortfall)} short at the latest marks (${p.pricesAsOf}). The pledgor must top up, and the ledger refuses any release until coverage is back to 100%.`,
      }),
    ]);
  }

  const blocks = [];
  if (p.shortfall > 0) {
    const { options } = R.suggestTopUps(rulesInput());
    const best = options.find((o) => o.valid);
    blocks.push(
      el("div", { class: "action-block" }, [
        el("h3", { text: `Top up: the book is ${formatMoney(p.shortfall)} short` }),
        el("p", { class: "hint", text: "The cheapest single delivery from inventory that restores full coverage, inside every limit." }),
        ...options.slice(0, 3).map((o) =>
          el("div", { class: `action-line${o === best ? " best" : ""}${o.valid ? "" : " blocked"}` }, [
            el("span", { text: o.valid ? `Deliver ${moneyFace(o.asset)} (posts ${formatMoney(o.asset.postedValue)})` : `${o.asset.assetType}` }),
            el("span", { class: "meta", text: o.valid ? `coverage after ${formatPct(o.coverageAfter)} · ~${formatMoney(o.annualCost)}/yr to pledge` : o.reason }),
            o === best
              ? el("button", {
                  class: "action",
                  text: "Propose top-up",
                  onclick: () => runAction(() => proposeDelivery(o.asset.assetType, o.asset.faceValue)),
                })
              : null,
          ])
        ),
      ])
    );
  }

  const { excess, lots } = R.suggestReturns(rulesInput());
  if (p.shortfall <= 0 && lots.length) {
    blocks.push(
      el("div", { class: "action-block" }, [
        el("h3", { text: excess > 0 ? `Return excess: ${formatMoney(excess)} above the requirement` : "Return collateral" }),
        el("p", { class: "hint", text: "Lots the ledger will let you take back without leaving the book short. The most expensive to keep pledged come first." }),
        ...lots.map((l) =>
          el("div", { class: `action-line${l.valid ? "" : " blocked"}` }, [
            el("span", { text: `${moneyFace(l.asset)} (posted ${formatMoney(l.asset.postedValue)})` }),
            el("span", { class: "meta", text: l.valid ? `coverage after ${formatPct(l.coverageAfter)}` : l.reason }),
            l.valid
              ? el("button", {
                  class: "action secondary",
                  text: "Propose return",
                  onclick: () => runAction(() => proposeReturn(l.asset.assetType, l.asset.faceValue)),
                })
              : null,
          ])
        ),
      ])
    );
  }

  if (!blocks.length) return null;
  return card("Collateral actions", blocks);
}

function renderOptimiser() {
  if (state.role !== "Pledgor" || !state.data.agreementState) return null;
  const postedTypes = [...new Set(state.data.agreementState.payload.schedule.map((a) => a.assetType))];

  const releaseSel = el(
    "select",
    { onchange: (e) => (state.suggestRelease = e.target.value) },
    [
      el("option", { value: "", text: "Any posted asset" }),
      ...postedTypes.map((t) =>
        el("option", { value: t, text: `Get back ${t}`, ...(t === state.suggestRelease ? { selected: "selected" } : {}) })
      ),
    ]
  );
  const goalIn = el("input", { class: "grow", value: state.suggestGoal, oninput: (e) => (state.suggestGoal = e.target.value) });
  const suggestBtn = el("button", {
    class: "action",
    text: state.aiBusy ? "Thinking…" : "Suggest",
    onclick: async () => {
      if (state.aiBusy) return;
      state.aiBusy = true;
      render();
      try {
        state.suggestion = await suggestSubstitution();
        state.error = null;
      } catch (e) {
        state.errorKind = "info";
        state.error = `Suggestion failed: ${e.message}`;
      } finally {
        state.aiBusy = false;
        render();
      }
    },
  });

  const moveText = (c) =>
    `Release ${c.outgoing.assetType} (${formatMoney(c.outgoing.postedValue)}) → deliver ${formatMoney(c.incoming.faceValue)} face of ${c.incoming.assetType} (posts ${formatMoney(c.incoming.postedValue)})`;

  const result = state.suggestion;
  const body = [];
  if (result) {
    const picked = result.choice === null ? null : result.valid[result.choice];
    if (picked) {
      body.push(
        el("div", { class: "suggestion" }, [
          el("div", { class: "suggestion-head" }, [
            el("strong", { text: moveText(picked) }),
            el("span", { class: "muted", text: result.source === "ai" ? "AI pick among rule-checked moves" : "Rules-engine pick" }),
          ]),
          el("p", { text: result.explanation }),
          el("p", {
            class: "muted",
            text: `Coverage after ${formatPct(picked.coverageAfter)} · est. funding benefit ${formatMoney(picked.annualBenefit)} / yr`,
          }),
          el("button", {
            class: "action",
            text: "Propose this substitution",
            onclick: () =>
              runAction(async () => {
                await proposeSubstitution(
                  picked.outgoing.assetType,
                  picked.outgoing.faceValue,
                  picked.outgoing.postedValue,
                  picked.incoming.assetType,
                  picked.incoming.faceValue
                );
                state.suggestion = null;
              }),
          }),
        ])
      );
    } else {
      body.push(el("p", { class: "warning", text: result.explanation }));
    }
    if (result.rejected.length) {
      body.push(el("h3", { text: "Ruled out by the agreement's rules" }));
      body.push(
        el(
          "ul",
          { class: "ruled-out" },
          result.rejected.slice(0, 4).map((c) => el("li", { text: `${c.outgoing.assetType} → ${c.incoming.assetType}: ${c.reason}` }))
        )
      );
    }
  }

  return card("Collateral optimiser", [
    el("p", {
      class: "hint",
      text: "Finds the cheapest swap that keeps this book eligible, covered and inside its concentration limits. The AI only chooses among moves the rules already allow, and the ledger checks the chosen move again when it is agreed and settled.",
    }),
    el("div", { class: "form-row" }, [releaseSel, goalIn, suggestBtn]),
    ...body,
  ]);
}

function renderCustodianTools() {
  if (state.role !== "Custodian") return null;
  // Keep the default narrative in step with the book (a margin call or a
  // price drop changes it) until the custodian writes their own.
  if (state.draftNarrative === null || state.draftNarrative === state.autoNarrative) {
    state.autoNarrative = defaultNarrative();
    state.draftNarrative = state.autoNarrative;
  }

  const noteIn = el("input", { placeholder: "Note, e.g. End of Day 1", value: "End of Day 1" });
  const narrativeBox = el("textarea", {
    class: "narrative-box",
    rows: "3",
    oninput: (e) => {
      state.draftNarrative = e.target.value;
    },
  });
  narrativeBox.value = state.draftNarrative;

  const draftBtn = el("button", {
    class: "action secondary",
    text: state.aiBusy ? "Drafting…" : "Draft with AI",
    onclick: async () => {
      if (state.aiBusy) return;
      if (state.mock) {
        state.errorKind = "info";
        state.error = "This is a static preview with sample data. The AI drafting proxy isn't reachable here. Run it locally to try it: see the Run locally page (run-locally.html).";
        render();
        return;
      }
      state.aiBusy = true;
      render();
      try {
        state.draftNarrative = await draftNarrativeWithAI(noteIn.value);
        state.error = null;
      } catch (e) {
        state.errorKind = "info";
        state.error = `AI drafting unavailable: ${e.message}`;
      } finally {
        state.aiBusy = false;
        render();
      }
    },
  });

  // Mark to market: the ledger re-values every posted lot at the new price.
  const markTypeSel = el(
    "select",
    { "aria-label": "Asset type to mark" },
    criteria().map((c) => el("option", { value: c.assetType, text: c.assetType }))
  );
  const markPriceIn = el("input", { placeholder: "Price per 100 face, e.g. 90", value: "90", inputmode: "decimal" });
  const markAsOfIn = el("input", { placeholder: "As of, e.g. Day 2 close", value: "Day 2 close" });
  const markRow = el("div", { class: "form-row" }, [
    markTypeSel,
    markPriceIn,
    markAsOfIn,
    el("button", {
      class: "action",
      text: "Mark price",
      onclick: () =>
        runAction(() => {
          const px = parseFloat(markPriceIn.value) / 100;
          if (!(px > 0)) throw new Error("Enter a positive price, e.g. 90 for 90% of face value.");
          return markPrice(markTypeSel.value, px, markAsOfIn.value || "Latest marks");
        }),
    }),
  ]);

  return card("Custodian tools", [
    el("h3", { text: "Mark to market" }),
    el("p", { class: "hint", text: "As valuation agent, publish a price per 100 of face value. The ledger re-values every posted lot at once: a drop can leave the book short, and releases are then refused until the pledgor tops up." }),
    markRow,
    el("h3", { text: "Regulator report" }),
    el("p", { class: "hint", text: "Generating a report is the only way information about this agreement ever reaches the regulator." }),
    el("div", { class: "form-row" }, [noteIn]),
    el("label", { class: "field-label", text: "Narrative (edit freely, or draft with AI, before committing)" }),
    narrativeBox,
    el("div", { class: "form-row" }, [
      draftBtn,
      el("button", {
        class: "action",
        onclick: () =>
          runAction(async () => {
            await generateReport(noteIn.value, state.draftNarrative);
            state.draftNarrative = null;
          }),
        text: "Generate audit report",
      }),
    ]),
  ]);
}

function renderReports() {
  const reports = state.data.reports;
  if (state.role !== "Regulator" && !reports.length) return null;
  if (!reports.length) return card("Audit reports", [emptyState("No reports generated yet.")]);
  const items = reports.map((r) => {
    const p = r.payload;
    return el("div", { class: "report" }, [
      el("div", { class: "report-head" }, [
        el("strong", { text: p.agreementId }),
        el("span", { class: "muted", text: `${p.asOfNote}${p.valuationAsOf ? ` · valued at ${p.valuationAsOf}` : ""}` }),
      ]),
      el("p", {
        class: "total",
        text: `Posted ${formatMoney(p.totalPostedValue)} against required ${formatMoney(p.requiredCollateral)} · coverage ${formatPct(p.coverageRatio)}`,
      }),
      el(
        "table",
        { class: "data" },
        [
          el("thead", {}, [
            el("tr", {}, [el("th", { text: "Asset type" }), el("th", { text: "Value" }), el("th", { text: "Share of book" })]),
          ]),
          el(
            "tbody",
            {},
            p.positionsByAssetType.map((pair) => {
              const share = p.concentrationByAssetType.find((c) => c._1 === pair._1);
              return el("tr", {}, [
                el("td", { "data-label": "Asset type", text: pair._1 }),
                el("td", { "data-label": "Value", class: "num", text: formatMoney(pair._2) }),
                el("td", { "data-label": "Share of book", class: "num", text: share ? formatPct(share._2) : "" }),
              ]);
            })
          ),
        ]
      ),
      p.eligibilityBreaches.length
        ? el("p", { class: "warning", text: `Eligibility breaches: ${p.eligibilityBreaches.join(", ")}` })
        : null,
      p.concentrationBreaches.length
        ? el("p", { class: "warning", text: `Concentration breaches: ${p.concentrationBreaches.join(", ")}` })
        : null,
      el("p", { class: "narrative", text: p.narrative }),
    ]);
  });
  return card("Audit reports", items);
}

function renderError() {
  const ledger = state.errorKind === "ledger";
  return el("div", { class: ledger ? "error" : "error info", role: "alert" }, [
    el("span", { class: "error-title", text: ledger ? "Refused by the ledger" : "Notice" }),
    document.createTextNode(state.error),
  ]);
}

function renderVisibilityNote() {
  const counts = {
    agreement: state.data.agreement ? 1 : 0,
    schedule: state.data.agreementState ? 1 : 0,
    marginCalls: state.data.marginCalls.length,
    calls: state.data.calls.length,
    reports: state.data.reports.length,
  };
  const summary =
    state.role === "Regulator"
      ? `This role sees ${counts.reports} audit report(s) and nothing else for this agreement: 0 raw calls, 0 raw schedule state.`
      : `This role sees the agreement, the live schedule, ${counts.marginCalls} margin call(s), and ${counts.calls} collateral call(s).`;
  return el("p", { class: "visibility-note", text: summary });
}

function renderBody() {
  app.appendChild(renderRoleSwitcher());

  if (state.mock) {
    app.appendChild(
      el("div", { class: "preview-banner" }, [
        el("strong", { text: "Static preview: sample data. " }),
        el("span", { text: "No Daml ledger is connected here, so actions are disabled. " }),
        el("a", { href: "https://mobilis-demo-production.up.railway.app/ui/demo-wall.html", text: "Try it on the live ledger →" }),
        el("span", { text: " Or run it yourself: " }),
        el("code", { text: "sh scripts/demo-ledger.sh" }),
        el("a", { href: "run-locally.html", text: "Step-by-step guide →" }),
      ])
    );
  }

  if (CFG.hosted && !state.mock) {
    app.appendChild(
      el("div", { class: "preview-banner hosted-banner" }, [
        el("strong", { text: "Public demo ledger." }),
        el("span", { text: "A real Canton ledger, shared with everyone viewing it and reset to a clean start every few hours. For your own private copy: " }),
        el("a", { href: "https://mobilis-angelraphs-projects.vercel.app/run-locally.html", text: "run it locally →" }),
      ])
    );
  }

  // Before the intro, so a wallet notice shows even with no role chosen.
  if (state.error && !state.role) app.appendChild(renderError());

  if (!state.role) {
    app.appendChild(
      el("div", { class: "intro" }, [
        el("h1", {}, [document.createTextNode("One ledger. "), el("span", { text: "Four views." })]),
        el("p", {
          text: "Pledgor, Secured Party, and Custodian see the live agreement and every call. Regulator sees only the computed audit report. Open this page in four tabs, one per role, to run the full demo side by side.",
        }),
      ])
    );
    return;
  }

  app.appendChild(
    el("div", { class: "identity-bar" }, [
      el("span", { class: `role-chip role-${state.role.toLowerCase()}`, text: state.role }),
      state.busy ? el("span", { class: "busy", text: "Working…" }) : null,
    ])
  );

  if (state.error) app.appendChild(renderError());

  app.appendChild(renderVisibilityNote());

  if (state.role === "Wallet") {
    app.appendChild(
      card("Your Canton wallet", [
        el("p", { text: `Connected as ${state.wallet.partyId}${state.wallet.network ? ` on ${state.wallet.network}` : ""}.` }),
        el("p", {
          class: "hint",
          text: "This party isn't part of a Mobilis collateral agreement on this network yet. When a custodian opens an agreement naming your party as pledgor, secured party or custodian (or sends you a regulator report), it appears here, and every action you take is approved and signed in your wallet.",
        }),
      ])
    );
    app.appendChild(
      renderTermsEditor(
        "Or start a test agreement now, on your own terms: list the assets your agreement accepts, the haircut on each, and the largest share of the book each may make up. Your party takes every role (pledgor, secured party, custodian and regulator), so you can walk the whole cycle yourself by switching roles, and the ledger enforces your terms exactly as it would between four firms. One approval in your wallet.",
        "Start a test agreement"
      )
    );
    return;
  }

  if (state.role === "Regulator") {
    app.appendChild(renderReports());
    return;
  }

  app.appendChild(renderAgreementCard());
  app.appendChild(renderMarginCalls());
  app.appendChild(renderCalls());
  const actions = renderCollateralActions();
  if (actions) app.appendChild(actions);
  const optimiser = renderOptimiser();
  if (optimiser) app.appendChild(optimiser);
  const proposeForm = renderProposeForm();
  if (proposeForm) app.appendChild(proposeForm);
  const custodianTools = renderCustodianTools();
  if (custodianTools) app.appendChild(custodianTools);
  const reports = renderReports();
  if (reports) app.appendChild(reports);
  // Model a new agreement on your own terms, between the four demo parties.
  if (state.role === "Custodian" && !state.wallet) {
    app.appendChild(
      renderTermsEditor(
        "Try your own agreement: list the assets it accepts, the haircut on each, and the largest share of the book each may make up. This creates a new agreement between the four demo parties (on this local ledger the pledgor and secured party sign together), and every role switches to it. Then propose real moves and see which ones the ledger refuses.",
        "Create agreement"
      )
    );
  }
}

// Flash a row whose status changed (or that appeared) since the last render,
// so a settlement or agreement landing from another party is noticeable.
const nextSeen = {};
function rowClass(contractKey, status) {
  nextSeen[contractKey] = status;
  const hadRows = Object.keys(state.seenStatus).length > 0;
  return hadRows && state.seenStatus[contractKey] !== status ? "flash" : "";
}

// Tick the coverage figure and slide the bar from the previous render's
// value to the new one, like a live market number.
function animateCoverage() {
  const fill = app.querySelector(".coverage-fill");
  const value = app.querySelector(".coverage-value");
  if (!fill || !value) {
    state.lastCoverage = null;
    return;
  }
  const to = parseFloat(value.dataset.to);
  const from = state.lastCoverage ?? to;
  state.lastCoverage = to;
  requestAnimationFrame(() => {
    fill.style.width = `${Math.min(100, to * 100).toFixed(1)}%`;
  });
  if (from === to) {
    value.textContent = formatPct(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1100);
    const eased = 1 - Math.pow(1 - t, 3);
    value.textContent = formatPct(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function render() {
  const scrollY = window.scrollY;
  app.innerHTML = "";
  for (const k of Object.keys(nextSeen)) delete nextSeen[k];
  renderBody();
  if (Object.keys(nextSeen).length) state.seenStatus = { ...nextSeen };
  animateCoverage();
  window.scrollTo(0, scrollY);
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
  if (window.self !== window.top) document.body.classList.add("embedded");
  render();
  try {
    state.parties = await fetchPartyDirectory();
  } catch (e) {
    // No reachable JSON API (e.g. this build is deployed somewhere with no
    // local Daml sandbox behind it). Fall back to a bundled, clearly-labeled
    // sample dataset rather than showing a wall of connection errors.
    state.mock = true;
    state.parties = window.MOBILIS_SAMPLE.parties;
  }
  const params = new URLSearchParams(location.search);
  const initialRole = params.get("role") || localStorage.getItem("mobilis-role");
  if (initialRole && ROLES.includes(initialRole)) {
    await loadRole(initialRole);
  } else {
    render();
  }
  if (!state.mock) startPolling();
  // A returning wallet user: restore the session silently (no picker).
  let returning = false;
  try { returning = localStorage.getItem(WALLET_FLAG) === "1"; } catch (e) { /* storage blocked */ }
  if (returning && !params.get("role")) {
    try {
      const sdk = await loadWalletSdk();
      const { isConnected } = await sdk.isConnected();
      if (isConnected) await connectWallet();
    } catch (e) { /* stay in demo mode */ }
  }
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    // Don't let a background poll silently wipe an error a user action just
    // surfaced (e.g. a rejected ineligible substitution) before they've had
    // a chance to read it. The explicit Refresh button still always clears it.
    if (state.role && !state.busy && !state.error) refresh();
  }, 4000);
}

boot();
