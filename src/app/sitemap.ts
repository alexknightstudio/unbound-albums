import { createAdminClient } from "@/lib/supabase/admin";

import type { MetadataRoute } from "next";

const BASE = "https://unboundalbums.com";

/** Public galleries and profiles only — private and unlisted never appear. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();

  const { data: galleries } = await admin
    .from("galleries")
    .select("slug, owner_id, indexed_at, created_at")
    .eq("visibility", "public")
    .returns<
      Array<{
        slug: string;
        owner_id: string;
        indexed_at: string | null;
        created_at: string;
      }>
    >();
  const publicRows = galleries ?? [];

  const ownerIds = [...new Set(publicRows.map((g) => g.owner_id))];
  const { data: accounts } = ownerIds.length
    ? await admin
        .from("accounts")
        .select("handle")
        .in("user_id", ownerIds)
        .not("handle", "is", null)
        .returns<Array<{ handle: string }>>()
    : { data: [] };

  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    ...(accounts ?? []).map((a) => ({
      url: `${BASE}/@${a.handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...publicRows.map((g) => ({
      url: `${BASE}/g/${g.slug}`,
      lastModified: new Date(g.indexed_at ?? g.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
