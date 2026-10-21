import type { MetadataRoute } from "next";
import { BRAND, APPS } from "@kora/brand";

/**
 * Web app manifest. Lets the app be installed to a home screen and fixes the
 * name, theme and background colour to the Kora brand rather than browser
 * defaults.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APPS.admin.name,
    short_name: BRAND.shortName,
    description: APPS.admin.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: COLOR_THEME,
    orientation: "any",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

/** Mirrors COLOR.primary.600 in @kora/brand. */
const COLOR_THEME = "#059669";
