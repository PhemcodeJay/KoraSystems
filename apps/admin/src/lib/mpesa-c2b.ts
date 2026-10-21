import { prisma } from "@kora/database";

export async function findC2bSme(shortcode: string): Promise<string | null> {
  const matches = await prisma.sME.findMany({
    where: {
      onboardingStatus: "APPROVED",
      OR: [{ mpesaTill: shortcode }, { mpesaPaybill: shortcode }],
    },
    select: { id: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].id : null;
}
