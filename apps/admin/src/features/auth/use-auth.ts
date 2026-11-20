import { useEffect, useState } from "react";
import { cookies } from "next/headers";
import { prisma } from "@kora/database";

/**
 * Custom hook for authentication state.
 * Provides user session, loading state, and error information.
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const cookieStore = cookies();
        const token = cookieStore.get("kora_session")?.value;

        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Verify the session token
        const SESSION_COOKIE = "kora_session";

        // Import verifySessionToken from auth package
        const { verifySessionToken } = await import("@kora/auth/src/session");

        const payload = verifySessionToken(token);

        if (payload) {
          const userData = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          });

          setUser(userData ?? null);
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication error");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSession();
  }, []);

  return { user, isLoading, error };
}