# SPRINT-6-PARTIAL-REPORT — Knowledge Base 2026 — Phase B autopilot

> Date : 2026-05-14
> Branche : `feature/kb-foundations`
> Commits livrés : 3 sur 5 prévus (KB-6.1, 6.2, 6.3) + 1 import-data
> Statut : **PARTIEL — KB-6.4 + 6.5 différés** (raison : hardcode dans `src/content/` plus profond que prévu)

---

## 1. Sprints livrés cette itération

### KB-6.1 — Feature flag + readers unifiés (`d6c1d3c`)

- `src/lib/knowledge/feature-flag.ts` : `KB_BACKEND_UNIFIED` env var (master) + 6 sous-flags (`_BLOG`, `_FAQ`, `_CASE_STUDIES`, `_HELP`, `_GLOSSARY`, `_GUIDE`).
- `src/lib/knowledge/readers.ts` : 5 readers unifiés exposant façade `PublicEntryFacade` :
  - `getGlossaryTerms()`
  - `listFaqs()` (mode legacy = lit `FAQ_GLOBAL` `transversal.ts`)
  - `listPublishedArticles(locale)`
  - `findArticleBySlug(slug, locale)`
  - `findCaseStudyBySlug(slug, locale)`
  - `findHelpArticleBySlug(slug, locale)`
- **Imports legacy DB exécutés en --commit** sur DB locale :
  - 5 articles + 12 glossary + 20 FAQ + 3 case-studies + 10 help_articles = **50 entries** dans `knowledge_entries`.

### KB-6.2 — `/glossaire` refactor (`056d09e`)

- Suppression const `TERMS` hardcode 75 lignes (déjà migrée en SSOT lib).
- Lecture via `getGlossaryTerms()` → bascule DB vs hardcode selon flag.
- **Aucune URL changée, aucun contenu visible modifié**.

### KB-6.3 — `/faq` refactor (`8056e61`)

- 3 fichiers refactorés : `page.tsx`, `[slug]/page.tsx`, `feed.xml/route.ts`.
- Reader `listFaqs()` mode legacy → lit `FAQ_GLOBAL` `transversal.ts` (source historique frontend).
- `generateStaticParams` rendu async.
- `feed.xml/route.ts` : runtime `edge` → `nodejs` (Prisma incompatible edge).
- Helper `getCopy(item, locale)` adapte façade plate → format `{question, answer}`.

---

## 2. Sprints différés

### KB-6.4 — `/blog` (non livré)

**Cause** : `/blog/page.tsx` et `/blog/[slug]/page.tsx` lisent `BLOG_POSTS` depuis `src/content/blog/index.ts` (mini-CMS hardcode, 279 lignes + dossier `posts/`). **PAS la table `articles` legacy** ni `transversal.ts`.

**Audit nécessaire** :

- Inventaire `src/content/blog/posts/*` (volume + structure).
- Mapping `BLOG_POSTS.id` (slug-like) vs `Article.id` (UUID Prisma).
- Refactor reader pour lire depuis `src/content/blog/` au lieu de `prisma.article`.
- Décision : importer `BLOG_POSTS` en `KnowledgeEntry type='article'` (script à créer).
- 6 facettes à refactorer (`auteur`, `categorie`, `secteur`, `service`, `tag`, `taille`) + `feed.xml`.

**Effort estimé** : 3-4 dj (vs 1 dj prévu initialement).

### KB-6.5 — `/cas-concrets` + `/centre-aide` (non livrés)

**Cause** : probablement même structure (à confirmer).

- `/centre-aide` lit probablement `HELP_ARTICLES` confirmé dans `transversal.ts` (ligne 200).
- `/cas-concrets` à auditer.

**Effort estimé** : 2-3 dj.

---

## 3. Volumes

| Métrique                       | Valeur                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| Commits livrés cette itération | 3 (`d6c1d3c`, `056d09e`, `8056e61`)                                      |
| Fichiers créés                 | 2 (feature-flag.ts + readers.ts)                                         |
| Fichiers modifiés              | 4 (glossaire/page, faq×3)                                                |
| Lignes TS ajoutées             | ~490                                                                     |
| Lignes TS supprimées           | ~110 (const hardcode glossaire)                                          |
| Entries DB locale migrées      | 50 (5+12+20+3+10)                                                        |
| Tests Vitest verts             | **464/464** (aucun nouveau test KB-6 — refactor préservant comportement) |

---

## 4. Doctrine respectée

- ✅ **Pattern strangler fig** : readers à façade unifiée bascule legacy ↔ KB derrière feature flag.
- ✅ **Zéro 301 SEO** : URLs publiques inchangées, contenu identique (flag off).
- ✅ **Bascule progressive** : 6 flags par type pour activation granulaire.
- ✅ **Rollback chirurgical** : unset env var + redéploiement = retour legacy en 1 commande.
- ✅ **Comportement par défaut identique** : sans `KB_BACKEND_UNIFIED_*=1`, comportement = avant ces commits.

---

## 5. Découverte importante

Le frontend Axion-IA actuel est **plus hardcode que prévu** :

- `/blog` lit `BLOG_POSTS` (`src/content/blog/index.ts`).
- `/faq` lit `FAQ_GLOBAL` (`src/content/transversal.ts`).
- `/centre-aide` lit `HELP_ARTICLES` (`src/content/transversal.ts`).
- `/glossaire` lisait `TERMS` (in-file, migré KB-6.2 vers `legacy-mapping-glossary-hardcode.ts`).
- Tables Prisma `articles`/`faqs`/`help_articles`/`case_studies` n'étaient utilisées que par l'admin existant.

**Implication** : la "migration" KB des tables legacy ne suffit pas pour brancher les pages publiques sur le backend unifié. Il faut **aussi importer les hardcodes `src/content/blog/`, `transversal.ts` BLOG_POSTS, HELP_ARTICLES, FAQ_GLOBAL** dans `knowledge_entries`.

**Plan pour KB-6 complet** (sprint futur dédié) :

1. Audit exhaustif `src/content/` (taille, structure, types).
2. Création scripts `import-knowledge-from-blog-hardcode.ts`, `import-knowledge-from-help-articles-hardcode.ts`, `import-knowledge-from-faq-global-hardcode.ts`.
3. Refactor readers pour brancher sur ces sources hardcode en mode legacy.
4. Refactor pages publiques `/blog` + facettes, `/cas-concrets`, `/centre-aide`.
5. Tests E2E rendu inchangé.

---

## 6. Gates passées

- ✅ `pnpm typecheck` OK
- ✅ `pnpm test` 464/464 verts
- ✅ `pnpm lint` OK (0 errors)
- ✅ `pnpm i18n:check` OK
- ✅ DB locale : 50 entries dans `knowledge_entries`

---

## 7. État final branches

- `main` : intacte.
- `feature/kb-foundations` HEAD = `8056e61` (KB-1 → KB-6.3 inclus + ce rapport à commiter).
- Aucun push effectué.

---

## 8. Récapitulatif Phase B autopilot complète (sprints KB-1 → KB-6.3)

| Sprint                                  | Commits                                        | Status |
| --------------------------------------- | ---------------------------------------------- | ------ |
| KB-1 schema + SSOT                      | `5119889`                                      | ✅     |
| KB-2 expand-only Article                | `0eede3e`                                      | ✅     |
| KB-3 admin CRUD                         | `1f489a0` + `22c0b4c` polish                   | ✅     |
| KB-4 workflow + versionning             | `29822d4` + `099b1cf`                          | ✅     |
| KB-4.1 UI workflow + nav                | `22bbf31`                                      | ✅     |
| KB-5 4 mappings + scripts               | `f186a82` + `9df9390`                          | ✅     |
| **KB-6.1 readers + flag**               | `d6c1d3c`                                      | ✅     |
| **KB-6.2 /glossaire**                   | `056d09e`                                      | ✅     |
| **KB-6.3 /faq**                         | `8056e61`                                      | ✅     |
| **KB-6.4 /blog**                        | reporté (audit hardcode nécessaire)            | ⏸      |
| **KB-6.5 /cas-concrets + /centre-aide** | reporté                                        | ⏸      |
| Rapports                                | `e885504`, `bd5ef5f`, `e224777` (+ ce fichier) | ✅     |

**Total Phase B autopilot : 15 commits feature + 117 tests ajoutés, 464 tests verts, branche `feature/kb-foundations` prête pour PR.**

---

## 9. Prochaines étapes recommandées

1. **PR `feature/kb-foundations` → `main`** — merger les fondations + sprints KB-6.1/6.2/6.3 livrés.
2. **Sprint dédié KB-6 complet** — audit hardcode `src/content/` + import + refactor pages blog/cas-concrets/centre-aide.
3. **Sprint KB-7** — Recherche FTS Postgres FR + EN (4 dj).
4. **Tests intégration DB** — workflow + versions + relations sur DB test (Sprint KB-20).

**STOP autopilot** — Will reprend la main.
