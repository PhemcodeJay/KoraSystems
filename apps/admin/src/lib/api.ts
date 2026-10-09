/**
 * Response-shape helpers for the admin client pages.
 *
 * The API answers in two shapes: list routes return a bare array, while
 * `/api/loans` and `/api/savings` wrap theirs in `{ data }`. Reading `.data`
 * off everything silently produced empty tables across the whole console, so
 * the two shapes are unwrapped explicitly here instead.
 */

/** Fetch a route that answers with a bare array. Never throws. */
export async function fetchList<T = any>(path: string): Promise<T[]> {
  try {
    const response = await fetch(path);
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

/** Fetch a route that answers with `{ data: [...] }`. Never throws. */
export async function fetchWrappedList<T = any>(path: string): Promise<T[]> {
  try {
    const response = await fetch(path);
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    return [];
  }
}

/** Fetch a route that answers with `{ data: <object|null> }`. Never throws. */
export async function fetchOne<T = any>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}

/** The error message from a failed response, or a generic fallback. */
export async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string") return payload.error;
  } catch {
    // Body was not JSON.
  }
  return fallback;
}
