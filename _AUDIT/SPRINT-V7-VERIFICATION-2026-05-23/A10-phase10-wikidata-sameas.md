# A10 Phase 10 — Wikidata sameAs triangulation

## Statut : ⚠️ STUB-OK (helper safe, mais zéro consumer wiré)

## Files claimed vs found

Commit `2f5361f2` "feat(seo): phase 10 — wikidata sameas triangulation (knowledge graph)" — 4 fichiers, +183/-13 :

| Fichier claimed                                 | Présent | Notes                                                                                                               |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/seo/wikidata-sameas.ts`                | OUI     | 81 lignes, 4 exports : `buildOrganizationSameAs`, `buildPersonManonSameAs`, `withSameAs`, `getWikidataConfigStatus` |
| `src/lib/seo/__tests__/wikidata-sameas.spec.ts` | OUI     | 79 lignes, 7 tests W1→W7 (matche exactement le claim commit)                                                        |
| `src/app/[locale]/page.tsx`                     | TOUCHÉ  | Diff = **prettier reformatting pur** (multilines reformattés). Aucun import du helper. Aucun `sameAs` ajouté.       |
| `src/content/transversal.ts`                    | TOUCHÉ  | Diff = **prettier reformatting pur** (1 ligne question FAQ wrappée). Aucun usage du helper.                         |

## Fallback safe (Wikidata down → no-op) : OUI

Le contrat fallback safe est verbatim respecté :

- L60 `withSameAs` : `return sameAs.length > 0 ? { sameAs } : {}` (anti-JSON-LD sale)
- L31 / L48 : validation stricte `/^Q\d+$/.test(qNumber)` — format invalide = array vide
- Aucun appel réseau (helper 100% env-driven, donc Wikidata down = no-op par construction — on ne **ping** pas Wikidata, on **embed** une URL)
- 0 throw, 0 try/catch nécessaire car pas d'I/O
- Tests W1 (env absents) + W4 (format invalide) verrouillent le no-op

## Cross-checks

- **Consumers identifiés** : **0** dans `src/` hors test
  - `Grep "wikidata-sameas|withSameAs(|buildOrganizationSameAs(|buildPersonManonSameAs("` → seul `__tests__/wikidata-sameas.spec.ts` (auto-import)
  - `Grep "from .*wikidata-sameas"` → idem, seul le test
  - Le claim commit ne mentionne **pas** explicitement un wiring de JSON-LD. Les 2 fichiers touchés (`page.tsx` + `transversal.ts`) montrent diff prettier-only.
- **JSON-LD `sameAs` présent dans pages** : OUI mais via patterns **antérieurs**, pas via le helper Phase 10
  - 18 fichiers contiennent `sameAs` (Grep) : `src/lib/seo.ts` (`buildLocalBusinessJsonLd`), `src/content/press.ts`, `src/components/knowledge/public/AuthorByline.tsx`, `src/lib/seo/local-citations.ts`, etc. — tous indépendants du helper Phase 10.
  - Aucun de ces consumers existants ne lit `WIKIDATA_QNUMBER_AXIONIA` / `WIKIDATA_QNUMBER_MANON`.
- **Env vars** : `WIKIDATA_QNUMBER_AXIONIA` + `WIKIDATA_QNUMBER_MANON` référencés uniquement dans le helper + son test + 2 docs `_AUDIT/SPRINT-V7-FINAL/*.md`. Optionnels (pas de Zod schema, pas dans `env.ts`). Fallback = string undefined → array vide.
- **Tests** : 7/7 verts revendiqués (W1-W7). Cohérent avec le fichier spec lu.

## Verdict / écarts trouvés

**STUB-OK avec écart de wiring** :

1. Helper créé et correctement défensif (fallback safe verbatim).
2. Tests présents et alignés avec l'API exposée.
3. **Écart** : la phrase claim « Phase 10 Sprint v7 — renforce signal d'autorité Person/Organization via liens sameAs Wikidata pour triangulation Google Knowledge Panel » implique un wiring JSON-LD. Or **aucun JSON-LD producer ne consomme le helper** (`buildOrganizationJsonLd`, `buildLocalBusinessJsonLd`, `AuthorByline`, JSON-LD persona Manon — tous orphelins du helper).
4. Conséquence concrète : tant que `withSameAs("axionia")` / `withSameAs("manon")` ne sont pas spreadés dans au moins 1 schema Organization/Person rendu côté pages, **Google Knowledge Panel ne reçoit aucun signal Wikidata** — même si Will configure les env vars en Coolify.
5. Les 2 fichiers touchés (`page.tsx`, `transversal.ts`) sont du bruit prettier (probable side-effect de pre-commit hook), pas un wiring fonctionnel.

**Effort résiduel pour passer en PROD effectif** : ~15-30 min — spread `...withSameAs("axionia")` dans le schema `Organization`/`LocalBusiness` de `src/lib/seo.ts:buildLocalBusinessJsonLd` (et idem `...withSameAs("manon")` dans `AuthorByline.tsx`).

**Risque de régression actuel** : nul (helper inerte tant que non-importé).
