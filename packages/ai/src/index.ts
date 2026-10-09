/**
 * @kora/ai — LLM client and the sales-agent functions.
 *
 * ── Why this is one dependency-free file ────────────────────────────────────
 * The repo already keys `OPENAI_API_KEY` and `GEMINI_API_KEY` but ships no
 * client; the vendor SDKs are heavy, version-churn fast, and would be bundled
 * for the sake of two HTTP calls. Raw `fetch` against the REST APIs keeps this
 * package free of Prisma, Next and Node-only APIs, so it can be imported from
 * a route handler, a Server Component or a plain Node test alike.
 *
 * ── Degradation is a feature ────────────────────────────────────────────────
 * Every function except `suggestLeads` has a deterministic non-AI path:
 * scoring falls back to a transparent heuristic, drafting to a template. A
 * missing key, a spent quota or a network partition therefore changes the
 * *quality* of the output, never its availability — routes never fail because
 * a model is down. `suggestLeads` cannot honestly invent prospects without a
 * model, so it signals that with `AiUnavailableError` for a clean 503.
 *
 * Written with erasable-only TypeScript (no enums, no namespaces) so Node can
 * execute the source directly: `node __tests__/sales-agent.test.mjs`.
 */

/** Providers this client speaks. */
export type AiProviderName = "openai" | "gemini";

/** Longest a single provider call may take before it is abandoned. */
const TIMEOUT_MS = 20_000;

/**
 * Providers with a key present, preferred one first.
 *
 * `AI_PROVIDER` pins a provider when both keys exist; an invalid or keyless
 * preference is dropped rather than honoured into a guaranteed failure.
 */
function providersInOrder(): AiProviderName[] {
  const available: AiProviderName[] = [];
  if (process.env.OPENAI_API_KEY) available.push("openai");
  if (process.env.GEMINI_API_KEY) available.push("gemini");

  const preferred = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (preferred === "openai" || preferred === "gemini") {
    const rest = available.filter((p) => p !== preferred);
    return available.includes(preferred) ? [preferred, ...rest] : rest;
  }
  return available;
}

/** True when at least one provider has a key. Drives UI affordances too. */
export function aiConfigured(): boolean {
  return providersInOrder().length > 0;
}

/** POST with a hard timeout, so one hung provider cannot hang the request. */
async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Chat Completions with forced JSON output. Tries each model in turn. */
async function callOpenAI(system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY as string;
  // Oldest-to-newest: a long-lived key should keep working when models retire.
  const models = ["gpt-4o-mini", "gpt-4.1-mini"];
  let lastFailure = "no model attempted";

  for (const model of models) {
    const res = await post(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${key}` },
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      },
    );
    // The model was retired or is not enabled on this key — try the next.
    if (res.status === 404) {
      lastFailure = `${model} unavailable`;
      continue;
    }
    if (!res.ok) throw new Error(`OpenAI returned HTTP ${res.status}.`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return text;
    lastFailure = `${model} returned no text`;
  }
  throw new Error(`OpenAI: ${lastFailure}`);
}

/** Gemini generateContent with forced JSON MIME type. Tries each model. */
async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY as string;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastFailure = "no model attempted";

  for (const model of models) {
    const res = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      },
    );
    if (res.status === 404) {
      lastFailure = `${model} unavailable`;
      continue;
    }
    if (!res.ok) throw new Error(`Gemini returned HTTP ${res.status}.`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (text) return text;
    lastFailure = `${model} returned no text`;
  }
  throw new Error(`Gemini: ${lastFailure}`);
}

/**
 * Parse JSON out of a model reply, tolerating code fences and stray prose.
 *
 * Providers are told to emit bare JSON but may still wrap it; anything that
 * cannot be parsed resolves to null so the caller falls back instead of
 * throwing mid-request.
 */
function parseJsonLoose(raw: string): unknown | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const candidates = [trimmed];
  const brace = trimmed.indexOf("{");
  const bracket = trimmed.indexOf("[");
  const start =
    brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next shape.
    }
  }
  return null;
}

/**
 * One JSON chat turn across every configured provider.
 *
 * Returns the parsed value, or null when no provider answered with usable
 * JSON — callers treat null as "use the deterministic path".
 */
async function chatJSON(system: string, user: string): Promise<unknown | null> {
  for (const provider of providersInOrder()) {
    try {
      const raw =
        provider === "openai"
          ? await callOpenAI(system, user)
          : await callGemini(system, user);
      const parsed = parseJsonLoose(raw);
      if (parsed !== null) return parsed;
    } catch {
      // Provider down, quota spent or malformed output: try the next provider,
      // then let the caller's fallback decide.
    }
  }
  return null;
}

/** Trimmed string from untrusted model output, or undefined. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// ============================================================================
// Lead scoring
// ============================================================================

/** The subset of a `Lead` row the sales-agent functions read. */
export type LeadLike = {
  company: string;
  contactName?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  notes?: string | null;
};

export type LeadScore = {
  /** 0-100; higher is a better fit. */
  score: number;
  /** One sentence explaining the number; shown as a tooltip in the UI. */
  reason: string;
  /** `ai` when a model produced it, `heuristic` for the local fallback. */
  engine: "ai" | "heuristic";
};

/**
 * Deterministic 0-100 fit score from what is actually on the row.
 *
 * Deliberately dumb and exported: with no key configured this is the *only*
 * scorer, and a reviewer should be able to read the whole policy in one pass.
 * Weights cap at 98, so a perfect row never quite reads as machine-perfect.
 */
export function heuristicScore(lead: LeadLike): LeadScore {
  let score = 10; // credit for existing as a named company
  const signals = ["company named"];

  if (lead.email) {
    score += 25;
    signals.push("email on file");
  }
  if (lead.phone) {
    score += 15;
    signals.push("phone on file");
  }
  if (lead.contactName) {
    score += 10;
    signals.push("contact named");
  }
  if (lead.role) {
    score += 10;
    signals.push("decision-maker role");
  }
  if (lead.city) {
    score += 5;
    signals.push("located");
  }

  switch (lead.source) {
    case "INBOUND":
      score += 15;
      signals.push("came inbound");
      break;
    case "MANUAL":
      score += 10;
      signals.push("added by hand");
      break;
    case "IMPORTED":
      score += 5;
      signals.push("imported");
      break;
    default:
      // AI-suggested and anything unknown: weakest until a human verifies it.
      score += 2;
  }

  if (lead.notes) {
    score += 8;
    signals.push("context notes");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: `Heuristic: ${signals.join(", ")}.`,
    engine: "heuristic",
  };
}

/** One lead rendered for a model prompt. */
function describeLead(lead: LeadLike, index: number): string {
  const contact = lead.contactName
    ? `${lead.contactName}${lead.role ? ` (${lead.role})` : ""}`
    : "unknown";
  return [
    `${index}. ${lead.company}`,
    `   contact: ${contact}`,
    `   email: ${lead.email ?? "none"} | phone: ${lead.phone ?? "none"} | city: ${lead.city ?? "unknown"}`,
    `   source: ${lead.source ?? "MANUAL"}${lead.notes ? ` | notes: ${lead.notes}` : ""}`,
  ].join("\n");
}

const SCORE_SYSTEM = [
  "You are a B2B sales-lead scoring engine for KoraSystems, a Kenyan platform for point of sale, sales analytics and business banking sold to SMEs.",
  "Score each lead's fit from 0 (unreachable or irrelevant) to 100 (clear buyer with complete contact details).",
  "Weigh: a named decision-maker, reachable email and phone, relevance of the company to Kenyan business software, and how complete the row is. Rows that are AI-sourced with guessed emails must score lower than human-verified ones with the same shape.",
  'Return ONLY JSON of the form {"results":[{"score":0,"reason":"one short sentence"}]} with exactly one result per lead, in the same order as the input. No prose outside the JSON.',
].join(" ");

/**
 * Score a batch of leads — one model call for the whole batch, so a pipeline
 * of 25 leads costs one request, not 25. Falls back to `heuristicScore` per
 * lead when no provider answers with well-formed JSON of the right length.
 */
export async function scoreLeads(
  leads: readonly LeadLike[],
): Promise<LeadScore[]> {
  if (leads.length === 0) return [];
  const fallback = leads.map(heuristicScore);
  if (!aiConfigured()) return fallback;

  const user = leads.map((lead, i) => describeLead(lead, i + 1)).join("\n");
  const parsed = await chatJSON(SCORE_SYSTEM, user);
  const results = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length !== leads.length) {
    return fallback;
  }

  return leads.map((lead, i) => {
    const entry = results[i] as { score?: unknown; reason?: unknown };
    const reason = str(entry.reason);
    const numeric = Math.round(Number(entry.score));
    if (!reason || !Number.isFinite(numeric)) return fallback[i];
    return {
      score: Math.max(0, Math.min(100, numeric)),
      reason,
      engine: "ai" as const,
    };
  });
}

/** Score a single lead — `scoreLeads` with a batch of one. */
export async function scoreLead(lead: LeadLike): Promise<LeadScore> {
  return (await scoreLeads([lead]))[0];
}

// ============================================================================
// Outreach drafting
// ============================================================================

/** Who the email is from — pulled from the signed-in user and their SME. */
export type Sender = {
  /** The human sending, e.g. "Sam Otieno". */
  name: string;
  /** Their business, e.g. "KoraSystems". */
  business: string;
};

export type LeadDraft = {
  subject: string;
  body: string;
  /** `ai` when a model wrote it, `template` for the local fallback. */
  engine: "ai" | "template";
};

export type DraftRequest = {
  lead: LeadLike;
  sender: Sender;
  /** Optional seller-written angle; never invented by the model if absent. */
  goal?: string;
};

/**
 * The no-AI draft: short, honest, personalised from fields that exist.
 *
 * Internal `lead.notes` are deliberately never included — notes are the
 * seller's own context and leaking them into outbound mail is exactly the
 * kind of "how do you know that?" reply that kills a cold thread. Every
 * draft ends with an easy opt-out, which is both good manners and what
 * keeps a sender domain off blocklists.
 */
export function templateDraft(lead: LeadLike, sender: Sender): LeadDraft {
  const first = lead.contactName?.trim().split(/\s+/)[0];
  const company = lead.company.trim() || "your business";
  const body = [
    first ? `Hi ${first},` : "Hi there,",
    "",
    `I'm ${sender.name} from ${sender.business}. We help Kenyan businesses like ${company} run sales, stock and payments from one place, with M-Pesa built in.`,
    "",
    "Would you be open to a short conversation this week? I'm happy to work around your schedule.",
    "",
    "Cheers,",
    sender.name,
    sender.business,
    "",
    'If now is not the right time, just reply "no thanks" and I will not follow up.',
  ].join("\n");

  return {
    subject: `${sender.business} for ${company}`.slice(0, 70),
    body,
    engine: "template",
  };
}

const DRAFT_SYSTEM = [
  "You write short, honest cold-outreach emails for KoraSystems, a Kenyan platform for point of sale, sales analytics and business banking.",
  "Rules: at most 130 words of plain text per email; subject under 60 characters; greet by first name when known; reference only facts present in the row — never invent details, numbers, mutual contacts or prior conversation; one clear call to action (a short call); end with a single easy opt-out sentence; sign with the sender's name and business; no markdown, no bullet points, no placeholders left in the text.",
  'Return ONLY JSON of the form {"results":[{"subject":"...","body":"..."}]} with exactly one result per draft, in the same order as the input. No prose outside the JSON.',
].join(" ");

/**
 * Draft emails for a batch — one model call for the whole batch.
 *
 * Falls back to `templateDraft` per row when no provider answers with
 * well-formed JSON of the right length, so the draft button always returns
 * something sendable.
 */
export async function draftBatch(
  requests: readonly DraftRequest[],
): Promise<LeadDraft[]> {
  if (requests.length === 0) return [];
  const fallback = requests.map((r) => templateDraft(r.lead, r.sender));
  if (!aiConfigured()) return fallback;

  const user = requests
    .map((r, i) => {
      const lines = [
        `${i + 1}. To: ${r.lead.contactName ?? "unknown contact"} at ${r.lead.company}${r.lead.role ? ` (${r.lead.role})` : ""}`,
        `   From: ${r.sender.name} of ${r.sender.business}`,
        `   Location: ${r.lead.city ?? r.lead.country ?? "Kenya"}`,
      ];
      if (r.goal) lines.push(`   Angle to use: ${r.goal}`);
      return lines.join("\n");
    })
    .join("\n");

  const parsed = await chatJSON(DRAFT_SYSTEM, user);
  const results = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length !== requests.length) {
    return fallback;
  }

  return requests.map((req, i) => {
    const entry = results[i] as { subject?: unknown; body?: unknown };
    const subject = str(entry.subject);
    const body = str(entry.body);
    if (!subject || !body) return fallback[i];
    return { subject: subject.slice(0, 120), body, engine: "ai" as const };
  });
}

/** Draft one email — `draftBatch` with a batch of one. */
export async function draftOutreach(request: DraftRequest): Promise<LeadDraft> {
  return (await draftBatch([request]))[0];
}

// ============================================================================
// Lead sourcing
// ============================================================================

/**
 * Thrown when sourcing needs a model and none can answer.
 *
 * Routes map this to 503 with a message the UI can show verbatim — the one
 * place where "no AI" is a real failure rather than a fallback.
 */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export type SuggestedLead = {
  company: string;
  contactName?: string;
  role?: string;
  email?: string;
  city?: string;
  /** One sentence on why the company fits — stored as the lead's notes. */
  why?: string;
};

/**
 * Source prospect candidates for a niche.
 *
 * Model output, stored as `source: AI_SUGGESTED, verified: false` — the
 * company names are plausible reconstructions and the emails are guesses
 * derived from them, so nothing here may be treated as confirmed contact
 * data until a human verifies it in the UI.
 */
export async function suggestLeads(input: {
  niche: string;
  location?: string;
  count?: number;
  /** Who is asking; keeps the prompt from suggesting their own business. */
  business?: string;
}): Promise<SuggestedLead[]> {
  const niche = input.niche.trim();
  if (!niche) throw new AiUnavailableError("Describe the niche to source.");
  if (!aiConfigured()) {
    throw new AiUnavailableError(
      "AI sourcing needs a model. Set OPENAI_API_KEY or GEMINI_API_KEY on the server.",
    );
  }

  const count = Math.max(1, Math.min(10, Math.round(input.count ?? 5)));
  const location = input.location?.trim() || "Kenya";

  const system = [
    "You are a B2B lead-sourcing assistant for KoraSystems (point of sale, sales analytics and business banking for Kenyan SMEs).",
    `Find realistic prospect companies in ${location} that match the requested niche — small and mid-size businesses that could genuinely buy, ${count} of them.`,
    'Return ONLY JSON of the form {"leads":[{"company":"...","contactName":"full name","role":"decision-maker title","email":"best guess","city":"...","why":"one sentence"}]}.',
    "Rules: invent plausible, generic company names rather than asserting real registered businesses you cannot verify; the contact should be the owner, manager or procurement lead; the email is your best guess derived from the company name — say so inside 'why'; keep 'why' under 20 words.",
  ].join(" ");

  const user = [
    `Niche: ${niche}`,
    `Location: ${location}`,
    `Sourcing for: ${input.business ?? "our platform"}`,
    `Count: ${count}`,
  ].join("\n");

  const parsed = await chatJSON(system, user);
  const rows = (parsed as { leads?: unknown } | null)?.leads;
  if (!Array.isArray(rows)) {
    throw new AiUnavailableError(
      "The model returned no leads. Try a different phrasing.",
    );
  }

  const leads: SuggestedLead[] = [];
  for (const row of rows) {
    if (leads.length >= count) break;
    const entry = row as Record<string, unknown>;
    const company = str(entry.company);
    if (!company) continue;
    leads.push({
      company: company.slice(0, 120),
      contactName: str(entry.contactName)?.slice(0, 120),
      role: str(entry.role)?.slice(0, 120),
      email: str(entry.email)?.slice(0, 200),
      city: str(entry.city)?.slice(0, 120),
      why: str(entry.why)?.slice(0, 400),
    });
  }

  if (leads.length === 0) {
    throw new AiUnavailableError(
      "The model returned no usable companies. Try a different phrasing.",
    );
  }
  return leads;
}




