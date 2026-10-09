// ─── PREUVES SOCIALES — interrupteurs uniques (2026-10-09) ─────────────────
// Le bandeau de logos clients et les avis clients ont été ÉTEINTS le 2026-10-09
// après un message de la DGCCRF (décision de Will). Tout le code reste en place :
// composants, pages /avis, cartes, notes, données structurées. Rien n'est cassé,
// tout est seulement masqué tant que l'interrupteur est sur `false`.
//
// Pour RALLUMER, quand il y aura de vrais clients :
// - logos : remplir `CLIENT_LOGOS` (src/content/home-data.ts) avec des clients
//   réels ayant donné leur accord écrit, déposer leurs SVG dans
//   `public/logos/clients/`, puis passer `LOGOS_CLIENTS_AFFICHES` à `true` ;
// - avis : republier les avis réels dans la console (statut « publié »), puis
//   passer `AVIS_CLIENTS_AFFICHES` à `true`. Les pages /avis, les blocs d'avis
//   des pages service, la note de l'accueil et les témoignages des pages
//   « implémentation » reviennent d'eux-mêmes.
//
// ⚠️ Ne repasser à `true` que sur décision de Will.

/** Bandeau de logos clients (accueil, villes, régions, pages service, fiches). */
export const LOGOS_CLIENTS_AFFICHES = false;

/** Avis clients : pages /avis, blocs d'avis, notes, étoiles, témoignages. */
export const AVIS_CLIENTS_AFFICHES = false;

/**
 * Faits du savoir (articles générés + robot de discussion) qui citent les avis
 * clients (notes moyennes, « 77 avis vérifiés »…). Retirés tant que
 * `AVIS_CLIENTS_AFFICHES` est éteint ; ils reviennent avec lui. ⚠️ Les chiffres
 * de ces faits datent de juillet 2026 : les recalculer avant de rallumer.
 */
const FAITS_ISSUS_DES_AVIS: ReadonlySet<string> = new Set([
  "impl-061",
  "impl-069",
  "form-018",
  "form-076",
  "form-077",
  "form-078",
  "ua-050",
  "ua-057",
]);

export function sansFaitsIssusDesAvis<T extends { readonly id: string }>(
  faits: readonly T[],
): readonly T[] {
  return AVIS_CLIENTS_AFFICHES ? faits : faits.filter((f) => !FAITS_ISSUS_DES_AVIS.has(f.id));
}
