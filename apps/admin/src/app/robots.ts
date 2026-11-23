import { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://korasystems.onrender.com";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/demo"],
      disallow: [
        "/login",
        "/register",
        "/account",
        "/home",
        "/admin",
        "/api/",
        "/_next/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
