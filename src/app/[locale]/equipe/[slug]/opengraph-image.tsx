// Image de partage des fiches équipe : le portrait recadré, le nom et la fonction.
// Seul le dirigeant principal a une fiche statique ; pour tout autre slug on rend une carte
// de marque sans photo (aucune requête base ici : l'image doit se générer avec les stubs de build).
//
// Runtime Node : le portrait est lu sur le disque (module scope, une seule fois). Satori ne
// décode pas l'AVIF : on lit le JPEG du même portrait.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FOUNDER } from "@/lib/brand";
import { WILLIAMS_FONCTION } from "@/content/equipe/williams";

export const alt = `${FOUNDER.fullName}, ${WILLIAMS_FONCTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// hex-ok: l'image est rendue hors Tailwind ; valeurs miroir de globals.css.
const TERRACOTTA = "#c24a1b"; // hex-ok: OG image, no Tailwind runtime
const IVOIRE = "#faf8f3"; // hex-ok: OG image, no Tailwind runtime
const MOCHA = "#2a2520"; // hex-ok: OG image, no Tailwind runtime

const portrait = await readFile(
  join(process.cwd(), "public", "illustrations", "home-founder-william.jpg"),
  "base64",
);
const portraitSrc = `data:image/jpeg;base64,${portrait}`;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function EquipeOpengraphImage({ params }: Props) {
  const { slug } = await params;
  const estWilliams = slug === FOUNDER.slug;
  const nom = estWilliams ? FOUNDER.fullName : "Axion-IA";
  const fonction = estWilliams ? WILLIAMS_FONCTION : "L'équipe d'Axion-IA";

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
      {estWilliams ? (
        <img
          alt={`Portrait de ${FOUNDER.fullName}`}
          src={portraitSrc}
          width={420}
          height={420}
          style={{ borderRadius: 32, objectFit: "cover" }}
        />
      ) : null}
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
