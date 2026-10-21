import { notFound } from "next/navigation";
import Link from "next/link";
import { getTransactionWithEntries, fmtKES, fmtDateTime } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * One posting and its ledger legs.
 *
 * The balance banner is computed from the entries below rather than trusting
 * a stored flag, so an unbalanced posting is visible here even if nothing
 * else checks it.
 */
export default async function TransactionDetail({
  params,
}: {
  params: { reference: string };
}) {
  const txn = await getTransactionWithEntries(params.reference);
  if (!txn) notFound();

  const dr = txn.entries
    .filter((e) => e.direction === "DEBIT")
    .reduce((s, e) => s + Number(e.amount), 0);
  const cr = txn.entries
    .filter((e) => e.direction === "CREDIT")
    .reduce((s, e) => s + Number(e.amount), 0);
  const balanced = Math.abs(dr - cr) < 0.01;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/transactions"
          className="text-sm text-brand-700 hover:underline"
        >
          ← Back to transactions
        </Link>
        <h1 className="mt-2 break-all font-mono text-lg font-semibold text-ink-900">
          {txn.reference}
        </h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {humanise(txn.type)} · {txn.accountCode} · {fmtDateTime(txn.postedAt)}
          {txn.smeOwner ? " · " + txn.smeOwner.businessName : ""}
        </p>
      </div>

      <div
        className={
          "rounded-xl border p-4 text-sm " +
          (balanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900")
        }
      >
        <p className="font-medium">
          {balanced ? "Balanced" : "Unbalanced"} — debits {fmtKES(dr)} vs credits{" "}
          {fmtKES(cr)}
        </p>
        {txn.simulated && (
          <p className="mt-1">
            This posting is flagged simulated. No real money moved.
          </p>
        )}
      </div>

      <Card title="Double-entry breakdown">
        {txn.entries.length === 0 ? (
          <Empty message="This posting has no ledger legs." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Account</Th>
                <Th>Direction</Th>
                <Th className="text-right">Amount</Th>
                <Th>Narration</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txn.entries.map((e) => (
                <tr key={e.id}>
                  <Td className="font-mono text-xs">{e.accountCode}</Td>
                  <Td>
                    <Badge
                      className={
                        e.direction === "DEBIT"
                          ? "bg-ink-900 text-white ring-ink-900/20"
                          : "bg-ink-100 text-ink-700 ring-ink-300/40"
                      }
                    >
                      {e.direction}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(e.amount)}
                  </Td>
                  <Td className="text-sm text-ink-600">{e.narration ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ink-200 bg-ink-50 font-medium">
              <tr>
                <Td>Total</Td>
                <Td className="text-xs text-ink-500">Dr / Cr</Td>
                <Td className="text-right tabular-nums">
                  {fmtKES(dr)} / {fmtKES(cr)}
                </Td>
                <Td>
                  <span className="sr-only">No narration</span>
                </Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {txn.description && (
        <Card title="Description">
          <p className="text-sm text-ink-700">{txn.description}</p>
        </Card>
      )}
    </div>
  );
}
