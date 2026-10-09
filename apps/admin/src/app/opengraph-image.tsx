import { BRAND, APPS, COLOR } from "@kora/brand";

export const alt = APPS.admin.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card. Rendered with the brand palette at request time, so a colour
 * change in @kora/brand propagates here without editing an image file.
 *
 * NOTE: on Windows, next/og's ImageResponse can fail with ERR_INVALID_URL
 * when resolving the Noto Sans font path. If that happens, fall back to a
 * static SVG that carries the same brand information.
 */
export default function OpengraphImage() {
  // Static SVG fallback — always works, no font resolution needed.
  // Replace with next/og ImageResponse when the font issue is resolved
  // (Next.js 15+, or a fixed @vercel/og on Windows).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${encodeURIComponent(COLOR.primary[600])}"/>
      <stop offset="100%" stop-color="${encodeURIComponent(COLOR.primary[900])}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(72,72)" fill="#fff" font-family="sans-serif">
    <g transform="translate(0,0)">
      <rect width="88" height="88" rx="20" fill="rgba(255,255,255,0.14)"/>
      <text x="44" y="62" text-anchor="middle" font-size="52" font-weight="700">K</text>
      <text x="108" y="48" font-size="40" font-weight="700">${BRAND.name}</text>
      <text x="108" y="78" font-size="22" fill="rgba(255,255,255,0.75)">${BRAND.legalName}</text>
    </g>
    <g transform="translate(0,180)">
      <text y="0" font-size="62" font-weight="700">${APPS.admin.name}</text>
      <text y="48" font-size="28" fill="rgba(255,255,255,0.85)">${APPS.admin.description}</text>
    </g>
    <text y="600" font-size="22" fill="rgba(255,255,255,0.7)">${BRAND.tagline}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
