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
 */
export const CGV_VERSION = "2026-11-08";
export const CGV_VERSION_LIBELLE = "8 novembre 2026";
export const CGV_VERSION_LIBELLE_EN = "November 8, 2026";
