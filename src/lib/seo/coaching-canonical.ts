// V2-08 (GEO) — une seule page de référence pour le coaching individuel : `/fr/un-a-un`.
//
// Les pages qui décrivent aussi le coaching (`/interventions/individuel`,
// `/interventions/dirigeants`, `/interventions/dirigeant-vision-strategique`) restent en
// ligne (aucune URL supprimée, aucune 301 avant 4 semaines de Search Console) mais
// déclarent la page de référence comme canonique. Fonction pure, sans effet de bord.

import type { Metadata } from "next";

import {
  COACHING_REFERENCE_PATH_EN,
  COACHING_REFERENCE_PATH_FR,
} from "@/content/coaching-reference";
import { SITE_URL } from "@/lib/seo";

/**
 * Renvoie `meta` avec la page de référence pour canonique. Les `hreflang` sont retirés :
 * une page dont la canonique est une autre page ne déclare pas d'alternates de langue.
 * Le robots reste `index,follow` (Google choisit la canonique ; pas de noindex).
 */
export function metadataCanoniqueVersCoaching(meta: Metadata, locale: string): Metadata {
  const chemin = locale === "fr" ? COACHING_REFERENCE_PATH_FR : COACHING_REFERENCE_PATH_EN;
  const canonique = `/${locale}${chemin}`;
  return {
    ...meta,
    alternates: { canonical: canonique },
    openGraph: meta.openGraph ? { ...meta.openGraph, url: `${SITE_URL}${canonique}` } : undefined,
  };
}
