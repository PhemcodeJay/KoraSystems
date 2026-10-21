"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Badge,
  Card,
  Empty,
  Stat,
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";

// ── Wire types ───────────────────────────────────────────────────────────────
// The page serialises Prisma rows (and Dates → ISO strings) into these, and
// the API routes return the same shapes, so server-rendered and fetched rows
// are interchangeable here.

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "REPLIED"
  | "QUALIFIED"
  | "CONVERTED"
  | "LOST";

export type EmailStatus = "DRAFT" | "SENT" | "FAILED";

export type OutreachDTO = {
  id: string;
  subject: string;
  body: string;
  status: EmailStatus;
  provider: string | null;
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type LeadSource = "MANUAL" | "AI_SUGGESTED" | "IMPORTED" | "INBOUND";

export type LeadDTO = {
  id: string;
  company: string;
  contactName: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
  source: LeadSource;
  status: LeadStatus;
  score: number | null;
  scoreReason: string | null;
  notes: string | null;
  verified: boolean;
  lastEmailedAt: string | null;
  createdAt: string;
  updatedAt: string;
  emails: OutreachDTO[];
};

const STATUSES: readonly LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: "bg-sky-50 text-sky-700 ring-sky-600/20",
  CONTACTED: "bg-amber-50 text-amber-800 ring-amber-600/20",
  REPLIED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  QUALIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CONVERTED: "bg-brand-50 text-brand-800 ring-brand-600/20",
  LOST: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

const SOURCE_STYLES: Record<LeadSource, string> = {
  MANUAL: "bg-slate-100 text-slate-700 ring-slate-500/20",
  AI_SUGGESTED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  IMPORTED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  INBOUND: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  MANUAL: "Added by hand",
  AI_SUGGESTED: "AI-sourced",
  IMPORTED: "Imported",
  INBOUND: "Inbound",
};

const EMAIL_STYLES: Record<EmailStatus, string> = {
  DRAFT: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SENT: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
};

type Banner = { kind: "ok" | "error"; text: string };

type ApiOk<T> = {
  data?: T;
  error?: string;
  simulated?: boolean;
  unverified?: boolean;
  engine?: string;
  skipped?: number;
};

async function api<T>(
  path: string,
  method = "POST",
  body?: unknown,
): Promise<ApiOk<T>> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as ApiOk<T> | null;
  if (!res.ok)
    throw new Error(json?.error || `Request failed (${res.status}).`);
  return json ?? {};
}

const inputClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
const labelClass = "block text-sm";
const labelTextClass = "mb-1 block text-xs font-medium text-ink-700";
const primaryBtnClass =
  "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtnClass =
  "rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The interactive sales-agent workbench.
 *
 * State is the pipeline itself: every action (source, add, score, draft,
 * send, move, delete) calls its route and merges the returned row, so the UI
 * never re-derives what the server already decided. A batch agent run simply
 * re-fetches the list — wholesale refresh is the only sane option after the
 * server touched an unknown number of rows in two passes.
 */
export function GrowthAgent({
  initialLeads,
  canSource,
  aiReady,
  tierName,
  senderName,
  businessName,
}: {
  initialLeads: LeadDTO[];
  /** False on FREE: sourcing and batch runs render an upgrade prompt. */
  canSource: boolean;
  /** False when no model key is configured server-side. */
  aiReady: boolean;
  tierName: string;
  senderName: string;
  businessName: string;
}) {
  const [leads, setLeads] = useState<LeadDTO[]>(initialLeads);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [count, setCount] = useState(5);
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
  });

  const stats = useMemo(
    () => ({
      total: leads.length,
      fresh: leads.filter((l) => l.status === "NEW").length,
      contacted: leads.filter((l) => l.status === "CONTACTED").length,
      qualified: leads.filter(
        (l) => l.status === "QUALIFIED" || l.status === "CONVERTED",
      ).length,
    }),
    [leads],
  );

  function say(kind: Banner["kind"], text: string) {
    setBanner({ kind, text });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fail(error: unknown) {
    say(
      "error",
      error instanceof Error ? error.message : "Something went wrong.",
    );
  }

  /**
   * Merge a server-returned row. PATCH endpoints return the row without
   * emails by design (it never changed them), so existing history must be
   * preserved unless the payload explicitly carries it.
   */
  function mergeLead(next: Partial<LeadDTO> & { id: string }) {
    setLeads((current) =>
      current.map((l) =>
        l.id === next.id ? { ...l, ...next, emails: next.emails ?? l.emails } : l,
      ),
    );
  }

  async function runAction(key: string, work: () => Promise<void>) {
    setBusy(key);
    try {
      setBanner(null);
      await work();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  const onSuggest = () =>
    runAction("suggest", async () => {
      const res = await api<LeadDTO[]>("/api/agent/leads/suggest", "POST", {
        niche,
        location: location || undefined,
        count,
      });
      const created = res.data ?? [];
      setLeads((current) => [...created, ...current]);
      const skipped = res.skipped ?? 0;
      say(
        "ok",
        `Sourced ${created.length} lead${created.length === 1 ? "" : "s"}${
          skipped ? ` (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped)` : ""
        }. They are guesses until verified — confirm details before sending.`,
      );
      setNiche("");
    });

  const onAdd = () =>
    runAction("add", async () => {
      const res = await api<LeadDTO>("/api/agent/leads", "POST", form);
      if (res.data) setLeads((current) => [res.data as LeadDTO, ...current]);
      setForm({ company: "", contactName: "", email: "", phone: "", city: "" });
      setShowAdd(false);
      say("ok", "Lead added.");
    });

  const onScore = (lead: LeadDTO) =>
    runAction(`score:${lead.id}`, async () => {
      const res = await api<LeadDTO>(`/api/agent/leads/${lead.id}/score`, "POST");
      if (res.data) mergeLead(res.data);
    });

  const onDraft = (lead: LeadDTO) =>
    runAction(`draft:${lead.id}`, async () => {
      const res = await api<OutreachDTO>(`/api/agent/leads/${lead.id}/draft`, "POST");
      const email = res.data;
      if (email) {
        setLeads((current) =>
          current.map((l) =>
            l.id === lead.id ? { ...l, emails: [email, ...l.emails] } : l,
          ),
        );
        setExpanded(lead.id);
      }
      say(
        "ok",
        `Draft ready${res.engine ? (res.engine === "ai" ? " (AI-written)" : " (template)") : ""} — review it below before sending.`,
      );
    });

  const onSend = (lead: LeadDTO, emailId: string) =>
    runAction(`send:${emailId}`, async () => {
      const res = await api<{ email: OutreachDTO; lead: LeadDTO }>(
        `/api/agent/leads/${lead.id}/send`,
        "POST",
        { emailId },
      );
      const payload = res.data;
      if (payload) {
        setLeads((current) =>
          current.map((l) => {
            if (l.id !== lead.id) return l;
            return {
              ...l,
              status: payload.lead.status,
              lastEmailedAt: payload.lead.lastEmailedAt,
              emails: l.emails.map((e) =>
                e.id === payload.email.id ? payload.email : e,
              ),
            };
          }),
        );
      }
      if (res.simulated) {
        say(
          "ok",
          "Email simulated — no SMTP is configured, so nothing left the server. Set SMTP_HOST, SMTP_USER and SMTP_PASS to deliver for real.",
        );
      } else {
        say(
          "ok",
          res.unverified
            ? "Email sent. That address is still unverified — double-check it landed."
            : "Email sent.",
        );
      }
    });

  const onStatus = (lead: LeadDTO, status: LeadStatus) =>
    runAction(`status:${lead.id}`, async () => {
      const res = await api<LeadDTO>(`/api/agent/leads/${lead.id}`, "PATCH", {
        status,
      });
      if (res.data) mergeLead(res.data);
    });

  const onVerify = (lead: LeadDTO, verified: boolean) =>
    runAction(`verify:${lead.id}`, async () => {
      const res = await api<LeadDTO>(`/api/agent/leads/${lead.id}`, "PATCH", {
        verified,
      });
      if (res.data) mergeLead(res.data);
    });

  const onDelete = (lead: LeadDTO) =>
    runAction(`delete:${lead.id}`, async () => {
      await api(`/api/agent/leads/${lead.id}`, "DELETE");
      setLeads((current) => current.filter((l) => l.id !== lead.id));
      if (expanded === lead.id) setExpanded(null);
    });

  const onRun = () =>
    runAction("run", async () => {
      const res = await api<{
        scored: number;
        drafted: number;
        scoreEngine: string | null;
        draftEngine: string | null;
      }>("/api/agent/run", "POST");
      const done = res.data;
      // The run touched an unknown number of rows in two passes; re-listing
      // is the only refresh that cannot show a stale pipeline.
      const list = await api<LeadDTO[]>("/api/agent/leads", "GET");
      if (list.data) setLeads(list.data);
      say(
        "ok",
        `Agent run finished: scored ${done?.scored ?? 0}, drafted ${done?.drafted ?? 0}.`,
      );
    });

  return (
    <div className="space-y-6">
      {banner && (
        <div
          role={banner.kind === "error" ? "alert" : "status"}
          className={clsx(
            "flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          <p>{banner.text}</p>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
            className="font-medium hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Leads in pipeline" value={String(stats.total)} />
        <Stat label="New" value={String(stats.fresh)} />
        <Stat label="Contacted" value={String(stats.contacted)} />
        <Stat
          label="Qualified"
          value={String(stats.qualified)}
          tone="brand"
          hint="Qualified or converted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {canSource ? (
          <Card
            title="Source leads"
            hint="The agent suggests prospects for a niche. Suggestions are guesses until verified — confirm details before sending."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSuggest();
              }}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span className={labelTextClass}>Niche</span>
                  <input
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g. pharmacies in Nairobi"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Location</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Kenya"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex items-end justify-between gap-3">
                <label className="text-sm text-ink-600">
                  <span className={labelTextClass}>Count (1–10)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 5)}
                    className="w-20 rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy === "suggest" || !niche.trim()}
                  className={primaryBtnClass}
                >
                  {busy === "suggest" ? "Sourcing…" : "Source leads"}
                </button>
              </div>
              {!aiReady && (
                <p className="text-xs text-amber-700">
                  No AI provider key is configured on the server — sourcing
                  will fail until OPENAI_API_KEY or GEMINI_API_KEY is set.
                </p>
              )}
            </form>
          </Card>
        ) : (
          <Card
            title="Source leads"
            hint="AI prospect sourcing is a paid feature."
          >
            <p className="text-sm text-ink-600">
              You are on the {tierName} plan. Sourcing and batch agent runs
              are included in Growth and Enterprise plans — scoring, drafting
              and sending below keep working on every plan.
            </p>
            <Link
              href="/plans"
              className={clsx(primaryBtnClass, "mt-3 inline-block")}
            >
              View plans
            </Link>
          </Card>
        )}

        <Card
          title="Add a lead"
          hint="Manual entries are treated as verified — you typed them yourself."
          action={
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className={ghostBtnClass}
            >
              {showAdd ? "Hide" : "Add lead"}
            </button>
          }
        >
          {showAdd ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAdd();
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className={clsx(labelClass, "sm:col-span-2")}>
                <span className={labelTextClass}>Company *</span>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Acme Traders Ltd"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Contact name</span>
                <input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  placeholder="Jane Wanjiku"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@acme.co.ke"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+254…"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>City</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Nairobi"
                  className={inputClass}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy === "add" || !form.company.trim()}
                  className={primaryBtnClass}
                >
                  {busy === "add" ? "Adding…" : "Save lead"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-ink-500">
              {senderName
                ? `Signed as ${senderName}${businessName ? ` · ${businessName}` : ""}.`
                : "Signed with your account details."}{" "}
              Outreach drafts sign with your name and business automatically.
            </p>
          )}
        </Card>
      </div>

      <Card
        title="Pipeline"
        hint={
          canSource
            ? "Run agent scores the unscored and drafts for the best fits. Sending stays a per-lead decision."
            : "Select a row to review its drafts and history."
        }
        action={
          canSource ? (
            <button
              type="button"
              onClick={onRun}
              disabled={busy === "run"}
              className={ghostBtnClass}
            >
              {busy === "run" ? "Running…" : "Run agent"}
            </button>
          ) : undefined
        }
      >
        {leads.length === 0 ? (
          <Empty message="No leads yet — source some above or add one by hand." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Score</Th>
                <Th>Status</Th>
                <Th>Contact</Th>
                <Th>Last emailed</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {leads.map((lead) => (
                <Fragment key={lead.id}>
                  <tr className="hover:bg-ink-50/60">
                    <Td>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(expanded === lead.id ? null : lead.id)
                        }
                        className="text-left font-medium text-ink-900 hover:text-brand-700"
                      >
                        {lead.company}{" "}
                        <span aria-hidden>
                          {expanded === lead.id ? "▾" : "▸"}
                        </span>
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge className={SOURCE_STYLES[lead.source]}>
                          {SOURCE_LABEL[lead.source]}
                        </Badge>
                        {!lead.verified && (
                          <Badge
                            className="bg-amber-50 text-amber-800 ring-amber-600/20"
                            title="AI-sourced contact details — confirm before sending."
                          >
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {lead.score === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span
                          title={lead.scoreReason ?? undefined}
                          className="font-semibold tabular-nums text-ink-900"
                        >
                          {lead.score}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          onStatus(lead, e.target.value as LeadStatus)
                        }
                        disabled={busy === `status:${lead.id}`}
                        aria-label={`Pipeline status for ${lead.company}`}
                        className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {humanise(s)}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {lead.contactName || lead.email ? (
                        <div>
                          {lead.contactName && (
                            <span className="block">{lead.contactName}</span>
                          )}
                          {lead.email && (
                            <span className="block text-xs text-ink-500">
                              {lead.email}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {lead.lastEmailedAt
                        ? new Date(lead.lastEmailedAt).toLocaleDateString("en-KE")
                        : "Never"}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onScore(lead)}
                          disabled={busy === `score:${lead.id}`}
                          className={ghostBtnClass}
                        >
                          {busy === `score:${lead.id}` ? "…" : "Score"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDraft(lead)}
                          disabled={busy === `draft:${lead.id}`}
                          className={ghostBtnClass}
                        >
                          {busy === `draft:${lead.id}` ? "…" : "Draft"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(lead)}
                          disabled={busy === `delete:${lead.id}`}
                          aria-label={`Delete ${lead.company}`}
                          title="Delete lead"
                          className={ghostBtnClass}
                        >
                          ✕
                        </button>
                      </div>
                    </Td>
                  </tr>
                  {expanded === lead.id && (
                    <tr className="bg-ink-50/40">
                      <td colSpan={6}>
                        <LeadDetail
                          lead={lead}
                          busy={busy}
                          onDraft={onDraft}
                          onSend={onSend}
                          onVerify={onVerify}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/**
 * The expanded row: contact facts with the verification toggle, and the
 * outreach history with preview-then-send.
 *
 * A separate component by design — it receives handlers as props instead of
 * closing over lead-list state, so sending from here cannot drift from the
 * same code path the row buttons use.
 */
function LeadDetail({
  lead,
  busy,
  onDraft,
  onSend,
  onVerify,
}: {
  lead: LeadDTO;
  busy: string | null;
  onDraft: (lead: LeadDTO) => void;
  onSend: (lead: LeadDTO, emailId: string) => void;
  onVerify: (lead: LeadDTO, verified: boolean) => void;
}) {
  return (
    <div className="grid gap-4 px-3 py-4 lg:grid-cols-2">
      <div className="space-y-2 text-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Contact
        </h4>
        <p className="font-medium text-ink-900">
          {lead.contactName ?? "No contact name"}
          {lead.role ? ` · ${lead.role}` : ""}
        </p>
        <p className="text-ink-600">
          {lead.email ?? "No email"}
          {lead.phone ? ` · ${lead.phone}` : ""}
        </p>
        <p className="text-ink-500">
          {[lead.city, lead.country].filter(Boolean).join(", ")}
        </p>
        <label className="flex items-center gap-2 text-ink-700">
          <input
            type="checkbox"
            checked={lead.verified}
            onChange={(e) => onVerify(lead, e.target.checked)}
            disabled={busy === `verify:${lead.id}`}
            className="h-4 w-4 rounded border-ink-300 accent-brand-600"
          />
          Contact details confirmed
        </label>
        {lead.scoreReason && (
          <p className="text-xs text-ink-500">Score: {lead.scoreReason}</p>
        )}
        {lead.notes && (
          <p className="rounded-lg bg-white p-2 text-xs leading-relaxed text-ink-600 ring-1 ring-ink-200">
            {lead.notes}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Outreach
          </h4>
          <button
            type="button"
            onClick={() => onDraft(lead)}
            disabled={busy === `draft:${lead.id}`}
            className={ghostBtnClass}
          >
            {busy === `draft:${lead.id}` ? "Drafting…" : "+ New draft"}
          </button>
        </div>
        {lead.emails.length === 0 && (
          <p className="text-sm text-ink-500">
            No drafts yet — Draft writes one from the contact facts on the left.
          </p>
        )}
        {lead.emails.map((email) => (
          <div
            key={email.id}
            className="rounded-lg border border-ink-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink-900">
                {email.subject}
              </p>
              <Badge className={EMAIL_STYLES[email.status]}>
                {humanise(email.status)}
              </Badge>
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-600">
              {email.body}
            </pre>
            {email.error && (
              <p className="mt-2 text-xs text-red-600">{email.error}</p>
            )}
            {email.status === "SENT" ? (
              <p className="mt-2 text-xs text-emerald-700">
                Sent{" "}
                {email.sentAt
                  ? new Date(email.sentAt).toLocaleString("en-KE")
                  : "earlier"}{" "}
                via {email.provider === "smtp" ? "SMTP" : "simulation"}
              </p>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-500">
                  {!lead.email
                    ? "Add an email address to send."
                    : email.status === "FAILED"
                      ? "Last attempt failed — retry when ready."
                      : "Review the copy, then send."}
                </span>
                <button
                  type="button"
                  onClick={() => onSend(lead, email.id)}
                  disabled={busy === `send:${email.id}` || !lead.email}
                  title={
                    !lead.email ? "Add an email address first" : undefined
                  }
                  className={ghostBtnClass}
                >
                  {busy === `send:${email.id}` ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



