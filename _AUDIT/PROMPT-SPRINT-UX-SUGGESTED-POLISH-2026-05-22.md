# PROMPT — Sprint UX Suggested Polish 2026-05-22

**Mode** : AUTOPILOT TOTAL — CODE
**Branche** : `feat/sprint-ux-suggested-polish-2026-05-22` (créée depuis `main@8031a00`)
**Cible score** : audit V-14 49 → ≥ 90, V-02 74 → ≥ 88, V-07 82 → ≥ 90, V-04 + V-10 + V-11 polish ciblé
**Cible globale** : 945/1000 (vs 715 baseline 2026-05-22)
**Source de vérité** : `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/` (V-02, V-04, V-07, V-10, V-11, V-14)

---

## 0. CONTRAINTES NON NÉGOCIABLES

- ❌ NE PAS push (branche local-only jusqu'à go merge Will)
- ❌ NE PAS toucher `main` directement
- ❌ NE PAS interroger Wikidata (décision Will 2026-05-21 RENONCÉ)
- ❌ NE PAS produire/inclure de DPA (reporté)
- ❌ NE PAS modifier la config CF WAF (DONE par Will)
- ❌ NE PAS générer d'images via DALL-E/IA (cf. `feedback_no_dalle_images`)
- ❌ NE PAS toucher la magic string `"stub.invalid"` (cf. AGENTS.md §Build externalisé)
- ❌ NE PAS retirer `SKIP_ENV_VALIDATION` / `BULLMQ_DISABLED` du Dockerfile builder
- ❌ NE PAS introduire de dépendances npm lourdes (autocomplete = impl maison, pas `cmdk` ni `algolia`)
- ❌ NE PAS dégrader Web Vitals (cibles strictes : LCP ≤ 1800, INP ≤ 100, CLS = 0, FirstLoad ≤ 75 KB gz)
- ✅ Commits atomiques par item, message clair
- ✅ Gates `pnpm typecheck` + `pnpm test` verts à chaque palier
- ✅ Doctrine ZÉRO INVENTION (lis le code avant d'écrire)
- ✅ STOP & ASK Will à la livraison finale

---

## 1. SCOPE — 7 ITEMS

### Item 1 — V-14 Composant générique `<SuggestedContent />`

**Score V-14 actuel** : 49/100. Logique dupliquée 4 routes (`/blog/[slug]`, `/implantations/[region]/[ville]`, et 2 autres).

**Sub-tâches** :

- Créer `src/components/SuggestedContent.tsx` (Client Component si interactif, sinon RSC) — props `items: { href; title; excerpt?; image?; meta? }[], variant: "articles" | "cities" | "mixed", title: string, jsonLdItemList?: boolean`
- Refactor `src/app/[locale]/blog/[slug]/page.tsx:261-269` vers ce composant
- Refactor `src/app/[locale]/implantations/[region]/[ville]/page.tsx:623-659` vers le même composant (variant cities)
- Émission JSON-LD `ItemList` quand `jsonLdItemList=true`
- Connecter articles DB (merge avec FS BLOG_POSTS) + embedding similarity helper si vector dispo, fallback catégorie
- Helper `src/server/content-gen/links/related-articles.ts` qui fait le merge DB+FS et applique similarité

**Acceptance** :

- 0 logique dupliquée
- ItemList JSON-LD émis sur `/blog/[slug]` (articles connexes)
- Articles DB visibles via merge (pas seulement les 3 FS hardcodés)

### Item 2 — V-14 `/guides/[slug]` "Articles connexes" + nofollow + DA/Trust

**Score V-14 dead-end** : guides actuellement sans suggested section.

**Sub-tâches** :

- Ajouter section "Articles connexes" sur `src/app/[locale]/guides/[slug]/page.tsx` via `<SuggestedContent />` (réutilise item 1)
- Ajouter `rel="nofollow"` conditionnel quand `trustTier === "unknown"` sur les liens externes injectés depuis citations Perplexity (helper dans `src/lib/seo/external-link-rel.ts` ou existant)
- Ajouter champ `daScore Int?` sur `ExternalReference` (migration Prisma)
- Helper `src/server/content-gen/links/trust-tier.ts` — `computeTrustTier(domain: string): "high" | "medium" | "low" | "unknown"` basé sur liste blanche curated (insee.fr, gouv.fr, europa.eu, etc.) — pas de fetch externe (Ahrefs/Moz exclus)

**Acceptance** :

- `/guides/[slug]` a section suggested (visible Lighthouse + SSR)
- HTML sanitizer respecte `rel="nofollow"` sur liens unknown (test unitaire)
- Migration Prisma `daScore` appliquée

### Item 3 — V-02 Search autocomplete Cmd+K + Pagination + Sidebar sticky

**Score V-02 actuel** : 74/100.

**Sub-tâches** :

- Composant `src/components/blog/BlogSearch.tsx` (Client) avec :
  - Trigger `Cmd+K` (Mac) / `Ctrl+K` (Win) global
  - Autocomplete maison (pas de dep npm) sur index `src/data/search-index.json` généré à build (ou fetch léger SSR API `/api/blog/search?q=`)
  - A11y : `role=combobox`, `aria-expanded`, navigation flèches, Escape close
  - Bundle impact ≤ +5 KB gz
- Pagination v1 sur `src/app/[locale]/blog/page.tsx` : `?page=N` avec offset/limit (20 articles/page), liens `prev/next` ajoutés via `<link rel="prev/next">` dans head
- Sidebar desktop sticky `lg+` sur `/blog/[slug]` (3-col layout) : utilise `<SuggestedContent variant="articles" />` (item 1) + section "Hot topics" (top 5 tags via DB count)

**Acceptance** :

- Cmd+K ouvre la palette, retour 5 résultats minimum
- `/blog?page=2` fonctionne, robots indexable, no doorway
- Sidebar sticky uniquement sur lg+ (md+ = pas de sidebar = pas de régression bundle mobile)

### Item 4 — V-07 LocalBusiness + DefinedTerm + metaTitle DB

**Score V-07 actuel** : 82/100.

**Sub-tâches** :

- Émettre `buildLocalBusinessJsonLd()` au niveau **région** dans `src/app/[locale]/implantations/[region]/page.tsx` (actuellement seulement ville-level)
- Factory `buildDefinedTermJsonLd()` dans `src/lib/seo/factories.ts` pour `/glossaire/[slug]` (entry-level) + `/glossaire` (collection `DefinedTermSet`)
- Wire la factory dans `src/app/[locale]/glossaire/[slug]/page.tsx`
- Validation : `src/app/[locale]/blog/[slug]/page.tsx` utilise bien `article.metaTitle` DB en fallback (test unitaire + fix si gap)

**Acceptance** :

- `/implantations/{region}` émet LocalBusiness JSON-LD (test rich-results validator local)
- `/glossaire/[slug]` émet DefinedTerm JSON-LD
- `metaTitle` DB pris en compte (assertion test)

### Item 5 — V-10 SSOT slug + KB redirect

**Score V-10 actuel** : 82/100. 4-5 implémentations slugify dispersées.

**Sub-tâches** :

- Créer `src/lib/slug.ts` SSOT : `export function slugify(input: string, opts?: { maxLen?: number; stripStopwords?: boolean }): string`
  - Algorithme canonique : NFD + diacritics + lowercase + kebab + trim
  - `maxLen` défaut 80 (Article), surchargeable
  - `stripStopwords` défaut `false` (FR : le/la/les/de/du/des/un/une/à/au/aux/et/ou)
  - Tests unitaires `src/lib/slug.test.ts` : edge cases unicode, length cap, stopwords toggle
- Remplacer les 5 implémentations :
  - `src/server/queue/workers/content-publish-worker.ts:67-75` → import `slugify` de `@/lib/slug`
  - `src/server/queue/workers/content-qa-extract-worker.ts` → idem (cap 180 conservé via opts)
  - `src/server/image-bank/utils/slug.ts:13-21` → `ensureAsciiSlug` wrap `slugify({maxLen: SLUG_MAX_LENGTH})`
  - `src/lib/geo.ts:96-102` → `getRelatedBlogPosts` utilise import
  - `src/content/transversal.ts` → idem
- Wire `findRedirectFromHistory()` dans `src/app/[locale]/ressources/[slug]/page.tsx` (helper existe, dead code, KB renames = 404 actuellement)

**Acceptance** :

- 1 seule implémentation slugify dans le code
- Tests existants verts (slugs déjà créés en DB n'évoluent pas — algorithme identique)
- `/fr/ressources/old-slug` → 301 vers nouveau slug si entrée `KnowledgeSlugHistory`

### Item 6 — V-04 Speculation Rules + preconnect P-001/013

**Score V-04 actuel** : 53/100 (runtime perf critique, code architecture excellent).

**Sub-tâches** :

- Ajouter `<script type="speculationrules">` dans `src/app/[locale]/layout.tsx` ou root layout :
  - `prerender` : routes haute conversion `/reserver`, `/tarifs`, `/contact`, `/audit-ia`
  - `prefetch` : routes hub `/blog`, `/implantations`, `/glossaire`, `/cas-concrets`
  - Eagerness `moderate` (équilibre bandwidth/UX)
- Preconnect ciblées dans `<head>` :
  - `<link rel="preconnect" href="https://plausible.io" crossOrigin="">`
  - `<link rel="preconnect" href="https://www.clarity.ms" crossOrigin="">`
  - Image CDN si externe (sinon skip — Next image domain = self)
- Pas de polyfill JS (browsers ciblés supportent Speculation Rules natifs — Chrome 109+ via browserslist)

**Acceptance** :

- Tag présent sur toutes les pages (vérif curl HEAD)
- Pas de régression bundle (Speculation Rules = pur HTML)
- Lighthouse score local mobile inchangé ou amélioré

### Item 7 — V-11 Filter images-en.xml + /glossaire EXCLUDED_FROM_INDEX

**Score V-11 actuel** : 81/100.

**Sub-tâches** :

- Dans `src/server/exporters/images-sitemap.ts` (ou équivalent route handler `app/sitemap-images-en.xml/route.ts`) : si `EN_LOCALE_ENABLED !== "true"` (défaut EN désactivé), retourner sitemap vide ou skip émission `/en/*`
- Ajouter `/glossaire` à `EXCLUDED_FROM_INDEX` dans `src/lib/seo-noindex-routes.ts` ou équivalent (hub double-déclaré entre `pages.xml` et `glossaire.xml`)
- Test unitaire : assert `/glossaire` absent de `pages.xml`, présent dans `glossaire.xml`

**Acceptance** :

- `curl /sitemap-images-en.xml` retourne 0 URL EN quand flag off
- `/glossaire` apparaît exactement 1 fois dans l'ensemble des sitemaps

---

## 2. ORDRE D'EXÉCUTION (dépendances)

1. **Item 5** (V-10 SSOT slug) — foundational, touche workers, à faire en premier pour propre baseline
2. **Item 1** (V-14 composant) — foundational pour items 2 + 3 sidebar
3. **Item 2** (V-14 /guides + nofollow) — dépend item 1
4. **Item 3** (V-02 search + pagination + sidebar) — dépend item 1
5. **Item 4** (V-07 LocalBusiness + DefinedTerm + metaTitle)
6. **Item 6** (V-04 Speculation Rules)
7. **Item 7** (V-11 sitemap filter)
8. **Gates finaux** : `pnpm typecheck` + `pnpm test` + commits atomiques + STOP & ASK Will

---

## 3. GATES (à chaque item)

```bash
cd axionia
pnpm typecheck           # 0 erreur exigée
pnpm test --run          # vert exigé (baseline ~1412/1419)
pnpm lint                # 0 erreur/warning sur les fichiers modifiés
```

Bundle delta sur tout fichier client : vérifier mentalement < +5 KB gz (size-limit gate CI sinon).

---

## 4. DÉCISIONS WILL FIGÉES (NE PAS RE-DEMANDER)

- D1 = 6.0/60 (cf. `axionia_p4_decisions_canoniques_2026-05-21`)
- D2 = 3 itérations pilier + landing / 2 autres
- D3 = Manon (rédaction humaine)
- D4 = wording transparence max Claude Sonnet 4.6
- D5 = email lundi 8h via P5
- D7 = société française pure (pas OÜ) — `Axion-IA OÜ` dans image-bank skill garde son chemin propre
- Wikidata = RENONCÉ
- DPA = REPORTÉ
- CF WAF = DONE
- Brand voice = 5 personas brand-voice.ts

---

## 5. LIVRABLE FINAL

À la fin :

- N commits atomiques sur `feat/sprint-ux-suggested-polish-2026-05-22` (non pushée)
- Rapport synthétique (3-5 lignes) : items livrés, score estimé, gates verts
- STOP & ASK Will pour merge quand toutes les confs parallèles seront terminées

**FIN PROMPT**
