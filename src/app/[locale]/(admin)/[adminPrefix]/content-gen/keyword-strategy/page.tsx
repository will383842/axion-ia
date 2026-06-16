/**
 * Redirect 308 (permanent) — FUSION (DECISION-IA §5-E, 2026-06-16).
 *
 * `/keyword-strategy` (vue globale des mots-clés : distribution verticales +
 * intents) faisait doublon conceptuel avec `/keyword-tracking` (suivi des
 * positions). Les deux sont fusionnés dans le pôle RÉGLAGES sous une entrée
 * unique « Suivi des positions », la stratégie devenant un onglet de
 * `/keyword-tracking`. On redirige définitivement vers cette page.
 *
 * Aucune capacité perdue : les mots-clés vivent dans `/keyword-tracking`.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KeywordStrategyPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/keyword-tracking`);
}
