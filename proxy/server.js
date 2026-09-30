"use strict";

/*
 * Mobilis AI proxy: drafts the custodian's report narrative
 * (/draft-narrative) and ranks collateral substitutions for the pledgor
 * (/suggest-substitution, see the optimiser section below).
 *
 * Why this exists: the "Draft with AI" and "Suggest" buttons in the UI need to
 * call an LLM, but an API key can never live in browser JavaScript (anyone
 * viewing the page could read it out of the page source). This tiny server
 * holds the real key and is the only thing that ever talks to the LLM
 * provider. The browser only ever talks to this proxy, on localhost, and
 * only ever gets back the drafted text, never the key.
 *
 * The draft is a starting point, not a committed fact: the custodian can
 * edit it freely in the UI before it's ever sent to the ledger, and every
 * number in the audit report (totals, positions, eligibility breaches) is
 * still computed deterministically on-ledger in Daml, never trusted from
 * this proxy or from the LLM. Only the free-text narrative sentence is ever
 * AI-assisted.
 *
 * Run:  node server.js   (reads proxy/.env for OPENAI_API_KEY)
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const NARRATIVE_SYSTEM_PROMPT =
  "You draft short, plain-English narratives for institutional collateral audit reports. " +
  "Write one to two sentences, factual and neutral in tone, suitable for a regulator or auditor. " +
  "State the total posted value against required collateral and the coverage ratio, call out any " +
  "eligibility or concentration breaches plainly if present, and do not invent any figures beyond " +
  "what is given. No preamble, no markdown, just the sentence(s).";

function callOpenAI(systemPrompt, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      reject(new Error("OPENAI_API_KEY is not set. Add it to proxy/.env and restart the proxy."));
      return;
    }
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens || 200,
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`OpenAI API returned ${res.statusCode}: ${data.slice(0, 300)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices && json.choices[0] && json.choices[0].message.content;
            if (!text) {
              reject(new Error("OpenAI API response had no content."));
              return;
            }
            resolve(text.trim());
          } catch (e) {
            reject(new Error(`Could not parse OpenAI API response: ${e.message}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildPrompt(facts) {
  const positions = Object.entries(facts.positionsByAssetType || {})
    .map(([type, value]) => `${type}: ${value}`)
    .join(", ");
  const list = (xs) => ((xs || []).length ? xs.join(", ") : "none");
  const shares = Object.entries(facts.concentrationByAssetType || {})
    .map(([type, share]) => `${type}: ${(share * 100).toFixed(1)}%`)
    .join(", ");
  return [
    `Agreement: ${facts.agreementId}`,
    `As of: ${facts.asOfNote}`,
    `Total posted value (after haircuts): ${facts.totalPostedValue}`,
    `Required collateral: ${facts.requiredCollateral}`,
    `Coverage ratio: ${(facts.coverageRatio * 100).toFixed(1)}%`,
    `Positions by asset type: ${positions || "none"}`,
    `Share of book by asset type: ${shares || "none"}`,
    `Eligibility breaches: ${list(facts.eligibilityBreaches)}`,
    `Concentration breaches: ${list(facts.concentrationBreaches)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------
// Substitution optimiser
// ---------------------------------------------------------------------
//
// The candidate moves come from rules.js, a mirror of the on-ledger
// rulebook, so the model only ever chooses between moves that already pass
// eligibility, coverage and concentration. It picks by index and explains
// why against the treasurer's stated goal. It cannot invent a move, and the
// move it picks still has to pass the real rulebook on-ledger at Agree and
// Settle. With no API key, the best-scoring valid move is returned with a
// deterministic explanation.

const rules = require("../ui/rules.js");

const OPTIMISER_SYSTEM_PROMPT =
  "You are a collateral optimisation assistant for a pledgor's treasury desk. You are given a goal " +
  "and a numbered list of substitutions that have already been checked against the agreement's " +
  "eligibility, haircut, coverage and concentration rules. Choose the single best one for the goal. " +
  'Reply with JSON only: {"choice": <number>, "explanation": "<two sentences, plain English, ' +
  'citing only the figures given>"}.';

function describeCandidate(c, i) {
  return (
    `${i}. Release ${c.outgoing.assetType} (posted ${c.outgoing.postedValue.toFixed(0)}), ` +
    `deliver ${c.incoming.faceValue.toFixed(0)} face of ${c.incoming.assetType} ` +
    `(posts ${c.incoming.postedValue.toFixed(0)}); coverage after ${(c.coverageAfter * 100).toFixed(1)}%; ` +
    `annual funding benefit ${c.annualBenefit.toFixed(0)}`
  );
}

function fallbackExplanation(c) {
  return (
    `Releasing ${c.outgoing.assetType} and delivering ${c.incoming.assetType} keeps the book covered ` +
    `at ${(c.coverageAfter * 100).toFixed(1)}% and within every limit. It is the valid swap with the ` +
    `highest estimated annual funding benefit (${c.annualBenefit.toFixed(0)}).`
  );
}

async function suggestSubstitution(input) {
  const candidates = rules.suggestSubstitutions(input);
  const valid = candidates.filter((c) => c.valid).slice(0, 5);
  const rejected = candidates.filter((c) => !c.valid);
  if (!valid.length) {
    return {
      choice: null,
      explanation: "No one-for-one substitution from the available inventory keeps this book covered and within limits.",
      valid,
      rejected,
      source: "rules",
    };
  }
  const fallback = { choice: 0, explanation: fallbackExplanation(valid[0]), valid, rejected, source: "rules" };
  if (!process.env.OPENAI_API_KEY) return fallback;
  const prompt = [`Goal: ${input.goal || "reduce funding cost"}`, "Candidates:", ...valid.map(describeCandidate)].join("\n");
  try {
    const raw = await callOpenAI(OPTIMISER_SYSTEM_PROMPT, prompt, 250);
    const parsed = JSON.parse(raw.replace(/^```(json)?/, "").replace(/```$/, "").trim());
    const choice = Number(parsed.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= valid.length) throw new Error("choice out of range");
    return { choice, explanation: String(parsed.explanation), valid, rejected, source: "ai" };
  } catch (e) {
    return { ...fallback, note: `AI unavailable: ${e.message}` };
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/draft-narrative") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let facts;
      try {
        facts = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body." }));
        return;
      }
      try {
        const narrative = await callOpenAI(NARRATIVE_SYSTEM_PROMPT, buildPrompt(facts));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ narrative }));
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/suggest-substitution") {
    readJson(req)
      .then(suggestSubstitution)
      .then((result) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      })
      .catch((e) => {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found." }));
});

server.listen(PORT, () => {
  console.log(`Mobilis AI narrative proxy listening on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("WARNING: OPENAI_API_KEY is not set. Add it to proxy/.env before using 'Draft with AI'.");
  }
});
