// Image de partage de la fiche de Williams Jullin : le portrait recadré, le nom et la fonction.
// Servie à /api/og/equipe-williams et référencée par `generateMetadata` du seul slug williams :
// les autres fiches (dont manon) gardent l'image de partage générique `/api/og`. Ce n'est donc
// volontairement PAS un fichier `opengraph-image` du segment [slug] (il s'appliquerait à tous).
// Aucune requête base ici : l'image doit se générer avec les stubs de build.
//
// Runtime Node : le portrait est lu sur le disque (module scope, une seule fois). Satori ne
// décode pas l'AVIF : on lit le JPEG du même portrait.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FOUNDER } from "@/lib/brand";
import { WILLIAMS_FONCTION } from "@/content/equipe/williams";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Les dimensions sont reprises telles quelles dans `generateMetadata` de la fiche (1200 × 630).
const size = { width: 1200, height: 630 } as const;

// hex-ok: l'image est rendue hors Tailwind ; valeurs miroir de globals.css.
const TERRACOTTA = "#c24a1b"; // hex-ok: OG image, no Tailwind runtime
const IVOIRE = "#faf8f3"; // hex-ok: OG image, no Tailwind runtime
const MOCHA = "#2a2520"; // hex-ok: OG image, no Tailwind runtime

const portrait = await readFile(
  join(process.cwd(), "public", "illustrations", "home-founder-william.jpg"),
  "base64",
);
const portraitSrc = `data:image/jpeg;base64,${portrait}`;

export async function GET() {
  const nom = FOUNDER.fullName;
  const fonction = WILLIAMS_FONCTION;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: IVOIRE,
        padding: 72,
        gap: 56,
      }}
    >
      <img
        alt={`Portrait de ${FOUNDER.fullName}`}
        src={portraitSrc}
        width={420}
        height={420}
        style={{ borderRadius: 32, objectFit: "cover" }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, color: MOCHA }}>
        <div style={{ display: "flex", fontSize: 28, color: TERRACOTTA, fontWeight: 600 }}>
          Axion-IA
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            lineHeight: 1.05,
            marginTop: 24,
            fontFamily: "serif",
          }}
        >
          {nom}
        </div>
        <div style={{ display: "flex", fontSize: 34, marginTop: 20, opacity: 0.85 }}>
          {fonction}
        </div>
        <div style={{ display: "flex", fontSize: 24, marginTop: "auto", opacity: 0.7 }}>
          axion-ia.com
        </div>
      </div>
    </div>,
    { ...size },
  );
}
