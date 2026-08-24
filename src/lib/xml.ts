/**
 * Échappement XML / HTML — SSOT.
 *
 * ## Pourquoi ce module existe ici, et pas ailleurs
 *
 * `escapeXml` vivait dans `src/server/image-bank/utils/xml.ts`. Cinq routes
 * l'importaient, dont **trois qui n'ont aucun rapport avec la banque d'images**
 * (`sitemap-images-blog`, `sitemap-images-services`, `sitemap-news-evergreen`).
 * Une fonction d'échappement XML n'appartient à aucun domaine métier : la ranger
 * dans un module obligeait les autres à en dépendre, et c'est ce qui faisait
 * rougir `image-bank:isolation-check` — pour une raison qui n'était pas une
 * fuite d'architecture, juste un fichier mal rangé.
 *
 * ## ⚠️ Ce que ce module NE règle PAS
 *
 * Mesuré le 2026-08-24 sur l'arbre entier : **27 implémentations** de cette même
 * fonction coexistent dans le dépôt, sous six noms différents (`escapeXml`,
 * `xmlEscape`, `escapeHtml`, `escapeHtmlAttr`, `esc`, `escapeName`…), et elles
 * **ne font pas toutes la même chose** :
 *
 *   19 échappent `& < > " '`
 *    6 échappent `& < > "`      (sans l'apostrophe)
 *    2 échappent `& < >`        (ni guillemet ni apostrophe)
 *
 * Ces écarts ne sont PAS tous des défauts — le jeu minimal dépend du contexte :
 * dans le CONTENU d'une balise, `& < >` suffit ; dans un ATTRIBUT, il faut aussi
 * le délimiteur employé. Mais ils sont indistinguables à la lecture, et rien ne
 * dit lequel a été choisi exprès. C'est le motif « un prédicat recopié diverge »,
 * que ce dépôt a déjà payé quatre fois.
 *
 * Ce module ne migre PAS les 26 autres : ce serait toucher des sitemaps et des
 * flux RSS servis en production, sans autre bénéfice immédiat que l'uniformité.
 * Il est le point d'arrivée quand on y viendra, un appelant à la fois.
 */

/**
 * Échappe les cinq caractères réservés de XML.
 *
 * Sûr pour le CONTENU comme pour un ATTRIBUT, quel que soit son délimiteur —
 * c'est pourquoi c'est le défaut à préférer dans un sitemap ou un flux.
 * `&apos;` est une entité XML valide ; en HTML pur, lui préférer `escapeHtmlAttr`.
 */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Échappe pour un attribut HTML délimité par des guillemets doubles.
 *
 * ⚠️ N'échappe PAS l'apostrophe : `&apos;` n'est pas une entité HTML4, et un
 * attribut délimité par `"` n'en a pas besoin. Ne pas employer pour un attribut
 * délimité par des apostrophes.
 *
 * 🔑 L'ordre compte : `&` d'abord, sinon on ré-échapperait les `&` des entités
 * qu'on vient d'écrire.
 */
export function escapeHtmlAttr(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
