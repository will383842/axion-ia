# 99 — ÉTAT DU CHANTIER DE FIXES (mis à jour 2026-08-15)

Suivi de l'application des patches. **Aucun merge dans `main`** — les branches
s'empilent pour une fusion en lot décidée par Will.

## Tableau de bord

| Lot | Branche | Commit local | Poussé | PR | Bloqué par |
|---|---|---|---|---|---|
| 1 (warm + gates) | `fix/geo-warm-gates-fenetre-stub` | ✅ `9feb2efe` | ❌ | ❌ | **RAM** (pre-push) |
| 2 (fenêtre stub) | même branche | ❌ non écrit | — | — | à implémenter |
| 3 (liens morts) | `fix/geo-liens-internes-morts` | ❌ | — | — | RAM + crédits |
| 4 (ingestion IA) | `fix/geo-canaux-ingestion-ia` | ❌ | — | — | RAM + crédits |
| 5 (hreflang) | `fix/geo-hreflang-canonical-marque` | ❌ | — | — | RAM + crédits |
| 6 (poids mort) | `fix/geo-poids-mort-rendu` | ❌ | — | — | RAM + crédits |

Le travail des lots 3 à 6 est **écrit et intact** dans
`axionia/.claude/worktrees/wf_6b9bfd4a-93b-{2,3,4,5}`, non commité.

## Deux blocages machine (ni l'un ni l'autre n'est un défaut de code)

1. **RAM** — le hook `pre-push` lance la suite complète (593 fichiers) et meurt
   en « Worker exited unexpectedly ». Mesure du 2026-07-31 : il faut **~6,5 Go
   libres** ; relevés du 15/08 : 3,0 Go puis **0,5 Go** (Chrome 28 instances
   2,06 Go, Claude 1,93 Go, VS Code 20 instances 1,78 Go). ➡️ Fermer Chrome et
   les VS Code superflus, puis repousser. Ne PAS contourner par `--no-verify` :
   ce hook a déjà attrapé 6 erreurs de typage laissées par un agent.
2. **Crédits d'usage épuisés** — aucun sous-agent ne démarre (10 agents tués sur
   deux tentatives). Les lots restants doivent être finalisés séquentiellement à
   la main, ~20 min chacun (install + prisma generate + typecheck + tests +
   commit) au lieu de 5 en parallèle.

## Revue faite à la main (session principale) — lots 3 à 6

Ce que la revue a vérifié sans rien exécuter de lourd :

- **LOT 4 / `robots.ts`** ✅ — `Allow: /api/og` **intact** (l.121 de la liste
  `COMMON_ALLOW`), invariant préservé. Les deux entrées Observatoire sont
  ajoutées en **forme étroite** (`export-csv`, `export-json`) et non par préfixe
  `/api/observatoire/` — choix explicitement justifié en commentaire pour ne pas
  pré-autoriser une future route d'écriture sous ce dossier. Bon réflexe.
- **LOT 5 / `routing.ts`** ✅ sur le fond — la correction est bien
  `alternateLinks: false`, et `locales` reste `["fr", "en"]` (l.13). La fausse
  correction (retirer `en`) est explicitement écartée en commentaire.
- 🔴 **LOT 5 / défaut trouvé par la revue** — le commentaire annonçait
  « Garde : `src/i18n/__tests__/alternate-links-header.spec.ts` » alors que
  **le dossier `__tests__` n'existait pas** et que le lot ne portait
  **aucun test**. Un commentaire qui promet une garde inexistante, c'est très
  exactement le diagnostic n°1 de cet audit reproduit dans son propre correctif.
  ➡️ **Corrigé** : le fichier a été écrit (3 assertions — `alternateLinks: false`
  présent, `en` toujours dans `locales`, `fr` par défaut), il reste à l'exécuter
  quand la machine le permettra.
- **LOT 3** — 9 fichiers, +119/−26, tests ajoutés dans
  `en-to-fr-redirect.test.ts` (+36). Non encore relu en détail.
- **LOT 6** — 2 fichiers + 2 specs neufs. Non encore relu en détail.

## Reste à faire, dans l'ordre

1. Libérer la RAM → pousser le lot 1 → ouvrir sa PR.
2. Implémenter le **lot 2** (variante G3 : déplacer revalidate + purge à la fin
   du job `deploy`) sur la même branche, en second commit. ⚠️ Ne PAS retenir la
   variante G1 (`lhci: needs: [deploy, warm]`) : elle désarme le seul gate
   bloquant dès qu'un `warm` est annulé, et ne couvre pas `indexnow`.
3. Finaliser les lots 3, 4, 5, 6 (revue → typecheck → tests → commit → push → PR).
4. Vagues 2 et 3 (lots 7 à 20) — voir `01-PLAN-PATCHES.md`.
5. Jamais sans Will : lots 10, 21, 22, 23 (ADR), les 16 arbitrages du §3,
   GEO-075 (gelé), et tout `03-RESTE-WILL.md`.
