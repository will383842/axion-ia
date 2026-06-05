// Default OpenGraph image — `app/opengraph-image.tsx` Next 16 file convention.
// 1200×630 PNG généré dynamiquement pour la homepage et fallback sur les
// pages sans `metadata.openGraph.images` explicite. Doctrine v3 Editorial
// Premium Light (ADR 0002) : terracotta surface, ivoire badge, Fraunces
// serif italique sur "IA".
//
// Pour des OG images par-page paramétrées (avec titre custom), utiliser
// `/api/og?title=...&accent=...` (cf. `src/app/api/og/route.tsx`).

// Audit GSC 2026-06-05 A-02 (P0-2 / D-4) — `/opengraph-image` renvoyait 502 en prod
// (Coolify standalone). 1re tentative (import `@vercel/og`) déployée 2026-06-05
// (SHA 0d97c528) : 502 PERSISTE → ce n'était pas l'import. Cause = le runtime "edge"
// pour une route image *file-convention* (metadata) n'est pas servi correctement par
// le serveur standalone `next start` (alors que `/api/og`, route handler edge, marche).
// Fallback D-4 appliqué : `runtime = "nodejs"` (ImageResponse pleinement supporté en
// node). On garde l'import `@vercel/og` (identique à `api/og`).
import { ImageResponse } from "@vercel/og";

// Audit GSC 5xx 2026-05-18 — fix `/opengraph-image` retournant 502 Bad Gateway.
//
// Cause racine : import `@/lib/brand` → import `@/env` (Zod schema validation
// au module load). En edge runtime + standalone Coolify, l'init Zod throw
// (server-only env vars non disponibles ou validation stricte). Le module
// crashe à l'import → Next renvoie 5xx → CF passe 502.
//
// Fix : inline le brand name au lieu d'importer BRAND. Le seul usage était
// l'alt text. SSOT préservée côté UI (Header, JSON-LD) qui restent en nodejs
// runtime. Précédent : `/api/og/route.tsx` édge runtime aussi mais sans BRAND
// import → fonctionne en prod (curl 200, image/png).
export const runtime = "nodejs"; // A-02 fallback D-4 — edge file-convention 502 en standalone Coolify

export const alt = "Axion-IA — Cabinet IA opérationnel B2B";

// P2-29 audit indexation 2026-05-18 — Google Discover hard floor = 1200×675 px
// (OG image < 1200×675 = pas éligible Discover surface Android/iOS Chrome).
// 1200×630 = standard OG Facebook/Twitter, mais 45px court Discover floor.
// 1200×675 = compatible Discover ET OG/Twitter (les viewports ignorent ratio).
export const size = {
  width: 1200,
  height: 675,
};

export const contentType = "image/png";

// hex-ok: ImageResponse runs in Edge runtime where Tailwind tokens are not
// available. Hex values mirror globals.css palette deliberately
// (doctrine v3 Editorial Premium Light, ADR 0002).
const TERRACOTTA = "#c24a1b"; // hex-ok: --color-terracotta v3
const TERRACOTTA_DEEP = "#8c3010"; // hex-ok: --color-terracotta-deep v3
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3
const PAPER = "#ffffff"; // hex-ok: --color-paper v3
const FG = "#1a1815"; // hex-ok: --color-fg v3

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DEEP} 100%)`,
        padding: 80,
      }}
    >
      {/* Logo badge ivoire — signature visuelle Axion-IA */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: PAPER,
          color: FG,
          padding: "12px 24px",
          borderRadius: 16,
          fontSize: 36,
          fontWeight: 500,
          fontStyle: "normal",
          fontFamily: "serif",
          letterSpacing: "-0.02em",
          alignSelf: "flex-start",
        }}
      >
        <span>Axion</span>
        <span style={{ margin: "0 4px", opacity: 0.6 }}>-</span>
        <span style={{ color: TERRACOTTA, fontStyle: "italic" }}>IA</span>
      </div>

      {/* Titre éditorial */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 80,
          color: IVOIRE,
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          Cabinet IA
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 500,
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginTop: 8,
          }}
        >
          opérationnel
        </div>
      </div>

      {/* Sous-titre + URL en bas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "auto",
          color: IVOIRE,
          fontSize: 24,
          fontFamily: "sans-serif",
          opacity: 0.85,
        }}
      >
        <span>Interventions · Audits · Implémentation IA</span>
        <span style={{ fontWeight: 600 }}>axion-ia.com</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
