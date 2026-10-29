// Classes partagées des formulaires de réservation et de la mini-demande du Tour France IA.
//
// Une seule source : `FormulaireReservation` (étape 2) et `/tour-france-ia/demande` (étape 1) les
// importent, pour que les deux écrans restent en harmonie. Chaînes copiées à l'identique du
// formulaire de réservation (aucun changement de rendu). Module sans JavaScript client.

/** Classes communes à tous les champs de saisie. Voir le PIÈGE `text-base` de `FormulaireReservation`. */
export const CHAMP =
  "border-border-strong bg-paper text-fg hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 w-full rounded-lg border px-3 text-base transition focus-visible:ring-4 focus-visible:outline-none";

/** Champ d'une ligne : 48 px de haut. */
export const CHAMP_HAUT = `${CHAMP} h-12`;

/** Libellé d'un champ. */
export const LIBELLE = "text-fg mb-1.5 block text-sm font-semibold";

/**
 * Bouton d'envoi. `text-mocha-fg` et NON `text-paper` : c'est l'appariement mesuré du design
 * system pour `bg-terracotta` (5,24:1).
 */
export const BOUTON_ENVOI =
  "bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta shadow-cta-terracotta flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
