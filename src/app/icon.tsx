// Dynamic icon — `app/icon.tsx` Next 16 file convention. Replaces a static
// favicon.ico with a code-generated icon respecting the Axion-IA editorial
// doctrine v3 (ADR 0002) : terracotta surface, ivoire badge, Fraunces serif
// italic « A ».

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

// hex-ok: ImageResponse runs in Edge runtime where Tailwind tokens are not
// available. Hex values mirror globals.css palette deliberately
// (doctrine v3 Editorial Premium Light, ADR 0002).
const TERRACOTTA = "#c24a1b"; // hex-ok: --color-terracotta v3
const IVOIRE = "#faf8f3"; // hex-ok: --color-bg v3 (paper variant)

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: TERRACOTTA,
        color: IVOIRE,
        fontSize: 22,
        fontWeight: 600,
        fontStyle: "italic",
        fontFamily: "serif",
        letterSpacing: "-0.02em",
      }}
    >
      A
    </div>,
    {
      ...size,
    },
  );
}
