/**
 * Les emplacements de la fiche client, tous vides (lot 0). Les tests de la page simulent
 * `fiche/emplacements` avec cet objet : les fonctions async rendent `null`, et les trois composants
 * (`ActionsDeLaPersonne`, `OngletDevisFactures`, `RelanceDevis`) sont des BOUCHONS qui rendent `null`.
 * Les specs qui ont besoin du vrai onglet Devis et factures prennent `emplacementsAvecOngletReel()`.
 * `lireClient360Cache` relaie vers `getClient360` (simulé ou non par la spec). Seul le lot 0 modifie ce fichier.
 */

export const emplacementsVides = {
  enTeteFiche: async () => null,
  EN_TETE_REMPLACE_LE_BANDEAU: false,
  compteursOnglets: async () => ({}),
  ongletActivite: async () => null,
  ONGLET_ACTIVITE_PRET: false,
  resumeTaches: async () => null,
  resumeNotes: async () => null,
  resumePrestations: async () => null,
  personnesDecision: async () => null,
  questionnaireEnBref: async () => null,
  archivageFiche: async () => null,
  lireClient360Cache: async (id: string) =>
    (await import("@/server/qualiopi/crm/clients")).getClient360(id),
  ActionsDeLaPersonne: (): null => null,
  OngletDevisFactures: (): null => null,
  RelanceDevis: (): null => null,
};

/** Emplacements vides, mais avec le VRAI onglet Devis et factures (déplacé dans `fiche/`). */
export async function emplacementsAvecOngletReel() {
  const { OngletDevisFactures } = await import(
    "@/components/admin/dossier-client/fiche/OngletDevisFactures"
  );
  return { ...emplacementsVides, OngletDevisFactures };
}
