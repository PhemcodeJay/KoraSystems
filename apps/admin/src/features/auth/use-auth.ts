"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

/**
 * Custom hook for authentication state.
 * Provides user session, loading state, and error information.
 *
 * The session itself is resolved server-side by `GET /api/auth/me`
 * (`getSessionUser` in @kora/auth): it reads the signed `kora_session`
 * cookie, verifies it, and reloads the user from the database. This hook
 * is a client component, so it cannot import `next/headers` or Prisma
 * directly — it fetches the session endpoint instead.
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const response = await fetch(api.auth.me.path, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });

        // 401 means no session (signed out, expired or cleared cookie) —
        // not an error, just an unauthenticated user.
        if (response.status === 401) {
          if (mounted) {
            setUser(null);
            setError(null);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Session check failed (${response.status})`);
        }

        const payload = await response.json();
        if (mounted) {
          setUser(payload?.user ?? null);
          setError(null);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Authentication error");
        setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchSession();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, isLoading, error };
}