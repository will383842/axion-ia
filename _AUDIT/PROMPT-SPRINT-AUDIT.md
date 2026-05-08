# 🧾 PROMPT SPRINT-AUDIT — Axion-IA · Croisement DoD attendue / déclarée / réelle

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** : Sprints 14.5-14.9 sont commités/pushés (pas working copy). HEAD `fd91518`, 1 commit ahead `origin/main`.
>
> Version 1.1 · 2026-05-06 (soir) — intègre Sprint 14.5 « Pivot doctrinal v3 » (ADR 0002).
> À lancer **immédiatement après livraison du Sprint 14.5** (post-pivot v3 commité), avant `04-frontend-final-audit.md`, `FRONTEND-DEEP-CHECK`, `VERIFICATION-FINALE Pass A`.
> Peut être relancé après n'importe quel sprint pour audit point-in-time.
>
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> Sortie : `_AUDIT/05-sprint-audit.md` + 3 annexes (par tranche de sprints) + `_AUDIT/05-sprint-audit-deltas.json` (machine-readable).
>
> ⚠️ **Doctrine de référence** : pour les Sprints **0-14 historiques** (commits `f52a2b4` → `f2ea1e6`), la DoD attendue reste **v1 Webflow** (ADR 0001). Pour le **Sprint 14.5 Pivot doctrinal v3** (commit dédié à venir) et les Sprints 15+ à venir, la DoD attendue est **v3 Editorial Premium Light** (ADR 0002, supersedes 0001). Cette dichotomie est intentionnelle pour préserver la traçabilité des sprints historiques.

---

## RÔLE

Tu es **auditeur de conformité contractuelle**. Ton job n'est **pas** de tester la qualité globale (Lighthouse, axe, etc. — c'est le rôle des 3 audits suivants). Ton job est exclusivement de **croiser ligne à ligne** :

1. **DoD attendue** — ce que `_AUDIT/PROMPT-CODAGE.md` exige sprint-par-sprint.
2. **DoD déclarée** — ce que `axionia/SESSION_LOG.md` + `axionia_progress.md` mémoire prétendent avoir livré.
3. **DoD réelle** — ce que `git show <commit>` + état actuel du repo prouve.

Et de produire un tableau d'écarts **par sprint, par critère**, avec verdict P0/P1/P2 par écart.

**Posture** : comptable, factuel, zéro indulgence. Si la DoD du Sprint 3 dit « 22 atoms livrés » et que le diff en montre 21, c'est un écart même si « ça marche en surface ».

---

## SOURCES DE VÉRITÉ

1. `_AUDIT/PROMPT-CODAGE.md` — DoD attendue par sprint (sections `SPRINT 0` à `SPRINT 14`).
2. `axionia/SESSION_LOG.md` — DoD déclarée livrée par sprint.
3. `git log --oneline` + `git show <commit>` — état réel des commits par sprint.
4. `_AUDIT/02-PLAN.md` — jalons M1→M11 et estimations.
5. `_AUDIT/02b-mapping-pages.md` — 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) (référence completeness).
6. `axionia/CHANGELOG.md` — **pas encore créé HEAD** (à initialiser Sprint 21). Pour Sprints 0-14, fallback : `SESSION_LOG.md` + `git log`.
7. `axionia/package.json` — stack verrouillée (Next 16.2.4, Auth.js v5 beta, etc.).
8. `axionia/.github/workflows/*.yml` — gates CI configurés.
9. `axionia/docs/adr/*.md` — ADR créés en cours de route (au moins ADR 0001 design).
10. Skills `axionia-*` (18) — règles attendues dans le code.
11. Mémoire utilisateur `axionia_progress.md` — ne pas confondre avec source de vérité, à utiliser comme indice secondaire.

---

## RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. Sauf STOP & ASK final.
2. **Lecture seule** — aucune modification du code, aucun commit. Cet audit ne corrige pas, il diagnostique.
3. **Citations obligatoires** — pour chaque finding : fichier:ligne attendue (PROMPT-CODAGE), commit hash réel, fichier:ligne du repo le cas échéant.
4. **Verdict tri-état par critère** : ✅ conforme · ⚠️ partiel (écart documenté + livré quand même) · ❌ manquant.
5. **Priorisation des écarts** :
   - **P0** — critère DoD non satisfait + non documenté dans SESSION_LOG (= dette cachée).
   - **P1** — critère DoD non satisfait mais documenté comme report explicite dans SESSION_LOG (= dette assumée à statuer).
   - **P2** — divergence mineure non bloquante (renommage, alternative équivalente).
6. **Aucune commande destructive** — `git log`, `git show`, `git diff`, `git ls-tree`, `pnpm ls`, `cat` autorisés ; `git reset`, `git rebase`, `git push`, modifications fichiers interdits.
7. **Cohérence mémoire ↔ repo** — si `axionia_progress.md` (mémoire) déclare un sprint livré mais aucun commit ne le porte → P0 conflit.

---

## DISPATCH MULTI-AGENTS (1 message, 3 Agent calls en parallèle)

| Agent           | Subagent | Tranche                                                                                            | Mission                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGT-S0-S4**   | Explore  | Sprints 0 → 4 (toolchain + tokens + i18n + atoms + sections)                                       | Pour chaque sprint : extraire DoD du PROMPT-CODAGE, lire entrée SESSION_LOG, lire `git show <commit>`, croiser → tableau Annexe A.                                                                                                                                                                                                                                                                                                                                                                         |
| **AGT-S5-S9**   | Explore  | Sprints 5 → 9 (3 modules produits + cas concrets + 5 transversales)                                | Idem → Annexe B. Vérifier mapping content/\*.ts attendu vs livré.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **AGT-S10-S14** | Explore  | Sprints 10 → 14 + 14.5 (légales + calendrier + ROI + forms + système/SEO + **pivot doctrinal v3**) | Idem → Annexe C. Spécial Sprint 14 : pages système (404/500/maintenance) + sitemap dynamique + llms.txt + IndexNow. **Spécial Sprint 14.5** : ADR 0002 présent, Design.md v3 présent, globals.css v3 (palette ivoire/sand/mocha/terracotta/sage, 3 polices Manrope/Fraunces/Inconsolata, type scale display 7rem, radius xl/2xl, shadows ton chaud `rgba(42,37,32,…)`, halos), 0 noir pur, 0 `bg-white` natif, Fraunces chargée, signature `em.editorial` rendue, baselines visual regression re-générées. |

L'agent principal pendant ce temps exécute les chapitres **transverses** ci-dessous (gates CI, ADR, deps, SESSION_LOG cohérence, mapping pages, contradictions Phase 0).

À la fin, l'agent principal **agrège** les 3 annexes + ses chapitres transverses dans `_AUDIT/05-sprint-audit.md` avec :

- **Tableau récap global** : 1 ligne par sprint × colonnes [DoD attendue / Déclarée / Réelle / Écarts P0 / P1 / P2 / Verdict].
- **Liste plate des P0** (action immédiate).
- **Verdict GO/NO-GO** pour enchaîner les 3 audits suivants.

---

## MÉTHODE PAR SPRINT (template à appliquer × 15)

Pour chaque sprint **N** ∈ {0..14} :

### Étape 1 — Extraire la DoD attendue

- Localiser dans `_AUDIT/PROMPT-CODAGE.md` la section `### SPRINT N` (ou MID-SPRINT CHECKPOINT précédent).
- Lister chaque critère DoD numéroté.
- Lister chaque fichier/composant nommément exigé.
- Lister chaque test exigé.
- Lister chaque skill devant être chargé.

### Étape 2 — Extraire la DoD déclarée

- Lire `axionia/SESSION_LOG.md` section Sprint N.
- Extraire : commit hash, date, liste des livrables annoncés, reports explicites, écarts assumés.
- Vérifier cohérence avec `axionia_progress.md` (si divergence → finding).

### Étape 3 — Extraire la DoD réelle

- `git show --stat <commit>` du sprint → liste des fichiers touchés.
- `git show <commit>:<file>` pour vérifier le contenu d'un fichier critique cité dans la DoD.
- `git ls-tree -r <commit>` pour confirmer présence d'artefacts attendus (scripts, ADR, tests, content).
- Si plusieurs commits couvrent un sprint, agréger leurs diffs.

### Étape 4 — Croiser

Tableau pour chaque sprint :

| #   | Critère DoD attendue | Déclaré SESSION_LOG | Réel git | Verdict  | Priorité |
| --- | -------------------- | ------------------- | -------- | -------- | -------- |
| 1   | …                    | …                   | …        | ✅/⚠️/❌ | P0/P1/P2 |

### Étape 5 — Vérifier exhaustivité des artefacts

Pour chaque sprint, lister explicitement :

- **Composants livrés** : nom de fichier, exporté, utilisé ailleurs (`grep import`).
- **Pages livrées** : route accessible (cf. `app/` structure), `generateMetadata` présent.
- **Tests livrés** : fichier `*.test.ts(x)` ou `*.spec.ts` correspondant à chaque module ajouté.
- **Content i18n** : si Sprint touche `messages/` ou `content/*.ts`, parité FR/EN.
- **ADR** : si décision technique structurelle prise, ADR `docs/adr/NNNN-*.md` existe.
- **Gates CI ajoutés** : si Sprint annonce un nouveau script (ex: `radius:check` Sprint 1, `contrast:check` Sprint 1), il existe dans `package.json` ET dans `.github/workflows/`.

---

## CHAPITRES TRANSVERSES (agent principal)

Ces vérifications ne sont pas attribuables à un sprint isolé — elles couvrent l'ensemble.

### T1. Cohérence SESSION_LOG ↔ git

- Chaque sprint déclaré livré dans SESSION_LOG a un commit identifiable.
- Chaque commit majeur a une entrée SESSION_LOG.
- Aucun commit « orphelin » (sans rattachement sprint) sauf hotfixes documentés.

### T2. Cohérence stack verrouillée

- `package.json` matche `_DECISIONS-FINALES.md` :
  - `next@16.2.4` (pas 15)
  - `next-auth@5.0.0-beta.31`
  - `next-intl@^4`
  - `motion@^11`
  - `react@^19.2`
  - Tailwind v4
  - Aucune occurrence : `resend`, `mailchimp`, `sendgrid`, `brevo`, `@stripe/*`, `paddle`, `@aws-sdk/*` (hors S3 si Hetzner Storage Box), `@vercel/*` autres que cli si présent.
- `pnpm ls` ≠ deps fantômes.

### T3. Gates CI exhaustifs (configurés dès Sprint 0)

- ~~`pnpm anti-formation:check` présent + invoqué en pre-commit + GitHub Action.~~ — **gate retiré** par ADR 0003 (lift formation ban, 2026-05-07). Plus aucun check `anti-formation` dans `verify:all` / pre-commit / Gate A CI.
- `pnpm anti-siren:check` idem.
- `pnpm anti-hex:check` idem.
- `pnpm use-client:check` idem.
- `pnpm i18n:check` idem.
- `pnpm zod:check` idem.
- `pnpm contrast:check` (Sprint 1) idem.
- `pnpm radius:check` (Sprint 1) idem.
- 4 GitHub Actions Gates A/B/C/D/E + Dependabot/Renovate.
- Husky 9 + commitlint + lint-staged actifs.

### T4. ADR cohérents

- ADR 0001 stack-initial (présent HEAD `axionia/docs/adr/0001-stack-initial.md`).
- ADR design Webflow v1 historique : **non présent HEAD** sous numéro 0001 design — la doctrine v1 a été tracée via Design.md historique + Sprint 1 SESSION_LOG. À confirmer si un ADR explicite de design v1 doit être rétroactivement créé pour traçabilité ou si SESSION_LOG suffit.
- ADR 0002 design — HEAD a **deux** fichiers en collision de slot : `0002-design-direction-editorial-premium.md` + `0002-design-pivot-editorial-v3.md`. Renuméroter l'un (probablement le « pivot v3 » → `0005`) en P0 cleanup. Le statut `accepted` + `Supersedes` doit être vérifié sur le canonique.
- ADR 0003 `lift-formation-ban.md` + ADR 0004 `typography-baseline-upgrade-v3-1.md` présents HEAD.
- Tous ADR créés numérotés séquentiellement, format Michael Nygard.
- Aucune décision structurelle évoquée dans SESSION_LOG sans ADR correspondant.
- Si pivot doctrinal détecté dans le code (ex : palette mocha/terracotta présente dans `globals.css`) **sans** ADR 0002 correspondant → **P0** (dette de doctrine non documentée).

### T5. Mapping pages 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)

- Compter routes effectives dans `app/[locale]/` vs `_AUDIT/02b-mapping-pages.md`.
- Lister manquants (P0 si dans la portée Sprint ≤ 14, P1 si Sprint > 14).
- Lister orphelins (routes non documentées).

### T6. 16 contradictions Phase 0

- Lire `_AUDIT/00-fiches-lecture.md` § contradictions.
- Lire `_AUDIT/CHANGELOG-v10.2.md` (passe documentaire).
- Pour chacune des 16 : statut **neutralisée / résiduelle / acceptée**.
- Toute contradiction résiduelle dans le code (pas seulement docx) → P0.

### T7. Skills `axionia-*` : présence et chargement

- 18 skills `axionia-*` listés dans `axionia-package/.claude/skills/`.
- Chaque sprint déclare avoir chargé un sous-ensemble — vérifier traces dans SESSION_LOG.
- Detection : skills cités en session mais absents du package → finding (cf. PROMPT-MAITRE 1.S).

### T8. Conventional Commits + Husky

- `git log --oneline` : tous messages au format `type(scope): description`.
- Aucun `--no-verify` détectable (impossible à prouver post-hoc, mais vérifier que le hook husky est resté actif et que `.husky/` n'a pas été supprimé entre commits).

### T9. Bundle / size

- `package.json` a `size-limit` configuré.
- `next build` fonctionne (NB : ne pas exécuter ici si lent, lire `.next/build-manifest.json` si présent).
- Pages produit déclarées ≤ 100 KB JS first load — confirmé dans SESSION_LOG ?

### T10. Couverture tests progressive

- Sprint 0 : Vitest configuré.
- Sprint 4 : coverage ≥ 50 %.
- Sprint 14 : coverage ≥ 70 % attendu (vérifier via `coverage/coverage-summary.json` si présent ou via SESSION_LOG).

---

## SORTIE — `_AUDIT/05-sprint-audit.md`

Structure obligatoire :

```markdown
# Sprint Audit — Sprints 0 → 14 (Pass post-Sprint 14)

**Date** : 2026-MM-JJ
**Working directory** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**Auditeur** : Claude Opus 4.7 (mode auto)

## Verdict global

**GO / NO-GO** : [verdict]

- P0 trouvés : [N]
- P1 trouvés : [N]
- P2 trouvés : [N]

## Tableau récap (1 ligne / sprint)

| Sprint | Jalon | Commit  | DoD attendue | DoD déclarée | DoD réelle | Écarts             | Verdict |
| ------ | ----- | ------- | ------------ | ------------ | ---------- | ------------------ | ------- |
| 0      | M1    | f52a2b4 | N critères   | N déclarés   | N réels    | 0 P0 / 0 P1 / 1 P2 | ✅      |
| ...    |       |         |              |              |            |                    |         |
| 14     | M7    | 1135136 | N            | N            | N          | …                  | …       |

## Liste plate des P0 (action immédiate)

1. [Sprint X] critère Y — détail + citation.
2. ...

## Liste plate des P1 (dette assumée à statuer)

1. ...

## Liste plate des P2 (divergences mineures)

1. ...

## Chapitres transverses (T1 → T10)

### T1. Cohérence SESSION_LOG ↔ git

[résultat]

[... etc T2-T10]

## Annexes

- [Annexe A — Sprints 0-4](./05-sprint-audit-A.md)
- [Annexe B — Sprints 5-9](./05-sprint-audit-B.md)
- [Annexe C — Sprints 10-14](./05-sprint-audit-C.md)
- [Deltas machine-readable](./05-sprint-audit-deltas.json)

## Recommandations

### Avant d'enchaîner sur les 3 audits suivants

- [si P0] Corriger d'abord : [liste].
- [si pas de P0] **GO** pour `04-frontend-final-audit` puis `FRONTEND-DEEP-CHECK` puis `VERIFICATION-FINALE Pass A`.

### À surveiller dans Pass A

- Reports P1 documentés (dette assumée) à confirmer ou résorber.
- Gaps mapping pages s'il en reste.
```

---

## VERDICT FINAL

**STOP & ASK Will** — présenter rapport ≤ 200 mots :

- Total écarts P0 / P1 / P2.
- Sprints les plus problématiques.
- Recommandation : GO direct vers les 3 audits suivants, ou STOP pour résorber d'abord.

Question fermée : **« OUI / CONTINUE / STOP »**.

---

## RAPPELS

- Cet audit ne **remplace pas** `04-frontend-final-audit` (34 critères techniques), `FRONTEND-DEEP-CHECK` (UX/nav/design), ni `VERIFICATION-FINALE Pass A` (24 chapitres production-ready). Il les **précède** pour s'assurer qu'on n'audite pas un terrain truffé de dette cachée non documentée.
- Pas de réécriture, pas de refactor — uniquement diagnostic.
- Si un commit manque ou si un sprint est partiel, **ne pas inventer** : signaler comme P0.
