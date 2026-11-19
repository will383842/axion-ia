/**
 * Version des conditions générales de vente : SOURCE UNIQUE.
 *
 * Lue par la page publique `/conditions-generales`, par le bloc affiché au signataire
 * d'un devis, par l'action de signature (qui ENREGISTRE `CGV_VERSION`, jamais la valeur
 * envoyée par le navigateur) et par le téléchargement PDF `/api/cgv`.
 *
 * 🔴 À changer à CHAQUE révision de fond du texte (`legal.ts`, slug
 * `conditions-generales`). Le test `__tests__/cgv-version.spec.ts` lie l'empreinte du
 * texte français à cette version : il casse si l'un bouge sans l'autre.
 *
 * Deux variantes du texte existent : la normale, et la « certifiée » qui ajoute cinq
 * passages (`cgv-passages-financement.ts`). La variante certifiée porte le suffixe `-f` : la
 * preuve de signature enregistre ainsi LAQUELLE des deux le client a acceptée.
 */

/**
 * Même règle que `isQualiopiCertificationObtenue` (lecture de `QUALIOPI_CERTIFICATION_OBTENUE`),
 * lue UNE FOIS par processus. `src/content` ne doit pas importer `src/server` (garde
 * `qualiopi:isolation-check`) : la règle est donc répétée ici, pas importée.
 */
export const CGV_AVEC_PASSAGES_FINANCEMENT =
  process.env["QUALIOPI_CERTIFICATION_OBTENUE"] === "true";

export const CGV_DATE_ISO = "2026-11-20";
export const CGV_VERSION = CGV_AVEC_PASSAGES_FINANCEMENT ? `${CGV_DATE_ISO}-f` : CGV_DATE_ISO;
export const CGV_VERSION_LIBELLE = "20 novembre 2026";
export const CGV_VERSION_LIBELLE_EN = "November 20, 2026";
