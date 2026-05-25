# PLAN CORRECTIF — Audit E2E Post-Sprint A
**Date audit** : 2026-05-25 | **Verdict** : 88/100 GO CONDITIONNEL
**Effort total** : ~44h40 (P0 : ~1h40 + P1 : ~18h + P2 : ~25h)

---

## Sprint Correctif P0 — À FAIRE AVANT DÉPLOIEMENT Sprint A
**Durée estimée** : ~1h40 min
**Priorité** : CRITIQUE — Sprint A (commit `4b1a881f`) n'est pas encore en prod. Ces 8 fixes doivent être appliqués avant de laisser le déploiement se terminer.

| # | ID | Fix | Fichier(s) | Effort |
|---|---|---|---|---|
| 1 | P0-01 | Route `/appel` inexistante → 404 : ajouter redirect `/appel` → `/reserver` dans `next.config.ts` | `next.config.ts` | 5 min |
| 2 | P0-02 | `/fr/audit/ciblé` → HTTP 500 (accent) : ajouter redirect 301 `/fr/audit/ciblé` → `/fr/audit/cible` | `next.config.ts` | 5 min |
| 3 | P0-03 | `public/llms.txt` re-introduit dans commit `4b1a881f` → conflit avec route dynamique → 500 : `git rm public/llms.txt` + intégrer le contenu Sprint A dans `src/app/llms.txt/route.ts` | `public/llms.txt` | 5 min |
| 4 | P0-04 | `VilleCommunesProches` ItemList JSON-LD URLs relatives → invalides sur ~12 900 pages : préfixer avec `${SITE_URL}/${locale}` | `src/components/ville/VilleCommunesProches.tsx` | 30 min |
| 5 | P0-05 | Double "Axion-IA" dans `<title>` home (template `%s · Axion-IA` appliqué à titre contenant déjà la marque) : utiliser `title: { absolute: '...' }` | `src/app/[locale]/page.tsx` | 5 min |
| 6 | P0-06 | Double "Axion-IA" dans `<title>` audit (même pattern) : même fix | `src/app/[locale]/audit/page.tsx` | 5 min |
| 7 | P0-07 | Sub-sitemap `services-villes-sites-web-ia` absent de `sitemap.ts` → 5e verticale entière orpheline pour Google : ajouter `"services-villes-sites-web-ia"` dans l'enum `StaticSitemapId`, le type `ServiceVillesKey`, `SERVICE_VILLES_PATHS`, et le switch `buildServicesVillesSitemap` | `src/app/[locale]/sitemap.ts` | 30 min |
| 8 | P0-08 | "5 jours ouvrés" × 3 occurrences (lignes 6, 32, 37) dans les prompts LLM : remplacer par "délai adapté à votre situation" | `src/server/content-gen/generators/landing-ville-by-vertical-audits.ts` | 15 min |

**ETA** : 1 session développeur = ~2h avec tests

---

## Sprint P1 — Qualité (avant scale 2150 villes)
**Durée estimée** : ~18h
**Priorité** : HAUTE — À corriger avant de lancer le script `regen-villes-stratified.ts` sur toutes les 2150 villes

### Top 10 P1 urgents

| # | ID | Issue | Fichier(s) | Effort |
|---|---|---|---|---|
| 1 | P1-01 | Routes `/implantations/[region]/[ville]/[verticale]` absentes des sub-sitemaps (500 routes SSG pré-générées non indexées) | `src/app/[locale]/sitemap.ts` | 2 h |
| 2 | P1-12 | "Home" absent du fil d'Ariane JSON-LD sur pages hub ville + verticale (BreadcrumbList invalide Google) | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (lignes 281-288) + `[verticale]/page.tsx` (lignes 361-369) | 20 min |
| 3 | P1-13 | Doublon `BreadcrumbList` JSON-LD sur `VilleServicePageTemplate` (`<Breadcrumbs emitJsonLd=true>` + `buildVilleServiceJsonLdGraph` émettent tous deux) | `src/components/sections/VilleServicePageTemplate.tsx` (lignes 254 et 337) | 10 min |
| 4 | P1-29 | `text-paper/85` sur `bg-terracotta` = ~3,9:1 contraste (WCAG AA fail — minimum 4,5:1) | `src/components/ville/OrangeContactBanner.tsx` (lignes 31 et 41) | 5 min |
| 5 | P1-20 | Aucun `scroll-margin-top` → sticky header (80-96px) masque toutes les cibles d'ancre : `[id] { scroll-margin-top: 5rem; }` dans globals.css | `src/app/globals.css` | 15 min |
| 6 | P1-36 | `FadeInOnView` inline `style.transition` bypasse le reset global `prefers-reduced-motion` (les styles inline ont priorité sur `!important` CSS) : conditionner `transition: 'none'` avec `matchMedia('(prefers-reduced-motion: reduce)').matches` | `src/components/motion/FadeInOnView.tsx` (ligne 63) | 10 min |
| 7 | P1-08 | LocalBusiness SAB JSON-LD absent des pages hub ville (présent sur région mais pas ville) | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | 30 min |
| 8 | P1-07 | Descriptions meta trop longues (home 188 chars, interventions ~220, un-a-un 185, implementation ~170, implantations 166 — cible max 158) | `src/app/[locale]/page.tsx`, `interventions/page.tsx`, `un-a-un/page.tsx`, `implementation/page.tsx`, `implantations/page.tsx` | 30 min |
| 9 | P1-10 | `aria-haspopup="true"` incorrect sur trigger mega-menu (devrait être `"dialog"` — WCAG 4.1.2) | `src/components/nav/HeaderMegaMenu.tsx` (ligne 119) | 10 min |
| 10 | P1-35 | `InterventionsAudienceStrip` forcé 2-col sur mobile → overflow texte à 375px | `src/components/services/interventions/InterventionsAudienceStrip.tsx` (ligne 48) | 15 min |

### P1 complémentaires (dans la semaine)

| ID | Issue | Fichier(s) | Effort |
|----|-------|------------|--------|
| P1-02 | 5e verticale `sites-web-ia` absente des sitemaps `services-villes-*` existants | `src/app/[locale]/sitemap.ts` | 30 min |
| P1-03 | 0 article blog tier-1 au SSG (3 articles tous tier-2) → sitemap blog = 0 articles au build | DB / content-gen pipeline | 1 h |
| P1-04 | Titre `/fr/tarifs` trop long : 73 chars (limite 60) | `src/app/[locale]/tarifs/page.tsx` | 10 min |
| P1-05 | Titres trop courts : `/fr/faq` 25 chars, `/fr/galerie` 24, `/fr/recherche` 20 | `faq/page.tsx`, `galerie/page.tsx`, `recherche/page.tsx` | 20 min |
| P1-06 | Descriptions meta trop courtes (<140 chars) sur 8 pages (a-propos, contact, methodologie…) | 8 pages stratégiques | 45 min |
| P1-09 | `noindex` tier_3 sur `paris/un-a-un` et `paris/sites-web-ia` — Paris est Tier-1 | DB / content-gen pipeline | 2 h |
| P1-11 | "Nos solutions" trigger → `/contact` (comportement UX trompeur) | `src/components/nav/SolutionsMegaMenu.tsx` (ligne 72) | 15 min |
| P1-14 | `StickyMobileCta` absent de `/fr/sites-web-augmentes` (présent sur les 4 autres pages service) | `src/app/[locale]/sites-web-augmentes/page.tsx` | 10 min |
| P1-17 | `NewsletterForm` sans `Sentry.captureException` dans les blocs `catch` | `src/features/newsletter/actions.ts` | 15 min |
| P1-18 | Rate limit fail-open sur Redis down sans alerte Sentry | `src/lib/rate-limit.ts` | 20 min |
| P1-22 | `SpeakableSpecification` dupliquée sur `VilleServicePageTemplate` (FAQPage + WebPage portent tous deux la même Speakable) | `src/lib/seo/ville-service-jsonld.ts` | 15 min |
| P1-23 | FAQPage potentiellement dupliqué sur hub ville | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (lignes 448-458) | 20 min |
| P1-24 | `datePublished: article.publishedAt?.toISOString()` peut être `undefined` → JSON-LD Article invalide | `[verticale]/page.tsx` (ligne 382) | 10 min |
| P1-31 | Pas de cross-linking inter-verticales sur 4/5 verticales ville (seul `audits` a un `CrossModules`) | `src/components/services/interventions/` (nouveau composant) | 2 h |
| P1-32 | "Démarrage sous 7 jours ouvrés" — violation potentielle brand voice (décision Will requise) | `src/content/audit-detail-configs.ts` (ligne 196) | 15 min |
| P1-33 | "premier atelier sous 5 jours ouvrés" — vérification brand voice (décision Will requise) | `src/content/m-positionnements.ts` (ligne 316) | 10 min |
| P1-34 | "rapport en 5 à 10 jours ouvrés" — vérification brand voice (décision Will requise) | `src/content/m-positionnements.ts` (ligne 1140) | 10 min |
| P1-37 | `/api/health` → 404 — le bon endpoint est `/api/healthz` (reconfiguration monitoring) | Config monitoring externe | 5 min |
| P1-38 | `GOOGLE_PSI_API_KEY` non provisionné → audits PSI futurs impossibles | `.env.local` + Coolify env vars | 15 min |

---

## Backlog P2 — Amélioration (prochaine itération)
**Durée estimée** : ~25h
**Priorité** : BASSE — Planifier sur prochaines 4-6 semaines

| ID | Issue | Fichier(s) | Effort |
|----|-------|------------|--------|
| P2-06 | Sélecteur Speakable orphelin `[data-un-a-un-hero-description]` absent dans le JSX | `src/components/services/un-a-un/UnAUnHero.tsx` (ligne 63) | 10 min |
| P2-08 | SIREN + forme juridique placeholder `[SIREN à compléter]` non renseignés (action Will) | `src/content/legal.ts` (lignes 44 et 76) | 5 min |
| P2-10 | `llms.txt` ne liste pas les 2 150 villes × 4 verticales Sprint A — crawlers IA sous-estiment la couverture | `src/app/llms.txt/route.ts` | 30 min |
| P2-43 | 3 transforms géométriques sans `motion-reduce:transform-none` sur InterventionsFamiliesGrid | `src/components/services/interventions/InterventionsFamiliesGrid.tsx` | 15 min |
| P2-45 | `scrollBy({ behavior: "smooth" })` ignore `prefers-reduced-motion` (WCAG 2.3.3) | `src/components/sections/TestimonialsCarousel.tsx` (ligne 33) | 10 min |
| P2-46 | `scrollIntoView({ behavior: "smooth" })` ignore `prefers-reduced-motion` (WCAG 2.3.3) | `src/components/calendar/BookingCalendar.tsx` (ligne 481) | 10 min |
| P2-09 | Page `/sous-processeurs` potentiellement manquante mais référencée dans la politique de confidentialité | `src/app/[locale]/sous-processeurs/page.tsx` | 30 min |
| P2-30 | `metaTitle`/`metaDescription` DB sans validation de longueur — risque hors-spec via CMS | `src/app/[locale]/blog/[slug]/page.tsx` | 30 min |
| P2-50 | Redirect `/` → `/fr` utilise 307 (temporaire) au lieu de 308 (permanent) — Google re-crawl à chaque visite | `src/proxy.ts` ou `next.config.ts` | 15 min |
| P2-25 | Schéma Person (Manon) sans `@id` — ne peut pas être cross-référencé par les schémas Article | `src/lib/seo.ts` | 10 min |
| P2-26 | Home utilise 4 composants `<JsonLd>` séparés au lieu d'un `@graph` unique (~200-400ms TBT potentiel) | `src/app/[locale]/page.tsx` | 1 h |
| P2-33 | `<table>` VilleTissuEconomique sans `<caption>` ni `aria-label` (WCAG 1.3.1) | `src/components/ville/VilleTissuEconomique.tsx` | 10 min |
| P2-11 | Deux `<nav aria-label="Navigation principale">` identiques (WCAG 4.1.2) | `src/components/nav/Header.tsx` (ligne 137) | 10 min |
| P2-41 | `text-[10px]` sur badges CaseStudyMarquee (sous le minimum 12px) | `src/components/ville/CaseStudyMarquee.tsx` (lignes 111 et 114) | 5 min |

---

## Actions Will requises (non-code)

| # | Action | Délai | P résolu |
|---|---|---|---|
| W-1 | Exécuter `git rm public/llms.txt` + intégrer contenu Sprint A dans `route.ts` | Avant déploiement | P0-03 |
| W-2 | **`pnpm prisma migrate dev --name sprint-a-extended-ville-content`** (4 modèles : GeneratedVilleEcosystem / GeneratedVilleSecteurs / GeneratedVilleFaqExtended / GeneratedVilleCasUsage) | Avant déploiement | P0 DB |
| W-3 | Décision brand voice : confirmer si "7 jours ouvrés" dans `audit-detail-configs.ts` + "5 jours ouvrés" dans `m-positionnements.ts` sont des garanties contractuelles ou non | Cette semaine | P1-32/33/34 |
| W-4 | Renseigner SIREN + forme juridique dans `src/content/legal.ts` | Cette semaine | P2-08 |
| W-5 | Créer clé `GOOGLE_PSI_API_KEY` dans Google Cloud Console → ajouter `.env.local` + Coolify | Cette semaine | P1-38 |
| W-6 | Reconfigurer les moniteurs externes de `/api/health` vers `/api/healthz` | Aujourd'hui (5 min) | P1-37 |
| W-7 | Lancer `pnpm tsx src/scripts/seed-kb-villes-facts.ts --commit` (si non exécuté depuis Sprint A Complément V3) | Sprint dédié | — |
| W-8 | Valider dry-run `pnpm tsx scripts/regen-villes-stratified.ts --villes=paris --dry-run` (~$3-5) puis lancer sur les 38 villes Tier-1 hors Paris | Sprint dédié | — |
| W-9 | Re-run healthcheck post-deploy Sprint A : `/llms.txt` = 200, `/fr/implantations/*/sites-web-ia` = 200, `/fr/appel` = 301→`/fr/reserver` | Post-deploy | — |

---

## Critères de succès post-correctif P0

- [ ] `/fr/appel` → 301 → `/fr/reserver` (pas de 404)
- [ ] `/fr/audit/ciblé` → 301 → `/fr/audit/cible` (pas de 500)
- [ ] `/llms.txt` → 200 OK (pas de 500)
- [ ] Google Search Console : sitemap `services-villes-sites-web-ia` soumis et indexé
- [ ] `<title>` home = "Cabinet IA Paris · Formations · Audits | Axion-IA" (pas "... · Axion-IA · Axion-IA")
- [ ] `<title>` audit = sans doublon brand
- [ ] `VilleCommunesProches` JSON-LD : URLs = `"https://axion-ia.com/fr/implantations/..."`
- [ ] Brand voice scan : 0 occurrence "5 jours ouvrés" dans `landing-ville-by-vertical-audits.ts`
- [ ] `pnpm prisma migrate dev` : exit 0, migrations appliquées
- [ ] `pnpm typecheck` : 0 erreurs après les 8 correctifs
- [ ] `pnpm vitest run` : 0 nouvelles régressions (baseline 1905/1912 ou mieux)

---

## Récapitulatif effort

| Priorité | Nombre | Effort estimé | Délai recommandé |
|----------|--------|---------------|-----------------|
| P0 — Bloquants | 8 | ~1h40 | Avant déploiement Sprint A |
| P1 — Majeurs | 38 | ~18h | Sprint correctif dans les 7 jours |
| P2 — Mineurs | 52 | ~25h | Backlog prochaines 4-6 semaines |
| **TOTAL** | **98** | **~44h40** | — |

---

*Plan correctif généré le 2026-05-25 par Agent G-3 — basé sur RAPPORT-AUDIT-E2E-PROFOND.md + ISSUES-PRIORITISES.md*
