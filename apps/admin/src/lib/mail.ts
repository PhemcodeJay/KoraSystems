import nodemailer from "nodemailer";

/**
 * Outbound email transport for the growth (sales-agent) feature.
 *
 * ── Two providers, chosen like every other external integration here ───────
 * A real one when configured (`SMTP_*`), an honest simulation otherwise —
 * the same shape as `DISBURSEMENT_PROVIDER=simulated` and the simulated
 * M-Pesa transactions. With no SMTP credentials a "send" logs what would
 * have gone out and returns `simulated: true`, so a demo never delivers
 * real mail (and the UI says so), while going live is only a matter of
 * setting `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM`.
 */

export type SendResult = {
  /** True when nothing left the machine; `messageId` is then a placeholder. */
  simulated: boolean;
  provider: "smtp" | "simulated";
  messageId: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic shape check — the MTA is the authority, this only rejects typos. */
export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Kora Growth <no-reply@korasystems.com>"
  );
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/**
 * Should this send go through a real server?
 *
 * `EMAIL_PROVIDER` overrides the heuristic in both directions: `simulated`
 * keeps a configured machine from delivering accidentally (reviews, demos),
 * `smtp` fails loudly if someone claims a transport they have not set up.
 */
function useSmtp(): boolean {
  const forced = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (forced === "simulated") return false;
  if (forced === "smtp") return true;
  return smtpConfigured();
}

/**
 * Send one plain-text email.
 *
 * Throws on a real transport failure — callers record the failure on the
 * `OutreachEmail` row rather than losing it, so a bounced send is visible in
 * the pipeline instead of silent.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  const to = input.to.trim();
  if (!isEmail(to)) throw new Error(`"${to}" is not a valid email address.`);

  if (!useSmtp()) {
    if (process.env.EMAIL_PROVIDER?.toLowerCase() === "smtp" && !smtpConfigured()) {
      throw new Error(
        "EMAIL_PROVIDER=smtp but SMTP_HOST, SMTP_USER and SMTP_PASS are not all set.",
      );
    }
    // Mirror the simulated M-Pesa logging: proof of what would have been sent,
    // with a placeholder id that can never be mistaken for a provider receipt.
    const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      "[mail:simulated]",
      JSON.stringify({ to, subject: input.subject, from: fromAddress(), messageId }),
    );
    return { simulated: true, provider: "simulated", messageId };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const info = await transport.sendMail({
    from: fromAddress(),
    to,
    subject: input.subject,
    text: input.text,
  });
  return {
    simulated: false,
    provider: "smtp",
    messageId: info.messageId || "",
  };
}
