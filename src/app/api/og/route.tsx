// Dynamic OG image generator — 1200×630, served at /api/og?title=...
// Used by Twitter / LinkedIn / Facebook / Slack previews. Supports 4 module
// accents via the `accent` query param.

import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

// hex-ok: dynamic OG image runs in Edge runtime where Tailwind tokens are
// not available. Hex values mirror globals.css palette deliberately
// (doctrine v3 Editorial Premium Light, ADR 0002).
const ACCENTS: Record<string, string> = {
  // Brand-fix 2026-06-20 — accent par défaut = terracotta (signature de marque,
  // cf. globals.css --color-terracotta + manifest theme_color). Avant, le défaut
  // était `primary` (bleu) → Google Images indexait des cartes OG bleues
  // off-brand pour la majorité des pages (toutes celles qui passent par
  // buildProductMetadata sans `ogAccent`). Le token bleu `primary` est RETIRÉ
  // volontairement : la marque ne doit jamais émettre de carte OG bleue. Un
  // éventuel `accent=primary` résiduel retombe sur terracotta (fallback ci-dessous).
  terracotta: "#c24a1b", // hex-ok: --color-terracotta v3 (signature marque)
  purple: "#7c3aed", // hex-ok: accent-purple token
  orange: "#c24a1b", // hex-ok: alias terracotta (était #f97316 orange vif off-brand)
  green: "#16a34a", // hex-ok: accent-green token
};

const FG = "#0a0e1a"; // hex-ok: --color-fg token
const BG = "#ffffff"; // hex-ok: --color-bg token
const MUTED = "#475569"; // hex-ok: gray-600 token
const WHITE = "#ffffff"; // hex-ok: --color-bg token

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "Axion-IA — Cabinet IA opérationnel";
  const eyebrow = searchParams.get("eyebrow") ?? "Axion-IA";
  const accent = ACCENTS[searchParams.get("accent") ?? "terracotta"] ?? ACCENTS["terracotta"];

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        backgroundColor: BG,
        color: FG,
        display: "flex",
        flexDirection: "column",
        padding: "72px 80px",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            backgroundColor: accent,
            color: WHITE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            borderRadius: 6,
          }}
        >
          A
        </div>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {eyebrow}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          paddingTop: 24,
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: 0,
            maxWidth: 1040,
          }}
        >
          {title}
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: MUTED,
          fontSize: 22,
        }}
      >
        <span>axion-ia.com</span>
        <span>Cabinet IA · UE</span>
      </div>

      {/* Editorial v3 accent stripe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 12,
          backgroundColor: accent,
        }}
      />
    </div>,
    { width: 1200, height: 630 },
  );
}
