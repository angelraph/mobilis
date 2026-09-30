// Times one full collateral cycle through the UI's own ledger calls on the
// live demo ledger (after record.js has run), three times, and prints the
// per-step round-trip times. Measures ledger + API time only, not the time
// a person takes to read and click.
const { chromium } = require("playwright");
// Optional: point at a specific Chromium with CHROME_PATH; otherwise
// Playwright uses its own. Needs `npm i playwright` and a running demo
// ledger (scripts/demo-ledger.sh).
const EXE = process.env.CHROME_PATH || undefined;

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const page = await browser.newPage();
  await page.goto("http://localhost:7575/ui/index.html?role=Pledgor");
  await page.waitForFunction(() => state.partyId && state.data.agreementState);

  const result = await page.evaluate(async () => {
    const as = async (role) => { await loadRole(role); };
    const t = async (label, fn, rows) => {
      const s = performance.now();
      await fn();
      rows.push([label, Math.round(performance.now() - s)]);
    };
    const outstanding = (tag) => state.data.calls.find((c) => c.payload.status.tag === "Outstanding" && c.payload.action.tag === tag);
    const agreedCall = () => state.data.calls.find((c) => c.payload.status.tag === "Agreed");
    const runs = [];
    for (let run = 0; run < 3; run++) {
      const rows = [];
      await as("SecuredParty");
      await t("Margin call requested", () => requestMarginCall(100000, "NeedsMoreCollateral"), rows);
      await as("Custodian");
      const mc = state.data.marginCalls.find((m) => m.payload.status === "Requested");
      await t("Margin call applied to schedule", () => applyMarginCall(mc.contractId), rows);
      await as("Pledgor");
      await t("Top-up delivery proposed", () => proposeDelivery("UST-BILL", 200000), rows);
      await as("SecuredParty");
      await t("Delivery agreed (rules checked)", () => agreeCall(outstanding("Delivery").contractId), rows);
      await as("Custodian");
      await t("Delivery settled (rules re-checked)", () => settleCall(agreedCall().contractId), rows);
      await refresh();
      const applied = state.data.marginCalls.find((m) => m.payload.status === "Applied");
      await t("Margin call fulfilled (coverage checked)", () => markMarginCallFulfilled(applied.contractId), rows);
      await refresh();
      await as("Pledgor");
      const ust = state.data.agreementState.payload.schedule.find((a) => a.assetType === "UST-BILL");
      await t("Substitution proposed", () => proposeSubstitution("UST-BILL", ust.faceValue, ust.postedValue, "CASH-USD", ust.postedValue), rows);
      await as("SecuredParty");
      await t("Substitution agreed", () => agreeCall(outstanding("Substitution").contractId), rows);
      await as("Custodian");
      await t("Substitution settled atomically", () => settleCall(agreedCall().contractId), rows);
      await refresh();
      await t("Regulator report generated", () => generateReport(`Timing run ${run + 1}`, null), rows);
      runs.push(rows);
    }
    return runs;
  });

  const steps = result[0].map((r) => r[0]);
  console.log("| Step | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) |");
  console.log("|---|---|---|---|");
  steps.forEach((s, i) => console.log(`| ${s} | ${result.map((r) => r[i][1]).join(" | ")} |`));
  const totals = result.map((r) => r.reduce((sum, x) => sum + x[1], 0));
  console.log(`| **Full cycle** | ${totals.map((x) => `**${x}**`).join(" | ")} |`);
  await browser.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
