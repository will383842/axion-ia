// OG image dynamique par ville — Audit Will 2026-05-27.
// 1200×675 PNG généré au build (ou ISR runtime) pour chaque route ville.
// Affiche : "IA pour votre entreprise à [VILLE]" + département + seoHook si dispo.
// Améliore le CTR partage social (Twitter, LinkedIn, Facebook, WhatsApp) car
// chaque ville obtient sa propre carte au lieu d'une carte générique partagée.
//
// Important : edge runtime — pas d'import @/env, @/lib/brand ni autre module
// qui valide des env vars au module load (cf. audit 5xx 2026-05-18).
// On résout `resolveVilleWithCopy` qui est safe edge (lecture statique).

import { ImageResponse } from "next/og";
import { resolveVilleWithCopy } from "@/content/villes/resolve-with-copy";

export const runtime = "edge";
export const alt = "Axion-IA — IA pour votre entreprise";
export const size = { width: 1200, height: 675 };
export const contentType = "image/png";

// hex-ok: Edge runtime ne charge pas Tailwind ; valeurs miroir globals.css v3.
const TERRACOTTA = "#c24a1b"; // hex-ok
const TERRACOTTA_DEEP = "#8c3010"; // hex-ok
const IVOIRE = "#faf8f3"; // hex-ok
const PAPER = "#ffffff"; // hex-ok
const FG = "#1a1815"; // hex-ok

interface Params {
  params: Promise<{ locale: string; region: string; ville: string }>;
}

export default async function VilleOpengraphImage({ params }: Params) {
  const { locale, ville: villeSlug } = await params;
  const isFr = locale === "fr";
  const ville = await resolveVilleWithCopy(villeSlug);

  const villeName = ville?.nameFr ?? villeSlug;
  const dept = ville?.departementLabel ?? ville?.departement ?? "";
  const seoHook = ville?.copy?.seoHook?.trim();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DEEP} 100%)`,
          padding: 72,
        }}
      >
        {/* Logo badge ivoire */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: PAPER,
            color: FG,
            padding: "10px 22px",
            borderRadius: 14,
            fontSize: 32,
            fontWeight: 500,
            fontFamily: "serif",
            letterSpacing: "-0.02em",
            alignSelf: "flex-start",
          }}
        >
          <span>Axion</span>
          <span style={{ margin: "0 4px", opacity: 0.6 }}>-</span>
          <span style={{ color: TERRACOTTA, fontStyle: "italic" }}>IA</span>
        </div>

        {/* Titre dynamique ville */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 60,
            color: IVOIRE,
            fontFamily: "serif",
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              opacity: 0.95,
            }}
          >
            {isFr ? "Structurez et déployez l'IA" : "Structure and deploy AI"}
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              opacity: 0.95,
              marginTop: 4,
            }}
          >
            {isFr ? "dans votre entreprise à" : "in your business in"}
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 500,
              fontStyle: "italic",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginTop: 16,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {villeName}
            {dept && (
              <span
                style={{
                  fontSize: 36,
                  fontStyle: "normal",
                  opacity: 0.7,
                  marginLeft: 16,
                  fontWeight: 400,
                }}
              >
                ({dept})
              </span>
            )}
          </div>
        </div>

        {/* Services + URL en bas */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "auto",
            color: IVOIRE,
            fontSize: 22,
            fontFamily: "sans-serif",
            opacity: 0.9,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>
              {isFr
                ? "Audit · Formation · Implémentation · Coaching · Web/SaaS IA"
                : "Audit · Training · Implementation · Coaching · AI Web/SaaS"}
            </span>
            {seoHook && (
              <span style={{ fontSize: 18, opacity: 0.85, fontStyle: "italic" }}>{seoHook}</span>
            )}
          </span>
          <span style={{ fontWeight: 600 }}>axion-ia.com</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
