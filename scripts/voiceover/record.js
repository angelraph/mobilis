// Voice-over version of record.js: each caption waits until the previous
// narration clip has finished, and logs when it appeared, so the clips can
// be laid onto the video at exactly those moments (see mix.py).
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:7575/ui/demo-wall.html";
const EXE = process.env.CHROME_PATH || undefined; // optional: a specific Chromium
const W = 1600, H = 900;
const DUR = JSON.parse(fs.readFileSync(path.join(__dirname, "vo", "durations.json"), "utf8").replace(/^\uFEFF/, ""));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: path.join(__dirname, "video"), size: { width: W, height: H } },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const marks = [];
  let voiceUntil = 0;

  await page.goto(BASE);
  await sleep(6000);

  const fr = (role) => page.frames().find((f) => f.url().includes(`role=${role}`));
  // Show a caption and start its narration clip; first let the previous clip finish.
  const say = async (id, title, sub) => {
    const wait = voiceUntil - Date.now();
    if (wait > 0) await sleep(wait);
    await page.evaluate(([t, s]) => window.setCaption(t, s), [title, sub]);
    marks.push({ id, t: (Date.now() - t0) / 1000 });
    voiceUntil = Date.now() + (DUR[id] || 3) * 1000 + 200;
  };
  const voiceDone = async () => {
    const wait = voiceUntil - Date.now();
    if (wait > 0) await sleep(wait);
  };
  const focus = (role) => page.evaluate((r) => window.focusRole(r), role);
  const refreshAll = async () => {
    for (const role of ["Pledgor", "SecuredParty", "Custodian", "Regulator"]) {
      await fr(role).evaluate(() => refresh());
    }
    await sleep(500);
  };
  const click = async (role, text, nth = 0) => {
    const f = fr(role);
    // A proposal must add a call on the ledger; if a cold-start redraw
    // swallowed the click, click once more.
    const proposing = text.startsWith("Propose");
    const before = proposing ? await f.evaluate(() => state.data.calls.length) : 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const btn = f.locator(`button:has-text("${text}")`).nth(nth);
      await retry(() => btn.scrollIntoViewIfNeeded({ timeout: 60000 }));
      await sleep(600);
      await retry(() => btn.click({ timeout: 60000 }));
      await f.waitForFunction(() => !state.busy, null, { timeout: 120000 });
      await sleep(400);
      if (!proposing) return;
      try {
        await f.waitForFunction((n) => { refresh(true); return state.data.calls.length > n; }, before, { timeout: 45000, polling: 1500 });
        return;
      } catch (e) {
        console.log(`retrying click: ${role} ${text}`);
      }
    }
    throw new Error(`${text} did not reach the ledger`);
  };
  const top = (role) => fr(role).evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  const scrollTo = (role, heading) =>
    fr(role).evaluate((h) => {
      const el = [...document.querySelectorAll("h2")].find((x) => x.textContent.toLowerCase().includes(h));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, heading);
  // The app redraws when ledger data changes; retry if an element is
  // replaced mid-interaction.
  const retry = async (fn) => {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e) { if (i >= 4 || !/not attached|detached|stale/i.test(e.message)) throw e; await sleep(700); }
    }
  };
  const fill = (role, placeholder, value) => retry(async () => {
    const input = fr(role).locator(`input[placeholder="${placeholder}"]`);
    await input.scrollIntoViewIfNeeded();
    await input.fill("");
    await input.type(value, { delay: 45 });
  });

  // 0. Intro
  await say("intro", "Mobilis: collateral mobility on Canton", "Four institutions, one ledger, each seeing only its own slice. Nothing posted yet.");
  await voiceDone();

  // 1. Delivery
  await focus("Pledgor");
  await say("delivery", "1 · The pledgor posts a US Treasury bill", "1,000,000 face value. The ledger will work out what it's worth after the agreed 2% haircut.");
  await fill("Pledgor", "Asset type, e.g. UST-BILL", "UST-BILL");
  await fill("Pledgor", "Face value", "1000000");
  await click("Pledgor", "Propose delivery");
  await refreshAll();
  await focus("SecuredParty");
  await say("agree", "The secured party agrees", "The ledger checks the move against the agreement's rules before it can be agreed.");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1200);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await say("settle", "The custodian settles it, atomically", "Posted value: 980,000, computed on the ledger from the haircut, never trusted from the browser.");
  await scrollTo("Custodian", "collateral calls");
  await sleep(1000);
  await click("Custodian", "Settle");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await voiceDone();

  // 2. Margin call
  await focus("SecuredParty");
  await say("margin", "2 · The exposure moves: a margin call for 1,400,000", "The secured party now needs more collateral.");
  await fill("SecuredParty", "Amount", "1400000");
  await click("SecuredParty", "Request margin call");
  await refreshAll();
  await focus("Custodian");
  await say("apply", "The custodian applies it to the live schedule", "Coverage drops to 70%. The book is now short by 420,000.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1000);
  await click("Custodian", "Apply to schedule");
  await refreshAll();
  await top("Custodian");
  await top("Pledgor");
  await voiceDone();
  await say("fulfilTry", "Can the custodian just mark it fulfilled?", "No. Fulfilment isn't a button press: the ledger checks the book is actually covered.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1500);
  await click("Custodian", "Mark fulfilled");
  await top("Custodian");
  await voiceDone();
  await sleep(1200);

  // 3. Top-up
  await focus("Pledgor");
  await say("topup", "3 · The pledgor tops up with a corporate bond", "500,000 face, posts 475,000 after a 5% haircut. Coverage is back above 100%.");
  await fill("Pledgor", "Asset type, e.g. UST-BILL", "IG-CORP-BOND");
  await fill("Pledgor", "Face value", "500000");
  await click("Pledgor", "Propose delivery");
  await refreshAll();
  await focus("SecuredParty");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(800);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await scrollTo("Custodian", "collateral calls");
  await sleep(800);
  await click("Custodian", "Settle");
  await refreshAll();
  await say("fulfilOk", "Now the margin call can be marked fulfilled", "The ledger confirms 1,455,000 posted against 1,400,000 required.");
  await scrollTo("Custodian", "margin calls");
  await sleep(1000);
  await click("Custodian", "Mark fulfilled");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await voiceDone();

  // 4. Optimiser
  await focus("Pledgor");
  await say("optimiser", "4 · The pledgor needs its Treasuries back for a repo", "The collateral optimiser looks for the cheapest swap the agreement's rules allow.");
  await scrollTo("Pledgor", "collateral optimiser");
  await sleep(1500);
  await fr("Pledgor").locator('section:has(h2:has-text("Collateral optimiser")) select').selectOption("UST-BILL");
  await sleep(600);
  await click("Pledgor", "Suggest");
  await scrollTo("Pledgor", "collateral optimiser");
  await voiceDone();
  await say("ruledOut", "It rules out the tempting swaps, and says why", "Corporate bonds would break their 60% concentration limit. High-yield isn't eligible. Cash is the valid move.");
  await voiceDone();
  await click("Pledgor", "Propose this substitution");
  await refreshAll();
  await focus("SecuredParty");
  await say("swap", "One asset out, one asset in, in a single transaction", "There's no moment where the secured party is unprotected.");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(1000);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await scrollTo("Custodian", "collateral calls");
  await sleep(800);
  await click("Custodian", "Settle");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await voiceDone();

  // 5. A bad move
  await focus("Pledgor");
  await say("bad", "5 · What if someone tries a bad swap?", "Swap the corporate bond for 100 of cash: that would leave the book badly short.");
  await fill("Pledgor", "Outgoing asset type", "IG-CORP-BOND");
  await fill("Pledgor", "Incoming asset type", "CASH-USD");
  await fill("Pledgor", "Incoming face value", "100");
  await click("Pledgor", "Propose substitution");
  await refreshAll();
  await voiceDone();
  await focus("SecuredParty");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(800);
  await click("SecuredParty", "Agree");
  await top("SecuredParty");
  await say("refused", "The ledger refuses it: it can't even be agreed", "The rules are enforced by the ledger itself, not by a UI or a policy document.");
  await voiceDone();
  await sleep(1000);
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(600);
  await click("SecuredParty", "Dispute");
  await refreshAll();

  // 6. Prices move
  await focus("Custodian");
  await say("mark", "6 · Markets move: the corporate bond is marked down to 80", "The ledger re-values every posted lot at the new mark, in the same transaction. The book is now short.");
  await scrollTo("Custodian", "custodian tools");
  await sleep(1500);
  await fr("Custodian").locator('select[aria-label="Asset type to mark"]').selectOption("IG-CORP-BOND");
  await fill("Custodian", "Price per 100 face, e.g. 90", "80");
  await click("Custodian", "Mark price");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await voiceDone();
  await focus("Pledgor");
  await say("topupSuggest", "Releases are blocked until the book is topped up", "The pledgor's screen proposes the cheapest delivery that restores full coverage. One click.");
  await scrollTo("Pledgor", "collateral actions");
  await sleep(1500);
  await click("Pledgor", "Propose top-up");
  await refreshAll();
  await focus("SecuredParty");
  await scrollTo("SecuredParty", "collateral calls");
  await sleep(800);
  await click("SecuredParty", "Agree");
  await refreshAll();
  await focus("Custodian");
  await scrollTo("Custodian", "collateral calls");
  await sleep(800);
  await click("Custodian", "Settle");
  await refreshAll();
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await voiceDone();

  // 7. Report
  await focus("Custodian");
  await say("report", "7 · The custodian publishes the regulator's report", "Every number is computed on the ledger from the live book, at the latest price marks.");
  await scrollTo("Custodian", "custodian tools");
  await sleep(1500);
  await click("Custodian", "Generate audit report");
  await refreshAll();
  await voiceDone();
  await focus("Regulator");
  await say("regulator", "The regulator sees the report, and nothing else", "Coverage, positions, breaches and the valuation date. Its node holds no agreement, schedule or call.");
  await voiceDone();
  await sleep(800);

  // Outro
  await focus("");
  for (const r of ["Pledgor", "SecuredParty", "Custodian"]) await top(r);
  await say("outro", "Mobilis: every collateral rule enforced by the ledger", "github.com/angelraph/mobilis · built on Canton for HackCanton Season 3");
  await voiceDone();
  await sleep(1500);

  fs.writeFileSync(path.join(__dirname, "vo", "marks.json"), JSON.stringify(marks, null, 1));
  const video = page.video();
  await context.close();
  console.log("VIDEO", await video.path());
  await browser.close();
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
