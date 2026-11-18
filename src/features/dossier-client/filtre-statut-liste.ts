/**
 * Filtre « Prospects / Clients / Perdus » de la liste des clients (`?statut=`). PUR : aucune lecture.
 *
 * Quatre vues, jamais d'autre valeur acceptée : une valeur inconnue (`?statut=zzz`) retombe sur
 * « Tous » au lieu d'afficher une liste vide qui ferait croire à une perte de fiches.
 *   · prospects : `prospect` + `devis_envoye` (pas encore de vente) ;
 *   · clients   : `client_actif` + `client_inactif` ;
 *   · perdus    : `perdu`.
 */

export const FILTRES_STATUT = ["tous", "prospects", "clients", "perdus"] as const;
export type FiltreStatut = (typeof FILTRES_STATUT)[number];

export const LIBELLE_FILTRE: Readonly<Record<FiltreStatut, string>> = {
  tous: "Tous",
  prospects: "Prospects",
  clients: "Clients",
  perdus: "Perdus",
};

const STATUTS_DU_FILTRE: Readonly<Record<FiltreStatut, ReadonlyArray<string> | null>> = {
  tous: null,
  prospects: ["prospect", "devis_envoye"],
  clients: ["client_actif", "client_inactif"],
  perdus: ["perdu"],
};

/** La valeur de `?statut=` (ou `undefined`) → un filtre connu ; sinon « tous ». */
export function lireFiltreStatut(brut: string | undefined): FiltreStatut {
  return (FILTRES_STATUT as ReadonlyArray<string>).includes(brut ?? "")
    ? (brut as FiltreStatut)
    : "tous";
}

export function appliquerFiltreStatut<T extends { readonly statut: string }>(
  fiches: ReadonlyArray<T>,
  filtre: FiltreStatut,
): T[] {
  const statuts = STATUTS_DU_FILTRE[filtre];
  return statuts === null ? [...fiches] : fiches.filter((f) => statuts.includes(f.statut));
}

/** Combien de fiches donnerait chaque filtre sur ces fiches : les compteurs égalent les listes. */
export function compterParFiltre(
  fiches: ReadonlyArray<{ readonly statut: string }>,
): Record<FiltreStatut, number> {
  return {
    tous: fiches.length,
    prospects: appliquerFiltreStatut(fiches, "prospects").length,
    clients: appliquerFiltreStatut(fiches, "clients").length,
    perdus: appliquerFiltreStatut(fiches, "perdus").length,
  };
}

/** L'adresse de la liste avec ses paramètres combinés (`archives`, `statut`, `q`) ; « tous » = absent. */
export function adresseListe(
  base: string,
  p: { readonly q?: string; readonly archives?: boolean; readonly statut?: FiltreStatut },
): string {
  const params = new URLSearchParams();
  if (p.archives === true) params.set("archives", "1");
  if (p.statut !== undefined && p.statut !== "tous") params.set("statut", p.statut);
  if (p.q !== undefined && p.q !== "") params.set("q", p.q);
  const suite = params.toString();
  return suite === "" ? base : `${base}?${suite}`;
}
