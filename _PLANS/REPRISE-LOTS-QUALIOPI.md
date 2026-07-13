# ⏸️ REPRISE — Chantier conformité Qualiopi + pilotage (6 lots) — PAUSE 2026-07-13

## Comment reprendre

- **Worktree** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-lots`
- **Branche** : `feat/qualiopi-conformite-pilotage` (base `bce5be83` = main avec hub facturation #314)
- **Plan complet** : `_PLANS/PLAN-CONFORMITE-PILOTAGE-2026-07-13.md`
- **Suivi détaillé** : `_PLANS/LOTS-CONFORMITE-STATE.md`
- **Machine 8 Go** : vitest `--maxWorkers=2`, typecheck `NODE_OPTIONS=--max-old-space-size=6144 pnpm typecheck`, JAMAIS `pnpm build` local.
- **Modèle demandé par Will** : implémenter en **Opus** (agents lancés en Opus explicite). Lot 4 avait été fait en Fable puis relu.
- Jonction `node_modules` = lien vers `../axionia/node_modules` — la RETIRER avant tout `git worktree remove`.

## État des lots

- ✅ **Lot 1** committé `5eca12f2` — questionnaires auto + alerte session sans formateur.
- ✅ **Lot 2** committé `128cfb94` — moyens pédagogiques, PDF registres, CV formateur, fiche adaptation, ind.29.
- ✅ **Lot 3** committé `7fd2563b` — pont appel/contact → CRM (entrées récentes + conversion 1 clic).
- 🔄 **Lot 4 EN COURS — DANS LE WORKING TREE, NON COMMITÉ** (pilotage réel). Un agent background
  (`ad8c0a53d7ec3157a`) le terminait au moment de la pause. Fichiers déjà présents :
  - Migration `prisma/migrations/20260713000003_incidents/` (modèle Incident).
  - Créés : `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/incidents/`, `IncidentForm.tsx`,
    `IncidentRowActions.tsx`, `ReporterEnRevueButton.tsx`, `CsvExportButton.tsx`,
    `src/server/actions/qualiopi/incidents.ts`, `src/server/qualiopi/registres/incidents-service.ts`,
    `src/server/qualiopi/satisfaction/synthese-service.ts`.
  - Modifiés : `pilotage-service.ts`, page pilotage, page indicateurs, `exports-pdf.ts`,
    `revue-direction.ts` + service, `catalogue.ts`, `evaluateur.ts`, `registry.ts`,
    `registres-pdf.ts`, `admin-nav.ts` + test.
  - **À FAIRE au redémarrage** : vérifier si l'agent a fini (git status), relire le diff,
    GATE (vitest `src/server/qualiopi src/server/actions/qualiopi --maxWorkers=2` + typecheck 6G
    + `prisma validate` + BOM check migration 000003), prettier --write, PUIS committer Lot 4.
- ⏳ **Lot 5** — Barèmes OPCO versionnés (structure vide, valeurs saisies par Will). Lancer en Opus.
- ⏳ **Lot 6** — SessionFormateur + commissions (cf. mémoire `cockpit-pilotage-formateurs-plan`). Opus.
- ⏳ **Vérif finale** — verify:all, revue adversariale multi-agents du diff complet, croisement
  matrice 22 indicateurs, prettier, PUSH branche + PR (JAMAIS merge sans gates verts ; push = deploy).

## Décisions / attente Will (hors code)

- Données légales Config Qualiopi : « je les mettrai plus tard ».
- STOP & ASK à trancher : CGV formation (SIREN/legal_overrides), EDOF oui/non, ind.29 auprès du
  certificateur, valeurs barèmes OPCO (Lot 5), barèmes commissions formateurs (Lot 6).

## Livrables déjà produits pour Will (hors code, à relire)

- `_EXPORT-FORMATIONS-2026-07-13/` — 17 fiches formations en Markdown.
- `_DOSSIER-FORMATIONS-2026-07-13/` — 17 fiches en PDF + `00-SPECIMENS/` (21 documents Qualiopi
  en PDF avec données fictives).

## PHRASE DE REPRISE (à copier au début de la prochaine conversation)

> Reprends le chantier conformité Qualiopi + pilotage. Lis
> `axionia-wt-lots/_PLANS/REPRISE-LOTS-QUALIOPI.md` et `_PLANS/LOTS-CONFORMITE-STATE.md`,
> vérifie l'état du worktree `feat/qualiopi-conformite-pilotage`, termine et committe le Lot 4
> (pilotage, déjà dans le working tree), puis enchaîne les Lots 5 et 6 en Opus, et finis par la
> vérification adversariale end-to-end avant la PR. Modèle : Opus. Machine 8 Go (vitest
> --maxWorkers=2, pas de build local).
