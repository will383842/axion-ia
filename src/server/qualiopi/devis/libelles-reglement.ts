/**
 * Libellés du mode de règlement d'un devis, selon l'état de la certification.
 *
 * Module pur (aucun accès serveur) : la valeur `certifie` est lue par l'appelant
 * via `isQualiopiCertificationObtenue()`. Tant que la certification n'est pas
 * obtenue, la console n'emploie aucun mot de tiers payeur : seuls les libellés
 * changent, aucune donnée n'est réécrite.
 *
 * Avec certification, chaque page garde EXACTEMENT sa table d'avant B6b-1
 * (la liste et la fiche n'avaient pas les mêmes libellés) : d'où la variante.
 */

export type VarianteReglement = "liste" | "fiche";

export const LIBELLE_REGLEMENT_DIRECT = "Règlement direct";
export const LIBELLE_REGLEMENT_TIERS = "Règlement par un tiers (ancien devis)";
export const LIBELLE_REGLEMENT_AUTRE = "Autre mode de règlement";

// Tables d'origine (`origin/main` avant B6b-1), figées par le test.
const LIBELLES_CERTIFIE: Record<VarianteReglement, Record<string, string>> = {
  liste: {
    direct: "Direct",
    opco: "OPCO",
    cpf: "CPF",
    france_travail: "France Travail",
  },
  fiche: {
    direct: "Direct (entreprise)",
    opco: "OPCO",
    cpf: "CPF / EDOF",
    france_travail: "France Travail",
  },
};

/** Table `mode connu → libellé`. Ne contient que les modes connus. */
export function libellesReglementDevis(
  certifie: boolean,
  variante: VarianteReglement,
): Record<string, string> {
  if (certifie) return { ...LIBELLES_CERTIFIE[variante] };
  return {
    direct: LIBELLE_REGLEMENT_DIRECT,
    opco: LIBELLE_REGLEMENT_TIERS,
    cpf: LIBELLE_REGLEMENT_TIERS,
    france_travail: LIBELLE_REGLEMENT_TIERS,
  };
}

/**
 * Libellé d'un mode. Mode inconnu : avec certification, repli actuel des pages
 * (valeur brute) ; sans certification, « Autre mode de règlement » — la valeur
 * brute pourrait contenir un mot interdit.
 */
export function libelleReglementDevis(
  mode: string,
  certifie: boolean,
  variante: VarianteReglement,
): string {
  const table = libellesReglementDevis(certifie, variante);
  if (Object.prototype.hasOwnProperty.call(table, mode)) return table[mode]!;
  return certifie ? mode : LIBELLE_REGLEMENT_AUTRE;
}
