/**
 * Ce que le client a PRIS : types et étapes d'une prestation (fiche client à 7 onglets, étape 3,
 * 2026-10-26). Vocabulaire de la console : « Prestation » (la table reste `projets`).
 *
 * PUR : aucune lecture, aucune écriture. Les valeurs permises vivent ICI et non dans la base
 * (`projet_suivis.type` est un texte) : un type de plus ne demande pas de migration.
 *
 * L'étape est CALCULÉE depuis le statut du projet et de ses devis ; Will peut la FORCER à la
 * main (`etape_forcee`). Le montant reste dans la console : il ne part jamais vers le CRM.
 */

export const TYPES_PRESTATION = [
  "formation",
  "audit",
  "coaching",
  "integration_automatisation",
  "site_internet",
  "conference",
  "autre",
] as const;
export type TypePrestation = (typeof TYPES_PRESTATION)[number];

export const LIBELLE_TYPE_PRESTATION: Readonly<Record<TypePrestation, string>> = {
  formation: "Formation",
  audit: "Audit",
  coaching: "Coaching 1-to-1",
  integration_automatisation: "Intégration ou automatisation",
  site_internet: "Site internet",
  conference: "Conférence",
  autre: "Autre",
};

export const ETAPES_PRESTATION = [
  "proposee",
  "devisee",
  "en_cours",
  "livree",
  "terminee",
  "en_pause",
  "perdue",
  "abandonnee",
] as const;
export type EtapePrestation = (typeof ETAPES_PRESTATION)[number];

export const LIBELLE_ETAPE_PRESTATION: Readonly<Record<EtapePrestation, string>> = {
  proposee: "Proposée",
  devisee: "Devisée",
  en_cours: "En cours",
  livree: "Livrée",
  terminee: "Terminée",
  en_pause: "En pause",
  perdue: "Perdue",
  abandonnee: "Abandonnée",
};

export const estTypePrestation = (v: unknown): v is TypePrestation =>
  typeof v === "string" && (TYPES_PRESTATION as readonly string[]).includes(v);

export const estEtapePrestation = (v: unknown): v is EtapePrestation =>
  typeof v === "string" && (ETAPES_PRESTATION as readonly string[]).includes(v);

/** L'étape déduite du projet et de ses devis. « Livrée » n'est jamais déduite : Will la pose. */
export function etapeCalculee(
  statutProjet: string,
  statutsDevis: ReadonlyArray<string>,
): EtapePrestation {
  switch (statutProjet) {
    case "en_pause":
      return "en_pause";
    case "perdu":
      return "perdue";
    case "abandonne":
      return "abandonnee";
    case "termine":
      return "terminee";
    case "gagne":
      return "en_cours";
    default:
      return statutsDevis.some((s) => s === "envoye" || s === "accepte") ? "devisee" : "proposee";
  }
}

/** L'étape affichée : celle que Will a forcée, sinon la calculée. */
export function etapeAffichee(
  forcee: string | null,
  statutProjet: string,
  statutsDevis: ReadonlyArray<string>,
): { readonly etape: EtapePrestation; readonly forcee: boolean } {
  if (estEtapePrestation(forcee)) return { etape: forcee, forcee: true };
  return { etape: etapeCalculee(statutProjet, statutsDevis), forcee: false };
}

/** « 1 500,50 » ou « 1500.5 » (euros) -> centimes ; vide -> null ; négatif ou illisible -> `undefined`. */
export function eurosEnCentimes(saisie: string): number | null | undefined {
  const brut = saisie.replace(/[\s ]/g, "").replace(",", ".");
  if (brut === "") return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(brut)) return undefined;
  return Math.round(Number(brut) * 100);
}

export function centimesEnEuros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
