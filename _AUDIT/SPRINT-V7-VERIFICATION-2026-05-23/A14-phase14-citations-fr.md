# A14 Phase 14 — 10 citations FR catalog

## Statut : ⚠️ STUB-OK

Catalogue + helpers livrés et testés, mais scaffold-only : aucun consumer du
catalogue dans le code applicatif, et `listingUrl` = null sur les 10 entries
(action async Will documentée dans le commit message).

## Files claimed vs found

Commit 88fbb169 — diff 2 fichiers / +214 lignes :

| Fichier claimed                                 | Trouvé | Lignes |
| ----------------------------------------------- | ------ | ------ |
| `src/lib/seo/local-citations.ts`                | oui    | 166    |
| `src/lib/seo/__tests__/local-citations.spec.ts` | oui    | 48     |

Chemins réels : `axionia/src/lib/seo/local-citations.ts` (sous-dossier
`axionia/` du repo). Match exact avec le commit.

## Catalogue : claimed 10 / found 10

| #   | slug                 | name                     | directoryUrl (racine)            | priority | URL valide          |
| --- | -------------------- | ------------------------ | -------------------------------- | -------- | ------------------- |
| 1   | pages-jaunes         | PagesJaunes              | https://www.pagesjaunes.fr       | 1        | format HTTPS valide |
| 2   | google-business      | Google Business Profile  | https://www.google.com/business  | 1        | format HTTPS valide |
| 3   | bing-places          | Bing Places for Business | https://www.bingplaces.com       | 1        | format HTTPS valide |
| 4   | kompass              | Kompass France           | https://fr.kompass.com           | 2        | format HTTPS valide |
| 5   | societe-com          | Societe.com              | https://www.societe.com          | 2        | format HTTPS valide |
| 6   | infogreffe           | Infogreffe               | https://www.infogreffe.fr        | 2        | format HTTPS valide |
| 7   | linkedin-company     | LinkedIn Company Page    | https://www.linkedin.com/company | 3        | format HTTPS valide |
| 8   | frenchtech-directory | La French Tech Directory | https://lafrenchtech.com         | 3        | format HTTPS valide |
| 9   | mappy                | Mappy                    | https://fr.mappy.com             | 4        | format HTTPS valide |
| 10  | 118000               | 118 000 (annuaire)       | https://www.118000.fr            | 4        | format HTTPS valide |

Structure d'entrée vérifiée (Read entry #1 PagesJaunes) : `slug`, `name`,
`listingUrl: null`, `directoryUrl`, `priority: 1`, `category` — conforme à
l'interface `LocalCitationEntry` (lignes 19-32).

Distribution priorités : P1=3 (NAP critique), P2=3 (B2B légal), P3=2 (Tech),
P4=2 (Géo), P5=0. Slugs uniques (test LC3 garantit l'invariant).

## Cross-checks

- Helpers exportés : oui — `buildLocalBusinessSameAsFR()` (filtre listingUrl
  non-null → array d'URLs pour `LocalBusiness.sameAs`) et
  `getLocalCitationsCoverage()` (stats total/listed/byPriority pour admin UI).
- Tests vitest : 6 tests LC1-LC6 dans `local-citations.spec.ts` (claim "6
  tests verts" du commit message = exact). LC5 garantit que
  `buildLocalBusinessSameAsFR()` retourne `[]` en V1 (listings vides).
- Consumers identifiés (Grep `buildLocalBusinessSameAsFR|LOCAL_CITATIONS_FR|getLocalCitationsCoverage|local-citations`
  sur tout le repo) :
  - `axionia/src/lib/seo/__tests__/local-citations.spec.ts` (test du module
    lui-même)
  - `axionia/_AUDIT/SPRINT-V7-FINAL/SPRINT-V7-FINAL-REPORT-2026-05-23.md`
    (documentation du sprint, pas du code)
  - **Aucun import depuis le code applicatif** (server, components, JSON-LD
    builders, admin pages). `buildLocalBusinessSameAsFR()` n'est branché à
    aucun `LocalBusiness.sameAs` réel.

## Verdict / écarts trouvés

Le scope claimé (catalogue 10 annuaires + helpers + 6 tests) est livré
intégralement et fidèlement. Les 10 entries existent, ont la structure
documentée, slugs uniques, priorités cohérentes, URLs racine au format HTTPS
valide. Les deux helpers exportés sont présents et testés.

Écart fonctionnel notable (documenté par l'auteur dans le commit message) :
le module est livré en mode scaffold V1. Deux limites concrètes :

1. Tous les `listingUrl` sont `null` : `buildLocalBusinessSameAsFR()` retourne
   `[]` tant que Will n'a pas créé les profils annuaires et complété les URLs
   (action async ~5-8 h estimée par le commit message).
2. Aucun consumer dans le code applicatif : même si Will remplit les
   `listingUrl`, le helper n'est appelé par aucun `LocalBusiness` JSON-LD
   builder (cherché par grep, zéro occurrence hors test et doc). Pour que le
   signal cross-platform atteigne effectivement Google/Bing, il faut un wiring
   complémentaire (probablement dans `src/lib/jsonld/*` ou un schema helper
   LocalBusiness), non livré dans cette phase.

Conséquence : phase 14 livre l'infrastructure de données (catalog + helpers

- tests) mais l'effet SEO net en prod est nul tant que (a) les listings sont
  créés et (b) le wiring vers les JSON-LD `LocalBusiness.sameAs` est branché.
  Le commit message reconnaît explicitement le point (a) ; le point (b) n'est
  pas mentionné.
