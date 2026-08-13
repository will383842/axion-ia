// Dynamic OG image generator — 1200×675, served at /api/og?title=...
// Used by Twitter / LinkedIn / Facebook / Slack previews et indexée par
// Google Images.
//
// Refonte 2026-08-13 (maquette validée Will) : carte éditoriale IVOIRE —
// fond --color-bg, barre terracotta pleine hauteur à gauche, badge-logo
// pilule « Axion-IA .com », titre serif encre, trait terracotta, sous-titre
// Manrope, pied de page avec glyphes globe/épingle dessinés en divs (pas
// d'emoji : Satori les résoudrait via un CDN externe, interdit en prod
// self-hosted). Décor droit abstrait : cercle pêche pâle + éventail d'arcs
// terracotta translucides + trame de points — uniquement des divs absolus
// (gradients + border-radius), Satori ne supportant ni SVG externe ni grid.
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
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3
const PAPER = "#ffffff"; // hex-ok: --color-paper v3
const FG = "#1a1815"; // hex-ok: --color-fg v3
const MUTED = "rgba(26, 24, 21, 0.62)"; // encre adoucie (sous-titre)
const HAIRLINE = "rgba(26, 24, 21, 0.14)"; // séparateur pied de page

// Chargées une fois par isolate edge (promesses au module scope, attendues
// dans GET). `import.meta.url` fait embarquer les .ttf dans le bundle edge.
const frauncesBold = fetch(
  new URL("../../../../public/fonts/Fraunces-Bold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const frauncesItalic = fetch(
  new URL("../../../../public/fonts/Fraunces-Italic.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const manropeRegular = fetch(
  new URL("../../../../public/fonts/Manrope-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const manropeBold = fetch(
  new URL("../../../../public/fonts/Manrope-Bold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

/** Taille de titre adaptée à la longueur — un titre court se lit en affiche,
 *  un titre long doit tenir en 3 lignes sans déborder de la carte. */
function titleFontSize(title: string): number {
  if (title.length <= 35) return 80;
  if (title.length <= 70) return 64;
  if (title.length <= 110) return 54;
  return 46;
}

/** Éventail d'arcs terracotta translucides : cercles concentriques centrés
 *  hors-canvas (bas-droite), seules les portions hautes traversent la carte
 *  en fines courbes parallèles — l'équivalent Satori du « fan » de la
 *  maquette, sans SVG. */
function decorArcs() {
  const cx = 1660; // centre X (hors canvas, à droite)
  const cy = 1140; // centre Y (hors canvas, en bas)
  const arcs = [];
  for (let i = 0; i < 14; i++) {
    const r = 560 + i * 30;
    arcs.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: 9999,
          border: "1.5px solid rgba(194, 74, 27, 0.20)", // hex-ok: rgb de --color-terracotta
        }}
      />,
    );
  }
  return arcs;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Cabinet IA opérationnel").slice(0, 140);
  const eyebrow =
    searchParams.get("eyebrow") ?? "Formations IA, audits et automatisations pour entreprises";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: IVOIRE,
        fontFamily: "Manrope",
        overflow: "hidden",
      }}
    >
      {/* Décor droit — grand cercle pêche très pâle */}
      <div
        style={{
          position: "absolute",
          right: -180,
          top: -200,
          width: 680,
          height: 680,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at 50% 50%, rgba(194, 74, 27, 0.10) 0%, rgba(194, 74, 27, 0.04) 70%, rgba(194, 74, 27, 0.02) 100%)", // hex-ok: rgb de --color-terracotta
        }}
      />

      {/* Décor droit — éventail d'arcs terracotta */}
      {decorArcs()}

      {/* Décor droit — trame de points */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 290,
          width: 230,
          height: 320,
          backgroundImage:
            "radial-gradient(circle at 11px 11px, rgba(194, 74, 27, 0.35) 10%, transparent 11%)", // hex-ok: rgb de --color-terracotta
          backgroundSize: "22px 22px",
        }}
      />

      {/* Barre terracotta pleine hauteur, bord gauche */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 14,
          height: "100%",
          background: TERRACOTTA,
        }}
      />

      {/* Colonne de contenu */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "48px 72px 44px 86px",
        }}
      >
        {/* Badge-logo pilule — reprend le logo du site */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            alignSelf: "flex-start",
            background: PAPER,
            border: `4px solid ${TERRACOTTA}`,
            borderRadius: 48,
            padding: "12px 34px 10px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: "-0.02em",
              color: FG,
              lineHeight: 1.1,
            }}
          >
            <span>Axion-</span>
            <span style={{ color: TERRACOTTA, fontStyle: "italic" }}>IA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
            <div style={{ width: 26, height: 2.5, background: TERRACOTTA }} />
            <span
              style={{
                fontFamily: "Manrope",
                fontWeight: 700,
                fontSize: 19,
                color: TERRACOTTA,
                margin: "0 8px",
              }}
            >
              .com
            </span>
            <div style={{ width: 26, height: 2.5, background: TERRACOTTA }} />
          </div>
        </div>

        {/* Bloc titre + trait + sous-titre, centré verticalement */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: titleFontSize(title),
              fontFamily: "Fraunces",
              fontWeight: 700,
              color: FG,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              maxWidth: 850,
            }}
          >
            {title}
          </div>
          <div
            style={{
              width: 64,
              height: 5,
              borderRadius: 3,
              background: TERRACOTTA,
              marginTop: 28,
              marginBottom: 22,
            }}
          />
          <div
            style={{
              fontSize: 30,
              fontFamily: "Manrope",
              color: MUTED,
              lineHeight: 1.4,
              maxWidth: 640,
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Pied de page : séparateur fin + domaine / localisation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1.5px solid ${HAIRLINE}`,
            paddingTop: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Glyphe globe : cercle + méridien + équateur */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                width: 26,
                height: 26,
                borderRadius: 9999,
                border: `2px solid ${FG}`,
                marginRight: 14,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 10,
                  width: 22,
                  height: 2,
                  background: FG,
                }}
              />
              <div
                style={{
                  width: 11,
                  height: 20,
                  borderRadius: 9999,
                  border: `2px solid ${FG}`,
                }}
              />
            </div>
            <span style={{ fontSize: 25, color: FG }}>axion-ia.com</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Glyphe épingle : goutte tournée à 45° + point central */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 21,
                height: 21,
                border: `2.5px solid ${FG}`,
                borderTopLeftRadius: 9999,
                borderTopRightRadius: 9999,
                borderBottomLeftRadius: 9999,
                borderBottomRightRadius: 0,
                transform: "rotate(45deg)",
                marginRight: 14,
                marginBottom: 4,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 9999, background: FG }} />
            </div>
            <span style={{ fontSize: 25, color: FG }}>Cabinet IA · France</span>
          </div>
        </div>
      </div>
    </div>,
    // 1200×675 = plancher Google Discover (cohérent avec opengraph-image.tsx).
    {
      width: 1200,
      height: 675,
      fonts: [
        { name: "Fraunces", data: await frauncesBold, style: "normal", weight: 700 },
        { name: "Fraunces", data: await frauncesItalic, style: "italic", weight: 400 },
        { name: "Manrope", data: await manropeRegular, style: "normal", weight: 400 },
        { name: "Manrope", data: await manropeBold, style: "normal", weight: 700 },
      ],
    },
  );
}
