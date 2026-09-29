/**
 * Libellés LISIBLES des énumérations imprimées sur les pièces. Module PUR.
 *
 * ## Le défaut (audit des pièces réelles, 2026-09-30)
 *
 * 🔴 L'attestation de fin de formation de `AXI-SESS-2026-001` imprimait
 * « Modalité presentiel » : la valeur BRUTE de l'énumération Prisma, sans
 * accent. Le producteur (`attestation-service.ts`) passait `session.modalite`
 * tel quel, alors que les six producteurs de `producteurs.ts` passaient déjà
 * par `modaliteLabel()`. Même fuite sur la convocation (« Financement :
 * france_travail ») et dans trois e-mails (« — presentiel — »).
 *
 * ## La règle
 *
 * > **Une valeur d'énumération ne s'imprime jamais telle quelle.** Elle passe
 * > par un libellé, et le libellé est appliqué AU GABARIT — pas seulement chez
 * > l'appelant.
 *
 * Au gabarit, parce que c'est le seul point par lequel TOUS les chemins passent :
 * un producteur de plus, un rejeu d'instantané (`exemplaire-signe.ts`) ou une
 * régénération rejouent des données écrites avant le correctif. Les fonctions
 * sont IDEMPOTENTES : une valeur déjà libellée (« Présentiel ») ressort
 * inchangée, si bien qu'un appelant qui libelle déjà n'est pas cassé.
 *
 * ⚠️ Une valeur INCONNUE ressort telle quelle plutôt que vide : un libellé
 * manquant se voit à la relecture, un blanc passe pour « rien à dire ».
 */

const MODALITE: Readonly<Record<string, string>> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  // `hybride` en base, « Mixte » sur les pièces : c'est le libellé que portent
  // déjà la convention, le contrat et le programme (`modaliteLabel`).
  hybride: "Mixte",
  mixte: "Mixte",
};

/** « presentiel » → « Présentiel ». Idempotent ; inconnu → inchangé. */
export function libelleModalite(valeur: string | null | undefined): string {
  if (valeur === null || valeur === undefined) return "";
  const v = valeur.trim();
  return MODALITE[v.toLowerCase()] ?? v;
}

/** Même libellé, en bas de casse, pour une phrase (« … — présentiel — … »). */
export function libelleModaliteMinuscule(valeur: string | null | undefined): string {
  const l = libelleModalite(valeur);
  return l === "" ? "" : l.charAt(0).toLowerCase() + l.slice(1);
}

const FINANCEMENT: Readonly<Record<string, string>> = {
  direct: "Financement direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
  mixte: "Financement mixte",
};

/** « france_travail » → « France Travail ». Idempotent ; inconnu → inchangé. */
export function libelleFinancement(valeur: string | null | undefined): string {
  if (valeur === null || valeur === undefined) return "";
  const v = valeur.trim();
  return FINANCEMENT[v] ?? v;
}
