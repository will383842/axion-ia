# feat/methode-couche-v1 — vérifications locales (2026-11-11)

Règle CI du 11/11 (CI GitHub saturée) : **aucune PR ouverte**, branche neuve poussée seule.
Les vérifications que la CI ferait sur ce périmètre ont été rejouées dans la routine.
Base : `origin/main` @ `506f3a37`. Dépendances : `pnpm install --frozen-lockfile
--ignore-scripts`, puis `pnpm exec prisma generate`. Les crochets git (husky) n'étaient pas
installés dans ce clone : aucun `--no-verify` utilisé, mais les contrôles du crochet ont été
lancés à la main (ci-dessous).

## Résultats

| Commande                                                                                                          | Résultat                         |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `pnpm exec tsc --noEmit -p tsconfig.json`                                                                         | ✅ 0 erreur                       |
| `pnpm exec vitest run src/server/methode`                                                                         | ✅ 26 / 26                        |
| `pnpm exec vitest run src/server/mcp src/app/api/mcp`                                                             | ✅ 51 / 51 (5 fichiers)           |
| `pnpm exec vitest run src/server/content-gen/__tests__`                                                           | ✅ 204 / 204 (18 fichiers)        |
| `pnpm exec vitest run tests/unit/ci` + gardes de prix (`no-hardcoded-prices`, `prix-dits-par-l-ia`, `prix-pages-publiques`, `canaux-machine-sans-prix`) | ✅ 679 passés, 8 ignorés (113 fichiers) |
| `pnpm exec eslint` sur les fichiers touchés                                                                       | ✅ 0 erreur (avertissements `no-console` préexistants dans les tests MCP) |
| `pnpm exec prettier --check` sur les fichiers touchés                                                             | ✅                                |
| `pnpm zod:check`, `anti-siren:check`, `anti-hex:check`, `use-client:check`, `i18n:check`, `qualiopi:isolation-check`, `image-bank:isolation-check` | ✅ code 0 pour chacun |
| `pnpm mcp:manifeste` (via `tsx scripts/mcp/ecrire-manifeste.ts`)                                                  | ✅ manifeste régénéré (8 outils) ; le processus ne rend pas la main faute de Redis local (connexion BullMQ en boucle, préexistant), arrêté après écriture |
| `pnpm mcp:fixtures`                                                                                               | ✅ jeu `methode-contexte.max.json` écrit ; les 4 autres jeux réécrits seulement en mise en forme ont été restaurés |

Suite `src/server/qualiopi` : **non lancée** (consigne).

## Essai à blanc de l'import (aucune base)

```
pnpm exec tsx scripts/methode/importer-methode.ts <copie axion-brand>/methode --detail
[methode] 276 fiche(s) découpée(s)
[methode]   methode-vente : 242
[methode]   methode-secteur-sante : 34
[methode]   étiquetées chiffres-exercice : 122
[methode] ESSAI À BLANC : rien n'a été écrit. Ajouter --ecrire pour écrire.
```

Source : `will383842/axion-brand`, branche `methode/livres-2026-11-11`, dossier `methode/`.
**L'import n'a jamais été exécuté contre une base** (ni locale, ni production).

## Limites connues

- Découpage heuristique des extraits PDF : quelques sections se rattachent à la précédente
  (ex. `fiche-deroule-audit` : sections 1, 2 et 4 non isolées). Le contenu n'est pas perdu.
  Relire `--detail` avant `--ecrire`.
- content-gen ne contient aujourd'hui aucun générateur de mail, d'offre ou de script :
  l'injecteur `injecterMethodeDansPromptSysteme` est livré et testé, mais branché sur aucun
  générateur (les générateurs actuels produisent des pages publiques).
