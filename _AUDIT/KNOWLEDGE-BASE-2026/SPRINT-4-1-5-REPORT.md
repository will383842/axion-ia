# SPRINT-4.1 + KB-5 REPORT — Knowledge Base 2026

> Date : 2026-05-14
> Branche : `feature/kb-foundations`
> Commits : 3 (`22bbf31` KB-4.1 + `f186a82` KB-5 step 1 + `9df9390` KB-5 step 2)

---

## 1. Sprint KB-4.1 — UI workflow + nav admin (`22bbf31`)

**Livrables** :

- `WorkflowPanel.tsx` (use-client) : 7 boutons contextuels selon `KbStatus` + rôle.
  - draft → review : Soumettre en revue (EDITOR+).
  - review → approved : Approuver avec note reviewer (REVIEWER+ ≠ author).
  - review → draft : Rejeter avec motif.
  - approved → published : Publier maintenant.
  - approved → scheduled : Programmer avec datetime-local.
  - published → archived : Dépublier (OWNER).
  - archived/deprecated → draft/published : Restaurer (OWNER).
  - any → archived : Force archive (OWNER, danger zone).
- Anti auto-approve UI : message dédié si reviewer = author.
- Page édition `[id]/page.tsx` étendue : `userRole` exposé + `WorkflowPanel` en haut + bouton "Aperçu ↗".
- Nav admin `layout.tsx` : lien `📚 Connaissances` ajouté en tête du groupe "contenu".

---

## 2. Sprint KB-5 — Migration legacy CaseStudy/FAQ/HelpArticle/Glossaire hardcode

### Step 1 — Mappings pure testables (`f186a82`)

- `legacy-mapping-case-study.ts` : `CaseStudy` → `KnowledgeEntry type='case_study'`. Body = `problem + solution` concat HTML + bodyText + bodyJson unifié.
- `legacy-mapping-faq.ts` : `FAQ` → `KnowledgeEntry type='faq'`. Génère 2 translations FR+EN (slug `-en` suffix anti-collision). `escapeHtml` anti-XSS.
- `legacy-mapping-help-article.ts` : `HelpArticle` → `KnowledgeEntry type='help_article'`. Triple-source body préservée.
- `legacy-mapping-glossary-hardcode.ts` : 12 termes IA en SSOT (snapshot 2026-05-13 depuis `glossaire/page.tsx`). `mapGlossaryTermInput` → 1 entry + 2 translations.

**Tests** : 23 Vitest verts (`legacy-mapping-additional.test.ts`).

### Step 2 — 4 scripts CLI (`9df9390`)

- `scripts/import-knowledge-from-case-study.ts`
- `scripts/import-knowledge-from-faq.ts`
- `scripts/import-knowledge-from-help-article.ts`
- `scripts/import-knowledge-from-glossary-hardcode.ts`

Tous suivent le pattern KB-2 (Article) :

- `--dry-run` par défaut.
- `--commit` explicite.
- `--batch-size=N` cursor pagination.
- Idempotent (skip si slug existe).
- `KnowledgeSlugHistory` peuplée à chaque création.

**Smoke tests dry-run sur DB locale** :

- Glossary : 12 termes hardcode → 12 would-create.
- FAQ : 20 entries legacy → 20 would-create.
- CaseStudy : à smoke-tester par Will avec le seed prod.
- HelpArticle : idem.

---

## 3. Volumes consolidés (sprints KB-4.1 + KB-5)

| Métrique                  | Valeur                                      |
| ------------------------- | ------------------------------------------- |
| Commits                   | 3 (`22bbf31`, `f186a82`, `9df9390`)         |
| Fichiers créés            | 10 (1 UI + 4 mappings + 1 test + 4 scripts) |
| Fichiers modifiés         | 2 (`layout.tsx`, `[id]/page.tsx`)           |
| Lignes TS ajoutées        | ~1 500                                      |
| Tests Vitest ajoutés      | 23 (4 mappings additionnels)                |
| Tests Vitest totaux verts | **464 / 464**                               |

---

## 4. Doctrine respectée

- ✅ Mode **EXPAND-ONLY** strict pour les 4 imports DB (aucun DROP ni ALTER sur `case_studies`/`faqs`/`help_articles`).
- ✅ Glossaire hardcode : SSOT `GLOSSARY_TERMS_HARDCODE` (snapshot daté), découplé du composant `glossaire/page.tsx`.
- ✅ Slug history peuplée systématiquement pour redirects 301 zéro perte SEO.
- ✅ État `published` direct pour Glossaire (déjà publics côté page hardcode), `draft` ou `published` selon legacy pour DB.
- ✅ Idempotency : skip si slug déjà migré (re-run safe).
- ✅ UI workflow alignée matrice §1.1 du `08-WORKFLOW-VERSIONING.md` (rôles + transitions + anti auto-approve).
- ✅ Nav admin : lien `Connaissances` AVANT Blog (priorité visuelle, contenu unifié = futur).

---

## 5. Gates passées

- ✅ `pnpm typecheck` OK
- ✅ `pnpm test` 464/464 verts
- ✅ `pnpm lint` OK (0 errors)
- ✅ `pnpm i18n:check` OK (289 keys in sync, namespacing `knowledge.*`)
- ✅ Smoke tests dry-run scripts CLI OK (glossary + FAQ)

---

## 6. Hors-scope (différé)

- **Sprint KB-6 — Routes publiques branchées sur backend unifié** (5 dj selon plan).
  - Refactor `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia` pour lire depuis `KnowledgeEntry`.
  - Feature flag `KB_BACKEND_UNIFIED` pour rollback chirurgical.
  - Vérif Guide-IA hardcode (audit avant migration éventuelle).
- **Tests intégration DB** workflow + versions + relations + migrations (Sprint KB-20).
- **Sprint KB-7 — Recherche FTS** (4 dj).

---

## 7. État final branches

- `main` : intacte (commits autre conversation préservés).
- `feature/kb-foundations` HEAD = `9df9390` (KB-1 + KB-2 + KB-3 + polish + KB-4 step 1/2/rapport + KB-4.1 + KB-5 step 1/2 + ce rapport).
- Aucun push effectué.

---

## 8. Récapitulatif global Phase B autopilot (sprints KB-1 à KB-5)

| Sprint               | Commits                             | Tests ajoutés | Status |
| -------------------- | ----------------------------------- | ------------- | ------ |
| KB-1                 | `5119889`                           | 40            | ✅     |
| KB-2 (expand-only)   | `0eede3e`                           | 14            | ✅     |
| KB-3                 | `1f489a0` + `22c0b4c` polish        | 17            | ✅     |
| KB-4 step 1+2        | `29822d4` + `099b1cf`               | 23            | ✅     |
| KB-4.1 (UI workflow) | `22bbf31`                           | 0 (UI)        | ✅     |
| KB-5 step 1+2        | `f186a82` + `9df9390`               | 23            | ✅     |
| Rapports             | `e885504`, `bd5ef5f` (+ ce fichier) | —             | ✅     |

**Total : 9 commits feature + 117 tests ajoutés, 464 tests verts total.**

---

**STOP autopilot** — Will reprend la main. Prochaine étape recommandée : **KB-6 routes publiques branchées** (5 dj).
