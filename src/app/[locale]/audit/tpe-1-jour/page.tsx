import { permanentRedirect } from "next/navigation";

// R5a (audit d'harmonie 08/11/2026, A03 / décision n°7 de Williams) — « Audit sur place ·
// 1 journée » (1 190 €) est retiré : il concurrençait l'offre phare. L'URL reste en ligne,
// mais renvoie définitivement (308) vers La Journée IA, qui reprend le même besoin
// (une journée dans l'entreprise) avec la formation en plus.
//
// Redirection posée dans la page et non dans `next.config.ts` (hors du lot R5a). Elle vaut pour
// toutes les locales : la version anglaise est de toute façon renvoyée vers le français.
// L'URL est aussi exclue du sitemap (`EXCLUDED_FROM_INDEX`) : on n'annonce pas une redirection.
//
// ⚠️ Le palier `audit-flash` de `pricing.ts` et son sous-palier restent déclarés : la
// réservation, le barème des apporteurs et ~400 pages ville les lisent encore. Ils ne sont
// plus affichés avec un montant (`prixPublicMasque`).

export default function AuditTpeUnJourPage(): never {
  permanentRedirect("/fr/journee-ia");
}
