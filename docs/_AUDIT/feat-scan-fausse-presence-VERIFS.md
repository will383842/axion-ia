# Vérifications — feat/scan-fausse-presence (2026-11-11)

Faites en local (CI saturée, aucune PR ouverte).

| Commande | Résultat |
| --- | --- |
| `pnpm exec vitest run tests/unit/content/scan-fausse-presence.spec.ts` | 1 fichier, 22 tests passés (10 phrases fautives, 10 saines, CSV, A_VERIFIER) |
| `pnpm exec eslint scripts/villes/scan-fausse-presence.ts tests/unit/content/scan-fausse-presence.spec.ts` | 0 erreur, 0 avertissement |
| `pnpm exec prettier --check` (mêmes fichiers) | conforme |
| `pnpm exec tsc --noEmit` | 4244 lignes d'erreurs, **toutes hors périmètre** (client Prisma non généré : l'installation a été faite avec `--ignore-scripts`) ; **0 erreur** mentionnant `scan-fausse-presence` |
| Scan `origin/main` (2159 fichiers) | 2937 détections : 1720 FAUTIF, 1217 A_VERIFIER |
| Scan `origin/feat/v3-villes-lot-2` (2159 fichiers) | 2893 détections : 1724 FAUTIF, 1169 A_VERIFIER |

Aucun fichier de `src/content/villes/copy/**` ni `villes-consultants-viennent-de.spec.ts` touché. Détail par motif : `scan-fausse-presence-RESUME-2026-11-11.md`.
