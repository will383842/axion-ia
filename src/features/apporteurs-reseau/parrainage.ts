/**
 * Réseau d'apporteurs — règles du RATTACHEMENT d'un parrain (art. 4.6), module PUR.
 *
 * Un seul niveau rémunéré. Le parrain doit avoir un contrat en vigueur (`signe`), et le filleul
 * ne doit pas être le même acteur sous un autre nom : un parrainage entre deux fiches qui
 * partagent le SIREN, l'e-mail, le téléphone ou l'IBAN reviendrait à se commissionner soi-même.
 */

export interface IdentiteParrainage {
  siren: string | null;
  email: string | null;
  telephone: string | null;
  iban: string | null;
}

export type CoordonneeCommune = "SIREN" | "adresse e-mail" | "numéro de téléphone" | "IBAN";

const chiffres = (v: string | null) => (v ?? "").replace(/\D/g, "");
const sansEspaces = (v: string | null) => (v ?? "").replace(/\s+/g, "").toUpperCase();

/** Les coordonnées que les deux fiches ont en commun. Pur ; une valeur vide ne compte jamais. */
export function coordonneesCommunes(
  a: IdentiteParrainage,
  b: IdentiteParrainage,
): CoordonneeCommune[] {
  const communes: CoordonneeCommune[] = [];
  if (chiffres(a.siren) !== "" && chiffres(a.siren) === chiffres(b.siren)) communes.push("SIREN");
  if (sansEspaces(a.email) !== "" && sansEspaces(a.email) === sansEspaces(b.email))
    communes.push("adresse e-mail");
  // Un numéro de téléphone se compare sur ses 9 derniers chiffres (+33 6… = 06…).
  const tel = (v: string | null) => chiffres(v).slice(-9);
  if (tel(a.telephone).length >= 9 && tel(a.telephone) === tel(b.telephone))
    communes.push("numéro de téléphone");
  if (sansEspaces(a.iban) !== "" && sansEspaces(a.iban) === sansEspaces(b.iban))
    communes.push("IBAN");
  return communes;
}

/** Refus éventuel du rattachement (message pour la console), ou `null` s'il est permis. */
export function refusRattachement(e: {
  parrainStatut: string;
  filleul: IdentiteParrainage;
  parrain: IdentiteParrainage;
}): string | null {
  if (e.parrainStatut !== "signe")
    return "Seul un apporteur au contrat signé peut parrainer : celui-ci ne l'est pas.";
  const communes = coordonneesCommunes(e.filleul, e.parrain);
  if (communes.length > 0)
    return `Rattachement refusé : les deux fiches ont le même ${communes.join(", le même ")}. Un apporteur ne se parraine pas lui-même.`;
  return null;
}
