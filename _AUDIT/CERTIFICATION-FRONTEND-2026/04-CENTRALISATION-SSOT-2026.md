# 04 — CENTRALISATION SSOT (Single Source of Truth) 2026

> Audit single sources of truth : brand, prix, routes, copy, navigation, JSON-LD, design tokens, etc.

## Audit en 6 chapitres × 10 critères = 60 points

### 1. Design tokens

1.1 1 seul fichier `globals.css` `@theme` Tailwind v4
1.2 0 hex color hors `@theme`
1.3 0 px hardcodé hors token spacing scale
1.4 Border radius scale documentée et utilisée
1.5 Shadow scale documentée et utilisée
1.6 Z-index scale documentée
1.7 Animation duration scale (150-300 ms)
1.8 Breakpoints uniques (sm/md/lg/xl/2xl)
1.9 Typography scale modular v3.2 respectée
1.10 Couleurs sémantiques (`bg`, `fg`, `terracotta`, etc.) cohérentes

### 2. Brand & naming

2.1 1 seul `lib/brand.ts` exporte « Axion-IA », « cabinet IA opérationnel »
2.2 Imports `BRAND.name`, `BRAND.tagline.fr`, `BRAND.tagline.en` partout
2.3 0 « Axion-IA » hardcodé en dur (sauf `lib/brand.ts`)
2.4 0 « cabinet IA opérationnel » hardcodé (centraliser ou messages i18n)
2.5 0 « agence/studio » utilisé pour Axion-IA (uniquement concurrents)
2.6 OG image source unique (`opengraph-image.tsx`)
2.7 Favicon source unique (`icon.tsx`)
2.8 Apple icon unique (`apple-icon.tsx`)
2.9 Site URL unique (`SITE_URL` dans `lib/seo.ts`)
2.10 Brand colors importées depuis tokens (pas de `#df5d3e` hardcodé)

### 3. Pricing & data

3.1 1 seul `data/pricing.ts` avec tous les tarifs
3.2 Audit tiers : Flash 490 €, Standard, Premium, Stratégique 12 000 €
3.3 Intervention tiers : Essentielle 490 €, etc.
3.4 Implementation tarifs
3.5 0 prix hardcodé dans JSX (`490 €` interdit hors centralisé)
3.6 Format prix locale-aware via `Intl.NumberFormat`
3.7 Currency par locale (€ FR, € EN — same EU)
3.8 Tarifs versionés (lastUpdated)
3.9 Promo tarifs séparés (`data/promotions.ts` si applicable)
3.10 Prix tests vitest (vérifie cohérence)

### 4. Routes & navigation

4.1 1 seul `lib/routes.ts` avec catalog complet
4.2 0 string `/audit` hardcodée hors catalog
4.3 0 string `/implantations/[region]` hardcodée hors helpers
4.4 Helper `route('audit')` ou similaire
4.5 1 seul `lib/navigation.ts` pour Header items
4.6 1 seul `lib/footer-links.ts` pour Footer items
4.7 1 seul `lib/breadcrumbs.ts` ou logique dans helper
4.8 Mega menu source de données centralisée
4.9 Routes localisées via `next-intl/navigation` partout
4.10 Test : grep `'/audit'` ne retourne que `lib/routes.ts`

### 5. Copy, FAQ, JSON-LD, Forms

5.1 0 string FR/EN hardcodée dans JSX (tout dans `messages/fr.json` + `messages/en.json`)
5.2 FR ↔ EN clés strictement égales
5.3 1 seul `data/faq.ts` (ou messages FAQ keys)
5.4 1 seul `lib/seo.ts` factories JSON-LD (Organization, WebSite, etc.)
5.5 1 seul fichier helpers metadata (`buildProductMetadata`)
5.6 1 seul `lib/schemas/` pour Zod schemas (réutilisés client+serveur)
5.7 CTA labels centralisés (messages ou `lib/cta-labels.ts`)
5.8 Error messages i18n centralisés
5.9 Email templates source unique (`emails/` Sprint 19)
5.10 Constants techniques (`lib/constants.ts` : `MAX_BOOKING_DAYS`, etc.)

### 6. Configuration & runtime environment

6.1 Env vars centralisées + validées (`lib/env.ts` avec Zod, fail-fast au boot)
6.2 0 `process.env.X` lu directement hors `lib/env.ts`
6.3 `.env.example` à jour, exhaustif, sans valeurs réelles
6.4 Distinction client (`NEXT_PUBLIC_*`) vs serveur (autre) explicite
6.5 Feature flags centralisées (`lib/flags.ts` ou DB-driven, pas d'env vars éparses)
6.6 Configuration runtime cohérente (1 fichier `config.ts` ou par domaine)
6.7 Theme variants (light/dark si applicable) tokens centralisés
6.8 Animation/transition durées centralisées (tokens dans `globals.css`)
6.9 Locale-specific assets centralisés (logos, OG images si différents)
6.10 1 seul `lib/site.ts` ou équivalent : `SITE_URL`, `SUPPORT_EMAIL`, `BUSINESS_HOURS`, etc.

## Méthode

- Phase A : grep des duplications (`grep -r "490 €" src/`, `grep -r "/audit" src/`, `grep -r "process.env" src/`)
- Phase A bis : Audit `lib/env.ts` complétude + validation Zod
- Phase A ter : Audit `data/`, `lib/`, `messages/` pour SSOT respect
- Phase B : Diagnostic /60
- Phase C : Plan extraction vers SSOT
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant refactor massif (changements transverses)
2. Avant changement schema env vars (impact deploy)
3. Avant migration vers DB-driven (Sprint 15+)
4. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Centraliser pour le plaisir (1 valeur utilisée 1 fois → ne pas extraire)
- ❌ SSOT trop abstraite (helpers indirects qui rendent la lecture pénible)
- ❌ Env vars lues directement avec `process.env.X` partout (use `lib/env.ts`)
- ❌ Feature flags éparpillées en env vars (préférer DB-driven ou 1 fichier central)
- ❌ Brand naming dur dans messages i18n + dans `lib/brand.ts` (single source)
- ❌ Pricing dupliqué dans copy + JSON-LD + meta (use 1 SSOT + helpers)
- ❌ Constants techniques mélangées avec data métier (séparer)

## Cible

> 60/60. Aucune information critique n'est définie 2 fois. Modifier un prix, un nom, une URL, un env var = 1 seul endroit. Boot fail-fast si env invalide.

## Livrables

```
audit-04-centralisation-SYNTHESE.md
audit-04-centralisation-DIAGNOSTIC.md
audit-04-centralisation-PLAN.md
audit-04-centralisation-DUPLICATES.md  (liste exhaustive grep)
audit-04-centralisation-ENV-AUDIT.md  (env vars audit + Zod schema)
```
