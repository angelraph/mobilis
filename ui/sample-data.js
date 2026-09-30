"use strict";

/*
 * Static preview data for deployments with no reachable Daml ledger (e.g.
 * this app hosted on Vercel). app.js falls back to this automatically when
 * it can't reach a JSON API, and labels every screen that's using it as a
 * preview.
 *
 * It is the ledger state of Setup:setup after step 3 (UST delivered, a
 * 1,400,000 margin call applied, a corporate bond topped up, the margin call
 * fulfilled), stopped just before the substitution so the preview's
 * optimiser has the same UST-for-cash swap to suggest. The report figures
 * are the ones Tests:test_regulatorSeesOnlyTheReport asserts for this book.
 */

const P = (name) => `${name}::sample`;

const CRITERIA = [
  { assetType: "UST-BILL", haircut: "0.02", concentrationLimit: "1.0" },
  { assetType: "IG-CORP-BOND", haircut: "0.05", concentrationLimit: "0.6" },
  { assetType: "CASH-USD", haircut: "0.0", concentrationLimit: "1.0" },
];

const UST = { assetType: "UST-BILL", faceValue: "1000000.0", postedValue: "980000.0" };
const CORP = { assetType: "IG-CORP-BOND", faceValue: "500000.0", postedValue: "475000.0" };

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
      eligibilityCriteria: CRITERIA,
    },
  },

  agreementState: {
    contractId: "sample-state",
    payload: {
      agreementId: "MOBILIS-CA-0001",
      eligibilityCriteria: CRITERIA,
      requiredCollateral: "1400000.0",
      schedule: [UST, CORP],
    },
  },

  marginCalls: [
    {
      contractId: "sample-margin-1",
      payload: { direction: "NeedsMoreCollateral", amount: "1400000.0", status: "Fulfilled" },
    },
  ],

  calls: [
    {
      contractId: "sample-call-1",
      payload: {
        proposer: P("Pledgor"),
        action: { tag: "Delivery", value: { asset: UST } },
        status: { tag: "Settled", value: {} },
      },
    },
    {
      contractId: "sample-call-2",
      payload: {
        proposer: P("Pledgor"),
        action: { tag: "Delivery", value: { asset: CORP } },
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
            outgoing: CORP,
            incoming: { assetType: "HY-BOND", faceValue: "500000.0", postedValue: "0.0" },
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
        totalPostedValue: "1455000.0",
        requiredCollateral: "1400000.0",
        coverageRatio: "1.0392857143",
        positionsByAssetType: [
          { _1: "UST-BILL", _2: "980000.0" },
          { _1: "IG-CORP-BOND", _2: "475000.0" },
        ],
        concentrationByAssetType: [
          { _1: "UST-BILL", _2: "0.6735395189" },
          { _1: "IG-CORP-BOND", _2: "0.3264604811" },
        ],
        eligibilityBreaches: [],
        concentrationBreaches: [],
        narrative:
          "Fully collateralised: all posted collateral is eligible, within concentration limits, and covers the requirement.",
      },
    },
  ],
};
