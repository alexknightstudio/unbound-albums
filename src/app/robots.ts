import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // App chrome and APIs have no business in an index. Individual private
      // and unlisted galleries additionally carry noindex meta.
      disallow: ["/galleries", "/api/", "/design/", "/print/", "/i/"],
    },
    sitemap: "https://unboundalbums.com/sitemap.xml",
  };
}
