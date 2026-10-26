import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Debounce a callback by `ms` milliseconds. Returns a memoised handler and a
 * `flush()` method to invoke immediately (e.g. on form submit).
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  ms: number
): { handler: T; flush: () => void; cancel: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fn = useRef(callback);
  fn.current = callback;

  const handler = useCallback(
    ((...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn.current(...args), ms);
    }) as T,
    [ms, fn, timer]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      fn.current();
    }
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { handler, flush, cancel };
}

/**
 * Simple in-memory client cache for GET requests. Avoids refetching the same
 * data on every navigation (e.g. balance, wallet list).
 */
const cache = new Map<string, { data: any; ts: number }>();
const TTL = 30_000; // 30 seconds

export async function cachedFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { ttl?: number }
): Promise<Response> {
  const ttl = init?.ttl ?? TTL;
  const key = String(input);

  if (init?.method?.toUpperCase() === "GET") {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < ttl) {
      return new Response(JSON.stringify(hit.data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const res = await fetch(input, init);

  if (init?.method?.toUpperCase() === "GET" && res.ok) {
    try {
      const data = await res.clone().json();
      cache.set(key, { data, ts: Date.now() });
    } catch {
      // ignore parse errors
    }
  }

  return res;
}

/**
 * Clear the client cache (call after a mutation invalidates data).
 */
export function clearCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}