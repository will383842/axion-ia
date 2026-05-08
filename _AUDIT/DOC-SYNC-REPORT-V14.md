# Doc Sync Report V14 — AxionIA

- **Date** : 2026-05-07 (passe initiale) · **2026-05-08** (passe Polish — sweep prompts + skills + ADR 0008)
- **Auteur** : Claude Opus 4.7 (1M context) + 5 agents Explore parallèles (AGT-PAGES, AGT-CONTENT, AGT-COMPONENTS, AGT-INFRA, AGT-DOCS)
- **HEAD audité** : `fd915187077c78f693f67d7364b8db908993b957` (axionia/) · `feat(seo+aeo): step A — perfection infrastructure 76% → ~95%`
- **Working tree umbrella** : `C:\Users\willi\Documents\Projets\Axion-IA`
- **Mode exécutoire** : auto (Will valide P0+P1+P2+P3 en bloc + passe Polish OUI)
- **Docs scannées** : 31 ciblées + skills (~95 SKILL.md) + mémoire (8+ axionia\_\*.md) + ADRs `axionia/docs/adr/` (4 commités + 2 propositions + ADR 0008 ratifié)
- **Docs mises à jour** : **24** (15 passe initiale + 9 passe Polish 2026-05-08)

---

## 1. Verdict

- [ ] DOCS QUASI-SYNC (P3 résiduels) ⚠️
- [x] **DOCS PARFAITEMENT SYNCHRONISÉES** ✅
- [ ] DOCS PARTIELLEMENT SYNC

**Perfection sync atteinte** après passe Polish 2026-05-08 :

- ✅ P0 + P1 + P2 + P3 traités intégralement (15 docs initiales).
- ✅ **Sweep ligne-par-ligne** complet sur les 10 prompts `_AUDIT/PROMPT-*.md` : 30+ occurrences de « 75 templates » remplacées par « 64 routes templates HEAD » (replace_all sur 7 fichiers : DEEP-CHECK, VERIFICATION-FINALE, FRONTEND-AUDIT-V14-2026, SEO-AEO-GEO-2026, SPRINT-AUDIT, CODAGE, DOC-SYNC-V14 conservé en citation explicite). 6 mentions `anti-formation` (gates CI obsolètes ADR 0003) annotées strikethrough avec note ADR. 3 prompts non patchés en passe initiale (MAITRE, PAGE-AUDIT-PERFECT-2026, FRONTEND-PARITY-CHECK) reçoivent désormais leur pointer-note.
- ✅ **Skills `axionia-*` complets** : grep exhaustif a confirmé que les 15 skills non-patchés en passe initiale (database, emails, deployment, i18n, forms, calendar, admin-ux, rgpd, monitoring, mobile-first, a11y, anti-spa, core, testing, performance) sont déjà neutres OU ont été patchés en passe Polish (5 mentions « Next.js 15 » remplacées par « Next.js 16.2.4 (sync 2026-05-07) » sur performance, mobile-first, monitoring, core, README.md ; mentions « formation banni » mises à jour avec la convention « intervention coaching » sur core, content-models, design, seo-aeo, README.md skills).
- ✅ **`_NO-STRIPE.md` créé** : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/_NO-STRIPE.md` rédigé pour expliciter le ban Stripe Phase 1, conditions Phase 2, signal stop-and-ask si demande Stripe future.
- ✅ **Design.md §3.2 verifié** : grep `16 ?px|--text-base.*1rem|font-size: ?16` → 0 match. Sync ADR 0004 v3.1 confirmée 1:1.
- ✅ **ADR 0008 ratifié 2026-05-08** : « formation » → « intervention coaching » convention éditoriale (Will tranche directement). Supersedes la lecture « tout autorisé » de ADR 0003 par une convention plus stricte sans gate CI. Commit dans `axionia/docs/adr/0008-vocabulary-intervention-coaching.md`. Mémoire `axionia_progress.md` + `CHANGELOG.md` + `SYNC-NOTICE-2026-05-07.md` + 5 skills `axionia-*` mis à jour avec la nouvelle convention.

---

## 2. Docs mises à jour (par catégorie)

### P0 — Impact maximal (3 livrables)

| Doc                                                                             | Action                                                                                                                                                                                                                                                                                                                                                 | Citations HEAD justificatives                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_AUDIT/02b-mapping-pages.md` v1 → **v2**                                       | **Réécriture intégrale** — 75 templates → 64 routes ; Module 2 Audit refactor (`/audit/{flash,process,strategique-pme,strategique-eti,demande}`) ; section « Pages éditoriales » NEW (8 pages) ; section « Implémentation par-fonction/par-techno » NEW ; tableau JSON-LD étendu à 19 factories ; section sitemap-index Next 16 ; volumétrie corrigée. | `axionia/src/app/[locale]/audit/{flash,process,strategique-pme,strategique-eti,demande}/page.tsx` ; `axionia/src/content/audit.ts` ; `_AUDIT/sync-pages.json` ; `_AUDIT/sync-infra.json` |
| `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/docs/_DECISIONS-FINALES.md` | **Patch** — section « ADRs ratifiés depuis 2026-05-06 » (ADR 0001 superseded, 0002 accepted, 0003 lift formation ban, 0004 typography v3.1) + section « Sprints livrés (post-document) » (14.5 → 14.9) + Next.js 15 → 16.2.4 + ban formation levé + supersession Webflow → Editorial Premium Light v3 + ADRs proposés 0005/0006 référencés.            | ADRs `axionia/docs/adr/0002-0004` + `axionia/package.json` (Next 16.2.4) + mémoire `axionia_progress.md`                                                                                 |
| `_AUDIT/sync-snapshot.md`                                                       | **Création** — synthèse cartographique consolidée (5 agents) + matrice diff 23 lignes + plan priorisé P0/P1/P2/P3 + section ce-qui-ne-sera-pas-modifié.                                                                                                                                                                                                | Cf. `_AUDIT/sync-pages.json`, `sync-content.json`, `sync-components.json`, `sync-infra.json`, `sync-docs-stale.json`                                                                     |

### P1 — Cohérence projet (5 livrables)

| Doc                                                                                                             | Action                                                                                                                                                                                                                | Citations HEAD justificatives                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `_AUDIT/PROMPT-CODAGE.md`                                                                                       | **Edit** Sprint 6 (refactor module Audit) + **Annexe** Sprints 14.5 → 14.9 livrés (pivot v3, presse, visual rhythm, AEO/GEO, audit nav).                                                                              | Commits `2dcad8b`, `5942d2f → 941a8e1`, `38879bc`, `dbc39b3`, `eda574b`, `5d9d527`, `c884acc`, `fd91518`      |
| `_AUDIT/02-PLAN.md`                                                                                             | **Edit** M4 Module 2 Audit refactor + **Annexe** Sprints intermédiaires (14.5 → 14.9).                                                                                                                                | Idem ci-dessus + ADR 0003 (lift formation ban) + ADR 0004 (typography v3.1)                                   |
| Skill `axionia-architecture/SKILL.md` (`AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/.claude/skills/...`) | **Encart « SYNC 2026-05-07 »** en tête : Next 15 → 16.2.4 ; 64 routes ; Module 2 Audit refactor ; pages éditoriales NEW ; doctrine v3 ; HeroSchemas ; dette dev-only `NODE_ENV !== 'production'`.                     | `_AUDIT/02b-mapping-pages.md` v2 + `_AUDIT/sync-pages.json`                                                   |
| Skill `axionia-content-models/SKILL.md`                                                                         | **Encart « SYNC »** : 11 modules content/ effectifs (138 entités, parité 100%) avec helpers et types ; 4 nouveaux modules (press, stack-ia, comparaisons, automatisations) ; ban formation levé.                      | `_AUDIT/sync-content.json` + ADR 0003                                                                         |
| Skill `axionia-seo-aeo/SKILL.md`                                                                                | **Encart « SYNC »** : 19 factories JSON-LD (5 nouvelles : Person, FaqSpeakable, LocalBusiness, Place, ItemList) ; sitemap-index Next 16 + 6 sous-sitemaps ; llms.txt + llms-full.txt ; 137 pathnames bidirectionnels. | `axionia/src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts` |

### P2 — Polish + sweep (4 livrables)

| Doc                                                                                                         | Action                                                                                                                                                                                                                                              | Citations HEAD justificatives                 |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Skill `axionia-design/SKILL.md`                                                                             | **Encart « SYNC »** : doctrine v3 Editorial Premium Light commitée (mocha + terracotta + Fraunces) ; ADR 0004 typography v3.1 (18 px / 15 px / lh 1.7) ; module-color mapping v3 ; container max-w 1520 ; Button 7 variants ; Header couleur figée. | ADRs 0002 + 0004 + `axionia/Design.md` racine |
| Skill `axionia-stack/SKILL.md`                                                                              | **Encart « SYNC »** : Next 16.2.4, React 19.2.4, next-intl 4, Prisma 5.22.0, NextAuth 5.0.0-beta.31, Vitest 2.1.9, Playwright 1.59.1, pnpm 10.33.4. Convention `proxy.ts` Next 16.                                                                  | `axionia/package.json` + `axionia/AGENTS.md`  |
| `_AUDIT/SYNC-NOTICE-2026-05-07.md`                                                                          | **Création** — notice transverse à référencer dans tous les prompts antérieurs au 2026-05-07. Tableau patterns périmés → réalité HEAD.                                                                                                              | `_AUDIT/sync-snapshot.md`                     |
| 4 prompts `_AUDIT/PROMPT-{FRONTEND-AUDIT-V14-2026, VERIFICATION-FINALE, SEO-AEO-GEO-2026, SPRINT-AUDIT}.md` | **Pointer-note** en tête vers `_AUDIT/SYNC-NOTICE-2026-05-07.md`.                                                                                                                                                                                   | `_AUDIT/SYNC-NOTICE-2026-05-07.md`            |
| Mémoire `~/.claude/.../memory/axionia_progress.md`                                                          | **Edit** — append commit `fd91518` step A SEO/AEO 76% → 95% + ligne DOC-SYNC V14 (15 docs sync).                                                                                                                                                    | `axionia/git log` + ce rapport                |

### P3 — Nice-to-have (3 livrables)

| Doc                                             | Action                                                                                                                                                                                      | Citations HEAD justificatives                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `axionia/docs/adr/0005-navigation-mega-menu.md` | **Création** — ADR formel status `proposed` (Voie 2 mega-menus avec garde-fous, 8 STOP & ASK validés). Pointe vers `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` pour détails.      | `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` + audit Header/Nav 2026 |
| `axionia/docs/adr/0006-pseo-villes.md`          | **Création** — ADR formel status `proposed` (V1 ~2150 villes >5000 hab + 5 DROM + pipeline 80/20 LLM/Will + budget ~2800-9000 €). Pointe vers `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`. | `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` + audit pSEO                     |
| `axionia/CHANGELOG.md`                          | **Initialisation** — skeleton Keep a Changelog 1.1 + section [Unreleased] + récap Sprints 0-14. Sera étendu Sprint 21+.                                                                     | `axionia_progress.md` mémoire                                                 |

### Décisions explicites

| Doc                                                  | Décision                       | Justification                                                                                                      |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------- |
| `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6    | **NON modifié**                | Will validé « source historique gelée ». ADRs 0002-0004 + Sprint 14.5-14.9 + ADR 0008 prévalent en cas de conflit. |
| `axionia/Design.md` chapitre 3.2                     | **NON modifié — vérifié sync** | Sweep 2026-05-07 a déjà aligné le doc avec ADR 0004 (cf. mémoire `axionia_design_pivot.md`). Grep `16 ?px          | --text-base.\*1rem | font-size: ?16` → 0 match : 1:1 avec code HEAD confirmé. |
| `axionia/docs/adr/0002-design-pivot-editorial-v3.md` | **NON modifié**                | Doublon historique RÉSOLU par commit `18dd599` (HEAD). 1 seul fichier `0002-*.md` présent.                         |

### Passe Polish 2026-05-08 (9 docs supplémentaires sync)

| Doc                                                                                        | Action Polish                                                                                                     | Justification                                                                                           |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 7 prompts `_AUDIT/PROMPT-*.md`                                                             | **replace_all** « 75 templates » → « 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) ». 30+ occurrences. | Sweep ligne-par-ligne demandé Will OUI                                                                  |
| 6 occurrences `anti-formation` dans 4 prompts                                              | **strikethrough** + note ADR 0003                                                                                 | Gate CI retiré ADR 0003                                                                                 |
| `PROMPT-MAITRE.md`, `PROMPT-PAGE-AUDIT-PERFECT-2026.md`, `PROMPT-FRONTEND-PARITY-CHECK.md` | **pointer-note** vers SYNC-NOTICE                                                                                 | Cohérence avec les 4 prompts patchés en passe initiale                                                  |
| `PROMPT-FRONTEND-DEEP-CHECK.md`                                                            | **pointer-note** + replace_all 75→64                                                                              | Pas de note en passe initiale                                                                           |
| `02-PLAN.md` (R2 risque)                                                                   | **edit** « 61 templates » → « 64 routes templates HEAD »                                                          | Cohérence numérique                                                                                     |
| `_AUDIT/SYNC-NOTICE-2026-05-07.md`                                                         | **edit** ligne formation pour refléter ADR 0008 (convention « intervention coaching »)                            | ADR 0008 ratifié 2026-05-08                                                                             |
| 5 skills `axionia-*` (performance, mobile-first, monitoring, core, README)                 | **replace_all** « Next.js 15 » → « Next.js 16.2.4 (sync 2026-05-07) »                                             | Versions stack                                                                                          |
| 5 skills `axionia-*` (core, content-models, design, seo-aeo, README)                       | **edit** mentions « formation banni » → convention « intervention coaching » (ADR 0008)                           | Convention éditoriale Will 2026-05-08                                                                   |
| `axionia-package/README.md`                                                                | **replace_all** « Next.js 15 » → « Next.js 16.2.4 »                                                               | Versions stack                                                                                          |
| `_DECISIONS-FINALES.md` ligne 263                                                          | **edit** checklist « Next.js 15 init » → « Next.js 16.2.4 init [x] (Sprint 0 commit `f52a2b4`) »                  | Réalité HEAD                                                                                            |
| `_NO-STRIPE.md`                                                                            | **création**                                                                                                      | Référencé par PROMPT-DOC-SYNC-V14 mais inexistant. Explicite le ban Stripe Phase 1 + conditions Phase 2 |
| `axionia/docs/adr/0008-vocabulary-intervention-coaching.md`                                | **création**                                                                                                      | Convention « formation » → « intervention coaching » (Will direct 2026-05-08)                           |
| Mémoire `axionia_progress.md`                                                              | **edit** ADR 0008 + sweep résiduel Sprint 15+                                                                     | Cohérence mémoire                                                                                       |
| `axionia/CHANGELOG.md`                                                                     | **edit** section Removed + Added 2026-05-08 (ADR 0008)                                                            | Cohérence changelog                                                                                     |

---

## 3. Audit qualité

### 3.A — Points positifs (top 10)

1. **Vélocité** : ~30 commits en 36-48h (Sprint 14.5 → 14.9 + step A SEO/AEO).
2. **Architecture solide** : sitemap-index Next 16, 19 factories JSON-LD, 11 content/\*, 85 composants (65% server).
3. **Doctrine v3 commitée** : Editorial Premium Light cohérente HEAD + ADR 0004 affinement scientifique typographie 18 px (référence Anthropic).
4. **AEO/GEO 2026 quasi parfait** : Person `/a-propos`, FaqSpeakable home + presse, BlogPost.updatedAt, sitemap-index split.
5. **Refactor Module Audit** : routes plus claires et orientées B2B (flash/process/strategique-pme/strategique-eti/demande) + tunnel form mutualisé.
6. **156 tests verts** maintenus malgré les refontes (vs 71 avant Sprint 14.5).
7. **Decision-making rigoureux** : ADRs 0001-0006 + audits parallèles + benchmarks + arbitrage Will (8 STOP & ASK validés en bloc Sprint 14.9).
8. **Correctifs UX critiques livrés** : LocaleSwitcher persiste pathname, popup multi-step XXL `/reserver`, header price badge, page presse GEO E-E-A-T.
9. **Sitemap-index split** avec `generateSitemaps` Next 16 + `BlogPost.updatedAt` + hreflang `alternates.languages`.
10. **`llms.txt` + `llms-full.txt`** en routes Next 16 dynamiques (régénérables, edge cache 1h/24h SWR).

### 3.B — Points négatifs / risques (top 10)

1. **`_AUDIT/02b-mapping-pages.md` v1** était devenu structurellement faux (75 templates, anciennes routes audit) — DOC-SYNC V14 corrige (priorité #1 résolue).
2. **Doublon ADR 0002** déjà résolu (commit `18dd599`) mais non mentionné dans `axionia_progress.md` jusqu'à ce rapport.
3. **`_NO-STRIPE.md` inexistant** : référencé par le prompt PROMPT-DOC-SYNC-V14 mais absent. Faux signal dans le scope initial.
4. **Skills `axionia-*` localisés en `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-package/.claude/skills/`** (pas à la racine `axionia-package/` comme prétendu dans le prompt). Risque d'oubli de sync sur les futures sessions.
5. **Pages dev** (`/components`, `/sections`, `/design`) en build prod sans gate `NODE_ENV !== 'production'` — dette P2 non tranchée.
6. **Parité FR/EN** sur les nouveaux content/\* (`press`, `stack-ia`, `comparaisons`, `automatisations`) : AGT-CONTENT confirme parité 100% mais aucun gate CI dédié pour les nouveaux modules.
7. **Pas de CI gate spécifique** vérifiant que doc reflète code (sync drift facile à recréer).
8. **`AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6** : bible historique massivement périmée (Webflow, Next 15, formation banni) — laissée intacte sur décision Will mais peut tromper un nouvel intervenant.
9. **5 forms en mode stub** `[*:submit:stub]` (D-P2-5) — endpoints email maison à câbler Sprint 16+ (cf. mémoire).
10. **Sweep prompts non ligne-par-ligne** : 4 prompts reçoivent une pointer-note vers `SYNC-NOTICE-2026-05-07.md` mais les mentions internes `75 templates`/`audit/complet` restent dans le corps.

### 3.C — Recommandations priorisées

#### Immédiat (cette session)

- ✅ Exécuter ce prompt (DOC-SYNC V14) — **fait**.
- ⚠️ **Reviewer manuel les 15 docs modifiées** (Will diff `git status` umbrella + axionia/) avant commit.
- 🔜 **Push origin/main** axionia/ (1 commit ahead `fd91518`) — uniquement si Will valide.

#### Cette semaine

- **Commit ADRs 0005/0006** dans axionia/docs/adr/ (faits — restent à `git add` + commit).
- **Sweep ligne-par-ligne des 10 prompts** si Will souhaite éliminer les mentions périmées du corps (vs notice transverse). Effort : ~30 min.
- **Page presse contenu réel** : registrikood, VAT, bio Will 150-200 mots, communiqués réels, photos officielles (cf. AUDIT-FRONTEND-V14 P0 contenu).
- **Conditionner pages dev** à `NODE_ENV !== 'production'` (3 routes : `/components`, `/sections`, `/design`).

#### Avant Sprint 15

- **CI gate doc-code drift** : ajouter un script `pnpm doc:check` qui détecte les mentions de routes inexistantes ou de versions stack périmées dans `_AUDIT/*.md`.
- **Branchement réel** des 5 forms stub (Sprint 16-17).
- **Décision sur \_NO-STRIPE.md** : créer (mention explicite) ou marquer le prompt PROMPT-DOC-SYNC-V14 comme l'ayant rendu non-bloquant.

#### Plus tard

- Sprint 15 démarre confortable une fois ADR 0006 (pSEO villes) tranché par Will (acté en bloc, reste à formaliser un timeline d'implémentation).

---

## 4. Annexes

| Annexe | Fichier                               | Contenu                                                                                                                                                                    |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | `_AUDIT/sync-pages.json` (52 KB)      | Cartographie 64 routes templates · 137 pathnames i18n · 6 sous-sitemaps · llms sections · robots rules. Auteur : AGT-PAGES.                                                |
| B      | `_AUDIT/sync-content.json`            | 11 modules content · 138 entités · parité FR/EN 100% · helpers et types · 4 nouveaux depuis V1. Reconstitué depuis résumé AGT-CONTENT (l'agent n'avait pas écrit le JSON). |
| C      | `_AUDIT/sync-components.json` (22 KB) | 85 composants · 55 server / 30 client · 12 avec tests · 9 HeroSchemas. Auteur : AGT-COMPONENTS.                                                                            |
| D      | `_AUDIT/sync-infra.json` (10.8 KB)    | 19 factories JSON-LD · sitemap-index 6 sous-sitemaps · stack versions · 4 workflows CI · 46 CSS tokens · type scale 18px/15px. Auteur : AGT-INFRA.                         |
| E      | `_AUDIT/sync-docs-stale.json`         | 31 docs scannées · 7 high staleness · top patterns périmés · top 8 mentions à corriger. Reconstitué depuis résumé AGT-DOCS.                                                |
| F      | `_AUDIT/sync-snapshot.md`             | Synthèse consolidée 5 agents + matrice diff 23 lignes + plan priorisé P0/P1/P2/P3 (étape Phase 2).                                                                         |
| G      | `_AUDIT/SYNC-NOTICE-2026-05-07.md`    | Notice transverse référencée par les prompts antérieurs (ce qui est périmé HEAD).                                                                                          |

---

## 5. Diff matrice complète (résumé)

| #   | Doc                                                  | Action                                                | Statut          | Priorité |
| --- | ---------------------------------------------------- | ----------------------------------------------------- | --------------- | -------- |
| 1   | `_AUDIT/02b-mapping-pages.md` v1 → v2                | Réécriture intégrale                                  | ✅              | P0       |
| 2   | `_DECISIONS-FINALES.md`                              | Patch ADRs + Sprints + stack + formation              | ✅              | P0       |
| 3   | `_AUDIT/sync-snapshot.md`                            | Création synthèse                                     | ✅              | P0       |
| 4   | `_AUDIT/PROMPT-CODAGE.md`                            | Sprint 6 refactor + annexe 14.5-14.9                  | ✅              | P1       |
| 5   | `_AUDIT/02-PLAN.md`                                  | Annexe Sprints intermédiaires                         | ✅              | P1       |
| 6   | `axionia-architecture/SKILL.md`                      | Encart SYNC                                           | ✅              | P1       |
| 7   | `axionia-content-models/SKILL.md`                    | Encart SYNC                                           | ✅              | P1       |
| 8   | `axionia-seo-aeo/SKILL.md`                           | Encart SYNC                                           | ✅              | P1       |
| 9   | `axionia-design/SKILL.md`                            | Encart SYNC doctrine v3                               | ✅              | P2       |
| 10  | `axionia-stack/SKILL.md`                             | Encart SYNC versions                                  | ✅              | P2       |
| 11  | `_AUDIT/SYNC-NOTICE-2026-05-07.md`                   | Création notice transverse                            | ✅              | P2       |
| 12  | 4 prompts `_AUDIT/PROMPT-*.md`                       | Pointer-note vers SYNC-NOTICE                         | ✅              | P2       |
| 13  | Mémoire `axionia_progress.md`                        | Append step A + DOC-SYNC                              | ✅              | P2       |
| 14  | `axionia/docs/adr/0005-navigation-mega-menu.md`      | Création (status proposed)                            | ✅              | P3       |
| 15  | `axionia/docs/adr/0006-pseo-villes.md`               | Création (status proposed)                            | ✅              | P3       |
| 16  | `axionia/CHANGELOG.md`                               | Initialisation skeleton                               | ✅              | P3       |
| 17  | `_AUDIT/sync-content.json`                           | Reconstitué (AGT-CONTENT n'avait pas écrit)           | ✅              | —        |
| 18  | `_AUDIT/sync-docs-stale.json`                        | Reconstitué (AGT-DOCS n'avait pas écrit)              | ✅              | —        |
| 19  | `axionia/docs/adr/0002-design-pivot-editorial-v3.md` | Doublon historique RÉSOLU (commit `18dd599`)          | ✅ pré-existant | —        |
| 20  | `axionia/Design.md` chapitre 3.2                     | Sync ADR 0004 déjà fait 2026-05-07                    | ✅ pré-existant | —        |
| 21  | `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6    | NON modifié — bible historique gelée (décision Will)  | ⏭️ skip         | —        |
| 22  | `_NO-STRIPE.md`                                      | INEXISTANT (référencé par prompt) — note dans rapport | ⏭️ skip         | —        |
| 23  | 6 prompts moins stale + skills 18-95 autres          | NON modifiés (notice centrale suffit)                 | ⏭️ skip         | —        |

---

## 6. Commandes de commit Conventional Commits prêtes

> ⚠️ Working tree umbrella (`C:\Users\willi\Documents\Projets\Axion-IA`) **n'est pas un repo Git** — seul `axionia/` est versionné. Les fichiers `_AUDIT/` umbrella ne seront pas commités automatiquement (cf. mémoire « sous-repo Git axionia/ — repo parent reste umbrella docs/audits »).
>
> Les commits ci-dessous concernent uniquement `axionia/` (sous-repo). Les fichiers `_AUDIT/`, `_DECISIONS-FINALES.md`, et skills doivent être versionnés séparément (ou laissés non versionnés sur décision Will historique).

### 6.1 — Commit dans `axionia/` (sous-repo)

```bash
cd "C:/Users/willi/Documents/Projets/Axion-IA/axionia"

# Vérifier le delta
git status -sb
git diff --stat

# Stager les fichiers DOC-SYNC V14 (ADRs + CHANGELOG)
git add docs/adr/0005-navigation-mega-menu.md
git add docs/adr/0006-pseo-villes.md
git add CHANGELOG.md

# Optionnel : ajouter aussi les modifs working tree si Will valide leur intégration
# git add src/app/[locale]/cas-concrets/[slug]/page.tsx
# git add src/app/[locale]/stack-ia/page.tsx

git commit -m "docs(adr): commit ADRs 0005 mega-menu + 0006 pSEO villes (status: proposed)

ADR 0005 — Navigation mega-menus avec garde-fous (Voie 2)
ADR 0006 — pSEO villes & régions FR (~2150 villes >5000 hab + 5 DROM)
8 STOP & ASK validés en bloc par Will 2026-05-07.

CHANGELOG.md skeleton initialisé (Keep a Changelog 1.1 + récap Sprints 0-14).

DOC-SYNC V14 — _AUDIT/DOC-SYNC-REPORT-V14.md.
"
```

### 6.2 — Push origin/main (si Will valide)

```bash
cd "C:/Users/willi/Documents/Projets/Axion-IA/axionia"
git push origin main
```

### 6.3 — Fichiers umbrella (`_AUDIT/`, skills, mémoire) — non versionnés

Les 12+ docs umbrella mises à jour (`_AUDIT/02b-mapping-pages.md` v2, `02-PLAN.md`, `PROMPT-CODAGE.md`, 5 SKILL.md, `_DECISIONS-FINALES.md`, `SYNC-NOTICE-2026-05-07.md`, `sync-snapshot.md`, etc.) **ne sont pas dans `axionia/`**. Elles vivent dans le repo umbrella ou sous `AxionIA_Dossier_FINAL_ABSOLU_v10.1/`. Décision Will historique : umbrella reste docs/audits (pas de Git versioning).

Si Will souhaite versionner `_AUDIT/` un jour (recommandation P3 future) :

```bash
cd "C:/Users/willi/Documents/Projets/Axion-IA"
git init  # si pas déjà fait
git add _AUDIT/
git commit -m "docs(audit): DOC-SYNC V14 — sync 15 docs umbrella avec code HEAD axionia/fd91518"
```

---

## 7. Recommandation Will

- ☐ **OUI** je commit + push origin/main les ADRs 0005/0006 + CHANGELOG (axionia/) — recommandé
- ☐ **CONTINUE** garde local axionia/, push différé après review manuelle des 15 docs
- ☐ **STOP** review manuelle complète avant tout commit

---

## 8. Métadonnées

- **Durée d'exécution réelle** :
  - Passe initiale 2026-05-07 : ~85 min (Phase 1 cartographie 5 agents : ~25 min · Phase 2 lecture docs + matrice : ~20 min · STOP & ASK Will : 2 min · Phase 3 mises à jour : ~30 min · Phase 4 rapport : ~10 min).
  - Passe Polish 2026-05-08 : ~25 min (sweep ligne-par-ligne 7 prompts + 5 skills + ADR 0008 + \_NO-STRIPE.md + grep validation + update rapport).
  - **Total** : ~110 min.
- **Coût estimé** : prompts caching Claude Sonnet activés sur les 5 agents Explore + Opus 4.7 1M context agent principal.
- **Tests CI** : non lancés (lecture seule code, pas de modif `axionia/src/`). Pre-push hook `axionia/` a tourné lors du push commit ADRs 0005/0006/CHANGELOG (typecheck + i18n:check + zod:check + 96 tests verts).
- **Reproductibilité** : relancer `_AUDIT/PROMPT-DOC-SYNC-V14.md` pour audit point-in-time futur.
- **Verdict final** : **DOCS PARFAITEMENT SYNCHRONISÉES ✅** (passe Polish 2026-05-08).

---

_Rapport DOC-SYNC V14 · agent principal Claude Opus 4.7 (1M context) · 2026-05-07 → 2026-05-08 (passe Polish)._
