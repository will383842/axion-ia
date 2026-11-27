fix(seo) : le plan du site d'images n'annonce plus les pages galerie en noindex (S2-1)

Fiche S2-1 de `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md` (contradiction C1).

## Le problème

`images-fr.xml` listait toutes les images publiées. Or la page `/galerie/[slug]` se met en `noindex` quand l'image n'a ni description ni résumé IA d'au moins 100 caractères. Le plan du site annonçait donc des pages que la page elle-même refuse d'indexer.

## Ce qui change

- Nouveau module `src/server/image-bank/indexabilite.ts` : `hasSubstantiveContent` (déplacée telle quelle depuis la page) et `isGalleryPageIndexable(locale, traduction)`.
- La page utilise ce prédicat : même condition qu'avant, aucune balise robots ne change.
- `images-fr.xml` et `images-en.xml` lisent `description` et `aiSummary` et ne listent que les pages indexables.
- Test `src/app/sitemaps/__tests__/images-galerie-indexation.spec.ts` : image vide absente, image enrichie présente, même prédicat importé par la page et les deux plans du site.

## Ce qui ne change pas

Aucune page supprimée, aucune URL modifiée, aucun contenu visible modifié, aucune migration. On ne fait que retirer du plan du site des pages déjà en noindex. Le plan du site tolère toujours la base `stub.invalid`. Le cache Cloudflare d'une heure retarde l'effet.

## Volontairement non fait

L'adresse de l'index galerie reste `/fr/galerie/` (avec barre finale) : la fiche ne le demande que si S2-0 confirme la redirection, et S2-0 est une mesure faite par Will.

## À noter

Les pages EN de la galerie sont toujours en noindex (règle existante). Si l'EN est réactivé, `images-en.xml` ne contiendra donc plus d'`<image:loc>` : la vérification de l'étape 4 de la procédure de réactivation (AGENTS.md) devra être ajustée à ce moment-là.

## Vérifications

- Test écrit d'abord : 3 échecs sans le code, 7 verts avec.
- `pnpm typecheck` vert ; vitest ciblé (galerie, téléchargement, sitemaps) vert.
- Relecture Opus du diff : aucun défaut, aucune page indexable retirée.

VERDICT OPUS : BON
