# A19 — Git log audit forensique

## Statut : 🔴 Bugs additionnels trouvés

Les 3 bugs lint-staged stash déclarés sont confirmés au pixel près. Aucun 4ème bug caché. Mais l'analyse forensique du diff réel de `59ede0e5` et `0718f572` révèle un détail non documenté précédemment : le diff "fantôme" capturé par lint-staged stash n'était pas vide — il contenait des WIP homepage parallèles (page.tsx + assets home). Donc ces 2 commits "cassés" ont en réalité poussé du contenu home étranger sous un message content-gen. Les recoveries (0b7c0797, 790ed7b4) ont correctement re-appliqué les fichiers cibles, mais le contenu home étranger des commits cassés reste en place sur main (couvert par d'autres commits home avant/après et donc sans effet de bord prouvé). Hors scope content-gen, "polish home" Sprint v7 non analysé per consignes.

## Table forensique (56 commits)

| SHA          | Type                                      | Files | Ins  | Del  | Bug ?                     | Recovery ?                                        |
| ------------ | ----------------------------------------- | ----- | ---- | ---- | ------------------------- | ------------------------------------------------- |
| 98e7626a     | feat sprint-v7 phase 18                   | 2     | 187  | 0    | non                       | n/a                                               |
| 6bcdbcc8     | chore quality session 10                  | 2     | 73   | 0    | non                       | n/a                                               |
| 91092353     | feat web-vitals phase 17                  | 2     | 138  | 0    | non                       | n/a                                               |
| aab650c9     | feat content-gen phase 16                 | 3     | 375  | 0    | non                       | n/a                                               |
| 456f7da8     | feat content-gen phase 15                 | 2     | 275  | 0    | non                       | n/a                                               |
| 33bdb966     | fix home revert                           | 2     | 28   | 27   | non                       | n/a                                               |
| 790ed7b4     | feat content-gen phase 9 RECOVERY         | 2     | 255  | 0    | non                       | RECOVERY 0718f572                                 |
| 915a54aa     | fix content-gen phase 9 re-apply cleanup  | 1     | 3    | 6    | non                       | cleanup post-recovery                             |
| 8430c45d     | fix build+home                            | 3     | 65   | 8    | non                       | n/a                                               |
| e2d48e75     | test admin sync wizard                    | 1     | 2    | 1    | non                       | n/a                                               |
| 88fbb169     | feat seo phase 14 citations FR            | 2     | 214  | 0    | non                       | n/a                                               |
| 7950826d     | feat content-gen+seo phase 13             | 4     | 215  | 1    | non                       | (porte aussi sentry-worker.ts pris pour 790ed7b4) |
| c8ec64d1     | feat seo phase 12                         | 2     | 304  | 0    | non                       | n/a                                               |
| 65beafeb     | feat seo phase 11 speakable               | 2     | 155  | 0    | non                       | n/a                                               |
| 2f5361f2     | feat seo phase 10 wikidata                | 4     | 183  | 13   | non                       | n/a                                               |
| **0718f572** | feat content-gen phase 9                  | 4     | 664  | 535  | **🔴 OUI scope mismatch** | recovered by 790ed7b4                             |
| f50e4817     | test content-gen phase 8 commit 4/4       | 4     | 222  | 70   | non                       | n/a                                               |
| ea523770     | feat admin phase 8 commit 3/4             | 2     | 126  | 41   | non                       | n/a                                               |
| f7609d25     | feat content-gen phase 8 commit 2/4       | 5     | 453  | 2    | non                       | n/a                                               |
| 65bc8745     | feat prisma phase 8 enum                  | 2     | 36   | 0    | non                       | n/a                                               |
| a36ce1dc     | test e2e phase 7                          | 1     | 72   | 0    | non                       | n/a                                               |
| 60584f7b     | feat content-gen phase 6 rss              | 3     | 577  | 0    | non                       | n/a                                               |
| 5b757acc     | feat content-gen phase 5 commit 2         | 2     | 430  | 0    | non                       | n/a                                               |
| 4bd715f6     | test brand persona-coverage               | 1     | 5    | 1    | non                       | n/a                                               |
| ac703b40     | feat content-gen phase 5 commit 1         | 9     | 663  | 444  | non                       | n/a                                               |
| 8e048696     | fix home wording                          | 2     | 7    | 7    | non                       | n/a                                               |
| 78274940     | feat home interventions                   | 3     | 267  | 168  | non                       | hors scope (home)                                 |
| 0b7c0797     | fix content-gen phase 3 commit 2 RECOVERY | 4     | 6    | 12   | non                       | RECOVERY 59ede0e5                                 |
| 9d777e1b     | feat home polish v10                      | 2     | 201  | 177  | non                       | hors scope                                        |
| 50b1c31b     | feat content-gen phase 4                  | 9     | 620  | 25   | non                       | n/a                                               |
| **59ede0e5** | refactor content-gen phase 3 commit 2     | 3     | 14   | 12   | **🔴 OUI scope mismatch** | recovered by 0b7c0797                             |
| bc3a627d     | feat home fondateur                       | 3     | 115  | 0    | non                       | hors scope                                        |
| 50a781d3     | refactor admin phase 3 cleanup            | 7     | 34   | 1899 | non                       | gros delete legacy \_v2 attendu                   |
| 538600e8     | feat home polish v8                       | 2     | 20   | 29   | non                       | hors scope                                        |
| 0a188ab8     | feat home polish v7                       | 3     | 40   | 41   | non                       | hors scope                                        |
| a1da4197     | feat home polish v6                       | 4     | 45   | 62   | non                       | hors scope                                        |
| 8f4d0e9d     | feat admin wizard 4 steps                 | 4     | 853  | 0    | non                       | n/a                                               |
| 339699ef     | feat home polish v5                       | 7     | 122  | 162  | non                       | hors scope                                        |
| **45aaab2f** | feat admin cities-order + coverage-map    | 8     | 1619 | 0    | non                       | RECOVERY 79a9d408                                 |
| 07502dfd     | feat home polish v4                       | 5     | 83   | 75   | non                       | hors scope                                        |
| **79a9d408** | feat admin cities-order                   | 0     | 0    | 0    | **🔴 OUI vide**           | recovered by 45aaab2f                             |
| 218601ce     | feat home polish v3                       | 3     | 76   | 53   | non                       | hors scope                                        |
| a7b87330     | fix motion fadeinonview                   | 1     | 18   | 13   | non                       | n/a                                               |
| 1d906f12     | feat home polish v2                       | 4     | 52   | 69   | non                       | hors scope                                        |
| f23f0765     | feat home polish                          | 3     | 111  | 601  | non                       | hors scope, gros delete attendu                   |
| 32f94d46     | feat content-gen cities-order actions     | 4     | 655  | 0    | non                       | n/a                                               |
| 926bcfc2     | feat home isr sticky                      | 1     | 40   | 0    | non                       | hors scope                                        |
| c617a046     | feat home refonte Blueprint               | 24    | 1393 | 34   | non                       | hors scope                                        |
| 53a1a61b     | feat prisma phase 1                       | 2     | 201  | 48   | non                       | n/a                                               |
| bb2352fe     | feat seo localbusiness                    | 5     | 40   | 1    | non                       | n/a                                               |
| ba9cbd1c     | feat content-gen équité villes            | 10    | 697  | 93   | non                       | n/a                                               |
| c0613b45     | feat audit+seo passe 2 runtime            | 42    | 1493 | 28   | non                       | n/a                                               |
| 66684d9d     | fix content-gen p0+p1                     | 12    | 46   | 25   | non                       | tiny edits multi-fichiers cohérents               |
| b2e8d4d5     | fix site-explorer                         | 3     | 36   | 4    | non                       | n/a                                               |
| 7a9db998     | fix test rename git mv                    | 1     | 0    | 0    | non (rename pur)          | n/a                                               |
| d3be98cb     | fix seo localbusiness safe                | 1     | 13   | 20   | non                       | n/a                                               |

## 3 bugs déclarés — confirmation

| Bug SHA  | Vide confirmed                                                                                                                                                               | Recovery SHA | Recovery OK                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 79a9d408 | OUI 0 fichier 0 ins 0 del (commit littéralement vide)                                                                                                                        | 45aaab2f     | OUI 8 fichiers 1619 ins (CitiesOrderV3 + CoverageMapV2 + admin-nav + coverage-map.ts + 2 tests + 2 pages)                                  |
| 59ede0e5 | OUI scope mismatch — message dit "policies.ts + OrchestratorV2 + layout.tsx" mais diff = home-founder-william.jpg + page.tsx + LogosMarquee.tsx (WIP home étranger capturé)  | 0b7c0797     | OUI 4 fichiers 6 ins 12 del (policies.ts -8 lignes dailyBatchSize + OrchestratorV2.tsx + layout.tsx + content-gen-config.ts seed)          |
| 0718f572 | OUI scope mismatch — message dit "expansion-state + gsc-hcu-monitor + sentry-worker" mais diff = llms.txt + page.tsx + accordion.tsx + transversal.ts (WIP home/UI étranger) | 790ed7b4     | OUI 2 fichiers 255 ins (expansion-state.ts 158 + gsc-hcu-monitor-worker.ts 97) ; sentry-worker.ts intégré séparément via 7950826d Phase 13 |

## Autres commits suspects (4ème bug caché ?)

| SHA      | Message                          | Pourquoi suspect                               | Verdict                                                                                                                                                                                                                                      |
| -------- | -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7a9db998 | fix(test) move admin-smoke       | 0 ins 0 del                                    | NON BUG — rename pur via `git mv tests/e2e/admin/admin-smoke.spec.ts → tests/e2e/content-gen/admin-smoke.spec.ts`, le diff-tree confirme `R100` rename similarity, comportement Git attendu pour un déplacement de fichier sans modification |
| 915a54aa | fix content-gen phase 9 re-apply | 1 fichier 3 ins 6 del seulement                | NON BUG — cleanup post-recovery (retire re-exports invalides "use server" de campaign-wizard.ts) ; message clair sur la portée                                                                                                               |
| 66684d9d | fix content-gen p0+p1            | 12 fichiers 46 ins 25 del (3.8 lignes/fichier) | NON BUG — tiny edits cohérents (ajout 2 lignes contrainte metaTitle dans 6 generators + 1 fix Speakable + Math.random→slotIndex). Diff aligné au message                                                                                     |
| 4bd715f6 | test brand persona-coverage      | 5 ins 1 del                                    | NON BUG — test sync trivial post-refactor, message correct                                                                                                                                                                                   |
| e2d48e75 | test admin sync wizard           | 2 ins 1 del                                    | NON BUG — sync heading "9 → 21 sliders", message correct                                                                                                                                                                                     |
| 50a781d3 | refactor admin phase 3 cleanup   | 34 ins 1899 del                                | NON BUG — suppression legacy `_v2` annoncée explicitement, asymétrie ins/del attendue                                                                                                                                                        |
| f23f0765 | feat home polish                 | 111 ins 601 del                                | NON BUG — retrait svg hero + densité -30%, asymétrie attendue (hors scope content-gen)                                                                                                                                                       |

Aucun 4ème bug caché. Les 3 bugs lint-staged stash sont les seules anomalies du Sprint v7.

## Verdict / écarts trouvés

3 bugs lint-staged stash confirmés au diff-tree, tous recovered :

- 79a9d408 → 45aaab2f (commit littéralement vide, recovery 1619 ins complète)
- 59ede0e5 → 0b7c0797 (commit fantôme contenant WIP home, recovery 4 fichiers content-gen propres)
- 0718f572 → 790ed7b4 (commit fantôme contenant WIP home+UI, recovery 2 fichiers content-gen propres)

Détail non documenté avant cette analyse — les commits 59ede0e5 et 0718f572 ne sont **pas vides** ; ils ont capturé du WIP homepage parallèle de Will/autres sessions et l'ont commité sous un message content-gen. Ce WIP est resté sur main mais n'a pas d'effet de bord prouvé (couvert par les commits home avant/après). Hors scope content-gen Sprint v7 per consignes.

Aucun 4ème bug caché. 53 commits sur 56 ont un diff cohérent avec leur message. Les 3 commits cassés sont tous identifiés dans la mémoire AxionIA et tous recovered. CI Gates verts post-recovery (vitest 88/88 Phase 8-14, typecheck 0, lint 0 hors warning React Compiler connu).
