fix(seo) : le plan du site presse exclut les communiqués en noindex (S2-2)

Fiche S2-2 de `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md` (contradiction C2).

## Le problème

`buildPresseSitemap` listait tous les communiqués publiés. La page `/presse/[slug]` met en `noindex` ceux qui n'ont pas de PDF et font moins de 60 mots. Le plan du site annonçait donc des pages que la page refuse d'indexer.

## Ce qui change

- Nouveau module `src/server/press/indexabilite.ts` : `communiqueIndexable({ pdfUrl, body })` (un PDF rend toujours indexable ; sinon le corps doit faire au moins 60 mots), avec `MIN_BODY_WORDS` et `countWords` déplacés tels quels depuis la page.
- La page utilise ce prédicat pour ses balises robots : même condition qu'avant. Le rendu (`isThin`) est inchangé.
- `buildPresseSitemap` lit `pdfStoragePath` et le corps de chaque traduction, et saute les communiqués non indexables. Une entrée EN n'est émise (et déclarée en alternate) que si sa propre page est indexable.
- Documentation d'en-tête de la page corrigée : 250 mots → 60 mots.
- Test `src/app/__tests__/sitemap-presse-noindex.spec.ts` : 59 mots sans PDF exclu, 60 mots inclus, PDF au corps vide inclus, même prédicat importé par la page et le plan du site.

## Ce qui ne change pas

Aucune page supprimée, aucune URL modifiée, aucune balise robots d'une page indexable modifiée, aucun contenu visible modifié, aucune migration. Le plan du site tolère toujours la base `stub.invalid` (requête vide). Si tous les communiqués sont exclus, la garde « anti-vide » de l'index retire `sitemap-presse.xml` : c'est voulu.

## Vérifications

- Test écrit d'abord : 3 échecs sans le code du plan du site, 5 verts avec.
- `tsc --noEmit` vert ; vitest ciblé (`src/app/__tests__`, `src/server/press`) vert.
- Relecture Opus du diff : aucun défaut bloquant, aucun communiqué indexable retiré. Deux remarques facultatives (renommer la variable `pdfUrl` du plan du site ; tester le cas FR long / EN court) non retenues : EN est désactivé et le code n'a pas changé après la relecture.

VERDICT OPUS : BON
