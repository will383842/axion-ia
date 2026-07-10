/**
 * Qualiopi — Numérotation séquentielle unique des documents officiels.
 *
 * Format : `AXI-<TYPE>-YYYY-NNN` (NNN = compteur ≥ 3 chiffres, zero-padded),
 * suffixe `-R0N` pour les occurrences de sessions récurrentes (ex.
 * `AXI-SESS-2026-001-R01`). Séquence non modifiable, conservée 5 ans.
 *
 * Ce module ne porte que les **formats purs** (constantes + formatter + regex
 * de validation), testables sans DB. L'allocation atomique du prochain NNN
 * (table compteur transactionnelle) est livrée avec les modèles cœur (T2/T3),
 * pas en T0 — pour ne jamais avoir deux documents au même numéro.
 */

/** Préfixes de type de document (segment `<TYPE>`). */
export const NUMBERING_PREFIX = {
  formation: "AXI-FORM",
  session: "AXI-SESS",
  attestation: "AXI-ATT",
  certificat: "AXI-CERT",
  facture: "AXI-FACT",
  reclamation: "AXI-REC",
  client: "AXI-CLI",
  devis: "AXI-DEV",
  offre: "AXI-OFF",
  audit: "AXI-AUD",
} as const;

export type NumberingType = keyof typeof NUMBERING_PREFIX;

/** Largeur minimale du compteur (zero-pad). */
export const SEQ_PAD_WIDTH = 3 as const;

/**
 * Construit un numéro de document officiel.
 *
 * @param type        type de document (clé de NUMBERING_PREFIX).
 * @param year        année (4 chiffres).
 * @param seq         compteur séquentiel >= 1.
 * @param recurrence  optionnel : n° d'occurrence d'une session récurrente >= 1
 *                    → suffixe `-R0N`.
 * @throws si année/seq/recurrence invalides.
 */
export function formatDocumentNumber(
  type: NumberingType,
  year: number,
  seq: number,
  recurrence?: number,
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`formatDocumentNumber: année invalide (${year})`);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`formatDocumentNumber: séquence invalide (${seq})`);
  }
  const base = `${NUMBERING_PREFIX[type]}-${year}-${String(seq).padStart(SEQ_PAD_WIDTH, "0")}`;
  if (recurrence === undefined) return base;
  if (!Number.isInteger(recurrence) || recurrence < 1) {
    throw new Error(`formatDocumentNumber: récurrence invalide (${recurrence})`);
  }
  return `${base}-R${String(recurrence).padStart(2, "0")}`;
}

/** Regex de validation d'un numéro de document officiel (tous types). */
export const DOCUMENT_NUMBER_REGEX =
  /^AXI-(FORM|SESS|ATT|CERT|FACT|REC|CLI|DEV|OFF)-\d{4}-\d{3,}(?:-R\d{2,})?$/;

/** `true` si la chaîne est un numéro de document officiel bien formé. */
export function isValidDocumentNumber(value: string): boolean {
  return DOCUMENT_NUMBER_REGEX.test(value);
}
