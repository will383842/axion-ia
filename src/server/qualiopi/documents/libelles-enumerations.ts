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

/**
 * SOURCE UNIQUE du libellé de la modalité `hybride` (salle ET visio) : courriel,
 * copie entreprise, PDF (convocation, convention, programme), site et console
 * le dérivent tous d'ici. Ne plus écrire « Mixte » ni « hybride » en dur ailleurs.
 */
export const LIBELLE_MODALITE_HYBRIDE = "Hybride (présentiel et distanciel)" as const;
export const LIBELLE_MODALITE_HYBRIDE_MINUSCULE = "hybride (présentiel et distanciel)" as const;

const MODALITE: Readonly<Record<string, string>> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: LIBELLE_MODALITE_HYBRIDE,
  // Ancienne valeur « mixte » encore présente dans d'anciens instantanés.
  mixte: LIBELLE_MODALITE_HYBRIDE,
};

/** Libellé de la modalité sur les pièces (convention, contrat, programme). */
export function modaliteLabel(
  m: "presentiel" | "distanciel" | "hybride",
): "Présentiel" | "Distanciel" | typeof LIBELLE_MODALITE_HYBRIDE {
  if (m === "presentiel") return "Présentiel";
  if (m === "distanciel") return "Distanciel";
  return LIBELLE_MODALITE_HYBRIDE;
}

/** Même libellé en bas de casse (convocation). */
export function modaliteLabelLower(
  m: "presentiel" | "distanciel" | "hybride",
): "présentiel" | "distanciel" | typeof LIBELLE_MODALITE_HYBRIDE_MINUSCULE {
  if (m === "presentiel") return "présentiel";
  if (m === "distanciel") return "distanciel";
  return LIBELLE_MODALITE_HYBRIDE_MINUSCULE;
}

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
