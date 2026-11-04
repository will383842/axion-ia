/**
 * Devis « à contresigner » — prédicat unique, pur, partagé par la liste des
 * devis, son compteur, son filtre et le pipeline des dossiers.
 *
 * Un devis est à contresigner quand il est `envoye` ET que sa pièce
 * (`documentGenereId`) figure dans l'ensemble des pièces de type devis déjà
 * signées par le client mais pas par axionia. Cet ensemble vient de
 * `pieces-en-attente.ts` (`idsPiecesDevisAContresigner`) : aucune logique de
 * signature n'est dupliquée ici. Déduit, jamais stocké : aucune valeur
 * d'énumération Prisma n'est ajoutée.
 */

export type EtatListeDevis =
  "brouillon" | "attente_client" | "a_contresigner" | "accepte" | "refuse_expire";

/** Filtres proposés à l'écran (le brouillon n'a pas de filtre propre). */
export type FiltreEtatDevis = Exclude<EtatListeDevis, "brouillon">;

export const FILTRES_ETAT_DEVIS: ReadonlyArray<{ id: FiltreEtatDevis; label: string }> = [
  { id: "attente_client", label: "En attente de signature client" },
  { id: "a_contresigner", label: "À contresigner" },
  { id: "accepte", label: "Acceptés" },
  { id: "refuse_expire", label: "Refusés / expirés" },
];

export interface DevisPourEtat {
  statut: string;
  documentGenereId?: string | null;
}

export function estDevisAContresigner(
  d: DevisPourEtat,
  piecesAContresigner: ReadonlySet<string>,
): boolean {
  return (
    d.statut === "envoye" &&
    typeof d.documentGenereId === "string" &&
    piecesAContresigner.has(d.documentGenereId)
  );
}

export function etatListeDevis(
  d: DevisPourEtat,
  piecesAContresigner: ReadonlySet<string>,
): EtatListeDevis {
  if (estDevisAContresigner(d, piecesAContresigner)) return "a_contresigner";
  switch (d.statut) {
    case "envoye":
      return "attente_client";
    case "accepte":
    case "transforme_convention":
      return "accepte";
    case "refuse":
    case "expire":
      return "refuse_expire";
    default:
      return "brouillon";
  }
}

/** `null` = pas de filtre. */
export function filtrerDevisParEtat<T extends DevisPourEtat>(
  liste: readonly T[],
  filtre: FiltreEtatDevis | null,
  piecesAContresigner: ReadonlySet<string>,
): T[] {
  if (filtre === null) return [...liste];
  return liste.filter((d) => etatListeDevis(d, piecesAContresigner) === filtre);
}

export function compterAContresigner(
  liste: readonly DevisPourEtat[],
  piecesAContresigner: ReadonlySet<string>,
): number {
  return filtrerDevisParEtat(liste, "a_contresigner", piecesAContresigner).length;
}

/** Valide un paramètre d'URL en filtre connu, sinon `null`. */
export function lireFiltreEtatDevis(valeur: string | string[] | undefined): FiltreEtatDevis | null {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return FILTRES_ETAT_DEVIS.find((f) => f.id === v)?.id ?? null;
}
