// Form v2 (2026-05-28) — labels FR pour les 12 types unifiés + 5 enums DB.
//
// Source de vérité partagée entre :
//   - SubmissionsV2.tsx (badge dans la liste)
//   - SubmissionDetailContent.tsx (titre + subject reply)
//   - SubmissionFilters.tsx (dropdown filtre par type)
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
