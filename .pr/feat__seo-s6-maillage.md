S6-1 · Le maillage des pages villes ne pointe que vers des pages indexées

Fiche : `docs/pilotage-seo-geo/S6-VILLES.md`, § 7, S6-1.

## Le problème

Le filtre `indexableOnly` de `getNearbyVilles` ne garde que les villes « qui ont un contenu ». Depuis la décision du 18/11/2026, les 2 157 communes en ont un : le filtre n'excluait plus rien. Résultat : une page ville indexée liait ses voisines `noindex`, et la liste « villes principales » d'une page région mêlait pages indexées et pages `noindex` (en Île-de-France : 5 indexées et 7 `noindex`).

## Ce que fait cette PR

- `src/lib/geo.ts` : nouvelle option `indexeesSeulement`, lue sur `villes-indexees.ts` (la source unique de l'indexation). Option nouvelle, donc les autres appelants (gabarit `par-ville`, orchestrateur de contenu) ne changent pas.
- `VilleCommunesProches.tsx` : une page ville **indexée** ne lie plus que des villes indexées. Les pages `noindex` gardent leur voisinage habituel (sinon une commune corse aurait affiché Nice et Marseille comme voisines).
- `[region]/page.tsx` : « villes principales » = villes indexées de la région, les plus peuplées d'abord (nouveau module pur `principales-region.ts`). Une région sans ville indexée (Corse) masque la liste.
- Commentaires périmés réalignés (`sitemap.ts`, gabarit `par-ville`, `resolve-with-copy.ts`, page ville, compte des schémas JSON-LD).

Le nombre de liens sortants des pages villes **baisse**. La ville du siège reste hors maillage national (règle existante, inchangée).

## Ce qui ne change pas

Aucune URL, aucun `meta robots`, aucun sitemap, aucun JavaScript client. La section « Toutes les villes » d'une page région continue de lister toutes les communes (la fiche veut que chaque ville reste atteignable ; la retirer est une décision à part).

## Vérifications

- Test rouge d'abord : `maillage-pages-indexees.spec.ts` échoue sans l'option, passe avec (8 tests : 40 villes indexées sans voisine `noindex`, ville du siège jamais citée, liste Île-de-France en dur, Corse vide, comportement historique inchangé sans l'option).
- `geo-extended.spec.ts` et `villes-indexees.spec.ts` verts.
- `pnpm typecheck` : propre. `prettier --check` : propre.

VERDICT OPUS : BON
