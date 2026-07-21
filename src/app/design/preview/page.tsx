/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";

import { r2Configured, signedGetUrl } from "@/lib/galleries/r2";
import { createClient } from "@/lib/supabase/server";

/**
 * DESIGN PREVIEW — tokens v1 proposal (not linked from the app).
 *
 * One fully-styled example screen (the dashboard) in the proposed light
 * photo-SaaS system, for Alex's sign-off before the tokens roll out anywhere.
 * Everything here uses the token values inline; on approval these move to
 * globals.css as CSS custom properties + Tailwind theme, and this page dies.
 * Signed-in only (it shows real gallery thumbnails).
 */

// ——— Tokens v1 (the proposal) ———
const T = {
  // Neutral ramp (cool gray, Untitled-UI-adjacent)
  n0: "#FFFFFF",
  n50: "#F8F9FB", // app background
  n100: "#F1F3F6", // wells, hover fills
  n200: "#E4E7EC", // borders
  n300: "#D0D5DD", // strong borders
  n400: "#98A2B3", // placeholders, icons-muted
  n500: "#667085", // secondary text
  n700: "#344054", // body text
  n900: "#101828", // headings
  // The ONE accent
  accent: "#2563EB", // primary CTAs, links, active states
  accentHover: "#1D4ED8",
  accentSoft: "#EFF6FF", // tints, selected fills
  accentBorder: "#BFDBFE",
  // Functional (sparing)
  success: "#039855",
  successSoft: "#ECFDF3",
  danger: "#D92D20",
  // Shadows
  shadowXs: "0 1px 2px rgba(16,24,40,0.05)",
  shadowSm: "0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)",
  shadowMd: "0 4px 8px -2px rgba(16,24,40,0.10), 0 2px 4px -2px rgba(16,24,40,0.06)",
};

const card: React.CSSProperties = {
  background: T.n0,
  border: `1px solid ${T.n200}`,
  borderRadius: 12,
  boxShadow: T.shadowXs,
};

export default async function DesignPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Real covers from the live Tulum gallery make the preview honest.
  let covers: string[] = [];
  if (r2Configured()) {
    const { data: photos } = await supabase
      .from("gallery_photos")
      .select("thumb_key")
      .eq("gallery_id", "ed392ae8-78c3-4ee8-bc88-f120bb7e0e1b")
      .not("thumb_key", "is", null)
      .order("position")
      .limit(2)
      .returns<Array<{ thumb_key: string }>>();
    covers = await Promise.all(
      (photos ?? []).map((p) => signedGetUrl(p.thumb_key)),
    );
  }

  return (
    <div
      style={{ background: T.n50, minHeight: "100svh", color: T.n700, fontSize: 15, lineHeight: 1.6 }}
    >
      {/* Top nav */}
      <nav style={{ background: T.n0, borderBottom: `1px solid ${T.n200}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <img src="/unbound-wordmark-ink.png" alt="Unbound" style={{ height: 13, width: "auto", display: "block" }} />
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ padding: "6px 12px", borderRadius: 8, background: T.accentSoft, color: T.accent, fontWeight: 500, fontSize: 14 }}>Galleries</span>
              <span style={{ padding: "6px 12px", borderRadius: 8, color: T.n500, fontWeight: 500, fontSize: 14 }}>Books</span>
              <span style={{ padding: "6px 12px", borderRadius: 8, color: T.n500, fontWeight: 500, fontSize: 14 }}>Settings</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, color: T.n500, background: T.n100, padding: "4px 10px", borderRadius: 999 }}>
              2.1 GB <span style={{ color: T.n400 }}>/ 500 GB</span>
            </span>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: T.accentSoft, color: T.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>
              AK
            </span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 96px" }}>
        {/* Page header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 30, lineHeight: "38px", fontWeight: 600, color: T.n900, letterSpacing: "-0.01em", margin: 0 }}>
              Galleries
            </h1>
            <p style={{ margin: "4px 0 0", color: T.n500, fontSize: 14 }}>
              4 galleries · 2.1 GB used · unlimited traffic
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.n300}`, background: T.n0, color: T.n700, fontWeight: 500, fontSize: 14, boxShadow: T.shadowXs, cursor: "pointer" }}>
              Import
            </button>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontWeight: 500, fontSize: 14, boxShadow: T.shadowXs, cursor: "pointer" }}>
              New gallery
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 32 }}>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.n500 }}>Storage</p>
            <p style={{ margin: "6px 0 10px", fontSize: 24, fontWeight: 600, color: T.n900 }}>
              2.1 GB <span style={{ fontSize: 14, fontWeight: 400, color: T.n400 }}>of 500 GB</span>
            </p>
            <div style={{ height: 6, borderRadius: 999, background: T.n100 }}>
              <div style={{ width: "4%", minWidth: 12, height: 6, borderRadius: 999, background: T.accent }} />
            </div>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.n500 }}>Views this month</p>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 600, color: T.n900 }}>1,284</p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              <span style={{ color: T.success, background: T.successSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 500 }}>+12%</span>
            </p>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.n500 }}>Downloads</p>
            <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 600, color: T.n900 }}>96</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.n400 }}>Free, forever — traffic costs you nothing</p>
          </div>
        </div>

        {/* Gallery cards */}
        <h2 style={{ margin: "40px 0 16px", fontSize: 18, lineHeight: "28px", fontWeight: 600, color: T.n900 }}>
          Recent
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {[
            { title: "Sofia & Marc — Tulum", meta: "6 photos · Oct 17, 2026", badge: "Private · Password", badgeStyle: { background: T.n100, color: T.n500 }, cover: covers[0] },
            { title: "Portfolio — Editorial", meta: "48 photos · updated today", badge: "Public", badgeStyle: { background: T.accentSoft, color: T.accent }, cover: covers[1] },
            { title: "Priya & Dev — Hudson Valley", meta: "412 photos · Jun 2, 2026", badge: "Unlisted", badgeStyle: { background: T.n100, color: T.n500 }, cover: null },
          ].map((g) => (
            <div key={g.title} style={{ ...card, overflow: "hidden", boxShadow: T.shadowSm }}>
              {g.cover ? (
                <img src={g.cover} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "4 / 3", background: `linear-gradient(135deg, ${T.n100}, ${T.n200})` }} />
              )}
              <div style={{ padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.n900 }}>{g.title}</p>
                <p style={{ margin: "2px 0 10px", fontSize: 13, color: T.n500 }}>{g.meta}</p>
                <span style={{ ...g.badgeStyle, fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 999 }}>
                  {g.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Component sampler */}
        <h2 style={{ margin: "48px 0 16px", fontSize: 18, lineHeight: "28px", fontWeight: 600, color: T.n900 }}>
          Component sampler
        </h2>
        <div style={{ ...card, padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Primary</button>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.n300}`, background: T.n0, color: T.n700, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Secondary</button>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "transparent", color: T.n500, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Ghost</button>
            <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.n200}`, background: T.n0, color: T.danger, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Delete</button>
            <a href="#" style={{ color: T.accent, fontWeight: 500, fontSize: 14, textDecoration: "none" }}>Text link →</a>
          </div>
          <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="sample" style={{ fontSize: 14, fontWeight: 500, color: T.n700 }}>
              Gallery title
            </label>
            <input
              id="sample"
              type="text"
              placeholder="Sofia & Marc — Tulum"
              style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.n300}`, background: T.n0, fontSize: 15, color: T.n900, boxShadow: T.shadowXs, outline: "none", fontFamily: "inherit" }}
            />
            <p style={{ margin: 0, fontSize: 13, color: T.n500 }}>Shown to anyone you share the link with.</p>
          </div>
        </div>

        <p style={{ marginTop: 48, fontSize: 13, color: T.n400 }}>
          Design preview — tokens v1 · Inter · not linked from the app · the gallery viewer itself stays photo-forward and neutral.
        </p>
      </main>
    </div>
  );
}
