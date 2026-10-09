// Sales-agent unit checks. Run: node __tests__/sales-agent.test.mjs
//
// Imports the TypeScript source directly — Node >= 22.18 strips the types, so
// the pure functions can be verified without a build step, a database or an
// AI provider key. Networked behaviour (real provider calls, real SMTP) is
// deliberately out of scope here; those degrade to these same pure paths.
import test from "node:test";
import assert from "node:assert/strict";

import {
  aiConfigured,
  heuristicScore,
  scoreLeads,
  suggestLeads,
  templateDraft,
  AiUnavailableError,
} from "../src/index.ts";

/** Clear every provider key so "no AI configured" is deterministic. */
function clearKeys() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_PROVIDER;
}

test("heuristicScore rewards complete, human-sourced contact data", () => {
  const bare = heuristicScore({ company: "Acme" });
  assert.ok(bare.score >= 0 && bare.score <= 100);
  assert.ok(bare.score < 50, `a bare company should not look hot: ${bare.score}`);

  const full = heuristicScore({
    company: "Acme Ltd",
    contactName: "Jane Wanjiku",
    role: "Owner",
    email: "jane@acme.co.ke",
    phone: "+254711223344",
    city: "Nairobi",
    source: "MANUAL",
    notes: "Met at a trade fair",
  });
  assert.ok(full.score >= 70, `expected a strong score, got ${full.score}`);
  assert.ok(full.score <= 100, "score must stay in range");
  assert.ok(full.reason.length > 0);
});

test("heuristicScore keeps AI-sourced rows below identical human ones", () => {
  const base = { company: "Beta Traders", contactName: "A B", email: "x@y.co" };
  const manual = heuristicScore({ ...base, source: "MANUAL" });
  const ai = heuristicScore({ ...base, source: "AI_SUGGESTED" });
  assert.ok(manual.score <= 100);
  assert.ok(
    ai.score < manual.score,
    `AI-sourced (${ai.score}) should rank below manual (${manual.score})`,
  );
});

test("scoreLeads falls back to the heuristic with no provider configured", async () => {
  clearKeys();
  assert.equal(aiConfigured(), false);

  const leads = [
    { company: "Gamma", email: "a@b.co" },
    { company: "Delta" },
  ];
  const results = await scoreLeads(leads);
  assert.equal(results.length, 2);
  assert.equal(results[0].engine, "heuristic");
  assert.equal(results[0].score, heuristicScore(leads[0]).score);
  assert.equal(results[1].score, heuristicScore(leads[1]).score);
});

test("suggestLeads refuses cleanly when no provider is configured", async () => {
  clearKeys();
  await assert.rejects(
    () => suggestLeads({ niche: "pharmacies in Nairobi" }),
    (err) => err instanceof AiUnavailableError,
  );
});

test("suggestLeads rejects an empty niche before touching a provider", async () => {
  clearKeys();
  await assert.rejects(
    () => suggestLeads({ niche: "   " }),
    (err) => err instanceof AiUnavailableError,
  );
});

test("templateDraft writes a personalised email with a real opt-out", () => {
  const draft = templateDraft(
    { company: "Acme Ltd", contactName: "Jane Wanjiku" },
    { name: "Sam Otieno", business: "KoraSystems" },
  );
  assert.ok(draft.subject.length > 0 && draft.subject.length <= 70);
  assert.ok(draft.body.includes("Acme Ltd"), "greets the company");
  assert.ok(draft.body.includes("Jane"), "greets the contact by first name");
  assert.ok(draft.body.includes("Sam Otieno"), "signed by the sender");
  assert.match(draft.body, /no thanks/i, "includes an opt-out line");
  assert.ok(draft.body.split(/\s+/).length <= 200, "stays short");
  assert.equal(draft.engine, "template");
});

test("templateDraft survives a lead with no contact name", () => {
  const draft = templateDraft(
    { company: "" },
    { name: "Sam Otieno", business: "KoraSystems" },
  );
  assert.ok(draft.body.startsWith("Hi there,"));
  assert.ok(draft.subject.length > 0, "subject never comes out empty");
});
