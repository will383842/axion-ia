// Form v2 (2026-05-28) — labels FR pour les 12 types unifiés + 5 enums DB.
//
// Déplacé le 2026-07-29 depuis `app/…/submissions/_v2/submission-type-labels.ts`
// vers la couche `features/` : la boîte de réception unifiée en a besoin, et la
// règle de frontières de modules interdit à `features/` d'importer depuis
// `app/` (imports descendants uniquement).
//
// Source de vérité partagée entre :
//   - SubmissionsV2.tsx (badge dans la liste)
//   - SubmissionDetailContent.tsx (titre + subject reply)
//   - SubmissionFilters.tsx (dropdown filtre par type)
//   - features/admin-inbox/queries.ts (objet de la ligne unifiée)
//
// Stratégie : `submission.type` (DB enum) ∈ 5 valeurs ; les 5 nouveaux types
// (presse, recrutement, speaker, investisseur, support_client) sont tous
// stockés comme SubmissionType.contact, distinction via `details.unifiedType`.
// → on préfère le label unifiedType si présent, sinon fallback sur le type DB.

/** Labels FR pour les 5 valeurs de l'enum DB SubmissionType. */
export const DB_TYPE_LABELS: Record<string, string> = {
  audit: "Audit",
  implementation: "Implémentation",
  intervention: "Intervention",
  contact: "Contact",
  quote_request: "Devis",
};

/** Labels FR pour les 12 valeurs de unifiedType (form discriminator). */
export const UNIFIED_TYPE_LABELS: Record<string, string> = {
  // Groupe 1 — Projet IA pour mon entreprise
  audit: "Audit IA",
  implementation: "Intégration sur-mesure",
  formation: "Formation IA",
  un_a_un: "Coaching 1 to 1",
  devis: "Devis sur projet",
  // Groupe 2 — Autres demandes
  partenariat: "Partenariat",
  presse: "Presse / média",
  recrutement: "Recrutement",
  speaker: "Invitation conférence",
  investisseur: "Investisseur / M&A",
  support_client: "Support client",
  autre: "Autre demande",
  // Simulateur de gains (2026-08-12). Sans cette entrée, les leads du tunnel
  // publicitaire s'affichaient « Contact » via le repli sur `dbType` — ils
  // étaient donc indiscernables d'un message de contact ordinaire, alors
  // qu'ils arrivent avec un gain estimé et un diagnostic complet.
  simulateur_roi: "Simulateur de gains",
};

/**
 * Résout le meilleur label disponible pour une submission.
 * Préfère unifiedType (fin) si présent, fallback sur dbType (5 valeurs).
 */
export function resolveSubmissionLabel(
  dbType: string,
  unifiedType: string | null | undefined,
): string {
  if (unifiedType && UNIFIED_TYPE_LABELS[unifiedType]) {
    return UNIFIED_TYPE_LABELS[unifiedType];
  }
  return DB_TYPE_LABELS[dbType] ?? dbType;
}
