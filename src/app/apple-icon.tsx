// Apple Touch icon — `app/apple-icon.tsx` Next 16 file convention. 180×180
// PNG généré dynamiquement, doctrine v3 Editorial Premium Light (ADR 0002).
// Apparait sur l'écran d'accueil iOS/iPadOS quand un visiteur ajoute le
// site en raccourci.

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

// hex-ok: ImageResponse runs in Edge runtime where Tailwind tokens are not
// available. Hex values mirror globals.css palette deliberately
// (doctrine v3 Editorial Premium Light, ADR 0002).
const TERRACOTTA = "#c24a1b"; // hex-ok: --color-terracotta v3
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3 (paper variant)
const TERRACOTTA_DEEP = "#8c3010"; // hex-ok: --color-terracotta-deep v3

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DEEP} 100%)`,
        color: IVOIRE,
        fontSize: 120,
        fontWeight: 600,
        fontStyle: "italic",
        fontFamily: "serif",
        letterSpacing: "-0.02em",
        borderRadius: 36,
      }}
    >
      A
    </div>,
    {
      ...size,
    },
  );
}
