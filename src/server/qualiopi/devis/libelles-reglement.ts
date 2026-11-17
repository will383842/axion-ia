/**
 * Libellés du mode de règlement d'un devis, selon l'état de la certification.
 *
 * Module pur (aucun accès serveur) : la valeur `certifie` est lue par l'appelant
 * via `isQualiopiCertificationObtenue()`. Tant que la certification n'est pas
 * obtenue, la console n'emploie aucun mot de tiers payeur : seuls les libellés
 * changent, aucune donnée n'est réécrite.
 */

export const LIBELLE_REGLEMENT_DIRECT = "Règlement direct";
export const LIBELLE_REGLEMENT_TIERS = "Règlement par un tiers (ancien devis)";

const LIBELLES_CERTIFIE: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
};

/** Table `mode de financement → libellé`. Tout mode inconnu à tiers → libellé « tiers ». */
export function libellesReglementDevis(certifie: boolean): Record<string, string> {
  if (certifie) return { ...LIBELLES_CERTIFIE };
  const table: Record<string, string> = {
    direct: LIBELLE_REGLEMENT_DIRECT,
    opco: LIBELLE_REGLEMENT_TIERS,
    cpf: LIBELLE_REGLEMENT_TIERS,
    france_travail: LIBELLE_REGLEMENT_TIERS,
  };
  // Tout autre mode (clé absente) → tiers, y compris à l'avenir.
  return new Proxy(table, {
    get: (cible, cle) =>
      typeof cle === "string" && !(cle in cible) && cle !== "then"
        ? LIBELLE_REGLEMENT_TIERS
        : Reflect.get(cible, cle),
  });
}
