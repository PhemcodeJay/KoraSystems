import { Card } from "@/components/ui";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";

export default async function CardsPage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's cards
  const cards = await prisma.card.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">My Cards</h2>
          <p className="mt-1 text-sm text-ink-500">Manage your debit and virtual cards</p>
        </div>
        <a
          href="/neobank/cards/create"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create Card
        </a>
      </div>

      {cards.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-ink-500">No cards yet. Create your first card.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card: any) => (
            <Card key={card.id} title={card.cardName}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Type</span>
                  <span className="text-sm font-medium text-ink-900 capitalize">{card.cardType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Card Number</span>
                  <span className="text-sm font-medium text-ink-900">• • • • {card.lastFourDigits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Expires</span>
                  <span className="text-sm font-medium text-ink-900">
                    {card.expiryMonth.toString().padStart(2, "0")}/{card.expiryYear.toString().slice(-2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Status</span>
                  <span className={`text-xs font-medium ${card.isActive ? "text-green-600" : "text-gray-600"}`}>
                    {card.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}