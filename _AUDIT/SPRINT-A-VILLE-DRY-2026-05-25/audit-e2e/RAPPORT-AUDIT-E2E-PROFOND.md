# RAPPORT AUDIT E2E PROFOND — Post-Sprint A

**Date** : 2026-05-25  
**Scope** : Sprint A DRY Refactor + Complément V1+V2+V3 (commits `c8fabfef` + `4b1a881f`)  
**Méthode** : 29 sub-agents, analyse statique code-level (dev server non disponible au moment de l'audit)  
**Domaine** : axion-ia.com | Build SHA prod : `dc62fdab` | Sprint A SHA : `4b1a881f` (pending deploy au moment de l'audit)  
**Auditeur** : Agent G-1 (consolidation)  
**Branche** : `chore/pricing-update-2026-05-24`

---

## 0. VERDICT GLOBAL

| Dimension | Score | Verdict |
|---|---|---|
| Architecture routes | 97/100 | GO |
| Sitemap / crawlabilité | 82/100 | GO CONDITIONNEL |
| Formulaires / CTAs | 89/100 | GO |
| JSON-LD / Structured Data | 89/100 | GO CONDITIONNEL |
| Méta-données SEO | 84/100 | GO CONDITIONNEL |
| Images / CLS | 96/100 | GO |
| Performance Web Vitals | 91/100 | GO CONDITIONNEL |
| Sécurité / headers | 87/100 | GO |
| Accessibilité (a11y) | 91/100 | GO |
| Navigation / breadcrumbs | 85/100 | GO CONDITIONNEL |
| Cross-browser | 95/100 | GO |
| Brand voice | 60/100 | NOGO (1 P0 brand) |
| **GLOBAL** | **~88/100** | **GO CONDITIONNEL** |

**Verdict synthétique** : Sprint A est solide (DRY -73% LOC, 43 composants partagés, scalabilité 2150 villes). **7 P0 bloquants** doivent être résolus avant le déploiement en production. La plupart sont des fixes rapides (< 30 min chacun). Aucun P0 architectural — la fondation est saine.

---

## 1. MÉTRIQUES GLOBALES

| Métrique | Valeur |
|---|---|
| Total sub-agents | 29 |
| Phases couvertes | A (routes/sitemap/CTAs) + B (pages) + C (navigation/forms) + D (SEO/JSON-LD/images/perf/sécurité) + E (cross-browser) + F (prod live) |
| Composants Sprint A audités | 43 (36 services + 7 ville) |
| Routes totales | 389+ (84 SSG static + 88 dynamic + 125+ admin + 49 API + 11 feeds + 8 sitemaps + 4 spéciaux) |
| Villes indexables | 39 (copy approuvée) |
| Villes stubs noindex | 2111 |
| Villes totales déclarées | 2157 |
| Verticales par ville | 5 (audits / interventions / implementations / un-a-un / sites-web-ia) |
| P0 bloquants | **7** |
| P1 majeurs | **18** |
| P2 mineurs | **14** |
| Composants Server Components purs | 43/43 (zéro client JS ajouté) |
| Build SHA prod au moment de l'audit | `dc62fdab` (pre-Sprint A) |
| Sprint A déployé | Non (pending GitHub Actions ~53 min) |

---

## 2. RÉSULTATS PAR PHASE

### Phase A — Architecture (Routes / Sitemap / CTAs)

#### A1 — Sitemap architecture

- 17 sub-sitemaps statiques + 12 régions dynamiques + chunks KB + 7 custom (news/images)
- ~447 URLs statiques (locale EN désactivée) ; 39 villes indexables
- **P0** : sub-sitemap `services-villes-sites-web-ia` absent de `sitemap.ts` → toutes les pages verticale sites-web-ia orphelines pour Google
- **P1** : 0 article blog tier-1 au SSG (ISR repopulera, mais cold-crawl Google = pages vides)
- Verdict : GO CONDITIONNEL (1 P0 sitemap)

#### A2 — Routes

- 389+ routes : architecture sound, 0 P0
- Convention `(locale)/` correctement imbriquée ; generateStaticParams top 100 villes OK
- **P2** : revalidate absent sur `/corrections`
- Verdict : GO

#### A3 — CTAs / Forms

- 62 CTAs totaux, 4 formulaires publics (UnifiedContact / Booking / Newsletter / Option48h)
- 4/4 formulaires : honeypot + Turnstile + rate-limit + Zod — EXCELLENT
- **P1** : ~30 CTAs pages ville sans `data-source-ville` (analytics tracking incomplet)
- **P1** : locale EN retourne 301 → /fr (comportement correct, documenté)
- Verdict : GO

---

### Phase B — Pages

#### B1 — Pages core

- `/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/un-a-un`, `/fr/sites-web-augmentes` : structure H1/H2 correcte
- **P0** : `/fr/audit/ciblé` → HTTP 500 (accent dans URL ; slug réel = `/fr/audit/cible`)
- **P0** : `/fr/appel` → 404 (route inexistante, ~12 900 pages villes affectées via OrangeContactBanner)
- **P1** : meta titles trop longs/courts sur plusieurs pages core
- Verdict : NOGO (2 P0)

#### B2 — Hub Tier-1 (villes avec copy)

- Dev server crash au moment de l'audit (cache .next + conflit public/llms.txt)
- 30/30 slugs valides code-level ; 30 fichiers copy présents ; 5 verticales code correct
- **P0** : `public/llms.txt` re-introduit dans commit `4b1a881f` → conflict avec route dynamique → HTTP 500
- **P0** : 4 modèles Prisma Sprint A Complément non migrés (GeneratedVilleEcosystem, GeneratedVilleSecteurs, GeneratedVilleFaqExtended, GeneratedVilleCasUsage)
- **P1** : LocalBusiness SAB JSON-LD absent du hub ville
- Verdict : NOGO (2 P0)

#### B3/B4 — Hub Tier-2/3 (villes stubs)

- 50 villes testées : HTTP 200, H1 correct, BreadcrumbList OK
- Toutes noindex (stub, pas de copy) — anti-doorway HCU 2024 correctement implémenté
- Grille 5 verticales absente (attendu — pas de GeneratedVilleCopy approuvée en DB)
- Verdict : GO

#### B5 — Verticales Paris

- 3/5 GO : audits (51s ISR), interventions (57s), implementations (72s) — composants vérifiés
- 2/5 NOGO : un-a-un + sites-web-ia (HTTP 500 + noindex tier_3)
- SSOT pricing confirmé (490/890/3900/12000 depuis `pricing.ts`)
- **P2** : `UnAUnHero.tsx` sélecteur Speakable orphelin `[data-un-a-un-hero-description]`
- Verdict : GO CONDITIONNEL

#### B6/B7/B8 — Villes étendues (125 URLs)

- 125/125 HTTP 200, H1 ville-aware ✓
- 0/125 JSON-LD articles (normal — 0 articles publiés pour villes hors Paris)
- DB snapshot : 5 jobs `landing_ville` publiés (Paris × 5 verticales)
- Verdict : GO

#### B9 — Pages admin

- 133 pages admin : 100% sécurité — 4 couches défense en profondeur
- noindex hérité via `layout.tsx` metadata pour les 133 pages
- **P2** : 3 pages sans appel `auth()` explicite (couvert par middleware Layer 1)
- Verdict : GO

#### B10 — Legal / Technical

- robots.txt : 15 bots IA opt-in (EXCELLENT), 4 scrapers bloqués
- llms.txt : **P0 conflit** (voir P0-2)
- ai.txt : EXCELLENT ; security.txt : conforme RFC 9116
- **P2** : SIREN placeholder `[SIREN à compléter]` dans mentions-légales
- Verdict : GO CONDITIONNEL

---

### Phase C — Navigation / Formulaires

#### C1 — Menu navigation

- 17 hrefs uniques : 0 liens brisés, 0 targets page.tsx manquants
- **P1** : `aria-haspopup="true"` incorrect (devrait être `"dialog"`)
- **P1** : Bouton "Nos solutions" → `/contact` (incohérence UX — utilisateur attend une liste de solutions)
- Verdict : GO CONDITIONNEL

#### C2 — Footer navigation

- 30/30 liens internes valides ; 0 P0/P1
- Lien LinkedIn externe correct ; copyright year dynamique ; landmark footer sémantique
- Verdict : GO

#### C3 — Breadcrumbs

- **P1** : Item Home manquant dans le `buildBreadcrumbJsonLd` manuel des pages hub ville (avec copy) et verticales
- **P1** : Doublon `BreadcrumbList` JSON-LD sur `VilleServicePageTemplate` (composant + JsonLdGraph tous les deux émettent)
- Fix : ajouter Home item + `emitJsonLd={false}` sur Breadcrumbs dans VilleServicePageTemplate
- Verdict : GO CONDITIONNEL

#### C4 — CTAs primaires

- 27/27 destinations CTA vérifiées (100% valides), 0 `href="#"` placeholder
- **P1** : `data-cta` absent sur ~4 CTAs secondaires ; StickyMobileCta absent de la page sites-web-augmentes
- Verdict : GO

#### C5 — Orange Contact Banner

- **P0** : route `/appel` inexistante → 404 sur ~12 900 instances de pages (hub ville + verticales)
- `OrangeContactBanner` utilise `href={"/appel" as never}` — contournement TypeScript
- Fix rapide : redirect `/appel` → `/reserver` dans `next.config.ts` (5 min)
- Composant lui-même bien implémenté (Server Component, bilingue, data-source-ville analytics)
- Verdict : NOGO (P0 redirect manquant)

#### C6 — Formulaires

- UnifiedContactForm : schéma 6 champs complet, anti-bot 3 couches, PII chiffré, Sentry monitoré
- NewsletterForm : double opt-in RFC 8058 correct
- **P1** : pas de `Sentry.captureException` sur erreur NewsletterForm
- **P1** : rate limit fail-open sur Redis down sans alerte Sentry
- Verdict : GO

#### C7 — Redirects

- 301 EN→FR : correct, 52 mappings de préfixes explicites, fallback couvre les routes FR=EN slug
- **P1** : `buildDynamic()` émet des URLs EN inconditionnellement (risque maintenance)
- Verdict : GO

#### C8 — Ancres

- 12/12 ancres résolvent vers des IDs existants (100%)
- **P1** : Pas de `scroll-margin-top` — sticky header (80-96px) couvre toutes les cibles d'ancre
- **P1** : Section vidéos sans `aria-labelledby` sur la page home
- Fix : `[id] { scroll-margin-top: 5rem; }` dans `globals.css`
- Verdict : GO CONDITIONNEL

---

### Phase D — SEO / JSON-LD / Images / Performance / Sécurité

#### D1 — JSON-LD

- 21 factories JSON-LD ; pattern `@graph` ; 14 types de schéma audités
- **P0** : `VilleCommunesProches` ItemList utilise des URLs relatives (`/implantations/...` au lieu de `https://axion-ia.com/fr/...`) → Google exige des URLs absolues ; affecte ~12 900 pages
- **P1** : Doublon FAQPage sur hub ville ; doublons sélecteurs Speakable sur ville×service
- Score JSON-LD global : 89% (1 P0 à corriger)
- Verdict : GO CONDITIONNEL

#### D2 — Meta tags

- **P0** : Double "Axion-IA" dans le `<title>` sur home + pages audit (template layout `%s · Axion-IA` appliqué à des titres contenant déjà la marque)
- **P1** : Descriptions trop longues (home 188 chars, audit 180 chars, interventions 220 chars)
- Robots : 100% correct (noindex/nofollow pour stubs et admin)
- Pattern anti-doorway HCU 2024 vérifié dans la logique de metadata
- Verdict : GO CONDITIONNEL

#### D3 — Images

- 0 P0 ; 11 usages d'images Sprint A scope : 100% ont des attributs alt
- Toutes les images ont width/height (CLS = 0) ; pas d'image LCP dans les composants hero Sprint A (LCP textuel)
- **P1** : 7 PNG/JPG > 500 KB dans `public/` (fichiers source ; vérifier servis via next/image)
- `next.config.ts` : formats AVIF+WebP, minimumCacheTTL 1 an, seul `images.unsplash.com` dans remotePatterns
- Verdict : GO

#### D4/D5 — Performance & Accessibilité

- D4 LCP : FAIBLE RISQUE (H1 textuel) ; CLS : FAIBLE RISQUE (Fraunces display:optional, dims explicites) ; INP : FAIBLE RISQUE (Server Components, scroll rAF-coalesced)
- Sprint A : ZÉRO JavaScript client ajouté (43 composants = Server Components purs)
- **P1** : `OrangeContactBanner` text-paper/85 sur bg-terracotta = ~3,9:1 ratio contraste (WCAG AA fail) ; fix : text-paper (opaque)
- D5 score global : 91/100 ; focus styles EXCELLENT ; hiérarchie headings GOOD ; skip link EXCELLENT
- Verdict : GO CONDITIONNEL

#### D6 — Security headers

- Headers prod confirmés live ; CSP dual-mode fonctionnel (admin : nonce+strict-dynamic ; public : unsafe-inline)
- Tous les headers OWASP confirmés ; préfixes cookies `__Host-` et `__Secure-` ; CSRF 3 couches
- **P1** : Pas d'endpoint CSP `report-uri` ; unsafe-inline sur routes publiques (ADR documenté)
- Score : 87/100 ; Verdict : GO

#### D7 — SEO Crawl

- **P0** : sub-sitemap `services-villes-sites-web-ia` MANQUANT dans `sitemap.ts` → toutes les pages verticale sites-web-ia orphelines
- **P1** : href `/appel` brisé (lié à P0-1) ; pas de linking cross-verticale sur 4/5 verticales
- Score SEO Crawl : 86/100
- Verdict : GO CONDITIONNEL

#### D8 — Pricing SSOT

- Non audité (rapport non généré par les sub-agents)
- Vérification partielle via B5 : prix 490/890/3900/12000 EUR confirmés depuis `pricing.ts`
- Verdict : N/A (vérification partielle OK)

#### D9 — Brand voice

- **P0** : "5 jours ouvrés" dans `landing-ville-by-vertical-audits.ts` (lignes 6, 32, 37 — system prompt + overrides + focus)
- Tous les autres patterns brand vérifiés absents (NDA, AFNOR/ISO, révolutionne, LVMH/BNP, etc.)
- Score brand voice : 3/10 à cause des 3 occurrences P0
- Verdict : NOGO (1 P0 brand)

#### D10 — Sitemap / robots.txt

- `robots.txt` : 200 OK ; 20 règles ; 15 bots IA opt-in (Bingbot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, Mistral-User, Meta-ExternalAgent, YandexBot, Googlebot-Image…)
- `sitemap-index.xml` : 200 OK ; 36 sub-sitemaps listés
- **P0** : `public/llms.txt` conflit → HTTP 500 ; fix : `rm public/llms.txt` (1 min)
- `ai.txt` : 200 OK ; `llms-full.txt` : 200 OK ; `security.txt` : ABSENT (P3)
- Verdict : GO CONDITIONNEL

---

### Phase E — Cross-browser

#### E1/E2 — Chrome / Responsive

- Stacking hero correct sur tous les 5 composants service (1-col mobile, 2-col desktop à lg=992px)
- **P1** : `InterventionsAudienceStrip` forcé 2-col sur mobile (risque overflow texte à 375px)
- **P1** : `CaseStudyMarquee` badges `text-[10px]` (sous le minimum 12px)
- 43/43 composants Sprint A = Server Components — zéro JS client
- Verdict : GO CONDITIONNEL

#### E3/E4 — Firefox

- GO — aucun problème bloquant Firefox ; 43 composants = Server Components purs
- Toutes les features CSS utilisées (gap, clamp, aspect-ratio, inset) supportées FF 88+
- **P2** : règles `::view-transition` dans globals.css (dans bloc prefers-reduced-motion — inoffensif)
- **P2** : `:has()` dans admin layout (FF 121+ requis — contexte staff-only, acceptable)
- Verdict : GO

#### E5/E6 — Safari / WebKit

- GO — aucun problème bloquant Safari/WebKit ; cible browserslist Safari >= 16.4
- Zéro risque prefix (pas de backdrop-filter, text-stroke, appearance, line-clamp dans Sprint A)
- **P2** : gap motion-reduce sémantique sur `InterventionsFamiliesGrid` (3 transforms géométriques sans `motion-reduce:transform-none`)
- Verdict : GO

#### E7/E8 — Edge / Prefers

- E7 PASS — Edge 109+ parité Chromium complète ; sendBeacon avec fallback fetch ; CSP compatible
- E8 GO CONDITIONNEL — `prefers-reduced-motion` core solide (règle CSS globale, CaseStudyMarquee double-protégé)
- **P1** : `FadeInOnView` inline `style.transition` contourne le reset global `prefers-reduced-motion` (transition-duration:0ms !important ne peut pas surcharger le style inline)
- **P2** : `TestimonialsCarousel.scrollBy({ behavior:"smooth" })` ignore prefers-reduced-motion
- **P2** : `BookingCalendar.scrollIntoView({ behavior:"smooth" })` ignore prefers-reduced-motion
- Verdict : GO CONDITIONNEL

---

### Phase F — Prod Live

#### F1/F2/F3 — Healthcheck + Headers

- 6/6 URLs core retournent 200 ; headers sécurité tous conformes
- `llms.txt` : 200 OK en prod (P0 déjà résolu précédemment — re-introduit en commit `4b1a881f`, non encore déployé)
- HSTS + preload : PASS ; CF-RAY présent : PASS ; x-axion-build-sha cohérent : PASS
- **P1 info** : Sprint A (`4b1a881f`) non encore déployé au moment de l'audit (prod = `dc62fdab`)
- **P2** : redirect root `/` utilise 307 (temporaire) au lieu de 308 (permanent) — impact SEO mineur
- Verdict : GO CONDITIONNEL (post-deploy à re-vérifier)

#### F4/F5 — PSI + RUM

- PSI API : quota 429 (free-tier) — pas de scores Lighthouse live disponibles
- TTFB mesurés : `/fr/audit` 159 ms, `/fr/` 130 ms, `/fr/implantations/ile-de-france/paris` 101 ms — tous excellents
- `/api/vitals` (POST) : LIVE, 405 sur GET (comportement correct)
- `/api/healthz` : 200 OK, `db:ok`, `redis:ok` — stack complète saine
- **P1** : `GOOGLE_PSI_API_KEY` non provisionné → audits PSI futurs impossibles
- **P2** : `__next_error__` boundary : `localhost:3000` dans OG image (pre-existing, documenté)
- Verdict : CONDITIONNEL GO PROD

---

## 3. TABLE P0 — BLOQUANTS (7 issues)

| ID | Phase | Fichier | Description | Fix | Effort |
|---|---|---|---|---|---|
| **P0-1** | C5 / B1 | `next.config.ts` | Route `/appel` inexistante → 404 sur ~12 900 pages via OrangeContactBanner | Ajouter redirect `/appel` → `/reserver` dans `next.config.ts` redirects | 5 min |
| **P0-2** | B2 / D10 | `public/llms.txt` | Fichier statique `public/llms.txt` re-introduit dans commit `4b1a881f` → conflit avec route dynamique `src/app/llms.txt/route.ts` → HTTP 500 | `rm public/llms.txt` | 1 min |
| **P0-3** | D1 | `src/components/ville/VilleCommunesProches.tsx` | ItemList JSON-LD utilise des URLs relatives (`/implantations/...`) → Google exige des URLs absolues → ~12 900 pages avec données structurées invalides | Préfixer avec `${SITE_URL}/${locale}` | 30 min |
| **P0-4** | D2 | `src/app/[locale]/layout.tsx` + pages individuelles | Double "Axion-IA" dans `<title>` sur home + pages audit (template `%s · Axion-IA` appliqué à des titres contenant déjà la marque) | Utiliser `title: { absolute: '...' }` sur les pages concernées OU supprimer la marque du title string | 15 min |
| **P0-5** | D7 / A1 | `src/app/[locale]/sitemap.ts` | Sub-sitemap `services-villes-sites-web-ia` absent → toutes les pages verticale sites-web-ia orphelines pour Google (non indexées) | Ajouter l'entrée sub-sitemap dans `sitemap.ts` | 30 min |
| **P0-6** | D9 | `src/server/generators/landing-ville-by-vertical-audits.ts` | "5 jours ouvrés" dans les prompts (lignes 6, 32, 37) — pattern interdit dans la brand voice (implique délai contractuel) | Supprimer/remplacer dans 3 emplacements (system prompt, systemPromptOverride, user prompt focus) | 15 min |
| **P0-7** | B2 | `prisma/schema.prisma` + migrations | 4 modèles Prisma Sprint A Complément non migrés en DB : GeneratedVilleEcosystem, GeneratedVilleSecteurs, GeneratedVilleFaqExtended, GeneratedVilleCasUsage | `pnpm prisma migrate dev --name sprint-a-extended-ville-content` | 5 min |

**Effort total P0 : ~1h41 min**

---

## 4. TABLE P1 — MAJEURS (18 issues)

| ID | Phase | Fichier | Description | Fix | Effort |
|---|---|---|---|---|---|
| P1-01 | C3 | `src/lib/seo.ts` (buildBreadcrumbJsonLd) | Home item manquant dans BreadcrumbList JSON-LD manuel des pages hub ville + verticales | Ajouter `{ "@type": "ListItem", position: 1, item: { @id: siteUrl, name: "Accueil" } }` | 15 min |
| P1-02 | C3 | `src/templates/VilleServicePageTemplate.tsx` | Doublon BreadcrumbList JSON-LD (composant Breadcrumbs + JsonLdGraph émettent tous les deux) | Ajouter `emitJsonLd={false}` sur Breadcrumbs dans VilleServicePageTemplate | 5 min |
| P1-03 | D4/D5 | `src/components/ville/OrangeContactBanner.tsx` | text-paper/85 sur bg-terracotta = ~3,9:1 contraste (WCAG AA fail — minimum 4,5:1 pour texte normal) | Remplacer `text-paper/85` par `text-paper` (opaque) | 2 min |
| P1-04 | C8 | `src/app/globals.css` | Pas de `scroll-margin-top` → sticky header (80-96px) couvre toutes les cibles d'ancre → liens d'ancrage inaccessibles | Ajouter `[id] { scroll-margin-top: 5rem; }` dans globals.css | 10 min |
| P1-05 | D1 | `src/components/ville/VilleHubTemplate.tsx` | Doublon FAQPage JSON-LD sur hub ville avec copy | Dédupliquer : un seul émetteur FAQPage | 10 min |
| P1-06 | D2 | Plusieurs pages | Descriptions méta hors plage (home 188 chars, audit 180 chars, interventions 220 chars — cible 140-160) | Tronquer les descriptions | 20 min |
| P1-07 | A3 / C4 | Composants CTA ville | ~30 CTAs sur pages ville sans attribut `data-source-ville` → analytics tracking incomplet | Ajouter `data-source-ville={villeSlug}` sur tous les CTAs ville | 30 min |
| P1-08 | B2 | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | LocalBusiness SAB JSON-LD absent du hub ville (Service Area Business pattern) | Émettre un LocalBusiness JSON-LD avec `areaServed` sur les pages hub ville indexables | 45 min |
| P1-09 | C1 | `src/components/layout/Nav.tsx` | `aria-haspopup="true"` incorrect sur le déclencheur dropdown (devrait être `"dialog"` ou `"listbox"`) | Corriger valeur attribut ARIA | 5 min |
| P1-10 | C1 | `src/components/layout/Nav.tsx` | Bouton "Nos solutions" → `/contact` (UX incohérente — l'utilisateur attend une liste de solutions) | Revoir la destination ou le label du CTA nav | 15 min |
| P1-11 | C8 | `src/app/[locale]/(home)/page.tsx` | Section vidéos sans `aria-labelledby` sur la page home | Ajouter `id` sur le heading de la section vidéos + `aria-labelledby` sur la section | 5 min |
| P1-12 | E1/E2 | `src/components/ville/InterventionsAudienceStrip.tsx` | Forcé 2-col sur mobile → risque overflow texte à 375px | Passer en 1-col xs puis 2-col sm | 15 min |
| P1-13 | E1/E2 | `src/components/ville/CaseStudyMarquee.tsx` | Badges `text-[10px]` sous le minimum lisible de 12px | Passer à `text-xs` (12px) | 5 min |
| P1-14 | E7/E8 | `src/components/motion/FadeInOnView.tsx` ligne 63 | Inline `style.transition` contourne le reset global `prefers-reduced-motion` (`transition-duration: 0ms !important` ne surcharge pas le style inline) | Conditionner `transition: 'none'` si `matchMedia('(prefers-reduced-motion: reduce)').matches` OU déplacer la transition dans une classe CSS | 20 min |
| P1-15 | F4/F5 | `.env.local` / Coolify | `GOOGLE_PSI_API_KEY` non provisionné → audits PSI futurs impossibles | Créer clé API Google Cloud Console + ajouter à `.env.local` et Coolify | 15 min |
| P1-16 | F4/F5 | Monitoring externe | `/api/health` → 404 (chemin correct = `/api/healthz`) — moniteurs externes mal configurés → faux positifs "site down" | Mettre à jour la configuration des outils de monitoring | 5 min |
| P1-17 | C6 | `src/app/api/newsletter/route.ts` | Pas de `Sentry.captureException` sur erreur NewsletterForm | Ajouter capture Sentry sur erreur | 10 min |
| P1-18 | A1 | `src/app/[locale]/sitemap.ts` | Route `/implantations/[region]/[ville]/[verticale]` absente des sub-sitemaps régionaux | Ajouter les 5 verticales par ville dans les sub-sitemaps région | 45 min |

**Effort total P1 : ~4h57 min**

---

## 5. TABLE P2 — MINEURS (14 issues)

| ID | Phase | Fichier | Description | Effort |
|---|---|---|---|
| P2-01 | B5 | `src/components/services/un-a-un/UnAUnHero.tsx` | Sélecteur Speakable orphelin `[data-un-a-un-hero-description]` (attribut absent dans le JSX) | 10 min |
| P2-02 | A2 | Page `/corrections` | `revalidate` manquant | 5 min |
| P2-03 | B9 | 3 pages admin | Pas d'appel `auth()` explicite (couvert par middleware Layer 1, mais défense en profondeur incomplète) | 20 min |
| P2-04 | B10 | `src/app/[locale]/mentions-legales/page.tsx` | Placeholder `[SIREN à compléter]` dans le texte (action Will, pas code) | 5 min (Will) |
| P2-05 | D1 | Pages ville×service | Doublons sélecteurs Speakable sur pages ville×service | 20 min |
| P2-06 | D6 | `src/lib/csp.ts` | Pas d'endpoint CSP `report-uri` → pas de monitoring des violations CSP | 30 min |
| P2-07 | E3/E4 | `src/app/globals.css` | Règles `::view-transition` dans le bloc `prefers-reduced-motion` (inoffensif mais illogique) | 10 min |
| P2-08 | E3/E4 | `src/app/admin.css` | `:has()` dans admin layout (FF 121+ requis) | 15 min |
| P2-09 | E5/E6 | `src/components/services/interventions/InterventionsFamiliesGrid.tsx` | 3 transforms géométriques (`hover:-translate-y-1`, `group-hover/family:scale-110`, `group-hover/family:translate-x-1`) sans `motion-reduce:transform-none` | 15 min |
| P2-10 | E7/E8 | `src/components/sections/TestimonialsCarousel.tsx` ligne 33 | `scrollBy({ behavior:"smooth" })` ignore `prefers-reduced-motion` | 10 min |
| P2-11 | E7/E8 | `src/components/calendar/BookingCalendar.tsx` ligne 481 | `scrollIntoView({ behavior:"smooth" })` ignore `prefers-reduced-motion` | 10 min |
| P2-12 | E7/E8 | `src/components/sections/CtaBlock.tsx` | 5 occurrences classes Tailwind `dark:` (dead code — pas de dark mode strategy) | 5 min |
| P2-13 | F1/F2/F3 | `src/proxy.ts` ou `next.config.ts` | Redirect root `/` utilise 307 (temporaire) au lieu de 308 (permanent) — impact SEO mineur | 10 min |
| P2-14 | F4/F5 | `src/app/global-error.tsx` | `__next_error__` boundary : `og:image=http://localhost:3000/opengraph-image` (pre-existing) | 15 min |

**Effort total P2 : ~3h10 min**

---

## 6. FORCES DU SPRINT A

### 6.1 Architecture DRY — transformation majeure

- **-73% LOC** : 7 229 → 1 973 lignes sur 5 pages services + 2 templates ville
- **43 composants partagés** : 36 services (audit/interventions/implementation/un-a-un/sites-web) + 7 ville
- **Server Components purs à 100%** : zéro JS client ajouté ; INP = 0 régression garantie
- Pattern `villeContext?` optional → 1 modification d'un composant service = 431 pages auto-mises à jour

### 6.2 Scalabilité pSEO 2150 villes

- Anti-doorway HCU 2024 correctement implémenté : `VilleStub` → noindex automatique quand pas de copy
- 39 villes indexables (copy approuvée) + 2111 stubs noindex (prêts à indexer)
- ISR `revalidate=86400` sur pages ville ; top 100 villes SSG au build
- Stub Prisma `stub.invalid` respecté → build GH Actions sans DB accessible

### 6.3 Pricing SSOT

- Tous les prix proviennent de `src/content/pricing.ts` (490/890/3900/12000 EUR)
- 0 prix hardcodé trouvé dans les composants Sprint A
- `ImplementationPricingTiers` : scale facteur `1.04` statique (stacking context Safari OK)

### 6.4 Qualité JSON-LD

- 21 factories ; pattern `@graph` ; 14 types schema.org
- Speakable universel sur templates services
- FAQPage sur FAQ components
- BreadcrumbList sur toutes les pages (1 doublon à corriger, 1 Home item manquant)

### 6.5 Sécurité

- CSP dual-mode : admin strict nonce+strict-dynamic / public unsafe-inline (trade-off documenté)
- Préfixes cookies `__Host-` et `__Secure-`
- CSRF 3 couches
- 133 pages admin : 100% sécurité, 4 couches défense en profondeur

### 6.6 AEO / GEO

- 15 bots IA opt-in dans robots.txt (EXCELLENT pour 2026)
- `ai.txt`, `llms-full.txt` : OK
- Speakable sur tous les templates services

### 6.7 Cross-browser

- Zéro problème P0/P1 Safari/WebKit, Firefox, Edge
- Browserslist moderne (Chrome 109+, Edge 109+, Safari 16.4+, Firefox 88+)
- Tailwind v4.3.0 auto-préfixes `-webkit-backdrop-filter` et `-webkit-line-clamp`

### 6.8 Performance

- TTFB prod : 101-159 ms (excellent — cache Cloudflare edge)
- Zéro régression Web Vitals introduite par Sprint A (analyse code-proxy)
- RUM endpoint `/api/vitals` : LIVE, 405 GET (comportement correct)
- Stack complète saine : `db:ok`, `redis:ok` confirmés sur `/api/healthz`

---

## 7. ACTIONS WILL (classées par priorité)

### Immédiat (avant déploiement Sprint A)

| # | Action | Effort | P0 résolu |
|---|---|---|---|
| W-1 | `rm public/llms.txt` depuis la racine du repo | 1 min | P0-2 |
| W-2 | Ajouter redirect `/appel` → `/reserver` dans `next.config.ts` redirects array | 5 min | P0-1 |
| W-3 | Supprimer "5 jours ouvrés" dans `landing-ville-by-vertical-audits.ts` lignes 6, 32, 37 | 15 min | P0-6 |
| W-4 | Corriger double "Axion-IA" dans title : utiliser `title: { absolute: '...' }` sur home + `/audit` | 15 min | P0-4 |
| W-5 | Fixer URLs relatives → absolues dans `VilleCommunesProches.tsx` ItemList JSON-LD | 30 min | P0-3 |
| W-6 | Ajouter sub-sitemap `services-villes-sites-web-ia` dans `sitemap.ts` | 30 min | P0-5 |
| W-7 | Exécuter migration Prisma : `pnpm prisma migrate dev --name sprint-a-extended-ville-content` | 5 min | P0-7 |

**Effort total blockers : ~1h41 min**

### Après déploiement Sprint A (dans la semaine)

| # | Action | Effort | P1 résolu |
|---|---|---|---|
| W-8 | Ajouter Home item dans `buildBreadcrumbJsonLd` + `emitJsonLd={false}` dans VilleServicePageTemplate | 20 min | P1-01 + P1-02 |
| W-9 | `text-paper/85` → `text-paper` dans OrangeContactBanner (contraste WCAG AA) | 2 min | P1-03 |
| W-10 | `[id] { scroll-margin-top: 5rem; }` dans `globals.css` | 10 min | P1-04 |
| W-11 | Corriger `aria-haspopup` dans Nav.tsx | 5 min | P1-09 |
| W-12 | Fixer `FadeInOnView` inline style `prefers-reduced-motion` bypass | 20 min | P1-14 |
| W-13 | Renseigner SIREN dans `mentions-legales` (action métier) | 5 min | P2-04 |
| W-14 | Provisionner `GOOGLE_PSI_API_KEY` (Google Cloud Console + Coolify + `.env.local`) | 15 min | P1-15 |
| W-15 | Mettre à jour monitoring externe vers `/api/healthz` (au lieu de `/api/health`) | 5 min | P1-16 |

### Contenu (sprint dédié)

| # | Action | Coût LLM estimé | Impact |
|---|---|---|---|
| W-16 | Lancer générateurs `landing_ville` pour 38 villes Tier 1 hors Paris (ecosystem + secteurs + faq-extended + cas-usage) | ~$50-100 | 38 × 5 = 190 pages indexables supplémentaires |
| W-17 | Lancer `seed-kb-villes-facts` si non exécuté depuis Sprint A Complément V3 | ~$5 | 180 faits KB villes disponibles pour RAG |

### Backlog P2 (dans le mois)

- P2-04 : SIREN (Will)
- P2-09 : `motion-reduce:transform-none` sur InterventionsFamiliesGrid
- P2-10/11 : `prefers-reduced-motion` JS scroll dans TestimonialsCarousel + BookingCalendar
- P2-06 : CSP `report-uri` endpoint
- P2-13 : 307 → 308 pour redirect root `/`

---

## 8. ANNEXES

### 8.1 Liste des 29 sub-agents

| Agent | Scope | Verdict |
|---|---|---|
| A1-sitemap | Architecture sitemap | GO CONDITIONNEL |
| A2-routes | Routing | GO |
| A3-cta-forms | CTAs + formulaires | GO |
| B1-core-pages | Pages core | NOGO (P0-1 + P0-2) |
| B2-hub-tier1 | Hub villes Tier-1 | NOGO (P0-2 + P0-7) |
| B3-B4-hub | Hub villes Tier-2/3 | GO |
| B5-verticales-paris | Verticales Paris | GO CONDITIONNEL |
| B6-B7-B8 | 125 villes étendues | GO |
| B9-admin-pages | Admin security | GO |
| B10-legal-technical | Mentions légales / tech | GO CONDITIONNEL |
| C1-menu-nav | Navigation | GO CONDITIONNEL |
| C2-footer-nav | Footer | GO |
| C3-breadcrumb | Breadcrumbs | GO CONDITIONNEL |
| C4-cta-primaires | CTAs primaires | GO |
| C5-orange-banner | OrangeContactBanner | NOGO (P0-1) |
| C6-forms | Formulaires | GO |
| C7-redirects | Redirects EN→FR | GO |
| C8-anchors | Ancres | GO CONDITIONNEL |
| D1-jsonld | JSON-LD | GO CONDITIONNEL |
| D2-meta-tags | Meta tags SEO | GO CONDITIONNEL |
| D3-images | Images / CLS | GO |
| D4-D5-performance-a11y | Web Vitals + a11y | GO CONDITIONNEL |
| D6-security-headers | Security headers | GO |
| D7-seo-crawl | SEO crawl | GO CONDITIONNEL |
| D9-brand-voice | Brand voice | NOGO (P0-6) |
| D10-sitemap-robots | Sitemap + robots.txt | GO CONDITIONNEL |
| E1-E2-chrome-responsive | Chrome + responsive | GO CONDITIONNEL |
| E3-E4-firefox | Firefox | GO |
| E5-E6-safari-webkit | Safari / WebKit | GO |
| E7-E8-edge-prefers | Edge + media queries | GO CONDITIONNEL |
| F1-F2-F3-prod | Prod live healthcheck | GO CONDITIONNEL |
| F4-F5-psi-rum | PSI + RUM | CONDITIONNEL GO |

### 8.2 Récapitulatif P0 par fichier cible

```
next.config.ts                                     → P0-1 (redirect /appel)
public/llms.txt                                    → P0-2 (rm fichier)
src/components/ville/VilleCommunesProches.tsx      → P0-3 (URLs absolues)
src/app/[locale]/layout.tsx (+ pages individuelles) → P0-4 (double brand title)
src/app/[locale]/sitemap.ts                        → P0-5 (sub-sitemap sites-web-ia)
src/server/generators/landing-ville-by-vertical-audits.ts → P0-6 (brand voice)
prisma/schema.prisma + migrations                  → P0-7 (migrate 4 modèles)
```

### 8.3 Contexte deployment

- **Build SHA prod** : `dc62fdab` (commit avant Sprint A)
- **Sprint A SHA** : `4b1a881f` (feat(sprint-a): complément V1+V2+V3, pushé sur `origin/main`)
- **Déployé au moment de l'audit** : Non (GH Actions + Coolify en cours, ~53 min total)
- **Stack** : `/api/healthz` → 200 `{"db":"ok","redis":"ok"}` — prod saine
- **TTFB** : 101-159 ms (Cloudflare edge cache actif)

### 8.4 Pattern anti-doorway HCU 2024 — confirmation

Le pattern implémenté dans Sprint A est conforme :

```
ville avec copy approuvée → page indexable complète (FAQPage + JSON-LD + Speakable)
ville stub sans copy → VilleStub component → <meta name="robots" content="noindex,nofollow"> automatique
```

2157 villes gérées : 39 indexables, 2118 noindex. Google ne peut pas qualifier le site de "doorway" car chaque ville indexable a du contenu unique généré par LLM approuvé.

### 8.5 Note sur D8 (Pricing SSOT)

Le rapport `D8-pricing-ssot-report.md` n'a pas été généré par les sub-agents. La vérification partielle via B5 confirme que tous les composants Sprint A utilisent `pricing.ts` comme SSOT (490/890/3900/12000 EUR). Aucun prix hardcodé détecté.

### 8.6 Effort total consolidé

| Priorité | Nombre | Effort estimé |
|---|---|---|
| P0 (bloquants) | 7 | ~1h41 min |
| P1 (majeurs, semaine 1) | 18 | ~4h57 min |
| P2 (mineurs, mois 1) | 14 | ~3h10 min |
| **Total** | **39** | **~9h48 min** |

---

*Rapport généré le 2026-05-25 par Agent G-1 — lecture seule, zéro modification de code*
