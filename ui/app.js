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

const MODULE = (name) => `${CFG.packageId}:CollateralAgreement:${name}`;
const TEMPLATE = {
  Agreement: MODULE("CollateralAgreement"),
  AgreementState: MODULE("CollateralAgreementState"),
  MarginCall: MODULE("MarginCall"),
  Call: MODULE("CollateralCall"),
  AuditReport: `${CFG.packageId}:AuditReport:AuditReport`,
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
  const match = raw.match(/message = "([^"]+)"/);
  return match ? match[1] : raw;
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

async function queryAll(token, templateIds) {
  return api("/v1/query", token, { templateIds });
}

async function exerciseChoice(token, templateId, contractId, choice, argument) {
  return api("/v1/exercise", token, { templateId, contractId, choice, argument });
}

async function fetchPartyDirectory() {
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

function previewPosted(assetType, faceValue) {
  const c = criteria().find((x) => x.assetType === assetType);
  const face = parseFloat(faceValue) || 0;
  return c ? face * (1 - parseFloat(c.haircut)) : 0;
}

function totalPosted(schedule) {
  return schedule.reduce((sum, a) => sum + parseFloat(a.postedValue), 0);
}

function formatPct(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `${(n * 100).toFixed(1)}%`;
}

function assetLabel(a) {
  return `${a.assetType} · posted ${formatMoney(a.postedValue)} (face ${formatMoney(a.faceValue)})`;
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
    state.error = `No party found for role "${role}". Has the Setup:setup script been run?`;
    render();
    return;
  }
  state.token = await mintToken([state.partyId]);
  localStorage.setItem("mobilis-role", role);
  const url = new URL(location.href);
  url.searchParams.set("role", role);
  history.replaceState(null, "", url);
  await refresh();
}

function sampleDataFor(role) {
  const s = window.MOBILIS_SAMPLE;
  if (role === "Regulator") {
    return { agreement: null, agreementState: null, marginCalls: [], calls: [], reports: s.reports };
  }
  return { agreement: s.agreement, agreementState: s.agreementState, marginCalls: s.marginCalls, calls: s.calls, reports: s.reports };
}

async function refresh() {
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
    const nextData = {
      agreement: agreements[0] || null,
      agreementState: states[0] || null,
      marginCalls,
      calls,
      reports,
    };
    const unchanged = !state.error && JSON.stringify(nextData) === JSON.stringify(state.data);
    state.data = nextData;
    state.error = null;
    if (unchanged) return; // nothing to redraw; avoids flicker and scroll jumps on idle polling
  } catch (e) {
    state.error = e.message;
  }
  render();
}

async function runAction(fn) {
  if (state.mock) {
    state.error = "This is a static preview with sample data. No ledger is connected. Run this locally to try actions (see docs/setup-guide.md in the repo).";
    render();
    return;
  }
  state.busy = true;
  render();
  try {
    await fn();
    await refresh();
  } catch (e) {
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
  const s = state.data.agreementState;
  const input = {
    criteria: s.payload.eligibilityCriteria,
    required: s.payload.requiredCollateral,
    schedule: s.payload.schedule,
    inventory: DEMO_INVENTORY,
    release: state.suggestRelease || null,
    goal: state.suggestGoal,
  };
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
    el("div", { class: "brand" }, [
      el("span", { class: "brand-mark", text: "M" }),
      el("span", { text: "Mobilis" }),
    ]),
    el(
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
    el("button", { class: "refresh-btn", onclick: () => refresh(), text: "Refresh" }),
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
          el("strong", { text: `Coverage ${formatPct(p.coverageRatio)}` }),
        ]),
        el("div", { class: "coverage-bar" }, [
          el("div", { class: "coverage-fill", style: `width: ${Math.min(100, p.coverageRatio * 100).toFixed(1)}%` }),
        ]),
        p.shortfall > 0 ? el("p", { class: "warning", text: `Shortfall: ${formatMoney(p.shortfall)}` }) : null,
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
    el("tr", {}, [
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
    const isCounterparty = c.payload.proposer !== state.partyId && (state.role === "Pledgor" || state.role === "SecuredParty");
    const status = statusBadge(c.payload.status);
    const canAgree = status === "Outstanding" && isCounterparty;
    const canSettle = status === "Agreed" && state.role === "Custodian";
    return el("tr", {}, [
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

  const assetTypeIn = el("input", { placeholder: "Asset type, e.g. UST-BILL", value: "UST-BILL" });
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
    el("p", { class: "hint", text: "Delivery and substitution are proposed by either party and must be agreed by the counterparty, then settled by the custodian. The ledger values every asset from the agreed haircuts and refuses any move that breaks eligibility, coverage, or concentration limits." }),
    deliveryRow,
    substitutionRow,
    marginCallRow,
  ]);
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
  if (state.draftNarrative === null) state.draftNarrative = defaultNarrative();

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
        state.error = "This is a static preview with sample data. The AI drafting proxy isn't reachable here. Run this locally to try it (see docs/setup-guide.md in the repo).";
        render();
        return;
      }
      state.aiBusy = true;
      render();
      try {
        state.draftNarrative = await draftNarrativeWithAI(noteIn.value);
        state.error = null;
      } catch (e) {
        state.error = `AI drafting unavailable: ${e.message}`;
      } finally {
        state.aiBusy = false;
        render();
      }
    },
  });

  return card("Custodian tools", [
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
        el("span", { class: "muted", text: p.asOfNote }),
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
        el("span", { text: "No Daml ledger is connected here. Run this locally to see it live and try the actions (see docs/setup-guide.md in the repo)." }),
      ])
    );
  }

  if (!state.role) {
    app.appendChild(
      el("div", { class: "intro" }, [
        el("h1", { text: "Pick a role to see its view of the ledger" }),
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

  if (state.error) {
    app.appendChild(el("div", { class: "error", text: state.error }));
  }

  app.appendChild(renderVisibilityNote());

  if (state.role === "Regulator") {
    app.appendChild(renderReports());
    return;
  }

  app.appendChild(renderAgreementCard());
  app.appendChild(renderMarginCalls());
  app.appendChild(renderCalls());
  const optimiser = renderOptimiser();
  if (optimiser) app.appendChild(optimiser);
  const proposeForm = renderProposeForm();
  if (proposeForm) app.appendChild(proposeForm);
  const custodianTools = renderCustodianTools();
  if (custodianTools) app.appendChild(custodianTools);
  const reports = renderReports();
  if (reports) app.appendChild(reports);
}

function render() {
  const scrollY = window.scrollY;
  app.innerHTML = "";
  renderBody();
  window.scrollTo(0, scrollY);
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
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
  if (!state.mock) {
    setInterval(() => {
      // Don't let a background poll silently wipe an error a user action just
      // surfaced (e.g. a rejected ineligible substitution) before they've had
      // a chance to read it. The explicit Refresh button still always clears it.
      if (state.role && !state.busy && !state.error) refresh();
    }, 4000);
  }
}

boot();
