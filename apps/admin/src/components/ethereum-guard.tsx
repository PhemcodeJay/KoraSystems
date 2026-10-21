"use client";

import { useEffect } from "react";

/**
 * EthereumGuard
 *
 * Defensive guard against Chrome extensions (e.g. crypto wallets such as
 * MetaMask) that inject `window.ethereum` via `Object.defineProperty` and throw
 * `TypeError: Cannot redefine property: ethereum` when another script has
 * already defined it as non-configurable.
 *
 * We pre-define `ethereum` as configurable (if nothing has yet) so extensions
 * can safely redefine it. If it's already defined — by an extension or another
 * script — we leave it alone and never throw.
 */
export default function EthereumGuard(): JSX.Element | null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const desc = Object.getOwnPropertyDescriptor(window, "ethereum");
      // Only define if missing or defined non-configurably by someone else.
      if (!desc || desc.configurable === false) {
        Object.defineProperty(window, "ethereum", {
          configurable: true,
          enumerable: true,
          get: () => (window as unknown as { ethereum?: unknown }).ethereum,
          set: (v) => {
            (window as unknown as { ethereum?: unknown }).ethereum = v;
          },
        });
      }
    } catch {
      // Non-fatal: if we can't define it, an extension already owns it.
    }
  }, []);

  return null;
}
