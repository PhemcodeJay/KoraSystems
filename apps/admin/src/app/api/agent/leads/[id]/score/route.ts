import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { scoreLead } from "@kora/ai";
import { loadLead } from "@/lib/growth";

/**
 * Score one lead and persist the verdict.
 *
 * The engine is recorded in `scoreReason` (`[ai] …` / `[heuristic] …`) so a
 * number on screen can always be traced to how it was produced. `scoreLead`
 * itself never fails — with no provider it returns the heuristic — so this
 * route has no 5xx path of its own.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const loaded = await loadLead(params.id, scope);
  if (loaded.error) return loaded.error;
  const lead = loaded.lead!;

  const result = await scoreLead(lead);

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: result.score,
      scoreReason: `[${result.engine}] ${result.reason}`,
    },
  });

  return NextResponse.json({ data: updated, engine: result.engine });
}
