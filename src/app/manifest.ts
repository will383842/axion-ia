import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";

// Web App Manifest — `app/manifest.ts` Next 16 file convention.
// Permet à un visiteur d'ajouter axion-ia.com comme raccourci sur son
// écran d'accueil mobile / desktop (PWA install). Doctrine v3 Editorial
// Premium Light : couleurs terracotta + ivoire chaud (ADR 0002).
//
// Note : default locale FR. Pour la version EN, le navigateur utilisera
// `lang="en"` du HTML root mais le manifest reste FR canonical (start_url
// pointe sur la home racine, le routing locale prend le relais).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.taglineFr.charAt(0).toUpperCase()}${BRAND.taglineFr.slice(1)}`,
    short_name: BRAND.name,
    description:
      "Cabinet IA opérationnel B2B — interventions, audits et implémentation IA pour entreprises.",
    start_url: ROUTES.home,
    scope: ROUTES.home,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#faf8f3", // hex-ok: W3C Web App Manifest spec requires hex literals (no CSS vars at PWA install time)
    theme_color: "#c24a1b", // hex-ok: idem — color matches --color-terracotta
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity", "education"],
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    shortcuts: [
      {
        name: "Réserver une intervention",
        short_name: "Réserver",
        description: `Calendrier de réservation ${BRAND.name}`,
        url: `/fr${ROUTES.reserve}`,
      },
      {
        name: "Demander un audit",
        short_name: "Audit",
        description: `Demande d'audit IA ${BRAND.name}`,
        url: `/fr${ROUTES.audit}`,
      },
      {
        name: "Stack IA",
        short_name: "Stack",
        description: `Catalogue des outils IA ${BRAND.name}`,
        url: `/fr${ROUTES.stackIa}`,
      },
    ],
    id: SITE_URL,
  };
}
