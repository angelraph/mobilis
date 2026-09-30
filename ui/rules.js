"use strict";

/*
 * Mobilis collateral rules, JavaScript mirror of daml/daml/Valuation.daml.
 *
 * Used for two things only: previewing what the ledger will compute, and
 * searching for substitutions worth suggesting. It is never the authority.
 * Every suggestion becomes an ordinary CollateralAgreement_ProposeCall, and
 * the ledger re-runs the real rulebook (Valuation.checkMove) at Agree and
 * again at Settle. If this file and the Daml ever disagree, the Daml wins
 * and the call is rejected.
 *
 * Loaded as a plain <script> in the UI (window.MobilisRules) and with
 * require() in proxy/server.js.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MobilisRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const num = (v) => (typeof v === "string" ? parseFloat(v) : v);

  function criterionFor(criteria, assetType) {
    return criteria.find((c) => c.assetType === assetType) || null;
  }

  function valueAsset(criteria, asset) {
    const c = criterionFor(criteria, asset.assetType);
    const face = num(asset.faceValue);
    return { assetType: asset.assetType, faceValue: face, postedValue: c ? face * (1 - num(c.haircut)) : 0 };
  }

  function totalPosted(schedule) {
    return schedule.reduce((sum, a) => sum + num(a.postedValue), 0);
  }

  function concentrations(schedule) {
    const total = totalPosted(schedule);
    const byType = {};
    for (const a of schedule) byType[a.assetType] = (byType[a.assetType] || 0) + num(a.postedValue);
    const out = {};
    for (const [t, v] of Object.entries(byType)) out[t] = total ? v / total : 0;
    return out;
  }

  function sameAsset(a, b) {
    return a.assetType === b.assetType && num(a.faceValue) === num(b.faceValue);
  }

  // Same four rules, same order, as Valuation.checkMove.
  function checkSubstitution(criteria, required, schedule, outgoing, incoming) {
    if (!criterionFor(criteria, incoming.assetType)) {
      return { ok: false, reason: `${incoming.assetType} is not on the agreed eligibility schedule` };
    }
    const idx = schedule.findIndex((a) => sameAsset(a, outgoing));
    if (idx === -1) return { ok: false, reason: `${outgoing.assetType} being released is not currently posted` };
    const next = schedule.filter((_, i) => i !== idx).concat([incoming]);
    const newTotal = totalPosted(next);
    if (newTotal < required) {
      return { ok: false, reason: `would leave posted value ${newTotal.toFixed(2)} below required ${required.toFixed(2)}` };
    }
    const share = concentrations(next)[incoming.assetType];
    const limit = num(criterionFor(criteria, incoming.assetType).concentrationLimit);
    if (share > limit) {
      return { ok: false, reason: `${incoming.assetType} would be ${(share * 100).toFixed(1)}% of the book, over its ${(limit * 100).toFixed(0)}% limit` };
    }
    return { ok: true, schedule: next };
  }

  /*
   * Enumerate one-for-one substitutions: each posted asset out, each
   * inventory lot in, sized to the smallest face value (rounded up to the
   * nearest 1,000) that keeps the book covered. Scored by the annual
   * funding benefit of the swap: what the outgoing asset is worth to the
   * pledgor elsewhere minus what the incoming one costs to pledge, both
   * from the inventory's costBps (an input the treasury desk supplies).
   *
   * Returns every candidate, valid or not, so the UI can show why the
   * tempting-but-illegal moves were ruled out.
   */
  function suggestSubstitutions({ criteria, required, schedule, inventory, release }) {
    const req = num(required);
    const posted = schedule.map((a) => ({ assetType: a.assetType, faceValue: num(a.faceValue), postedValue: num(a.postedValue) }));
    const costOf = (t) => {
      const lot = inventory.find((l) => l.assetType === t);
      return lot ? num(lot.costBps) : 0;
    };
    const out = [];
    for (const outgoing of posted) {
      if (release && outgoing.assetType !== release) continue;
      const remaining = totalPosted(posted) - outgoing.postedValue;
      for (const lot of inventory) {
        if (lot.assetType === outgoing.assetType) continue;
        const c = criterionFor(criteria, lot.assetType);
        const haircut = c ? num(c.haircut) : 0;
        const needPosted = Math.max(0, req - remaining);
        let face = c ? Math.ceil(needPosted / (1 - haircut) / 1000) * 1000 : num(lot.available);
        if (face <= 0) face = 1000;
        const incoming = valueAsset(criteria, { assetType: lot.assetType, faceValue: face });
        let check;
        if (face > num(lot.available)) {
          check = { ok: false, reason: `needs ${face.toLocaleString()} face of ${lot.assetType}, only ${num(lot.available).toLocaleString()} available` };
        } else {
          check = checkSubstitution(criteria, req, posted, outgoing, incoming);
        }
        const annualBenefit =
          (outgoing.postedValue * costOf(outgoing.assetType) - incoming.postedValue * costOf(lot.assetType)) / 10000;
        out.push({
          outgoing,
          incoming,
          valid: check.ok,
          reason: check.ok ? null : check.reason,
          annualBenefit,
          coverageAfter: check.ok && req > 0 ? totalPosted(check.schedule) / req : null,
        });
      }
    }
    out.sort((a, b) => (a.valid === b.valid ? b.annualBenefit - a.annualBenefit : a.valid ? -1 : 1));
    return out;
  }

  return { valueAsset, totalPosted, concentrations, checkSubstitution, suggestSubstitutions };
});
