"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateCardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("virtual");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/banking/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });

      if (res.ok) {
        router.push("/neobank/cards");
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to create card");
      }
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Create Card</h2>
        <p className="mt-1 text-sm text-ink-500">
          Order a new debit or virtual card
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">Cardholder Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
            placeholder="e.g. Jane Doe"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Card Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
          >
            <option value="virtual">Virtual Card</option>
            <option value="physical">Physical Card</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !name}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Card"}
        </button>
      </form>
    </div>
  );
}