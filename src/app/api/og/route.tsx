// Dynamic OG image generator — 1200×675, served at /api/og?title=...
// Used by Twitter / LinkedIn / Facebook / Slack previews et indexée par
// Google Images.
//
// Refonte 2026-08-12 (demande Will) : l'ancienne carte (fond blanc, police
// système, pavé « A ») était off-brand à côté de la carte d'accueil
// `opengraph-image.tsx`. Celle-ci reprend exactement son langage — fond
// terracotta dégradé, badge papier « Axion-IA », titre ivoire — avec en plus
// les VRAIES polices du site (Fraunces / Manrope, chargées depuis
// `public/fonts/`, Satori ne connaissant pas les fontes CSS).
//
// Le param `accent` est toujours accepté (URLs OG déjà émises/cachées) mais
// n'a plus d'effet : depuis le brand-fix 2026-06-20 la marque n'émet qu'une
// seule signature visuelle, et aucun call-site ne passait `ogAccent`.

import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

// hex-ok: dynamic OG image runs in Edge runtime where Tailwind tokens are
// not available. Hex values mirror globals.css palette deliberately
// (doctrine v3 Editorial Premium Light, ADR 0002).
const TERRACOTTA = "#c24a1b"; // hex-ok: --color-terracotta v3
const TERRACOTTA_DEEP = "#8c3010"; // hex-ok: --color-terracotta-deep v3
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3
const PAPER = "#ffffff"; // hex-ok: --color-paper v3
const FG = "#1a1815"; // hex-ok: --color-fg v3

// Chargées une fois par isolate edge (promesses au module scope, attendues
// dans GET). `import.meta.url` fait embarquer les .ttf dans le bundle edge.
const frauncesRegular = fetch(
  new URL("../../../../public/fonts/Fraunces-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const frauncesItalic = fetch(
  new URL("../../../../public/fonts/Fraunces-Italic.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const manropeRegular = fetch(
  new URL("../../../../public/fonts/Manrope-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

/** Taille de titre adaptée à la longueur — un titre court se lit en affiche,
 *  un titre long doit tenir en 3 lignes sans déborder de la carte. */
function titleFontSize(title: string): number {
  if (title.length <= 35) return 80;
  if (title.length <= 70) return 64;
  if (title.length <= 110) return 54;
  return 46;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Cabinet IA opérationnel").slice(0, 140);
  const eyebrow = searchParams.get("eyebrow") ?? "Interventions · Audits · Formations IA";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DEEP} 100%)`,
        padding: "64px 72px",
      }}
    >
      {/* Badge papier — même signature que la carte d'accueil */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: PAPER,
          color: FG,
          padding: "10px 22px",
          borderRadius: 16,
          fontSize: 32,
          fontFamily: "Fraunces",
          letterSpacing: "-0.02em",
          alignSelf: "flex-start",
        }}
      >
        <span>Axion</span>
        <span style={{ margin: "0 4px", opacity: 0.6 }}>-</span>
        <span style={{ color: TERRACOTTA, fontStyle: "italic" }}>IA</span>
      </div>

      {/* Titre éditorial de la page */}
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize(title),
            fontFamily: "Fraunces",
            color: IVOIRE,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            maxWidth: 1020,
          }}
        >
          {title}
        </div>
      </div>

      {/* Pied : contexte + domaine */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: IVOIRE,
          fontSize: 24,
          fontFamily: "Manrope",
          opacity: 0.9,
        }}
      >
        <span>{eyebrow}</span>
        <span>axion-ia.com</span>
      </div>
    </div>,
    // 1200×675 = plancher Google Discover (cohérent avec opengraph-image.tsx).
    {
      width: 1200,
      height: 675,
      fonts: [
        { name: "Fraunces", data: await frauncesRegular, style: "normal", weight: 400 },
        { name: "Fraunces", data: await frauncesItalic, style: "italic", weight: 400 },
        { name: "Manrope", data: await manropeRegular, style: "normal", weight: 400 },
      ],
    },
  );
}
