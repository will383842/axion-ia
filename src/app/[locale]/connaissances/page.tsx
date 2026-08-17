/**
 * Hub `/fr/connaissances` — KB V4 publique, page 1.
 *
 * P1-18 audit E2E NAV+CTA 2026-05-15 — expose les KnowledgeEntry triple-
 * filtrés public (status=published + audience=public + confidentiality=public).
 * Toute lecture passe par `fetchPublicKbList` — jamais `prisma.knowledgeEntry`
 * direct (anti-leak drafts).
 *
 * 2026-08-16 (GEO-088) — le rendu vit dans `_views/KbListingView`, partagé avec
 * `/connaissances/page/[num]`. Ce hub listait 48 fiches sur les **507**
 * déclarées au sitemap : 459 orphelines, mesurées à l'unité en production. Voir
 * l'en-tête de la vue.
 *
 * FR-only (doctrine v1.2 KB V1 — FR uniquement).
 * ISR Next 16 revalidate=3600.
 */

import type { Metadata } from "next";

import { KbListingView, buildKbListingMetadata } from "./_views/KbListingView";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildKbListingMetadata(locale, 1);
}

export default async function ConnaissancesHub({ params }: Props) {
  const { locale } = await params;
  return <KbListingView locale={locale} page={1} />;
}
