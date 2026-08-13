// Dynamic OG image generator — 1200×675, served at /api/og?title=...
// Used by Twitter / LinkedIn / Facebook / Slack previews et indexée par
// Google Images.
//
// Refonte 2026-08-13 (maquette validée Will, fidélité maximale) : carte
// éditoriale ivoire aux coins arrondis posée sur un fin fond clair, barre
// terracotta pleine hauteur épousant l'arrondi gauche, badge-logo pilule
// « Axion-IA .com », titre serif encre bleutée, trait terracotta,
// sous-titre Manrope, pied de page globe/épingle en glyphes divs (pas
// d'emoji : Satori les résoudrait via un CDN externe, interdit en prod
// self-hosted) avec séparateur vertical fin. Décor droit : lavis pêche
// diffus sur presque toute la moitié droite + nappe de fines lignes qui
// ondulent en diagonale (flancs d'ellipses géantes tournées — jamais de
// cercle fermé visible) + trame de points discrète — uniquement des divs
// absolus (gradients + border-radius + rotate), Satori ne supportant ni
// SVG externe ni grid.
//
// Le param `accent` est toujours accepté (URLs OG déjà émises/cachées) mais
// n'a plus d'effet : depuis le brand-fix 2026-06-20 la marque n'émet qu'une
// seule signature visuelle, et aucun call-site ne passait `ogAccent`.

import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

// hex-ok: dynamic OG image runs in Edge runtime where Tailwind tokens are
// not available. Hex values mirror globals.css palette + la maquette OG
// validée par Will (encre bleutée) deliberately (doctrine v3 Editorial
// Premium Light, ADR 0002).
const TERRACOTTA = "#c24a1b"; // hex-ok: --color-terracotta v3
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3
const PAPER = "#ffffff"; // hex-ok: --color-paper v3
const FRAME = "#f2f0ea"; // hex-ok: fond clair autour de la carte (maquette)
const INK = "#272c3d"; // hex-ok: encre bleutée très sombre de la maquette
const MUTED = "rgba(39, 44, 61, 0.68)"; // encre bleutée adoucie (sous-titre)
const HAIRLINE = "rgba(39, 44, 61, 0.16)"; // filets pied de page

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

/** Nappe de fines lignes ondulantes (maquette) : flancs gauches d'ellipses
 *  géantes tournées, échelonnées du haut-droit vers le bas — les ellipses
 *  débordent très largement du canvas, on ne voit jamais de cercle fermé,
 *  seulement des courbes parallèles qui coulent en diagonale. */
function flowLines() {
  const lines = [];
  // Une seule famille de courbes en « C » ouvertes vers la droite : le
  // flanc gauche de chaque ellipse entre par le bord haut (~x 810-1040),
  // bombe à gauche vers (~x 780, y 470), puis s'évase vers le coin
  // bas-droit — le flux diagonal de la maquette. Copies translatées d'un
  // pas constant : lignes parallèles, jamais de croisement ni de cercle
  // fermé visible (l'ellipse déborde largement du canvas en haut).
  for (let i = 0; i < 28; i++) {
    const w = 800;
    const h = 1150;
    const cx = 1210 + i * 10;
    const cy = 70;
    lines.push(
      <div
        key={`a${i}`}
        style={{
          position: "absolute",
          left: cx - w / 2,
          top: cy - h / 2,
          width: w,
          height: h,
          borderRadius: 9999,
          border: "1.4px solid rgba(194, 74, 27, 0.14)", // hex-ok: rgb de --color-terracotta
          transform: "rotate(22deg)",
        }}
      />,
    );
  }
  return lines;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Cabinet IA opérationnel").slice(0, 140);
  const eyebrow =
    searchParams.get("eyebrow") ?? "Formations IA, audits et automatisations pour entreprises";

  return new ImageResponse(
    // Fond clair autour de la carte arrondie (maquette : coins visibles).
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: FRAME,
        padding: 9,
        fontFamily: "Manrope",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          position: "relative",
          background: IVOIRE,
          borderRadius: 26,
          border: "1px solid rgba(39, 44, 61, 0.08)", // hex-ok: liseré carte
          overflow: "hidden",
        }}
      >
        {/* Lavis pêche diffus sur la moitié droite — aucun contour net */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            backgroundImage:
              "radial-gradient(ellipse 900px 720px at 88% 22%, rgba(238, 168, 118, 0.34) 0%, rgba(238, 168, 118, 0.16) 48%, rgba(238, 168, 118, 0.00) 74%)", // hex-ok: lavis pêche maquette
          }}
        />

        {/* Second lavis, coin bas-droit — la nappe repose dessus */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            backgroundImage:
              "radial-gradient(ellipse 720px 520px at 97% 92%, rgba(238, 168, 118, 0.20) 0%, rgba(238, 168, 118, 0.00) 68%)", // hex-ok: lavis pêche maquette
          }}
        />

        {/* Nappe de lignes ondulantes */}
        {flowLines()}

        {/* Trame de points discrète, intégrée dans la vague bas-droit */}
        <div
          style={{
            position: "absolute",
            left: 1000,
            top: 330,
            width: 175,
            height: 270,
            backgroundImage:
              "radial-gradient(circle at 9px 9px, rgba(194, 74, 27, 0.22) 9%, transparent 10%)", // hex-ok: rgb de --color-terracotta
            backgroundSize: "18px 18px",
          }}
        />

        {/* Barre terracotta pleine hauteur, épouse l'arrondi gauche */}
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
            padding: "40px 64px 36px 78px",
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
              border: `3px solid ${TERRACOTTA}`,
              borderRadius: 48,
              padding: "12px 40px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Fraunces",
                fontWeight: 700,
                fontSize: 42,
                letterSpacing: "-0.02em",
                color: INK,
                lineHeight: 1.1,
              }}
            >
              <span>Axion</span>
              <span style={{ color: TERRACOTTA, fontStyle: "italic" }}>-IA</span>
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
              paddingTop: 14,
              paddingBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: titleFontSize(title),
                fontFamily: "Fraunces",
                fontWeight: 700,
                color: INK,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
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
                marginTop: 26,
                marginBottom: 20,
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

          {/* Pied de page : filet fin + domaine | séparateur | localisation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: `1.5px solid ${HAIRLINE}`,
              paddingTop: 20,
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
                  border: `2px solid ${INK}`,
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
                    background: INK,
                  }}
                />
                <div
                  style={{
                    width: 11,
                    height: 20,
                    borderRadius: 9999,
                    border: `2px solid ${INK}`,
                  }}
                />
              </div>
              <span style={{ fontSize: 25, color: INK }}>axion-ia.com</span>
              {/* Séparateur vertical fin (maquette) */}
              <div
                style={{
                  width: 1.5,
                  height: 34,
                  background: HAIRLINE,
                  marginLeft: 56,
                }}
              />
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
                  border: `2.5px solid ${INK}`,
                  borderTopLeftRadius: 9999,
                  borderTopRightRadius: 9999,
                  borderBottomLeftRadius: 9999,
                  borderBottomRightRadius: 0,
                  transform: "rotate(45deg)",
                  marginRight: 14,
                  marginBottom: 4,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: 9999, background: INK }} />
              </div>
              <span style={{ fontSize: 25, color: INK }}>Cabinet IA · France</span>
            </div>
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
