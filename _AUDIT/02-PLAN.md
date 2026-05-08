# AxionIA — Plan d'implémentation maître (M1 → M11)

**Version 1 · 06/05/2026 · FR**
**Source de vérité** : `_DECISIONS-FINALES.md` + `CLAUDE.md` v6 + ADR `docs/adr/0001-design-direction-webflow.md` + skills `axionia-*`.

---

## Vue d'ensemble

Le développement d'AxionIA est découpé en **11 jalons (M1 → M11)** pour un total visé d'environ **56 jours-homme**. Chaque jalon est une unité livrable autonome, testable, validable par Will. L'ordre n'est pas strict pour M2-M3 (parallélisables) mais l'est pour M1 (préalable) et M11 (final).

| #   | Jalon                                                                  | Estimation  | Dépendances | Skills majeurs                                             |
| --- | ---------------------------------------------------------------------- | ----------- | ----------- | ---------------------------------------------------------- |
| M1  | Setup repo + stack                                                     | ~3 j-h      | —           | `axionia-core`, `axionia-stack`                            |
| M2  | Design tokens + composants UI atomiques                                | ~5 j-h      | M1          | `axionia-design`, `axionia-mobile-first`                   |
| M3  | Header/Footer + Layout `[locale]` + i18n                               | ~3 j-h      | M2          | `axionia-i18n`, `axionia-design`                           |
| M4  | Pages publiques (modules + transversales)                              | ~12 j-h     | M3          | `axionia-seo-aeo`, `axionia-anti-spa`                      |
| M5  | Formulaires multi-step + Calendrier maison + Simulateur ROI            | ~6 j-h      | M4          | `axionia-forms`, `axionia-calendar`                        |
| M6  | Pages transversales + légales + blog templates                         | ~5 j-h      | M4          | `axionia-i18n`, `axionia-seo-aeo`                          |
| M7  | Schémas SEO/AEO/JSON-LD + sitemap + robots + llms.txt + IndexNow       | ~3 j-h      | M4-M6       | `axionia-seo-aeo`                                          |
| M8  | Backend : Prisma + Auth.js v5 + server actions + BullMQ + email maison | ~6 j-h      | M5          | `axionia-database`, `axionia-emails`                       |
| M9  | Console admin (14 sections)                                            | ~6 j-h      | M8          | `axionia-admin-ux`                                         |
| M10 | Tests E2E + Lighthouse CI + sécurité (OWASP/Turnstile/CSP)             | ~4 j-h      | M9          | `axionia-testing`, `axionia-performance`, `owasp-security` |
| M11 | Déploiement Hetzner + Coolify + Cloudflare + monitoring                | ~3 j-h      | M10         | `axionia-deployment`, `axionia-monitoring`                 |
|     | **TOTAL**                                                              | **~56 j-h** |             |                                                            |

---

## M1 — Setup repo + stack (~3 j-h)

### Objectif

Initialiser le dépôt Next.js 15 App Router avec la stack arrêtée, le tooling qualité (lint, format, hooks), la validation runtime des variables d'environnement, et l'infrastructure Docker locale (Postgres + Redis). À la fin de M1, `npm run dev` lance une page d'accueil minimale FR+EN avec Header/Footer placeholders, et `npm run build` passe sans erreur ni warning.

### Prérequis

- Node 22 LTS installé localement.
- Docker Desktop ou Podman pour Postgres 16 + Redis 7 en local.
- Compte Hetzner Cloud (CX32 commandé), domaine `axion-ia.com` confirmé.
- Variables d'env documentées dans `_DECISIONS-FINALES.md` §12 (CLAUDE.md v6).

### Livrables

1. Repo Git initialisé avec convention de commit (Conventional Commits FR via Commitlint).
2. Projet Next.js 15 + TypeScript strict + Tailwind v4 + shadcn/ui (style New York, base Neutral, CSS variables).
3. `package.json` avec scripts : `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `db:push`, `db:seed`, `db:studio`.
4. `tsconfig.json` strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).
5. `lib/env.ts` avec `@t3-oss/env-nextjs` + Zod : l'app refuse de démarrer si une variable manque ou est invalide.
6. `lib/prisma.ts` singleton + `lib/redis.ts` ioredis singleton.
7. `docker/docker-compose.yml` local : Postgres 16 + Redis 7 + Mailhog (preview emails dev).
8. Husky + lint-staged + Prettier + ESLint config Next 15 + custom rule "ban-formation" (lint personnalisé).
9. GitHub Actions de base : `lint`, `typecheck`, `test:unit`, `build`.
10. Arborescence dossier alignée sur `axionia-architecture/SKILL.md` §2 (dossiers vides + README dans chaque pour la navigation).

### Definition of Done

- `npm run dev` ouvre `http://localhost:3000/fr` avec page d'accueil placeholder.
- `npm run build` passe sans erreur ni warning TS/ESLint.
- `npm run typecheck` strict OK.
- Hook pre-commit bloque un commit contenant le mot « formation ».
- Variable d'env manquante → erreur explicite au démarrage (test : retirer `DATABASE_URL` doit fail-fast).
- CI GitHub Actions verte sur `main`.
- README projet documenté avec quickstart + architecture.

### Estimation : 3 j-h

1 jour scaffolding + 1 jour env validation + Docker local + 1 jour CI + lint custom + revue.

### Risques

- **Tailwind v4 instabilité** : la v4 est récente. Mitigation : pinner la version exacte, tester sur `next.config.ts` avec PostCSS plugin officiel.
- **shadcn/ui + Tailwind v4** : incompatibilité possible. Mitigation : si bug, fallback temporaire shadcn/ui canary build.
- **React Compiler** : encore en preview. Décision : NE PAS l'activer en M1, attendre M4 si stable.

### Skills à charger

`axionia-core` (toujours en premier) · `axionia-stack` · `using-superpowers` (méta) · `verification-before-completion`.

---

## M2 — Design tokens + composants UI atomiques shadcn (Webflow-inspired) (~5 j-h)

### Objectif

Implémenter la doctrine visuelle Webflow-inspired (ADR 0001) sous forme de tokens CSS variables Tailwind v4, polices via `next/font`, et 25+ composants shadcn customisés (Button, Card, Input, Form, Select, Textarea, Dialog, Sheet, Dropdown, Accordion, Tabs, Badge, Separator, Toast, Skeleton, Avatar, Progress, Alert, Switch, Checkbox, RadioGroup, Calendar, Popover, Command). Chaque composant respecte mobile-first, `prefers-reduced-motion`, focus visible, touch targets ≥ 44×44px.

### Prérequis

M1 terminé. Lecture de `Design.md` racine, ADR 0001, skill `axionia-design`.

### Livrables

1. `app/globals.css` : tokens CSS variables Webflow-inspired (Webflow Blue `#146ef5`, 6 secondaires purple/pink/green/orange/yellow/red, near-black `#080808`, canvas blanc, échelle spacing fractionnelle 4/8/12/16/24/32/48/64/96).
2. `tailwind.config.ts` : extension `theme.extend.colors`/`spacing`/`borderRadius`/`boxShadow` mappant les CSS variables. Shadow signature 5-couches cascade définie comme `shadow-card-elevated`.
3. `next/font` : Manrope (variable, weights 400/500/600/700/800) + Inconsolata (mono) — `display: 'swap'`, preload sur layout racine.
4. 25+ composants shadcn customisés avec variants AxionIA :
   - `Button` : variants `primary` (Webflow Blue), `secondary` (outline), `ghost`, `link` ; tailles `sm`/`md`/`lg` ; signature `translate-x-[6px]` au hover sur primary + arrow icon.
   - `Card` : variant `elevated` avec shadow 5-couches, radius 8px.
   - `Input`, `Textarea`, `Select` : focus ring Webflow Blue 2px, error state rouge `#ee1d36`.
5. Storybook (ou Ladle léger) avec preview de chaque composant en variants + états (default, hover, focus, disabled, error).
6. Composants partagés : `<AeoBlock>`, `<JsonLd>`, `<CTACentral>`, `<ScrollProgress>`, `<SkipToContent>`.
7. Tests Vitest + Testing Library sur Button, Form, Dialog (focus trap), Sheet (drawer mobile).

### Definition of Done

- Tous les tokens en CSS variables, **aucune couleur en dur** dans le code.
- Toggle dark mode désactivé pour v1 (mais variables structurées pour ajout futur).
- Lighthouse a11y ≥ 95 sur la page Storybook.
- Tests Vitest sur 5 composants critiques verts.
- Touch targets ≥ 44×44px vérifié sur mobile (Playwright viewport 375px).
- `prefers-reduced-motion` désactive l'animation `translate-x-[6px]`.

### Estimation : 5 j-h

1 j tokens + Tailwind config + polices · 2,5 j composants shadcn customisés · 1 j Storybook + tests · 0,5 j composants partagés.

### Risques

- **Discipline secondaires** : tentation d'utiliser 3+ couleurs sur une section. Mitigation : ESLint rule custom détectant l'usage de plus de 2 secondaires sur un même fichier composant.
- **Manrope vs WF Visual Sans Variable** : rendu légèrement différent. Mitigation : valider visuellement avec Will sur 3 maquettes clés (home, intervention essentielle, audit).
- **Bundle taille** : 25+ composants shadcn = risque de bundle gonflé. Mitigation : tree-shaking strict + bundle analyzer en M10.

### Skills à charger

`axionia-design` · `axionia-mobile-first` · `axionia-a11y` · `web-design-guidelines` (linter UI complémentaire).

---

## M3 — Header/Footer + Layout `[locale]` + i18n (~3 j-h)

### Objectif

Implémenter le Header épuré 5 items + CTA central sticky + sélecteur FR·EN, le Footer 5 zones (Identité · Services · Ressources · Entreprise · Légal) avec Blog déplacé en zone Ressources, et le routing next-intl FR+EN avec pathnames localisés (`/cas-concrets` ↔ `/case-studies`, `/centre-aide` ↔ `/help-center`, etc.). Header mobile en 2 niveaux (logo+burger / barre CTA dédiée) avec drawer slide-in.

### Prérequis

M2 terminé. Lecture de `Navigation-Complete-AxionIA.md` §4 (header desktop + mobile + footer).

### Livrables

1. `lib/i18n/routing.ts` : configuration next-intl avec `defaultLocale: 'fr'`, `locales: ['fr', 'en']`, `pathnames` complets pour 9 slugs localisés (cas-concrets/case-studies, centre-aide/help-center, a-propos/about, etc.).
2. `lib/i18n/navigation.ts` : exports `Link`, `redirect`, `useRouter`, `usePathname` localisés.
3. `lib/i18n/request.ts` : chargement des messages par locale.
4. `middleware.ts` : next-intl middleware + redirection `/` → `/fr` ou `/en` selon `Accept-Language` (cookie `NEXT_LOCALE` 1 an).
5. `app/[locale]/layout.tsx` : `<html lang={locale}>`, providers (next-intl, theme), polices Manrope+Inconsolata, analytics Plausible self-hosted, métadonnées globales (Organization JSON-LD).
6. `app/[locale]/(public)/layout.tsx` : Header + Footer.
7. `components/layout/header/` :
   - `header.tsx` (Server Component pour markup principal).
   - `header-cta.tsx` (CTA central sticky avec prix dynamique fetché server-side).
   - `mobile-drawer.client.tsx` (drawer slide-in, focus trap, swipe close).
   - `language-switcher.client.tsx` (preserve pathname via next-intl).
8. `components/layout/footer/` :
   - `footer.tsx` (5 zones, Server Component).
   - `newsletter-form.client.tsx` (Server Action POST → BullMQ).
   - `mobile-accordion-footer.client.tsx` (5 accordéons fermés sauf Identité).
9. `messages/fr.json` + `messages/en.json` : clés Header/Footer + métadonnées globales (~80 clés initiales).
10. hreflang automatique sur chaque page via `generateMetadata` helper dans `lib/seo/`.

### Definition of Done

- `/` redirige vers `/fr` ou `/en` selon navigateur, mémorisé en cookie.
- Header desktop (≥1024px) affiche 5 items + CTA + sélecteur langue. Aucun dropdown.
- Header mobile (<1024px) affiche 2 niveaux (logo+burger / CTA bar). Drawer slide-in fonctionnel avec focus trap.
- Footer affiche 5 zones desktop, 5 accordéons mobile (sauf Identité ouverte).
- Switch de langue FR→EN sur `/fr/cas-concrets/abc` redirige vers `/en/case-studies/abc` (via pathnames + slug mappé).
- Tests Playwright : 7 viewports (375, 414, 768, 1024, 1280, 1440), navigation Header complète, drawer ouvre/ferme, switch langue préserve pathname.
- Lighthouse mobile ≥ 95 sur `/fr` minimal.

### Estimation : 3 j-h

1 j config next-intl + middleware + pathnames · 1,5 j Header desktop + mobile + drawer · 0,5 j Footer + newsletter form.

### Risques

- **Pathname mapping** : oublier un slug localisé casse le switch de langue. Mitigation : test E2E systématique sur les 9 slugs localisés.
- **Drawer mobile a11y** : focus trap + body scroll lock complexes. Mitigation : utiliser Radix Dialog (déjà dans shadcn) comme base.
- **CTA central prix dynamique** : si appel DB synchrone bloque le LCP. Mitigation : prix mis en cache Redis 5 min + ISR sur layout.

### Skills à charger

`axionia-i18n` · `axionia-design` · `axionia-mobile-first` · `axionia-a11y`.

---

## M4 — Pages publiques (par module — répartition fine) (~12 j-h)

### Objectif

Livrer **toutes les pages publiques des 3 modules** (19 pages × 2 langues) avec contenu copywriting v2 (corrigé du mot « formation »), bloc AEO 50-80 mots en haut, hero, sections produit, FAQ embarquée, CTA tunnel, témoignages et cas concret pertinents. Pages 100% Server Components avec îles client justifiées (Simulateur ROI, Calendrier visuel).

### Prérequis

M3 terminé. Mapping pages disponible (`_AUDIT/02b-mapping-pages.md`). Copywriting v2 prêt dans `messages/fr.json` + `messages/en.json`.

### Livrables — répartition fine

1. **Module 1 — Interventions (6 pages × 2 langues = 12 routes effectives)**
   - `/[locale]/interventions` (parent, simulateur ROI inline + calendrier preuve sociale + 5 cartes).
   - `/[locale]/interventions/essentielle` (★ OFFRE PHARE — landing dédiée 490/790/1190 €).
   - `/[locale]/interventions/equipes`.
   - `/[locale]/interventions/managers`.
   - `/[locale]/interventions/conference`.
   - `/[locale]/interventions/dirigeants`.
   - **~3 j-h.** Réutilise `<InterventionCard>`, `<PricingTable>`, `<AeoBlock>`, `<TestimonialEmbed>`.
2. **Module 2 — Audit (6 pages × 2 langues = 12 routes effectives) — REFACTOR 2026-05-07**
   - `/[locale]/audit` (listing avec 4 cartes diagnostic + `AuditHeroSchema`).
   - `/[locale]/audit/flash` (Diagnostic Flash — porte d'entrée).
   - `/[locale]/audit/process` (Audit Ciblé processus).
   - `/[locale]/audit/strategique-pme` (Audit stratégique PME 10-49).
   - `/[locale]/audit/strategique-eti` (Audit stratégique ETI 50+).
   - `/[locale]/audit/demande` (formulaire 5 étapes mutualisé pour les 4 niveaux).
   - **~2 j-h.** Tunnel form unifié au lieu de 4 forms intégrés.
     > Refactor 2026-05-07 (cf. `_AUDIT/02b-mapping-pages.md` v2 §3, `PROMPT-CODAGE.md` Sprint 6 réactualisé). Anciennes routes `/audit/{complet,departement,point-de-vente,cabinet}` SUPPRIMÉES.
3. **Module 3 — Implémentation IA (10 pages × 2 langues = 20 routes effectives)**
   - `/[locale]/implementation` (hub des 11 exemples + IA Custom).
   - `/[locale]/implementation/ia-custom` (PREMIUM 8k-50k €).
   - `/[locale]/implementation/chatbot`.
   - `/[locale]/implementation/processus`.
   - `/[locale]/implementation/structuration`.
   - `/[locale]/implementation/crm-erp`.
   - `/[locale]/implementation/documents`.
   - `/[locale]/implementation/agents`.
   - `/[locale]/implementation/integrations`.
   - `/[locale]/implementation/no-code`.
   - **~4 j-h.** Composant `<ImplementationCard>` + table 4 niveaux + 11 exemples mosaïque.
4. **Page d'accueil `/[locale]/`** (hero + bloc AEO + 3 modules + simulateur ROI + 3 cas concrets + 3 témoignages + CTA).
   - **~1 j-h.**
5. **Tests Playwright** : happy path FR + EN sur chaque page produit, viewport 375 + 1280, vérification du bloc AEO et du CTA.
   - **~2 j-h.**

### Definition of Done

- 19 pages × 2 langues vivent et passent `npm run build` sans warning.
- Chaque page a son `generateMetadata` (titre + description + canonical + hreflang + OG + Twitter).
- Bloc AEO 50-80 mots présent en tête de chaque page parent + page produit.
- Aucun `'use client'` non justifié (lint check).
- Toutes les chaînes via next-intl. Aucun texte en dur.
- Lighthouse mobile (3G simulé) ≥ 95 sur 5 pages clés (home, /fr/interventions/essentielle, /fr/audit, /fr/implementation, /fr/implementation/ia-custom).
- `messages/fr.json` + `messages/en.json` complets pour ces 19 pages.

### Estimation : 12 j-h

3+2+4+1+2 = 12 j-h. Inclut copywriting intégré et tests E2E par page.

### Risques

- **Volume de copywriting** : 19 pages × 2 langues = beaucoup de contenu. Mitigation : Will fournit le copy FR v2 corrigé en début de M4 ; EN traduit en parallèle (pas de blocage).
- **Simulateur ROI complexe** : interactions sliders + recalcul temps réel. Mitigation : isolé dans une île client `<RoiSimulator />`, géré en M5.
- **Calendrier preuve sociale** : nécessite données réelles. Mitigation : données mockées en M4, branchement DB en M8.

### Skills à charger

`axionia-seo-aeo` · `axionia-anti-spa` · `axionia-design` · `axionia-mobile-first` · `axionia-i18n`.

---

## M5 — Formulaires multi-step + Calendrier maison + Simulateur ROI (~6 j-h)

### Objectif

Implémenter les 3 features interactives critiques : (1) Formulaires multi-step (audit 5 étapes, implémentation 4 étapes, IA Custom 6 étapes, contact, newsletter) avec React Hook Form + Zod + Zustand pour persistance entre étapes ; (2) Calendrier maison avec 3 états (RÉSERVÉ/OPTION/DISPONIBLE) et option 48h ; (3) Simulateur ROI avec 3 sliders + recalcul temps réel.

### Prérequis

M4 terminé pour le contenant. M8 pas encore démarré → mocks API en attendant.

### Livrables

1. **Formulaires multi-step** (`features/intervention/components/`, `features/audit/components/`, `features/implementation/components/`) :
   - Schemas Zod par feature (`schemas.ts`).
   - Form RHF + persistance Zustand + sessionStorage.
   - Indicateur progression (1/5, 2/5, …) avec aria-current.
   - Gestion erreurs Zod + scroll vers premier champ en erreur.
   - Récap final (étape n/n) avec édition par section.
   - Anti-spam : honeypot + Turnstile + rate-limit Redis (10/h/IP) en M8.
   - **~2 j-h.**
2. **Calendrier maison** (`features/calendar/`) :
   - Composant visuel `<CalendarGrid>` avec 3 états couleurs (rouge/orange/vert).
   - Modal action sur clic créneau dispo (Réserver direct ou Poser option 48h).
   - Page `/[locale]/interventions/essentielle?error=slot_taken` (race condition).
   - Page `/[locale]/desabonnement` adaptée pour token option expirée.
   - Composant `<CountdownTimer>` pour option en cours.
   - **~2,5 j-h.**
3. **Simulateur ROI** (`features/intervention/components/roi-simulator.client.tsx`) :
   - 3 sliders (participants, salaire moyen, minutes/jour économisées).
   - Calcul temps réel avec debounce 100ms.
   - Affichage différencié ROI > 5x (badge succès) vs < 2x (texte rassurant).
   - Tabular figures sur stats.
   - **~1 j-h.**
4. **Tests Playwright** : 3 flows critiques (réservation Essentielle, demande audit, demande IA Custom) FR + EN.
   - **~0,5 j-h.**

### Definition of Done

- 4 formulaires multi-step fonctionnels avec validation Zod côté client + serveur (mock en M5, réel en M8).
- Calendrier maison : créneaux mockés affichés correctement, modal action ouvre, race condition gérée.
- Simulateur ROI : 3 sliders + recalcul fluide, debounce respecté.
- Touch targets ≥ 44×44px sur tous les inputs et boutons.
- `type="email"`, `type="tel"`, `inputmode="numeric"` corrects.
- `font-size: 16px` minimum sur inputs (anti-zoom iOS).
- Tests Playwright verts FR + EN sur les 3 flows.

### Estimation : 6 j-h

2 + 2,5 + 1 + 0,5 = 6 j-h.

### Risques

- **Race condition calendrier** : 2 visiteurs réservent le même créneau. Mitigation : verrou pessimiste Postgres `FOR UPDATE` en M8 ; en M5 mock + page d'erreur dédiée.
- **Persistance Zustand entre étapes** : risque de perte si user ferme l'onglet. Mitigation : sessionStorage + clé `form_draft_{type}` + expiration 1h.
- **Simulateur ROI sur mobile** : sliders fins peu accessibles tactile. Mitigation : sliders custom 44px+ avec valeurs steppables au tap.

### Skills à charger

`axionia-forms` · `axionia-calendar` · `axionia-mobile-first` · `axionia-a11y`.

---

## M6 — Pages transversales + légales + blog templates (~5 j-h)

### Objectif

Livrer les pages transversales (À propos, Contact, Confirmation, Désabonnement, Maintenance, Recherche), les 6 pages légales adaptées au droit estonien (Mentions légales, CGV, Politique de confidentialité, Cookies, RGPD, Accessibilité), et les templates des contenus indexables (Blog listing + article + catégorie + tag + auteur, FAQ listing + question + catégorie, Centre d'aide listing + article + catégorie, Cas concrets listing + cas + secteur, Témoignage individuel).

### Prérequis

M3 et M4 terminés.

### Livrables

1. **Pages transversales** (6 pages × 2 langues = 12 routes) :
   - `/[locale]/a-propos` (Schema AboutPage + Person, E-E-A-T).
   - `/[locale]/contact` (formulaire simple + coordonnées + carte iframe OpenStreetMap).
   - `/[locale]/confirmation` (page post-soumission, paramètres `?type=intervention&id=xxx`).
   - `/[locale]/desabonnement` (token signé RFC 8058).
   - `/[locale]/maintenance` (mode maintenance temporaire activé via env).
   - `/[locale]/recherche` (cross-content blog + FAQ + aide + cas concrets).
   - **~1,5 j-h.**
2. **Pages légales** (6 pages × 2 langues = 12 routes) :
   - Layout `(legal)` dédié avec sommaire latéral.
   - Contenu légal estonien (à fournir par Will / Cabinet juridique).
   - Mentions légales : OÜ + numéro registrikood + adresse Tallinn + hébergeur.
   - CGV : droit estonien.
   - Politique de confidentialité : RGPD + AKI estonienne (équivalent CNIL).
   - Cookies : Plausible self-hosted = pas de bannière obligatoire (mais déclaration).
   - RGPD : droits utilisateurs + recours AKI.
   - Accessibilité : déclaration WCAG 2.2 AA.
   - **~1,5 j-h.**
3. **Templates contenus indexables** (5 templates × 2 langues, contenu mocké) :
   - `/[locale]/blog/[slug]` + listing + catégorie + tag + auteur.
   - `/[locale]/faq/[slug]` + listing accordéon + catégorie.
   - `/[locale]/centre-aide/[slug]` + listing + catégorie.
   - `/[locale]/cas-concrets/[slug]` + listing filtrable + secteur.
   - `/[locale]/temoignages/[slug]`.
   - Composant `<BreadcrumbList>` partagé.
   - **~1,5 j-h.**
4. **Pages d'erreur** :
   - `/[locale]/not-found.tsx` (404 utile avec recherche + 4 liens utiles).
   - `/[locale]/error.tsx` (500 rassurant + Sentry auto-notify).
   - **~0,5 j-h.**

### Definition of Done

- 18 pages transversales/légales + 5 templates de contenus vivent.
- Layout `(legal)` rend correctement avec sommaire latéral.
- Pages légales conformes droit estonien (validées par Will / cabinet juridique).
- Templates blog/FAQ/aide/cas concrets fonctionnent avec données mockées (basculement DB en M8).
- Breadcrumbs JSON-LD émis sur toutes les pages éligibles.
- Tests Playwright : 404 affiche recherche, désabonnement avec token valide affiche confirmation.

### Estimation : 5 j-h

1,5 + 1,5 + 1,5 + 0,5 = 5 j-h.

### Risques

- **Contenu juridique estonien** : nécessite validation Will / cabinet. Mitigation : Will fournit textes ou valide ChatGPT-draft avant intégration.
- **AKI déclaration RGPD** : démarche externe potentielle. Mitigation : à clarifier avec Will en début de M6 ; si non bloquant, intégrer placeholder.

### Skills à charger

`axionia-i18n` · `axionia-seo-aeo` · `axionia-rgpd` · `axionia-a11y`.

---

## M7 — Schémas SEO/AEO/JSON-LD + sitemap + robots + llms.txt + IndexNow (~3 j-h)

### Objectif

Implémenter la couche SEO/AEO complète : sitemap multilingue multi-fichier, robots.txt, llms.txt, protocole IndexNow, JSON-LD sur chaque page (Organization, Service, Offer, FAQPage, Article, BreadcrumbList, Person, Review selon contexte), OG images dynamiques par page via Edge runtime + `@vercel/og`.

### Prérequis

M4 et M6 terminés.

### Livrables

1. **`app/sitemap.ts`** : sitemap-index multilingue + sitemap-pages-fr.xml + sitemap-pages-en.xml + sitemap-blog-fr.xml + sitemap-blog-en.xml + sitemap-faq-fr.xml + sitemap-faq-en.xml + sitemap-aide-fr.xml + sitemap-aide-en.xml + sitemap-cas-fr.xml + sitemap-cas-en.xml. Edge runtime.
2. **`app/robots.ts`** : disallow `/admin`, `/api`, `/confirmation`, `/desabonnement` ; sitemap-index référencé.
3. **`app/llms.txt/route.ts`** : Edge runtime, généré dynamiquement à partir des contenus publiés.
4. **`public/.well-known/indexnow.txt`** : clé IndexNow + script de notification automatique sur publication article (M9 admin).
5. **`components/seo/JsonLd.tsx`** : composant générique + helpers spécifiques (`OrganizationJsonLd`, `ServiceJsonLd`, `OfferJsonLd`, `FAQPageJsonLd`, `ArticleJsonLd`, `BreadcrumbListJsonLd`, `PersonJsonLd`, `ReviewJsonLd`, `LocalBusinessJsonLd` non utilisé — cabinet UE distant).
6. **`app/api/og/[locale]/[slug]/route.ts`** : Edge, `@vercel/og`, design Webflow-inspired (Webflow Blue + Manrope).
7. **`opengraph-image.tsx`** sur `app/[locale]/(public)/`, `app/[locale]/(public)/interventions/`, etc. — fallback OG par défaut.
8. **`lib/seo/`** : helpers `generateMetadataForPage()`, `generateHreflangAlternates()`, `getCanonicalUrl()`.
9. **Tests** : validation Schema.org via Rich Results Test (snapshot tests Vitest sur les builders JSON-LD).

### Definition of Done

- `/sitemap.xml` retourne un sitemap-index valide.
- `/robots.txt` correct avec disallow admin/api.
- `/llms.txt` retourne un manifest valide et à jour.
- Chaque page a son JSON-LD adapté (cf. mapping Livrable 3 `02b-mapping-pages.md`).
- Validation Google Rich Results Test passe sur 5 pages clés (home, intervention essentielle, audit, FAQ slug, blog slug).
- OG image dynamique générée en < 200ms (Edge).
- Hreflang automatique correct sur toutes les pages.
- IndexNow ping déclenché à la publication d'un article (test en M9).

### Estimation : 3 j-h

0,5 j sitemap + robots + llms.txt · 1 j composants JSON-LD + intégration sur pages · 1 j OG images dynamiques · 0,5 j tests + validation.

### Risques

- **JSON-LD invalide** : casse les rich results. Mitigation : tests snapshot + validation Rich Results Test en CI.
- **OG images Edge runtime** : incompatibilités avec polices custom. Mitigation : utiliser `font.local()` ou polices Google bundlées en base64.
- **llms.txt format** : standard mouvant. Mitigation : suivre la spec en vigueur 2026.

### Skills à charger

`axionia-seo-aeo` · `schema-markup` · `ai-seo`.

---

## M8 — Backend : Prisma + Auth.js v5 + server actions + BullMQ + email maison PowerMTA (~6 j-h)

### Objectif

Implémenter toute la couche backend : schema Prisma complet (18 tables), migrations, seeders FR+EN, Auth.js v5 + 2FA TOTP pour admin, Server Actions pour toutes les mutations (réservation, options 48h, soumissions, newsletter, CMS admin), BullMQ workers (envoi emails, expiration option 48h, indexation search), intégration PowerMTA + MailWizz + Nodemailer + 16 templates React Email (8 × 2 langues).

### Prérequis

M5 (formulaires) et M7 (SEO) terminés.

### Livrables

1. **Schema Prisma complet** (`prisma/schema.prisma`) :
   - 18 tables (cf. CLAUDE.md v6 §13) : `submissions`, `bookings`, `calendar_slots`, `bookings_options`, `articles`, `article_translations`, `article_tags`, `authors`, `testimonials`, `case_studies`, `faqs`, `help_articles`, `surveys`, `survey_responses`, `categories`, `admin_users`, `activity_logs`, `settings`, `newsletter_subscribers`.
   - Multilingue : option (b) tables de traduction pour articles/cas concrets, option (a) champs `*_fr`/`*_en` pour FAQ/témoignages.
   - Index sur slugs UNIQUE par locale, FTS tsvector pour recherche.
2. **Migrations** + **seeders** (FR+EN) avec données de démo (3 cas concrets, 5 articles blog, 20 FAQ, 10 articles aide, 6 témoignages).
3. **Auth.js v5** (`lib/auth.ts`) : Credentials provider + 2FA TOTP (verrouillé sur `/admin/2fa` après login) + session JWT + Prisma adapter.
4. **Server Actions par feature** (`features/{nom}/actions.ts`) :
   - `createBooking` (intervention).
   - `postOption48h` (avec verrou pessimiste Postgres).
   - `submitAudit` / `submitImplementation` / `submitContact`.
   - `subscribeNewsletter` / `unsubscribeNewsletter`.
   - Admin : `validateOption`, `refuseOption`, `publishArticle`, `updatePricing`.
   - Chaque action : `await rateLimit(ip)` + `schema.parse(input)` + Zod validation server-side.
5. **BullMQ workers** (`server/jobs/`) :
   - `email-worker.ts` : consume queue `emails` → Nodemailer → SMTP localhost:2525 (PowerMTA).
   - `option-expiration-worker.ts` : cron toutes les 5min → libère options expirées.
   - `option-reminder-worker.ts` : cron horaire → envoie rappel à H+24.
   - `newsletter-worker.ts` : campagnes via MailWizz API.
   - `search-indexer.ts` : reindex tsvector à la publication.
6. **Email maison** (`lib/email/`) :
   - `client.ts` : Nodemailer SMTP localhost:2525.
   - `queue.ts` : producteur BullMQ.
   - `templates/` : 16 templates React Email (cf. CLAUDE.md v6 §11).
   - DKIM 2048 + SPF strict + DMARC + BIMI configurés sur DNS Cloudflare (M11).
   - Warmup IP progressif (script `scripts/warmup-ip.ts`).
7. **Telegram notifications** (`lib/telegram.ts`) : tags `[INTERVENTION]`, `[OPTION]`, `[OPTION CONFIRMÉE]`, `[OPTION EXPIRÉE]`, `[ANNULATION]`, `[AUDIT]`, `[AUTO]`, `[CONTACT]`, `[NEWSLETTER]`.
8. **Branchement front → back** : remplacement des mocks M4-M5-M6 par appels Server Actions réels.

### Definition of Done

- `prisma migrate dev` passe sans erreur, seed alimente la DB de démo.
- Login admin fonctionne avec 2FA TOTP (testé sur Google Authenticator).
- Réservation Essentielle complète end-to-end : formulaire → server action → Prisma → email confirmation FR/EN → Telegram → calendrier mis à jour.
- Option 48h avec verrou pessimiste : 2 visiteurs concurrents → 1 succès, 1 page race condition.
- Email envoyé via Mailhog (dev) avec DKIM (à valider M11 en prod).
- 16 templates React Email rendent correctement (preview avec `react-email dev`).
- BullMQ workers tournent en background, traitent la queue.
- Tests Vitest unit sur schemas Zod, Vitest integration sur 3 actions critiques avec test DB.

### Estimation : 6 j-h

1,5 j Prisma + migrations + seed · 1 j Auth.js + 2FA · 1,5 j Server Actions + intégration front · 1 j BullMQ + email + Telegram · 1 j tests + branchement.

### Risques

- **PowerMTA setup local** : difficile de simuler en dev. Mitigation : Mailhog en dev, PowerMTA réel en M11.
- **Verrou pessimiste Postgres** : peut bloquer en cas d'erreur applicative. Mitigation : timeout transaction + try/catch + libération auto.
- **Auth.js v5 (beta)** : breaking changes possibles. Mitigation : pinner version exacte, migration documentée si bump.

### Skills à charger

`axionia-database` · `axionia-emails` · `axionia-forms` · `axionia-calendar` · `axionia-rgpd`.

---

## M9 — Console admin (14 sections) (~6 j-h)

### Objectif

Construire la console d'administration complète sous `/[ADMIN_URL_PREFIX]/` (FR uniquement, mais permet de gérer les contenus FR ET EN avec toggle). 14 sections : Tableau de bord, Calendrier, Options, Soumissions, Blog, Cas concrets, Témoignages, FAQ, Centre d'aide, Catégories, Newsletter, Paramètres (prix dynamiques, simulateur, CTA), Utilisateurs (4 rôles + 2FA), Activity logs.

### Prérequis

M8 terminé.

### Livrables

1. **Layout admin** (`app/[locale]/(admin)/[ADMIN_URL_PREFIX]/layout.tsx`) :
   - Auth gate (redirige `/login` si non connecté, `/2fa` si TOTP non vérifié).
   - Sidebar gauche fixe 240px desktop, bottom nav 5 items mobile.
   - Topbar : recherche globale, notifications (bell), sélecteur langue preview, profile dropdown.
2. **Tableau de bord** (`/`) : KPIs jour/semaine/mois + alertes (options en attente, nouvelles soumissions).
3. **Calendrier** (`/calendrier`) : vue mois + validation options + blocage dates avec raison.
4. **Options** (`/options`) : liste options en attente avec timer 48h, actions valider/refuser/demander info.
5. **Soumissions** (`/soumissions`) : tous formulaires, filtres par type/locale/date, export CSV.
6. **Blog** (`/blog`) : CRUD articles avec Tiptap éditeur + toggle FR/EN + génération slug auto + IndexNow ping à la publication.
7. **Cas concrets** (`/cas-concrets`) : CRUD avec résultats chiffrés + secteur + module utilisé.
8. **Témoignages** (`/temoignages`) : CRUD avec slug UNIQUE + photos.
9. **FAQ** (`/faq`) : CRUD avec slug auto + catégorisation.
10. **Centre d'aide** (`/centre-aide`) : CRUD avec flag `is_tutorial` (Schema HowTo).
11. **Catégories** (`/categories`) : tags + auteurs blog + catégories transverses.
12. **Newsletter** (`/newsletter`) : abonnés, exports, segmentation langue, intégration MailWizz API pour campagnes.
13. **Paramètres** (`/parametres`) : prix dynamiques (3 modules), simulateur ROI tuning, CTA central texte/prix, tranches participants, mode maintenance.
14. **Utilisateurs** (`/utilisateurs`) : 4 rôles (Super Admin / Admin / Éditeur / Lecteur), gestion comptes + reset 2FA + activity logs par user.

### Definition of Done

- 14 sections accessibles et fonctionnelles avec données réelles (issues de M8).
- Sidebar desktop + bottom nav mobile testés sur 3 viewports.
- 4 rôles avec permissions différenciées (Lecteur ne peut pas éditer, Éditeur ne peut pas gérer utilisateurs).
- Tiptap éditeur fonctionne avec images (upload Hetzner Storage Box).
- Toggle FR/EN sur chaque éditeur de contenu (article, cas concret, FAQ, etc.) sauvegarde les deux versions sans écraser.
- Export CSV soumissions avec encodage UTF-8 BOM (Excel-compatible).
- Activity logs enregistre toutes actions admin (création, édition, suppression, validation).
- Tests Playwright admin : login + 2FA, validation option, publication article, modification prix.

### Estimation : 6 j-h

1 j layout + auth + dashboard · 1,5 j calendrier + options + soumissions · 2 j CMS contenus (blog, cas, témoignages, FAQ, aide, catégories) · 1 j newsletter + paramètres + utilisateurs · 0,5 j tests.

### Risques

- **Tiptap + uploads images** : complexité moyenne. Mitigation : utiliser `@tiptap/extension-image` + endpoint upload S3-compatible Hetzner.
- **4 rôles + permissions** : risque oubli check côté action. Mitigation : middleware central de permissions sur Server Actions admin.
- **Toggle FR/EN** : complexité UX (ne pas perdre les saisies). Mitigation : Zustand par éditeur + warning avant changement de langue si dirty.

### Skills à charger

`axionia-admin-ux` · `axionia-database` · `axionia-i18n` · `owasp-security`.

---

## M10 — Tests E2E + Lighthouse CI + sécurité (OWASP/Turnstile/CSP) (~4 j-h)

### Objectif

Couverture qualité complète : tests E2E Playwright sur les 7 flows critiques (cf. `Navigation-Complete-AxionIA.md` §3), Lighthouse CI bloquant en pre-merge sur seuils stricts (Perf ≥ 95, A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 100, LCP < 1.8s, INP < 80ms, CLS < 0.05), sécurité OWASP Top 10 + Turnstile + CSP strict + headers de sécurité + audit `npm audit` + scan SAST GitHub.

### Prérequis

M9 terminé.

### Livrables

1. **Tests Playwright** (`tests/e2e/`) :
   - `flow-1-booking-essentielle.spec.ts` (FR + EN).
   - `flow-2-option-48h.spec.ts` (avec race condition simulée).
   - `flow-3-audit-request.spec.ts`.
   - `flow-4-implementation-request.spec.ts`.
   - `flow-5-aeo-faq-entry.spec.ts` (depuis `/faq/[slug]`).
   - `flow-6-admin-validate-option.spec.ts` (login + 2FA + validation).
   - `flow-7-language-switch.spec.ts` (préservation pathname + données form).
   - 7 viewports × 2 langues = ~14 runs par flow.
2. **Tests axe-core** : injection sur chaque page de référence en CI, échec si violation A11y critique.
3. **Lighthouse CI** :
   - Config `.lighthouseci/config.js` avec budgets stricts (LCP < 1.8s, INP < 80ms, CLS < 0.05, Lighthouse mobile > 95).
   - Run sur 8 URLs clés (home, /interventions/essentielle, /audit, /implementation, /implementation/ia-custom, /blog, /faq, /cas-concrets) en FR + EN.
   - Bloquant en pre-merge.
4. **Sécurité OWASP** :
   - Cloudflare Turnstile sur tous les formulaires publics.
   - Honeypot field (caché CSS) sur chaque formulaire.
   - Rate-limit Redis 10/h/IP par formulaire.
   - CSP strict (`script-src 'self'`, `style-src 'self' 'unsafe-inline'` pour Tailwind, `img-src 'self' data:`, etc.).
   - Headers : `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
   - Validation Zod côté serveur sur 100% des inputs.
   - Tokens CSRF sur formulaires non-Action (Route Handlers).
   - HTTPS forcé en prod.
   - Logs admin (activity_logs) pour audit trail.
5. **Scans automatisés** :
   - `npm audit` en CI (fail si HIGH+).
   - GitHub CodeQL SAST scan.
   - Snyk ou OWASP Dependency-Check (optionnel).
6. **Tests de charge** : k6 ou Artillery sur 3 endpoints critiques (POST option 48h, GET /api/calendar/slots, POST submit audit) — 100 RPS soutenu.

### Definition of Done

- 7 flows E2E verts en FR + EN sur 7 viewports en CI.
- Lighthouse CI vert sur 8 URLs clés × 2 langues = 16 audits.
- axe-core 0 violation critique.
- CSP strict actif, testé via securityheaders.com (cible A+).
- Turnstile + honeypot + rate-limit testés (envoi 11e formulaire en 1h → bloqué).
- `npm audit` clean, CodeQL clean.
- Test charge : 100 RPS pendant 60s sans erreur 5xx.

### Estimation : 4 j-h

1,5 j Playwright E2E (7 flows × 2 langues) · 0,5 j axe-core + Lighthouse CI · 1,5 j sécurité OWASP + Turnstile + CSP + headers · 0,5 j tests charge.

### Risques

- **CSP strict casse Plausible self-hosted** : potentiel. Mitigation : whitelister explicitement `plausible.axion-ia.com` dans `script-src` et `connect-src`.
- **Turnstile en dev** : nécessite clés test Cloudflare. Mitigation : feature flag `TURNSTILE_ENABLED` désactivable en local.
- **Test charge sur Postgres mockée** : pas représentatif. Mitigation : lancer test charge sur staging avec DB de démo réaliste.

### Skills à charger

`axionia-testing` · `axionia-performance` · `owasp-security` · `axionia-a11y`.

---

## M11 — Déploiement Hetzner + Coolify + Cloudflare + monitoring (~3 j-h)

### Objectif

Mise en production : provisionnement Hetzner CX32 Frankfurt + Storage Box BX11 + IP dédiée mail, Coolify self-hosted, déploiement Docker Compose (Next.js + Postgres 16 + Redis 7 + PowerMTA + MailWizz + Plausible + Sentry self-hosted + Uptime Kuma), Cloudflare proxy + WAF + DDoS + CDN, Let's Encrypt SSL, DNS configuré (A, AAAA, MX, SPF, DKIM 2048, DMARC, BIMI, IndexNow), warmup IP email progressif, sauvegardes Postgres quotidiennes chiffrées sur Storage Box, monitoring Sentry + Uptime Kuma + Pino.

### Prérequis

M10 terminé. VPS Hetzner provisionné, domaine acquis, IP dédiée commandée.

### Livrables

1. **Provisionnement Hetzner** :
   - VPS CX32 Frankfurt (4 vCPU, 8 GB RAM, 80 GB NVMe).
   - Storage Box BX11 (1 TB) configuré S3-compatible.
   - IP dédiée mail (rDNS configuré sur `mail.axion-ia.com`).
   - Backups Hetzner natif activés (quotidien).
   - Hardening serveur : ufw firewall, fail2ban, SSH key only, désactivation root login, mises à jour auto sécurité.
2. **Coolify self-hosted** : installation, dashboard, GitHub integration, auto-deploy sur push `main`.
3. **Docker Compose** (`docker/docker-compose.yml`) :
   - Service `app` (Next.js standalone build).
   - Service `postgres` (16 + volume persistant + extension pg_trgm).
   - Service `redis` (7).
   - Service `powermta` (config + queues).
   - Service `mailwizz` (sur sous-domaine `mailwizz.axion-ia.com`).
   - Service `plausible` (analytics).
   - Service `sentry` (error monitoring self-hosted).
   - Service `uptime-kuma` (sur sous-domaine `status.axion-ia.com`).
   - Reverse proxy Caddy (auto SSL Let's Encrypt).
4. **DNS Cloudflare** :
   - A/AAAA `axion-ia.com` → IP Hetzner (proxied).
   - CNAME `www` → `axion-ia.com` (proxied).
   - A/AAAA `staging.axion-ia.com` → IP Hetzner staging (proxied).
   - A `mail.axion-ia.com` → IP dédiée mail (DNS-only, JAMAIS proxied).
   - A `mailwizz.axion-ia.com` → IP Hetzner (proxied).
   - A `plausible.axion-ia.com` → IP Hetzner (proxied).
   - A `status.axion-ia.com` → IP Hetzner (proxied).
   - MX `axion-ia.com` → `mail.axion-ia.com` priorité 10.
   - TXT SPF : `v=spf1 ip4:<IP_DEDIEE> -all`.
   - TXT DKIM 2048 (généré par PowerMTA) sur `default._domainkey.axion-ia.com`.
   - TXT DMARC : `v=DMARC1; p=quarantine; rua=mailto:dmarc@axion-ia.com; pct=100`.
   - TXT BIMI : `v=BIMI1; l=https://axion-ia.com/bimi/logo.svg`.
   - TXT IndexNow + verifications (Google Search Console, Bing Webmaster).
5. **Cloudflare** : proxy ON sur `axion-ia.com` + `www` (pas sur mail.\*), WAF ruleset OWASP, Bot Fight Mode, Rate Limiting, page rules de cache, headers de sécurité.
6. **Sauvegardes Postgres** : `scripts/backup-postgres.ts` cron quotidien 3h UTC → dump chiffré (gpg) → upload Storage Box → rétention 30 jours + 12 mensuels.
7. **Warmup IP** : `scripts/warmup-ip.ts` lancé S1 (10/jour) → S6 (2000+/jour). Suivi via PowerMTA logs + DMARC reports.
8. **Monitoring** :
   - Sentry self-hosted : DSN dans env, source maps uploadées au build.
   - Uptime Kuma : monitor sur `https://axion-ia.com/`, `/fr`, `/en`, `/api/calendar/slots`, `mail.axion-ia.com:25` (port mail), Postgres ping.
   - Alertes Telegram sur incident (downtime > 2 min, erreur 5xx récurrente).
9. **Runbook ops** : document `docs/ops/runbook.md` avec procédures (rollback, restart service, restauration backup, ajout admin).

### Definition of Done

- `https://axion-ia.com/fr` répond en prod, Lighthouse mobile ≥ 95.
- TLS A+ sur SSL Labs.
- securityheaders.com → A+.
- DKIM + SPF + DMARC validés (mail-tester.com → 10/10).
- Premier email de test (réservation Essentielle) reçu en boîte de réception (pas spam).
- Sentry capture une erreur de test.
- Uptime Kuma vert sur tous les monitors.
- Backup Postgres exécuté avec succès, restauration testée sur staging.
- Coolify auto-deploy déclenché par push `main` → app redéployée en < 3 min.
- Telegram alerte fonctionne (test : couper Postgres → alerte reçue).

### Estimation : 3 j-h

0,5 j provisionnement Hetzner + hardening · 1 j Coolify + Docker Compose + Cloudflare + DNS · 0,5 j PowerMTA + MailWizz + DKIM/SPF/DMARC · 0,5 j sauvegardes + monitoring · 0,5 j tests prod + warmup IP + runbook.

### Risques

- **Délivrabilité email** : nouvelle IP = réputation 0. Mitigation : warmup progressif + monitoring DMARC + premier mois envoi limité aux confirmations transactionnelles.
- **Cloudflare proxy + Server-Sent Events** : pas utilisé en v1, OK.
- **Backups chiffrés** : si clé GPG perdue, backups inutilisables. Mitigation : clé GPG sauvegardée dans 2 endroits sécurisés (1Password + clé physique).
- **PowerMTA licence** : payante. Mitigation : confirmer achat licence avant M11 (cf. Dépendances externes).

### Skills à charger

`axionia-deployment` · `axionia-monitoring` · `axionia-emails` · `axionia-rgpd`.

---

## Risques transverses

### R1 — Direction visuelle Webflow-inspired vs positionnement B2B premium

**Description** : la palette Webflow (Webflow Blue + 6 secondaires) est associée à un grand public/no-code, alors qu'AxionIA cible un B2B premium (cabinet IA McKinsey-like).
**Impact** : potentielle perception « grand public » par les décideurs C-level, baisse de conversion sur cibles dirigeantes.
**Mitigation** :

- Discipline secondaires stricte (1 par module, jamais 3+ sur une section).
- 80% canvas blanc dominant.
- Manrope (substitut WF Visual Sans) lisible et premium.
- Validation visuelle Will sur 3 maquettes clés en M2.
- Surveiller retours décideurs en M11+ ; possibilité de pivot palette en mineur via les CSS variables.

### R2 — Volume de copywriting FR + EN

**Description** : ~~~61 templates × 2 langues~~ → **64 routes templates HEAD × 2 langues** (cf. `_AUDIT/02b-mapping-pages.md` v2) = volume rédactionnel conséquent, particulièrement sur les pages produit modules (19 pages) et les contenus indexables (blog, FAQ, aide, cas concrets, témoignages).
**Impact** : retard M4-M6 si copy non livré à temps.
**Mitigation** :

- Will fournit le copy FR v2 corrigé (sans « formation ») au démarrage de M4.
- EN traduit en parallèle par Will ou via Claude (validation Will obligatoire avant intégration).
- Templates de contenus (blog, FAQ, aide, cas) vivent avec données mockées en M6, basculement réel en M9 admin.

### R3 — Auth.js v5 (beta) + breaking changes

**Description** : Auth.js v5 est en beta, des breaking changes peuvent survenir entre M1 et M11.
**Impact** : refonte partielle de la couche auth admin si bump majeur.
**Mitigation** :

- Pinner version exacte au démarrage (M1).
- Migration documentée si bump nécessaire.
- Surveiller le changelog NextAuth.js / Auth.js mensuellement.
- Possibilité de fallback vers une auth maison simple (email/password + JWT + 2FA TOTP custom) si blocage.

### R4 — Délivrabilité email (PowerMTA + IP fraîche)

**Description** : nouvelle IP = réputation 0 chez Gmail/Outlook/Yahoo. Risque que les emails de confirmation tombent en spam.
**Impact** : visiteurs ne reçoivent pas leur confirmation de réservation → perte de confiance + appels au support.
**Mitigation** :

- Warmup IP progressif strict (10 → 2000+/jour sur 6 semaines).
- DKIM 2048 + SPF strict + DMARC + BIMI dès J1.
- Domaine `mail.axion-ia.com` séparé (réputation indépendante du domaine principal).
- Monitoring DMARC reports + Postmaster Tools Google + Microsoft SNDS.
- Validation `mail-tester.com` → 10/10 avant M11.
- Premier mois : limiter à transactionnels uniquement, pas de newsletter.

### R5 — Race conditions sur le calendrier (option 48h)

**Description** : 2 visiteurs réservent ou posent option sur le même créneau dans la même seconde.
**Impact** : double réservation, frustration utilisateur, image dégradée.
**Mitigation** :

- Verrou pessimiste Postgres `SELECT ... FOR UPDATE` dans la Server Action `postOption48h` / `createBooking`.
- Page dédiée race condition (`/interventions/essentielle?error=slot_taken`) avec 3 alternatives.
- Données de formulaire préservées en localStorage 1h.
- Tests Playwright simulant 2 requêtes concurrentes en M10.

### R6 — Conformité RGPD + AKI estonienne

**Description** : société estonienne soumise à RGPD + autorité estonienne AKI. Mentions légales et pages de confidentialité doivent être conformes.
**Impact** : risque légal en cas de non-conformité (amendes RGPD jusqu'à 4% CA).
**Mitigation** :

- Plausible self-hosted (pas de bannière cookie obligatoire).
- Pas de tracking tiers (pas de Google Analytics, pas de Facebook Pixel).
- DPO email `dpo@axion-ia.com` opérationnel.
- Procédures droits RGPD documentées (accès, rectification, suppression, portabilité, opposition).
- Validation Will / cabinet juridique sur les pages légales avant M11.

### R7 — Performance budgets stricts (LCP < 1.8s, INP < 80ms, Lighthouse > 95)

**Description** : budgets très stricts, en dessous des recommandations Google standard. Risque que l'évolution des contenus (images, blog) dégrade les scores.
**Impact** : baisse SEO + UX dégradée mobile.
**Mitigation** :

- Lighthouse CI bloquant en pre-merge dès M10.
- Bundle analyzer en surveillance continue.
- Images via `next/image` avec dimensions fixes (CLS = 0).
- Polices via `next/font` (preload + swap).
- Speculation Rules + PPR adoptés progressivement.
- Plafond bundle First Load JS < 80 kB par page.

### R8 — Volume de tests E2E × 2 langues × 7 viewports

**Description** : 7 flows × 2 langues × 7 viewports = 98 runs Playwright. Temps CI long.
**Impact** : CI lente → frustration dev, risque de skip.
**Mitigation** :

- Parallélisation Playwright (10 workers).
- Smoke test minimal sur PR (3 flows × 2 langues × 2 viewports = 12 runs).
- Full E2E sur merge `main` uniquement.
- Timeout par test 30s strict.

---

## Dépendances externes

### D1 — Police premium (Manrope)

**Question** : Manrope (Google Fonts, gratuite) est le substitut open-source de WF Visual Sans Variable propriétaire. Est-ce que Will souhaite acquérir une police premium payante (ex : Söhne, Inter Display custom, Beausite) à la place ?
**Statut** : Manrope retenue (gratuite, conforme ADR 0001, suffisamment proche). À reconfirmer si Will souhaite une élévation visuelle premium en post-launch.
**Bloquant pour** : M2.

### D2 — Licence PowerMTA

**Question** : PowerMTA est un produit commercial Sparkpost (anciennement Port25). Coût licence ~3000-5000 USD/an pour l'édition pro.
**Statut** : Will maîtrise PowerMTA via SOS-Expat (licence existante ?). À confirmer :

- Licence transférable / partageable avec AxionIA ?
- Si non, achat dédié AxionIA OUI/NON ?
- Alternative : Postfix + OpenDKIM si licence indisponible (perte d'expertise Will + délivrabilité moindre).
  **Statut** : DÉCISION REQUISE avant M8 (intégration emails) et M11 (déploiement).
  **Bloquant pour** : M8 (en partie, peut être mocké), M11 (totalement).

### D3 — VPS Hetzner provisionné

**Question** : VPS Hetzner CX32 Frankfurt commandé ? Storage Box BX11 commandé ? IP dédiée mail commandée ? Domaine `axion-ia.com` acquis ?
**Statut** : à confirmer par Will au démarrage M1.
**Bloquant pour** : M11 (totalement). M1 peut démarrer avec Docker local.

### D4 — Comptes tiers

**Question** : Cloudflare account créé ? GitHub repo créé ? Telegram Bot créé (pour notifications) ? Cabinet juridique pour validation pages légales ?
**Statut** : à clarifier en M1.
**Bloquant pour** : M3 (Telegram en dev OK avec bot test), M6 (pages légales validées avant prod), M11 (Cloudflare obligatoire).

### D5 — Authority Indication (AKI)

**Question** : déclaration RGPD à l'AKI estonienne nécessaire ? Numéro registrikood OÜ obtenu ? TVA EE obtenue ?
**Statut** : à clarifier par Will / Cabinet juridique. Variables d'env `COMPANY_REGISTRATION_NUMBER`, `COMPANY_VAT_NUMBER` à compléter avant M11.
**Bloquant pour** : M11 (mentions légales prod).

### D6 — Copywriting v2 corrigé

**Question** : Will fournit-il le copywriting FR v2 (corrigé du mot « formation », adapté société estonienne, multilingue) avant M4 ?
**Statut** : OK existant dans le dossier `00-Synthese-Globale` à corriger.
**Bloquant pour** : M4 (peut démarrer avec placeholders, mais retard intégration finale).

### D7 — Validation visuelle ADR 0001

**Question** : Will valide-t-il visuellement la direction Webflow-inspired sur 3 maquettes clés en M2 (home, intervention essentielle, audit) avant de scaler aux 19 pages produit en M4 ?
**Statut** : checkpoint M2 → M4.
**Bloquant pour** : M4 (sans validation, risque de refonte massive).

### D8 — Identité société (nom commercial)

**Question** : Will fournit-il le nom commercial d'AxionIA OÜ avant M11 ?
**Statut** : variable `COMPANY_NAME` à compléter avant prod. Tant que vide, footer affiche « AxionIA OÜ · Tallinn · [numéro à compléter] ».
**Bloquant pour** : M11 (mentions légales).

---

## Récapitulatif

| Jalon                                    | Estimation | Cumul |
| ---------------------------------------- | ---------- | ----- |
| M1 — Setup                               | 3 j-h      | 3     |
| M2 — Design tokens + UI                  | 5 j-h      | 8     |
| M3 — Header/Footer + i18n                | 3 j-h      | 11    |
| M4 — Pages publiques                     | 12 j-h     | 23    |
| M5 — Forms + Calendrier + ROI            | 6 j-h      | 29    |
| M6 — Transversales + Légales + Templates | 5 j-h      | 34    |
| M7 — SEO/AEO                             | 3 j-h      | 37    |
| M8 — Backend                             | 6 j-h      | 43    |
| M9 — Console admin                       | 6 j-h      | 49    |
| M10 — Tests + sécurité                   | 4 j-h      | 53    |
| M11 — Déploiement                        | 3 j-h      | 56    |
| **TOTAL**                                | **56 j-h** |       |

À raison de 5 j-h/semaine : **~11-12 semaines calendaires** (hors aléas, dépendances externes, validations Will).
À raison de 4 j-h/semaine : **~14 semaines**.

**Date cible launch v1** : selon démarrage et rythme — à valider avec Will. Plan compatible avec une livraison Q3 2026 si démarrage immédiat.

---

## Annexe — Sprints intermédiaires livrés (post-publication v1, ratifiés 2026-05-07)

> Ajoutée 2026-05-07 par DOC-SYNC V14 (cf. `_AUDIT/sync-snapshot.md`).

| Sprint     | Jalon        | Livré                                                                                                                                                                                           | Référence                                                   |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 14.5       | M2-M4 polish | Pivot doctrine v3 « Editorial Premium Light » (mocha + terracotta + Fraunces serif italique)                                                                                                    | ADR 0002, 22 commits `5942d2f`→`941a8e1` pushed origin/main |
| 14.6       | M6           | Espace presse `/presse` GEO E-E-A-T + `content/press.ts` (22 entités)                                                                                                                           | commit `38879bc`                                            |
| 14.7       | M2/M4        | Visual rhythm A+B (placeholder infra + 6 hero schemas + 17 pages) + ADR 0004 typography v3.1 (body 18px, text-sm 15px, lh 1.7)                                                                  | commit `dbc39b3`, ADR 0004                                  |
| 14.8       | M7           | AEO/GEO 2026 perfection : sitemap-index Next 16 + 6 sous-sitemaps, 5 nouvelles factories JSON-LD (Person, FaqSpeakable, LocalBusiness, Place, ItemList), Person `/a-propos`, BlogPost.updatedAt | commits `eda574b`, `5d9d527`, `c884acc`, `fd91518`          |
| 14.9       | M3-M4        | Audit Header & Navigation 2026 (8 STOP & ASK validés), ADRs 0005 (mega-menu) et 0006 (pSEO villes) proposés                                                                                     | `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`                    |
| Correctifs | M4-M5        | Refonte `/interventions` + ADR 0003 lift formation ban + `/reserver` v2 calendrier 2026 + 3 tiers Essentielle + bug LocaleSwitcher fix + pages erreur v3                                        | ADR 0003, 7 commits Sprint 14 dispatch                      |

**Note v2 du PLAN** : ces sprints intermédiaires ont été pushés sur `origin/main` 2026-05-07 (HEAD `fd91518`, 1 commit ahead working). Le plan original M1-M11 reste valable pour la suite (Sprints 15-23 = M8-M11).

---

**Sources de vérité** :

- Origine : `_DECISIONS-FINALES.md` (06/05/2026) · `CLAUDE.md` v6 · ADR `docs/adr/0001-design-direction-webflow.md` · `Navigation-Complete-AxionIA.md` v1 · skills `axionia-*`.
- À jour 2026-05-07 : ADRs `axionia/docs/adr/0002-0004` (commités) + `_AUDIT/sync-snapshot.md` + `_AUDIT/02b-mapping-pages.md` v2 (64 routes HEAD).
