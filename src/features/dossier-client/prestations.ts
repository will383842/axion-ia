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
  "besoin",
  "devis_envoye",
  "accepte",
  "terminee",
  "en_pause",
  "perdue",
] as const;
export type EtapePrestation = (typeof ETAPES_PRESTATION)[number];

export const LIBELLE_ETAPE_PRESTATION: Readonly<Record<EtapePrestation, string>> = {
  besoin: "Besoin",
  devis_envoye: "Devis envoyé",
  accepte: "Accepté",
  terminee: "Terminée",
  en_pause: "En pause",
  perdue: "Perdue",
};

export const estTypePrestation = (v: unknown): v is TypePrestation =>
  typeof v === "string" && (TYPES_PRESTATION as readonly string[]).includes(v);

export const estEtapePrestation = (v: unknown): v is EtapePrestation =>
  typeof v === "string" && (ETAPES_PRESTATION as readonly string[]).includes(v);

/** L'étape déduite du projet et de ses devis : Besoin, Devis envoyé ou Accepté sauf statut final. */
export function etapeCalculee(
  statutProjet: string,
  statutsDevis: ReadonlyArray<string>,
): EtapePrestation {
  switch (statutProjet) {
    case "en_pause":
      return "en_pause";
    case "perdu":
    case "abandonne":
      return "perdue";
    case "termine":
      return "terminee";
    case "gagne":
      return "accepte";
    default:
      if (statutsDevis.some((s) => s === "accepte" || s === "transforme_convention")) {
        return "accepte";
      }
      return statutsDevis.some((s) => s === "envoye") ? "devis_envoye" : "besoin";
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

const nettoyerMontant = (saisie: string): string => saisie.replace(/[\s  ]/g, "").replace(",", ".");

/** « 1 500,50 » ou « 1500.5 » (euros) -> centimes ; vide -> null ; négatif ou illisible -> `undefined`. */
export function eurosEnCentimes(saisie: string): number | null | undefined {
  const brut = nettoyerMontant(saisie);
  if (brut === "") return null;
  // Écriture française des milliers collée (« 1.500 ») : ambiguë, on refuse.
  if (/^\d{1,3}\.\d{3}$/.test(brut)) return undefined;
  // 7 chiffres au plus : les centimes tiennent dans un INTEGER de la base.
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(brut)) return undefined;
  return Math.round(Number(brut) * 100);
}

/** Le message à montrer quand `eurosEnCentimes` refuse la saisie. */
export function messageMontantInvalide(saisie: string): string {
  const brut = nettoyerMontant(saisie);
  if (/^\d{1,3}\.\d{3}$/.test(brut)) return "Montant ambigu : écrivez 1500 ou 1 500.";
  if (/^\d{8,}(\.\d+)?$/.test(brut)) {
    return "Montant trop grand : 9 999 999 € au plus.";
  }
  return "Le montant n'est pas valide (euros, deux décimales au plus).";
}

export function centimesEnEuros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
