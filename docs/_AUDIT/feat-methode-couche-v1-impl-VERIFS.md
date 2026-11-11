# Vérifications locales — `feat/methode-couche-v1-impl` (2026-11-11)

Branche neuve : `feat/methode-couche-v1` a été poussée en parallèle par une autre session
(commit `2dea98f0`, ADR seul) ; pas de force-push, ce travail vit donc ici.

Ordre de Williams du 11/11 (18 h 45) : CI saturée, aucune PR ouverte. Les contrôles que la
CI ferait sur ce périmètre ont été lancés à la main, sur la branche partie de `origin/main`
(`5260eeec`).

| Contrôle | Commande | Résultat |
| --- | --- | --- |
| Tests ciblés (méthode + MCP + route MCP) | `pnpm exec vitest run src/app/api/mcp src/server/mcp src/server/methode` | ✅ 6 fichiers, **69/69** |
| Tests voisins (content-gen + gardes CI env) | `pnpm exec vitest run tests/unit/ci/origine-de-prod-jamais-en-repli.spec.ts tests/unit/ci/le-circuit-visio-n-ajoute-aucune-cle-d-ia.spec.ts tests/unit/ci/gardes-isolation-sont-appelees.spec.ts src/server/content-gen/__tests__` | ✅ 21 fichiers, **219/219** |
| Types | `pnpm exec tsc --noEmit` | ✅ code de sortie 0, aucune erreur (2 min 55 s) |
| ESLint, fichiers touchés | `pnpm exec eslint <fichiers touchés>` | ✅ 0 erreur ; 15 avertissements `no-console`, **tous déjà présents sur `main`** dans `harnais.spec.ts` et `appel-et-journal.spec.ts` (vérifié sur la version de `main`) ; 0 sur les fichiers neufs |
| Prettier, fichiers touchés | `pnpm exec prettier --check <fichiers touchés>` | ✅ « All matched files use Prettier code style! » |
| Manifeste MCP | `pnpm mcp:manifeste` puis `prettier --write` | ✅ régénéré (`manifestSha` `sha256:8e20760f…`, 28 050 octets canoniques) ; `manifeste.spec.ts` vert |
| Jeu maximal MCP | `pnpm mcp:fixtures` | ✅ `fixtures/methode-contexte.max.json` ; les 4 autres jeux réécrits seulement au formatage ont été restaurés |
| Essai à blanc de l'import | `pnpm tsx scripts/methode/importer-methode.ts <copie methode/>` (sans `DATABASE_URL`) | ✅ 356 fiches : 278 `methode-vente`, 78 `methode-secteur-sante`, 120 `chiffres-exercice`, 18 `doctrine:a-revoir` ; « rien n'a été écrit » |

Non lancés, volontairement : la suite complète `src/server/qualiopi` (consigne), l'import
`--ecrire` (aucune base réelle), le build Next (aucune route ni page touchée).

Note : `pnpm mcp:manifeste` / `mcp:fixtures` écrivent leur fichier puis ne rendent pas la
main (connexion BullMQ/Redis ouverte par le registre, Redis absent en local) ; le fichier
est complet, il faut seulement couper le processus.

## Hook pre-push (suite vitest complète)

Premier passage (avant correctif) : 16 875 réussis, **2 échecs**, tous deux dans
`src/app/api/mcp/__tests__/route.test.ts` (la route listait encore sept outils). Corrigé
(huit outils, `axionia.methode.contexte` inclus) ; le résultat du second passage est celui
du push de cette branche.
