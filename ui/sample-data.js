"use strict";

/*
 * Static preview data for deployments with no reachable Daml ledger (e.g.
 * this app hosted on Vercel). This is a real snapshot captured from an
 * actual local run of Setup:setup plus a live "Draft with AI" session, not
 * invented numbers. app.js falls back to this automatically when it can't
 * reach a JSON API, and labels every screen that's using it as a preview.
 */

const P = (name) => `${name}::sample`;

window.MOBILIS_SAMPLE = {
  parties: {
    Pledgor: P("Pledgor"),
    SecuredParty: P("SecuredParty"),
    Custodian: P("Custodian"),
    Regulator: P("Regulator"),
  },

  agreement: {
    contractId: "sample-agreement",
    payload: {
      agreementId: "MOBILIS-CA-0001",
      pledgor: P("Pledgor"),
      securedParty: P("SecuredParty"),
      custodian: P("Custodian"),
      regulator: P("Regulator"),
      eligibilityCriteria: [
        { assetType: "UST-BILL", maxHaircut: "0.02" },
        { assetType: "IG-CORP-BOND", maxHaircut: "0.05" },
      ],
    },
  },

  agreementState: {
    contractId: "sample-state",
    payload: {
      schedule: [
        { assetType: "IG-CORP-BOND", faceValue: "1000000.0", postedValue: "950000.0" },
      ],
    },
  },

  marginCalls: [
    {
      contractId: "sample-margin-1",
      payload: { direction: "NeedsMoreCollateral", amount: "50000.0", fulfilled: true },
    },
  ],

  calls: [
    {
      contractId: "sample-call-1",
      payload: {
        proposer: P("Pledgor"),
        action: { tag: "Delivery", value: { asset: { assetType: "UST-BILL", faceValue: "1000000.0", postedValue: "980000.0" } } },
        status: { tag: "Settled", value: {} },
      },
    },
    {
      contractId: "sample-call-2",
      payload: {
        proposer: P("Pledgor"),
        action: {
          tag: "Substitution",
          value: {
            outgoing: { assetType: "UST-BILL", faceValue: "1000000.0", postedValue: "980000.0" },
            incoming: { assetType: "IG-CORP-BOND", faceValue: "1000000.0", postedValue: "950000.0" },
          },
        },
        status: { tag: "Settled", value: {} },
      },
    },
    {
      contractId: "sample-call-3",
      payload: {
        proposer: P("Pledgor"),
        action: {
          tag: "Substitution",
          value: {
            outgoing: { assetType: "IG-CORP-BOND", faceValue: "1000000.0", postedValue: "950000.0" },
            incoming: { assetType: "HY-BOND", faceValue: "500000.0", postedValue: "400000.0" },
          },
        },
        status: { tag: "Disputed", value: { reason: "HY-BOND is not on the agreed eligibility schedule" } },
      },
    },
  ],

  reports: [
    {
      contractId: "sample-report-1",
      payload: {
        agreementId: "MOBILIS-CA-0001",
        asOfNote: "End of Day 1",
        totalPostedValue: "950000.0",
        positionsByAssetType: [{ _1: "IG-CORP-BOND", _2: "950000.0" }],
        eligibilityBreaches: [],
        narrative:
          "The total posted value for Agreement MOBILIS-CA-0001 as of End of Day 1 is 950,000, with all positions classified as IG-CORP-BOND. There are no eligibility breaches reported.",
      },
    },
  ],
};
