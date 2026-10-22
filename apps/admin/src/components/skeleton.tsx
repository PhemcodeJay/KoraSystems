import { useState, useEffect, useCallback } from "react";

/**
 * Shimmering skeleton that renders instantly while content loads.
 * Gives perceived immediate response — the user sees structure before data.
 */
export function Skeleton({
  className = "h-4",
  width,
}: {
  className?: string;
  width?: string | number;
}) {
  return (
    <div
      className={[
        "animate-pulse rounded-md bg-ink-100",
        width ? `w-[${typeof width === "number" ? width + "px" : width}]` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/**
 * Skeleton line with a title-width block and a shorter detail line.
 */
export function SkeletonLine({ width = "60%" }: { width?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4" width={width} />
      <Skeleton className="h-3" width="40%" />
    </div>
  );
}

/**
 * A small inline "spinner" for buttons so the click feels instant.
 */
export function LoadingSpinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={["animate-spin text-ink-500", className].filter(Boolean).join(" ")}
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}