"use strict";

// Checks ui/rules.js against the shared rulebook cases in parity-cases.json.
// The same cases are compiled into daml/daml/ParityCases.daml (by
// scripts/gen-parity.py) and run against the ledger's Valuation.checkMove,
// so the browser's previews and suggestions can't drift from the ledger.
//
//   node --test ui/rules.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("./rules.js");
const { criteria, cases } = require("./parity-cases.json");

const asset = (a) => ({ assetType: a.type, faceValue: a.face });
const action = (a) =>
  a.tag === "Substitution"
    ? { tag: a.tag, outgoing: asset(a.outgoing), incoming: asset(a.incoming) }
    : { tag: a.tag, asset: asset(a.asset) };

for (const c of cases) {
  test(`parity: ${c.name}`, () => {
    const r = rules.checkMove({
      criteria,
      prices: c.prices,
      required: c.required,
      schedule: c.schedule.map(asset),
      action: action(c.action),
    });
    assert.equal(r.ok, c.expect.ok, r.reason || "expected a rejection");
    if (c.expect.ok) assert.equal(rules.totalPosted(r.schedule), c.expect.total);
    else assert.equal(r.rule, c.expect.rule);
  });
}

test("suggestions stay inside the rulebook", () => {
  const schedule = [asset({ type: "UST-BILL", face: 1000000 }), asset({ type: "IG-CORP-BOND", face: 500000 })];
  const inventory = [
    { assetType: "UST-BILL", available: 3000000, costBps: 40 },
    { assetType: "IG-CORP-BOND", available: 2000000, costBps: 8 },
    { assetType: "CASH-USD", available: 1500000, costBps: 25 },
    { assetType: "HY-BOND", available: 1000000, costBps: 3 },
  ];
  // Every "valid" substitution must pass checkMove on its own.
  for (const s of rules.suggestSubstitutions({ criteria, prices: [], required: 1400000, schedule, inventory }).filter((x) => x.valid)) {
    assert.ok(rules.checkMove({ criteria, prices: [], required: 1400000, schedule, action: { tag: "Substitution", outgoing: s.outgoing, incoming: s.incoming } }).ok);
  }
  // Over-covered book: the corp bond can go back, the Treasury can't.
  const { excess, lots } = rules.suggestReturns({ criteria, prices: [], required: 950000, schedule, inventory });
  assert.equal(excess, 505000);
  assert.deepEqual(lots.filter((l) => l.valid).map((l) => l.asset.assetType), ["IG-CORP-BOND"]);
  // A price drop leaves the book short: the cheapest valid top-up covers it.
  const top = rules.suggestTopUps({ criteria, prices: [["IG-CORP-BOND", 0.8]], required: 1400000, schedule, inventory });
  assert.equal(top.shortfall, 40000);
  const best = top.options[0];
  assert.ok(best.valid);
  assert.ok(best.coverageAfter >= 1);
});
