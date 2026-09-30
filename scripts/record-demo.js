// Records the Mobilis demo video against a fresh demo ledger
// (scripts/demo-ledger.sh), driving the real UI buttons in all four role
// views of ui/demo-wall.html. Output: a .webm in ./video.
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:7575/ui/demo-wall.html";
// Optional: point at a specific Chromium with CHROME_PATH; otherwise
// Playwright uses its own. Needs `npm i playwright` and a running demo
// ledger (scripts/demo-ledger.sh).
const EXE = process.env.CHROME_PATH || undefined;
const W = 1600, H = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: path.join(__dirname, "video"), size: { width: W, height: H } },
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await sleep(4000);

  const fr = (role) => page.frames().find((f) => f.url().includes(`role=${role}`));
  const caption = (t, s) => page.evaluate(([t, s]) => window.setCaption(t, s), [t, s]);
  const focus = (role) => page.evaluate((r) => window.focusRole(r), role);
  const refreshAll = async () => {
    for (const role of ["Pledgor", "SecuredParty", "Custodian", "Regulator"]) {
      await fr(role).evaluate(() => refresh());
    }
    await sleep(600);
  };
  const click = async (role, text, nth = 0) => {
    const f = fr(role);
    const btn = f.locator(`button:has-text("${text}")`).nth(nth);
    await btn.scrollIntoViewIfNeeded();
    await sleep(700);
    await btn.click();
    await f.waitForFunction(() => !state.busy, null, { timeout: 120000 });
    await sleep(500);
  };
  const top = (role) => fr(role).evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  const scrollTo = (role, heading) =>
    fr(role).evaluate((h) => {
      const el = [...document.querySelectorAll("h2")].find((x) => x.textContent.toLowerCase().includes(h));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, heading);
  const fill = async (role, placeholder, value) => {
    const input = fr(role).locator(`input[placeholder="${placeholder}"]`);
    await input.scrollIntoViewIfNeeded();
    await input.fill("");
    await input.type(value, { delay: 60 });
  };

  // 0. Intro
  await caption("Mobilis: collateral mobility on Canton", "Four institutions, one ledger, each seeing only its own slice. Nothing posted yet.");
  await sleep(6000);

  // 1. Delivery
  await focus("Pledgor");
  await caption("1 · The pledgor posts a US Treasury bill", "1,000,000 face value. The ledger will work out what it's worth after the agreed 2% haircut.");
  await fill("Pledgor", "Asset type, e.g. UST-BILL", "UST-BILL");
  await fill("Pledgor", "Face value", "1000000");
  await sleep(1500);
  await click("Pledgor", "Propose delivery");
  await refreshAll();
  await focus("SecuredParty");
  await caption("The secured party agrees", "The ledger checks the move against the agreement's rules before it can be agreed.");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1500);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await caption("The custodian settles it, atomically", "Posted value: 980,000, computed on the ledger from the haircut, never trusted from the browser.");
  await scrollTo("Custodian", "collateral calls");
  await sleep(1200);
  await click("Custodian", "Settle");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await sleep(4000);

  // 2. Margin call
  await focus("SecuredParty");
  await caption("2 · The exposure moves: a margin call for 1,400,000", "The secured party now needs more collateral.");
  await fill("SecuredParty", "Amount", "1400000");
  await sleep(800);
  await click("SecuredParty", "Request margin call");
  await refreshAll();
  await focus("Custodian");
  await caption("The custodian applies it to the live schedule", "Coverage drops to 70%. The book is now short by 420,000.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1200);
  await click("Custodian", "Apply to schedule");
  await refreshAll();
  await top("Custodian");
  await top("Pledgor");
  await sleep(4500);
  await caption("Can the custodian just mark it fulfilled?", "No. Fulfilment isn't a button press: the ledger checks the book is actually covered.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1200);
  await click("Custodian", "Mark fulfilled");
  await top("Custodian");
  await sleep(5500);

  // 3. Top-up
  await focus("Pledgor");
  await caption("3 · The pledgor tops up with a corporate bond", "500,000 face, posts 475,000 after a 5% haircut. Coverage is back above 100%.");
  await fill("Pledgor", "Asset type, e.g. UST-BILL", "IG-CORP-BOND");
  await fill("Pledgor", "Face value", "500000");
  await sleep(1200);
  await click("Pledgor", "Propose delivery");
  await refreshAll();
  await focus("SecuredParty");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1000);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await scrollTo("Custodian", "collateral calls");
  await sleep(1000);
  await click("Custodian", "Settle");
  await refreshAll();
  await caption("Now the margin call can be marked fulfilled", "The ledger confirms 1,455,000 posted against 1,400,000 required.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1200);
  await click("Custodian", "Mark fulfilled");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await sleep(4000);

  // 4. Optimiser
  await focus("Pledgor");
  await caption("4 · The pledgor needs its Treasuries back for a repo", "The collateral optimiser looks for the cheapest swap the agreement's rules allow.");
  await scrollTo("Pledgor", "collateral optimiser");
  await sleep(1500);
  await fr("Pledgor").locator('section:has(h2:has-text("Collateral optimiser")) select').selectOption("UST-BILL");
  await sleep(800);
  await click("Pledgor", "Suggest");
  await scrollTo("Pledgor", "collateral optimiser");
  await caption("It rules out the tempting swaps, and says why", "Corporate bonds would break their 60% concentration limit. High-yield isn't eligible. Cash is the valid move.");
  await sleep(8000);
  await click("Pledgor", "Propose this substitution");
  await refreshAll();
  await focus("SecuredParty");
  await caption("One asset out, one asset in, in a single transaction", "There's no moment where the secured party is unprotected.");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1200);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await scrollTo("Custodian", "collateral calls");
  await sleep(1000);
  await click("Custodian", "Settle");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await sleep(4500);

  // 5. A bad move
  await focus("Pledgor");
  await caption("5 · What if someone tries a bad swap?", "Swap the corporate bond for 100 of cash: that would leave the book badly short.");
  await fill("Pledgor", "Outgoing asset type", "IG-CORP-BOND");
  await fill("Pledgor", "Incoming asset type", "CASH-USD");
  await fill("Pledgor", "Incoming face value", "100");
  await sleep(1000);
  await click("Pledgor", "Propose substitution");
  await refreshAll();
  await focus("SecuredParty");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1000);
  await click("SecuredParty", "Agree");
  await top("SecuredParty");
  await caption("The ledger refuses it: it can't even be agreed", "The rules are enforced by the ledger itself, not by a UI or a policy document.");
  await sleep(6000);
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(800);
  await click("SecuredParty", "Dispute");
  await refreshAll();

  // 6. Report
  await focus("Custodian");
  await caption("6 · The custodian publishes the regulator's report", "Every number is computed on the ledger from the live book.");
  await scrollTo("Custodian", "custodian tools");
  await sleep(1500);
  await click("Custodian", "Generate audit report");
  await refreshAll();
  await focus("Regulator");
  await caption("The regulator sees the report, and nothing else", "Coverage, positions, share of book, breaches. Its node holds no agreement, schedule or call.");
  await sleep(9000);

  // Outro
  await focus("");
  await caption("Mobilis: every collateral rule enforced by the ledger", "github.com/angelraph/mobilis · built on Canton for HackCanton Season 3");
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await sleep(6000);

  await page.screenshot({ path: path.join(__dirname, "final.png") });
  const video = page.video();
  await context.close();
  console.log("VIDEO", await video.path());
  await browser.close();
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
