"use strict";

/*
 * Mobilis AI narrative-drafting proxy.
 *
 * Why this exists: the custodian's "Draft with AI" button in the UI needs to
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

function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      reject(new Error("OPENAI_API_KEY is not set. Add it to proxy/.env and restart the proxy."));
      return;
    }
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You draft short, plain-English narratives for institutional collateral audit reports. " +
            "Write one to two sentences, factual and neutral in tone, suitable for a regulator or auditor. " +
            "State the total posted value, call out any eligibility breaches plainly if present, and do not " +
            "invent any figures beyond what is given. No preamble, no markdown, just the sentence(s).",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
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
  const breaches = (facts.eligibilityBreaches || []).length
    ? facts.eligibilityBreaches.join(", ")
    : "none";
  return [
    `Agreement: ${facts.agreementId}`,
    `As of: ${facts.asOfNote}`,
    `Total posted value: ${facts.totalPostedValue}`,
    `Positions by asset type: ${positions || "none"}`,
    `Eligibility breaches: ${breaches}`,
  ].join("\n");
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
        const narrative = await callOpenAI(buildPrompt(facts));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ narrative }));
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
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
