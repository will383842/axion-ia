# Phase 0 — Reality-check 20 GAPs vs code actuel (2026-05-16)

> **Méthode** : 3 agents Explore parallèles (backend / frontend / tests-CI-docs) — lecture seule, preuves fichier:ligne. État repo `main` après commit `a572cae`.

## Verdict global

**Image-bank est à 0% d'implémentation côté code métier.** Seule l'infrastructure de surface existe :

- 3 env vars stubs (`IP_HASH_SALT`, `IMAGE_AUTO_PUBLISH_SCORE`, `RETENTION_IMAGE_LOGS_MONTHS` — orphelines, jamais lues)
- 3 pathnames `routing.ts` (`/galerie`, `/galerie/[slug]`, `/galerie/[slug]/telecharger`) → 404 actuels
- 1 composant marketing livré : `src/components/sections/PressImageBank.tsx` (lien `/galerie` cassé)
- 1 mention Footer commentée `P0-10` (galerie retirée en attente skill v1.1)
- `robots.ts` + `llms.txt` + `ai.txt` + AdminCommandPalette ✅ présents (réutilisables)

→ Le prompt v1.1 décrit donc un **build greenfield** étiqueté « audit + delta perfection 2026 » mais agissant en réalité comme spec d'implémentation initiale.

## Tableau GAP / Statut / Preuve

| GAP                                                                                   | Niveau | Statut            | Preuve repo                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GAP-01 Taxonomie métier                                                               | 🔴 P0  | ❌ Non implémenté | `prisma/schema.prisma` : 58 modèles, **0 modèle `Image*`** (seul `KnowledgeAsset` ligne 2135 dédié KB)                                                                                           |
| GAP-02 `subjectOf` cross-ref                                                          | 🔴 P0  | ❌ Non implémenté | Pas de colonnes `subjectOfUrl/Type`. Pas de helper `getHeroImageForPage`.                                                                                                                        |
| GAP-03 Variant `og.webp` 1200×630                                                     | 🟠 P1  | ❌ Non implémenté | `src/server/image-bank/` inexistant. Seul `content-gen/images/image-optimizer.ts` existe (scope ≠ image-bank).                                                                                   |
| GAP-04 Seed démo + bulk-import CSV                                                    | 🟠 P1  | ❌ Non implémenté | Aucun `scripts/seed-image-bank.ts`. Aucune route admin import.                                                                                                                                   |
| GAP-05 Conflit Web Vitals AGENTS.md vs lighthouserc.json                              | 🟡 P2  | ✅ Confirmé       | INP : AGENTS 100 vs lighthouserc 80 — CLS : AGENTS 0 vs lighthouserc 0.05. ADR requis (voir `12-conflit-web-vitals-resolution.md`).                                                              |
| GAP-06 `/llms.txt` audité + `/ai.txt` + `/.well-known/security.txt`                   | 🟠 P1  | 🟡 Partiel        | ✅ `llms.txt` (4585 bytes, présent) — ✅ `ai.txt` (route `src/app/ai.txt/route.ts` 97 lignes) — ❌ `security.txt` absent.                                                                        |
| GAP-07 JPEG XL + Cloudflare Polish/Mirage                                             | 🟡 P2  | ❌ Non implémenté | Pas de pipeline JXL. Cloudflare Polish / Mirage non activé côté config CF (à valider via dashboard).                                                                                             |
| GAP-08 Détection AI referrer + dashboard ROI AEO/GEO                                  | 🟠 P1  | ❌ Non implémenté | Pas de dashboard analytics image-bank. (À noter : tracking referrer LLM existe pour content-gen → réutiliser le service.)                                                                        |
| GAP-09 Cross-réf `subjectOf.Article` content-gen↔image-bank                           | 🟡 P2  | ❌ Non implémenté | Pas d'`embedCount` ni `trackUsage` côté workers content-gen (23 workers audités).                                                                                                                |
| GAP-10 Enrichissement attributs + formules contraintes                                | 🔴 P0  | ❌ Non implémenté | Pas de validators (`alt-validator.spec.ts` etc.). Pas de prompts Claude figés.                                                                                                                   |
| GAP-11 Console admin onglet `image-bank` 15 sous-pages                                | 🔴 P0  | ❌ Non implémenté | `AdminSidebar.tsx` : 8 groupes (main/content/engagement/ops/system) — pas d'entrée image-bank. Dossier `[adminPrefix]/image-bank/` absent. (Référence pattern : content-gen a 20 sous-dossiers.) |
| GAP-12 Schema.org `@graph` chaining                                                   | 🟠 P1  | ❌ Non implémenté | Pas de service `image-jsonld-graph.service.ts`.                                                                                                                                                  |
| GAP-13 E-E-A-T Person schema photographe                                              | 🟠 P1  | ❌ Non implémenté | `ImageAsset.photographerName` n/a (table absente). Pages `/equipe/[slug]` à inventorier séparément.                                                                                              |
| GAP-14 Knowledge Graph entities (sameAs Wikidata)                                     | 🟠 P1  | 🟡 Partiel        | `Organization.sameAs` actuellement minimal (LinkedIn + X probablement). Wikidata entry à créer (action humaine §2.7.5).                                                                          |
| GAP-15 Internal linking + anchor text strategy                                        | 🟠 P1  | ❌ Non implémenté | Pas de stratégie codée.                                                                                                                                                                          |
| GAP-16 viewport-fit=cover + theme-color dual + X-Robots-Tag + max-image-preview:large | 🟡 P2  | 🟡 Partiel        | ✅ `themeColor: "#c24a1b"` + `colorScheme: "light"` présents (`layout.tsx:77-82`). ❌ `viewport-fit=cover` absent. ❌ `max-image-preview:large` absent meta robots.                              |
| GAP-17 Hiérarchie titres H1 unique + H2/H3 sémantiques                                | 🟡 P2  | ❌ Non applicable | Pages galerie absentes — à respecter au moment du build.                                                                                                                                         |
| GAP-18 Pinterest/LinkedIn/Facebook rich tags                                          | 🟡 P2  | ❌ Non implémenté | Pages galerie absentes.                                                                                                                                                                          |
| GAP-19 pHash perceptual hash                                                          | 🟡 P2  | ❌ Non implémenté | Colonne absente.                                                                                                                                                                                 |
| GAP-20 Prompts Claude figés + tests régression                                        | 🔴 P0  | ❌ Non implémenté | Aucun prompt versionné, aucun test.                                                                                                                                                              |

## Tables Prisma image-bank attendues vs existantes

| Table attendue (spec v1.0) | Présence Prisma actuel                              |
| -------------------------- | --------------------------------------------------- |
| `ImageAsset`               | ❌ Absente                                          |
| `ImageAssetTranslation`    | ❌ Absente                                          |
| `ImageCategory`            | ❌ Absente                                          |
| `ImageTag`                 | ❌ Absente                                          |
| `ImageTagOnAsset`          | ❌ Absente                                          |
| `ImageUsageLog`            | ❌ Absente                                          |
| `ImageDownloadLog`         | ❌ Absente                                          |
| `ImageImportBatch`         | ❌ Absente                                          |
| `Country` (prérequis)      | À confirmer (table partagée probablement existante) |

→ **0/8 tables image-bank.**

## Workers BullMQ image-bank attendus vs existants

`src/server/queue/workers/` = 21 workers (tous `content-*`, `booking-*`, `email-*`, `retention-*`, `option-*`). **0 worker `image-bank-*`.**

Attendus :

- `image-bank-enrich-worker.ts` ❌
- `image-bank-import-worker.ts` ❌
- `image-bank-translate-worker.ts` ❌

## Pages publiques galerie

| Route                                                              | Présence             |
| ------------------------------------------------------------------ | -------------------- |
| `src/app/[locale]/galerie/page.tsx`                                | ❌ Absent (404 prod) |
| `src/app/[locale]/galerie/[slug]/page.tsx`                         | ❌ Absent (404 prod) |
| `src/app/[locale]/galerie/[slug]/telecharger/page.tsx`             | ❌ Absent            |
| `src/app/[locale]/galerie/interventions-formations/page.tsx` (hub) | ❌ Absent            |
| `src/app/[locale]/galerie/audits/page.tsx` (hub)                   | ❌ Absent            |
| `src/app/[locale]/galerie/implementations/page.tsx` (hub)          | ❌ Absent            |

Note Footer.tsx l52-56 : « P0-10 audit — `/galerie` retiré, route absente. Sera ré-ajouté quand skill image-bank v1.1 expose hub public. » → décision déjà tracée par audit nav E2E 2026-05-15.

## Console admin

- `AdminSidebar.tsx` (66 lignes) : 8 groupes nav, pas d'entrée image-bank
- Dossier `src/app/[locale]/(admin)/[adminPrefix]/image-bank/` ❌ absent
- Dossier `src/components/admin/image-bank/` ❌ absent
- `AdminCommandPalette` ⌘K ✅ présent (réutilisable pour entries image-bank)
- Pattern comparable : `content-gen/` admin = 20 sous-dossiers (author, costs, coverage, geo, jobs, kb-readonly, keyword-tracking, landing-variants, onboarding, orchestrator, publications, publications-status, quality, queue, review-queue, rss, settings, similarity-monitor, templates, …)

## SEO infra existante (réutilisable)

| Élément                             | Statut                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/robots.ts` (route handler) | ✅ Présent — déclare `AI_BOTS_ALLOWED` (ClaudeBot, GPTBot, Google-Extended, etc.) et `DISALLOWED` (CCBot, Bytespider). **À enrichir** avec crawlers 2026 (Claude-SearchBot, Copilot-User, GoogleOther). |
| `public/llms.txt`                   | ✅ Présent (4585 bytes) — référence pages canoniques + CC BY 4.0. **À enrichir** avec section image-bank dédiée (sitemap-images-fr.xml + sitemap-images-en.xml).                                        |
| `src/app/ai.txt/route.ts`           | ✅ Présent (97 lignes) — Spawning.ai/IAB standard.                                                                                                                                                      |
| `public/.well-known/security.txt`   | ❌ Absent                                                                                                                                                                                               |
| `sitemap-images-fr.xml`             | ❌ Route à créer                                                                                                                                                                                        |
| `sitemap-images-en.xml`             | ❌ Route à créer                                                                                                                                                                                        |

## Tests, scripts, CI

| Élément                              | Statut                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Tests `tests/image-bank/`            | ❌ 0 fichier (22 tests total dans `tests/`, tous content-gen / e2e / integration / schemas) |
| Scripts npm `image-bank:*`           | ❌ 0 (pattern à copier : `content-gen:seed`, `content-gen:isolation-check`)                 |
| Specs Playwright image-bank          | ❌ 0                                                                                        |
| CI gate `image-bank:isolation-check` | ❌ Absent (à ajouter Gate B)                                                                |
| Lighthouse CI                        | ✅ Actif (job `lhci` dans `ci.yml`, gates 5 URLs prod live)                                 |

## Conclusion Phase 0

Le prompt v1.1 « audit + delta perfection 2026 » présuppose une base image-bank existante (v1.0 ou similaire) à patcher. **Cette base n'existe pas dans le repo.** Le prompt agit donc comme **spec d'implémentation initiale complète** (audit + greenfield + perfection 2026 fusionnés).

Implications pour la suite (Phases 2-7) :

- **Phase 2 backend** = `prisma migrate` greenfield (8 tables) + 30+ services from scratch + 3 workers from scratch (~80h dev)
- **Phase 3 admin** = 15 pages admin from scratch + composants + AdminSidebar entry + AdminCommandPalette entries (~40h)
- **Phase 4 public** = index galerie + détail + 3 hubs + injection métier sur 30+ pages (~40h)
- **Phase 5 SEO infra** = sitemap-images + enrichissements robots/llms.txt + security.txt + IndexNow étendu + Bing API (~15h)
- **Phase 6 seed + bulk-import + 30 images démo + audit-e2e** (~20h + dépend Phase 2-5)
- **Phase 7 finalisation** (ADRs + docs + skill bump + tag) (~10h)

**Total estimation honnête : 200-400h** (vs 24-32h CPU annoncés dans le prompt). Hors-scope session unique. Voir `99-rapport-final.md` pour décision Will.
