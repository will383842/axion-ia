/**
 * Format canonique des images de partage (Open Graph / Twitter Card).
 *
 * 🔴 POURQUOI CE MODULE EXISTE — recensement OG du 2026-08-17.
 *
 * Les 1 667 URLs indexables de la production ont été mesurées, et les 1 667
 * annonçaient `og:image:width=1200` / `og:image:height=630`. C'était FAUX
 * partout, et de deux façons différentes :
 *
 *   · `/api/og` et `/opengraph-image` rendent **1200×675** (mesuré au pixel
 *     sur les fichiers téléchargés depuis la production) — 45 px de plus que
 *     ce qui était déclaré ;
 *   · les 133 articles de blog servaient une photo Unsplash forcée à
 *     `w=1080` (**1080×607** mesuré) — 120 px de MOINS que ce qui était
 *     déclaré, et sous le seuil des 1200 px en dessous duquel LinkedIn
 *     dégrade la grande carte en vignette.
 *
 * Les trois valeurs vivaient en dur dans trois fichiers qui ne se
 * connaissaient pas : `seo.ts` (déclaration), `api/og/route.tsx` (rendu) et
 * `opengraph-image.tsx` (rendu). Rien ne pouvait rougir quand elles
 * divergeaient — et elles ont divergé.
 *
 * 🔑 Elles sont désormais UNE SEULE constante, importée par les trois. Ce
 * n'est pas un test qui garantit l'accord : c'est le compilateur.
 *
 * ⚠️ CE MODULE DOIT RESTER SANS AUCUN IMPORT.
 *
 * `api/og/route.tsx` et `opengraph-image.tsx` tournent en **runtime edge**.
 * L'audit GSC du 2026-05-18 a coûté un 502 en production précisément parce que
 * `opengraph-image.tsx` importait `@/lib/brand` → `@/env`, dont la validation
 * Zod throw au chargement du module en edge. Un import ajouté ici rejouerait
 * ce défaut. `@/lib/site-url` est déjà disqualifié pour cette raison : il
 * importe `@/env`.
 */

/**
 * Dimensions du canevas de nos images de partage.
 *
 * 1200×675 et non 1200×630 : le plancher Google Discover est 1200×675, et les
 * réseaux sociaux ignorent le ratio tant que la largeur atteint 1200. Le
 * format couvre donc Discover ET la grande carte Facebook/LinkedIn/Slack,
 * ce que 1200×630 ne faisait pas.
 */
export const OG_IMAGE_LARGEUR = 1200;
export const OG_IMAGE_HAUTEUR = 675;

/**
 * Largeur minimale sous laquelle LinkedIn et Facebook cessent d'afficher la
 * grande carte et retombent sur une vignette. Sert de seuil aux alertes de
 * l'explorateur d'URLs ; n'est pas utilisé au rendu.
 */
export const OG_LARGEUR_MINIMALE_GRANDE_CARTE = 1200;
