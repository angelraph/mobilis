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
};

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

function assetPayload(assetType, faceValue, postedValue) {
  return {
    assetType,
    faceValue: String(faceValue),
    postedValue: String(postedValue),
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

async function agreeCall(callId) {
  const agreementCid = state.data.agreement.contractId;
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Agree", { agreementCid });
}

async function disputeCall(callId, reason) {
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Dispute", { reason });
}

async function settleCall(callId) {
  const stateCid = state.data.agreementState.contractId;
  await exerciseChoice(state.token, TEMPLATE.Call, callId, "Call_Settle", { stateCid });
}

async function markMarginCallFulfilled(marginCallId) {
  await exerciseChoice(state.token, TEMPLATE.MarginCall, marginCallId, "MarginCall_MarkFulfilled", {});
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
function defaultNarrative() {
  const s = state.data.agreementState;
  const a = state.data.agreement;
  if (!s || !a) return "";
  const eligibleTypes = a.payload.eligibilityCriteria.map((c) => c.assetType);
  const breaches = s.payload.schedule.filter((asset) => !eligibleTypes.includes(asset.assetType));
  return breaches.length
    ? `Attention: ${breaches.length} posted asset(s) fall outside the agreed eligibility schedule.`
    : "All posted collateral is within the agreed eligibility schedule.";
}

async function draftNarrativeWithAI(asOfNote) {
  const s = state.data.agreementState;
  const a = state.data.agreement;
  const positions = {};
  for (const asset of s.payload.schedule) {
    positions[asset.assetType] = (positions[asset.assetType] || 0) + parseFloat(asset.postedValue);
  }
  const eligibleTypes = a.payload.eligibilityCriteria.map((c) => c.assetType);
  const breaches = s.payload.schedule
    .map((x) => x.assetType)
    .filter((t) => !eligibleTypes.includes(t));
  const res = await fetch(`${AI_PROXY_BASE}/draft-narrative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agreementId: a.payload.agreementId,
      asOfNote,
      totalPostedValue: Object.values(positions).reduce((sum, v) => sum + v, 0),
      positionsByAssetType: positions,
      eligibilityBreaches: breaches,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "The AI drafting proxy is not reachable.");
  return json.narrative;
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
      a.payload.eligibilityCriteria.map((c) => `${c.assetType} (max haircut ${c.maxHaircut})`).join(", "),
    ],
  ];
  const table = el("table", { class: "kv" }, [
    el(
      "tbody",
      {},
      rows.map(([k, v]) => el("tr", {}, [el("th", { text: k }), el("td", { text: v })]))
    ),
  ]);
  const schedule = s
    ? el("div", { class: "schedule" }, [
        el("h3", { text: "Live schedule" }),
        s.payload.schedule.length
          ? el(
              "table",
              { class: "data" },
              [
                el("thead", {}, [el("tr", {}, [el("th", { text: "Asset type" }), el("th", { text: "Posted value" })])]),
                el(
                  "tbody",
                  {},
                  s.payload.schedule.map((asset) =>
                    el("tr", {}, [
                      el("td", { "data-label": "Asset type", text: asset.assetType }),
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
      el("td", { "data-label": "Status", text: mc.payload.fulfilled ? "Fulfilled" : "Open" }),
      el(
        "td",
        { "data-label": "", class: "actions" },
        [
          !mc.payload.fulfilled && state.role === "Custodian"
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
                  runAction(() => disputeCall(c.contractId, "Rejected: asset type not on the agreed eligibility schedule")),
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
  const assetTypeIn = el("input", { placeholder: "Asset type, e.g. UST-BILL", value: "UST-BILL" });
  const faceIn = el("input", { placeholder: "Face value", value: "1000000" });
  const postedIn = el("input", { placeholder: "Posted value", value: "980000" });
  const outTypeIn = el("input", { placeholder: "Outgoing asset type", value: "UST-BILL" });
  const inTypeIn = el("input", { placeholder: "Incoming asset type", value: "IG-CORP-BOND" });
  const inFaceIn = el("input", { placeholder: "Incoming face value", value: "1000000" });
  const inPostedIn = el("input", { placeholder: "Incoming posted value", value: "950000" });

  const deliveryRow = el("div", { class: "form-row" }, [
    assetTypeIn,
    faceIn,
    postedIn,
    el("button", {
      class: "action",
      onclick: () =>
        runAction(() => proposeDelivery(assetTypeIn.value, faceIn.value, postedIn.value)),
      text: "Propose delivery",
    }),
  ]);

  const substitutionRow = el("div", { class: "form-row" }, [
    outTypeIn,
    el("span", { class: "arrow", text: "→" }),
    inTypeIn,
    inFaceIn,
    inPostedIn,
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
            inFaceIn.value,
            inPostedIn.value
          );
        }),
      text: "Propose substitution",
    }),
  ]);

  const marginCallRow =
    state.role === "SecuredParty"
      ? (() => {
          const amountIn = el("input", { placeholder: "Amount", value: "50000" });
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
    el("p", { class: "hint", text: "Delivery and substitution are proposed by either party and must be agreed by the counterparty, then settled by the custodian." }),
    deliveryRow,
    substitutionRow,
    marginCallRow,
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
      el("p", { class: "total", text: `Total posted value: ${formatMoney(p.totalPostedValue)}` }),
      el(
        "table",
        { class: "data" },
        [
          el("thead", {}, [el("tr", {}, [el("th", { text: "Asset type" }), el("th", { text: "Value" })])]),
          el(
            "tbody",
            {},
            p.positionsByAssetType.map((pair) =>
              el("tr", {}, [
                el("td", { "data-label": "Asset type", text: pair._1 }),
                el("td", { "data-label": "Value", class: "num", text: formatMoney(pair._2) }),
              ])
            )
          ),
        ]
      ),
      p.eligibilityBreaches.length
        ? el("p", { class: "warning", text: `Eligibility breaches: ${p.eligibilityBreaches.join(", ")}` })
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
