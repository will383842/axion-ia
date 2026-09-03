/**
 * Valeurs de formulaire du lieu de déroulement (côté client).
 *
 * Module SANS "use client" ni JSX : il est importé à la fois par des composants
 * client (`LieuFieldset`, `SessionForm`) et par des Server Components qui
 * préparent les valeurs initiales depuis la base.
 *
 * Représentation VOLONTAIREMENT en chaînes, y compris pour le type de lieu :
 * un `<select>` HTML n'a pas de valeur nulle, et introduire `null` ici obligerait
 * chaque champ à distinguer « vide » de « absent » sans qu'aucun écran n'en
 * fasse quoi que ce soit. La conversion en `null` persistable est faite une seule
 * fois, côté serveur, par `normaliserLieu` (`server/qualiopi/lieu/lieu-input.ts`).
 */

export interface LieuValues {
  lieuType: "" | "sur_site" | "nos_locaux" | "distanciel";
  lieuIntitule: string;
  lieuAdresse: string;
  lieuCodePostal: string;
  lieuVille: string;
  lieuSalle: string;
  lieuVisioUrl: string;
  /** Accueil du formateur sur place (2026-09-03) — nom et téléphone. */
  contactSurPlaceNom: string;
  contactSurPlaceTelephone: string;
  /** Badge, accueil, parking, étage, code… ce qu'il faut savoir pour ENTRER. */
  consignesAcces: string;
}

/** Formulaire vierge. */
export const LIEU_VALUES_VIDE: LieuValues = {
  lieuType: "",
  lieuIntitule: "",
  lieuAdresse: "",
  lieuCodePostal: "",
  lieuVille: "",
  lieuSalle: "",
  lieuVisioUrl: "",
  contactSurPlaceNom: "",
  contactSurPlaceTelephone: "",
  consignesAcces: "",
};

/** Ligne de base (colonnes `lieu*` nullables) → valeurs de formulaire. */
export function lieuValuesDepuisSession(row: {
  lieuType?: string | null;
  lieuIntitule?: string | null;
  lieuAdresse?: string | null;
  lieuCodePostal?: string | null;
  lieuVille?: string | null;
  lieuSalle?: string | null;
  lieuVisioUrl?: string | null;
  contactSurPlaceNom?: string | null;
  contactSurPlaceTelephone?: string | null;
  consignesAcces?: string | null;
}): LieuValues {
  const type = row.lieuType ?? "";
  return {
    lieuType:
      type === "sur_site" || type === "nos_locaux" || type === "distanciel" ? type : ("" as const),
    lieuIntitule: row.lieuIntitule ?? "",
    lieuAdresse: row.lieuAdresse ?? "",
    lieuCodePostal: row.lieuCodePostal ?? "",
    lieuVille: row.lieuVille ?? "",
    lieuSalle: row.lieuSalle ?? "",
    lieuVisioUrl: row.lieuVisioUrl ?? "",
    contactSurPlaceNom: row.contactSurPlaceNom ?? "",
    contactSurPlaceTelephone: row.contactSurPlaceTelephone ?? "",
    consignesAcces: row.consignesAcces ?? "",
  };
}

/**
 * Valeurs de formulaire → charge utile d'une Server Action.
 *
 * Toutes les clés sont émises, `lieuType: ""` compris : le schéma serveur
 * l'accepte et le traduit en « effacer le type ». Omettre la clé signifierait
 * « ne touche pas à cette colonne », ce qui rendrait impossible le retour à
 * « — Non précisé — » depuis le formulaire de correction.
 */
export function lieuPayload(v: LieuValues): Record<string, string> {
  return {
    lieuType: v.lieuType,
    lieuIntitule: v.lieuIntitule,
    lieuAdresse: v.lieuAdresse,
    lieuCodePostal: v.lieuCodePostal,
    lieuVille: v.lieuVille,
    lieuSalle: v.lieuSalle,
    lieuVisioUrl: v.lieuVisioUrl,
    contactSurPlaceNom: v.contactSurPlaceNom,
    contactSurPlaceTelephone: v.contactSurPlaceTelephone,
    consignesAcces: v.consignesAcces,
  };
}
