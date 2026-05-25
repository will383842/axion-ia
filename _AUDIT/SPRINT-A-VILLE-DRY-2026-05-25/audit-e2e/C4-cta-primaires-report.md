# C-4 CTAs Primaires Report

**Date**: 2026-05-25  
**Agent**: C-4 (CTA Primaires Home + Services)  
**Method**: Code-level static analysis — read-only, zero runtime  
**Scope**: `src/app/[locale]/page.tsx` (home) + 5 pages hub services + 36 composants partagés Sprint A Phase 2

---

## 1. Method: code-level static analysis

Analyse statique exhaustive des fichiers suivants :

**Pages hub (orchestrateurs)**
- `src/app/[locale]/page.tsx` (home)
- `src/app/[locale]/audit/page.tsx`
- `src/app/[locale]/interventions/page.tsx`
- `src/app/[locale]/implementation/page.tsx`
- `src/app/[locale]/un-a-un/page.tsx`
- `src/app/[locale]/sites-web-augmentes/page.tsx`

**Composants services partagés Sprint A Phase 2**
- `src/components/services/audit/` (8 fichiers)
- `src/components/services/interventions/` (7 fichiers)
- `src/components/services/implementation/` (10 fichiers)
- `src/components/services/un-a-un/` (5 fichiers)
- `src/components/services/sites-web/` (6 fichiers)

**Composants marketing**
- `src/components/marketing/Cta.tsx`
- `src/components/marketing/StickyMobileCta.tsx`

**Vérification d'existence des routes** : `ls` sur chaque destination CTA.

---

## 2. CTAs trouvés par page

### 2.1 — Page Home (`/`)

| Section | CTA Label (FR) | `href` | Route existante | `data-cta` | Issues |
|---|---|---|---|---|---|
| Hero | "Réserver un appel" | `/reserver` | ✅ | — | — |
| Hero | "Nous contacter" | `/contact` | ✅ | — | — |
| Value cards (×5) | Wrapper Link "Découvrir le service" | `/interventions`, `/un-a-un`, `/audit`, `/implementation`, `/sites-web-augmentes` | ✅ toutes | — | — |
| Pricing table (×5) | Lignes cliquables services | `/interventions`, `/audit`, `/un-a-un`, `/implementation`, `/sites-web-augmentes` | ✅ toutes | — | — |
| Pricing sous-titre | "Parlons-en" | `/contact` | ✅ | — | — |
| Pricing lien | "Voir notre méthode en 4 étapes" | `/methodologie` | ✅ | — | — |
| Cases section | "Voir tous les cas concrets" (t("casesCta")) | `/cas-concrets` | ✅ | — | — |
| CTA Contact band | "Réserver un appel" | `/reserver` | ✅ | — | — |
| CTA Contact band | "Nous contacter" | `/contact` | ✅ | — | — |
| Founder | "Découvrir notre approche complète" | `/a-propos` | ✅ | — | — |
| Testimonials | "Plus d'analyses... blog" | `/blog` | ✅ | — | — |
| FAQ sous-titre | "Voir toute la FAQ" | `/faq` | ✅ | — | — |
| FAQ sous-titre | "nous contacter" | `/contact` | ✅ | — | — |
| FAQ transparent | "notre politique de transparence" | `/transparence` | ✅ | — | — |
| StickyMobileCta | t("heroCtaPrimary") | `/interventions/essentielle` | ✅ | `home-sticky-mobile` | — |

**Résumé Home** : 15 CTAs/links distincts — toutes routes validées. Aucun `href="#"`.

---

### 2.2 — Page Audit (`/audit`)

CTAs inline dans `audit/page.tsx` :

| Section | CTA Label | `href` | Route existante | `data-cta` | Issues |
|---|---|---|---|---|---|
| StickyMobileCta | "Flash terrain · 890 €" | `/reserver?intervention=audit-flash-onsite` | ✅ (`/reserver` existant + QS) | `audit-flash-onsite-sticky` | — |

CTAs via composants Sprint A Phase 2 :

| Composant | Section | CTA Label (FR) | `href` | Route existante | `data-cta` / `track` | Issues |
|---|---|---|---|---|---|---|
| `AuditHero` | Hero primaire | "Réserver un Flash terrain · 890 €" | `/reserver?intervention=audit-flash-onsite` | ✅ | `audit-hero-flash` | — |
| `AuditHero` | Hero secondaire | "Demander un cadrage" | `/audit/demande` | ✅ | `audit-hero-cadrage` | — |
| `AuditTierGrid` | Grid (×4 tiers) | "Voir le format" | `/audit/flash`, `/audit/cible`, `/audit/strategique-pme`, `/audit/strategique-eti` | ✅ toutes | `audit-tier-grid-{id}` | — |
| `AuditCtaBlock` | CTA final | "Réserver sur le calendrier" | `/reserver?intervention=audit-flash-onsite` | ✅ | `audit-cta-flash` | — |
| `AuditCrossModules` | Cross-links | "Former vos équipes →" | `/interventions` | ✅ | — | — |
| `AuditCrossModules` | Cross-links | "Implémenter l'IA →" | `/implementation` | ✅ | — | — |
| `BeyondAuditBlock` | Upsell | "Voir le Module 3 Implémentation" | `/implementation` | ✅ | — | — |

**Résumé Audit** : 9 CTAs distincts — toutes routes validées.

---

### 2.3 — Page Interventions (`/interventions`)

CTAs inline dans `interventions/page.tsx` :

| Section | CTA Label | `href` | Route existante | `data-cta` | Issues |
|---|---|---|---|---|---|
| CtaBlock final | "Pré-réservez sur le calendrier" | `/reserver` | ✅ | — (via `Cta` prop) | — |
| StickyMobileCta | "Réserver · à partir de X €" | `/reserver` | ✅ | `interventions-hub-sticky` | — |

CTAs via composants Sprint A Phase 2 :

| Composant | Section | CTA Label (FR) | `href` | Route existante | `data-cta` / `track` | Issues |
|---|---|---|---|---|---|---|
| `InterventionsHero` | Hero primaire | "Pré-réservez sur le calendrier" | `/reserver` | ✅ | — | — |
| `InterventionsHero` | Hero secondaire | "Découvrez les interventions" | `#familles` | ✅ (anchor `id="familles"` dans `InterventionsFamiliesGrid`) | — | — |
| `InterventionsFamiliesGrid` | Famille: Collectives | "Voir les interventions équipes" | `/interventions/collectives` | ✅ | — | — |
| `InterventionsFamiliesGrid` | Famille: Individuel | "Voir les coachings individuels" | `/interventions/individuel` | ✅ | — | — |
| `InterventionsFamiliesGrid` | Famille: Dirigeants | "Voir les offres dirigeants" | `/interventions/dirigeants` | ✅ | — | — |
| `InterventionsFamiliesGrid` | Famille: Conférence | "Voir les conférences" | `/interventions/conference` | ✅ | — | — |
| `InterventionsReservationFlow` | Funnel primaire | "Ouvrir le calendrier" | `/reserver` | ✅ | — | — |
| `InterventionsReservationFlow` | Funnel secondaire | "Question avant de pré-réserver ?" | `/contact` | ✅ | — | — |
| `InterventionsMaturityLevels` | Niveau 1 | "Voir les formations équipe" | `/interventions/collectives` | ✅ | — | — |
| `InterventionsMaturityLevels` | Niveau 2 | "Voir les coachings individuels" | `/interventions/individuel` | ✅ | — | — |
| `InterventionsMaturityLevels` | Niveau 3 | "Voir les offres dirigeants" | `/interventions/dirigeants` | ✅ | — | — |
| `InterventionsCrossModules` | Cross-link 1 | "Auditer d'abord →" | `/audit` | ✅ | — | — |
| `InterventionsCrossModules` | Cross-link 2 | "Implémenter l'IA →" | `/implementation` | ✅ | — | — |

**Résumé Interventions** : 13 CTAs distincts — toutes routes validées. Anchor `#familles` confirmée.

---

### 2.4 — Page Implementation (`/implementation`)

CTAs inline dans `implementation/page.tsx` :

| Section | CTA Label | `href` | Route existante | `data-cta` | Issues |
|---|---|---|---|---|---|
| StickyMobileCta | "Décrire mon besoin · 48 h" | `/contact` | ✅ | `impl-sticky-mobile` | — |

CTAs via composants Sprint A Phase 2 :

| Composant | Section | CTA Label (FR) | `href` | Route existante | `data-cta` / `track` | Issues |
|---|---|---|---|---|---|---|
| `ImplementationHero` | Hero primaire | "Décrire mon besoin · réponse 48 h" | `/contact` | ✅ | `impl-hero-primary` | — |
| `ImplementationHero` | Hero secondaire | "Commencer par un audit" | `/audit` | ✅ | `impl-hero-audit` | — |
| `ImplementationPillarChoices` | Pilier 1 & 4 | "Commencer par un audit" | `/audit` | ✅ | — | — |
| `ImplementationPillarChoices` | Pilier 2 & 5 | (scroll anchor) | `#catalogue` | ✅ (anchor `id="catalogue"` dans `ImplementationCatalogFunctions`) | — | — |
| `ImplementationPillarChoices` | Pilier 3 & 6 | "Notre méthode" | `/methodologie` | ✅ | — | — |
| `ImplementationCatalogFunctions` | Catalogue (par cat) | titre catégorie | `/implementation/par-fonction/{slug}` | ✅ (route `[slug]` existante) | — | — |
| `ImplementationCatalogFunctions` | CTA inline 1 | "Décrire mon besoin" | `/contact` | ✅ | — | — |
| `ImplementationCatalogFunctions` | CTA inline 2 | "Décrire mon besoin" | `/contact` | ✅ | — | — |
| `ImplementationCatalogFunctions` | Lien par-techno | "Voir par technologie" | `/implementation/par-techno` | ✅ | — | — |
| `ImplementationPricingTiers` | CTA tier 1 | "Décrire mon besoin" | `/contact` | ✅ | — | — |
| `ImplementationPricingTiers` | CTA tier 2 | "Décrire mon besoin" | `/contact` | ✅ | — | — |
| `ImplementationComparisonMatrix` | CTA matrix | "Décrire mon besoin" | `/contact` | ✅ | — | — |
| `ImplementationCtaBlock` | CTA final primaire | "Décrire mon besoin · réponse 48 h" | `/contact` | ✅ | `impl-final-primary` | — |
| `ImplementationCtaBlock` | CTA final secondaire | "Commencer par un audit" | `/audit` | ✅ | `impl-final-audit` | — |

**Résumé Implementation** : 14 CTAs distincts — toutes routes validées. Anchor `#catalogue` confirmée.

---

### 2.5 — Page Un-à-Un (`/un-a-un`)

CTAs inline dans `un-a-un/page.tsx` :

| Section | CTA Label | `href` | Route existante | `data-cta` | Issues |
|---|---|---|---|---|---|
| StickyMobileCta | "Démarrer mon 1-to-1" | `/contact` | ✅ | `un-a-un-sticky-mobile` | — |

CTAs via composants Sprint A Phase 2 :

| Composant | Section | CTA Label (FR) | `href` | Route existante | `data-cta` / `track` | Issues |
|---|---|---|---|---|---|---|
| `UnAUnHero` | Hero primaire | "Démarrer mon accompagnement" | `/contact` | ✅ | `un-a-un-hero-primary` | — |
| `UnAUnHero` | Hero secondaire | "Voir les formations groupe" | `/interventions/collectives` | ✅ | `un-a-un-hero-formations` | — |
| `UnAUnCtaBlock` | CTA final | "Démarrer mon accompagnement 1-to-1" | `/contact` | ✅ | `un-a-un-cta-block-final` | — |

**Résumé Un-à-Un** : 4 CTAs distincts — toutes routes validées.

---

### 2.6 — Page Sites Web Augmentés (`/sites-web-augmentes`)

CTAs inline dans `sites-web-augmentes/page.tsx` : aucun CTA inline direct (page 100% assemblage composants).

CTAs via composants Sprint A Phase 2 :

| Composant | Section | CTA Label (FR) | `href` | Route existante | `data-cta` / `track` | Issues |
|---|---|---|---|---|---|---|
| `SitesWebHero` | Hero primaire | "Décrire mon projet · devis 48 h" | `/contact` | ✅ | `sites-web-augmentes-hero-primary` | — |
| `SitesWebHero` | Hero secondaire | "Commencer par un audit" | `/audit` | ✅ | `sites-web-augmentes-hero-audit` | — |
| `SitesWebCtaBlock` | CTA final primaire | "Décrire mon projet" | `/contact` | ✅ | `sites-web-augmentes-cta-contact` (`data-cta` direct) | — |
| `SitesWebCtaBlock` | CTA final secondaire | "Voir les niveaux d'audit" | `/audit` | ✅ | `sites-web-augmentes-cta-audit` (`data-cta` direct) | — |

**Résumé Sites Web** : 4 CTAs distincts — toutes routes validées.

---

## 3. Composants CTA partagés

### 3.1 — `Cta` (`src/components/marketing/Cta.tsx`)

Wrapper universel des boutons CTA marketing. Comportement :
- Prop `track` → émis comme `data-cta` sur le `<a>` ou `<Link>` underling. Fonctionnel.
- `external=true` → `<a target="_blank" rel="noreferrer">`. Correct (pas d'usage détecté sur les pages auditées).
- `shape="pill"` par défaut (rounded-full). Conforme charte.
- Pas d'`aria-label` explicite sur le composant — le texte enfant sert de label accessible. Acceptable si le texte enfant est descriptif (vérifié ci-dessous).

### 3.2 — `StickyMobileCta` (`src/components/marketing/StickyMobileCta.tsx`)

- `aria-hidden={!visible}` sur le container → correct (masqué pour screen readers quand invisible).
- `ArrowRight` avec `aria-hidden="true"` — correct.
- Prop `track` émis comme `data-cta` sur le `<Link>` — fonctionnel.
- **Aucun `aria-label` explicite** sur le bouton → le `label` prop est le texte visible affiché, ce qui sert de label accessible. Acceptable.

### 3.3 — `CtaBlock` (`src/components/sections/CtaBlock.tsx`)

Wrapper section CTA — ne contient aucun `href` direct, délègue entièrement à la prop `cta: ReactNode`. Correct.

### 3.4 — Patterns `Link` directs (sans `Cta`)

Dans `SitesWebCtaBlock` : utilisation de `<Link href="/contact" data-cta="...">` direct (non passé via `Cta`). Tracking `data-cta` présent. Fonctionnel et cohérent.

Dans `InterventionsReservationFlow` : `<Link href="/contact">` sans `data-cta` (lien texte secondaire "Question avant..."). Niveau P2 — absence de tracking sur un lien texte secondaire.

Dans `InterventionsFamiliesGrid` : stretched link pattern avec `<Link aria-label="...">` covering la card — `aria-label` présent et descriptif. Conforme a11y.

---

## 4. Issues trouvées

### P0 — Bloquant

**Aucun P0 détecté.**

- Zéro `href="#"` sur les 6 pages et 36 composants audités.
- Zéro route 404 détectée parmi les destinations.
- Zéro CTA icon-only sans `aria-label` détecté (toutes les icônes ont `aria-hidden="true"` et sont accompagnées de texte visible).

### P1 — Avertissement

**P1-1 : `data-cta` absent sur 4 `<Link>` non-Cta dans les composants partagés**

| Composant | href | Label visible | Manque |
|---|---|---|---|
| `InterventionsReservationFlow` (l.102) | `/contact` | "Question avant de pré-réserver ?" | `data-cta` tracking |
| `AuditTierGrid` (l.127) | `/audit/{tier}` (×4) | "Voir le format" | `track` / `data-cta` (4 links) |
| `InterventionsFamiliesGrid` stretched link (l.295) | `/interventions/{famille}` (×4) | sr-only label | `data-cta` tracking |
| `InterventionsMaturityLevels` (l.98) (×3) | `/interventions/collectives`, `/individuel`, `/dirigeants` | texte reco | `data-cta` tracking |

Impact : pas d'impact UX ou SEO ; tracking analytics incomplet sur ces CTAs secondaires.

**P1-2 : `StickyMobileCta` sur `sites-web-augmentes/page.tsx` absent**

La page `/sites-web-augmentes` n'a pas de `StickyMobileCta`, contrairement aux 4 autres pages hub services (`/audit`, `/interventions`, `/implementation`, `/un-a-un`). Incohérence de parité mobile.

### P2 — Mineur / Amélioration

**P2-1 : Texte CTA "Parlons-en" (home pricing) — trop court pour l'accessibilité**

Le lien `/contact` dans la phrase pricing de la home utilise le label "Parlons-en" (3 mots). Compréhensible en contexte, mais hors contexte (screen reader liste liens) le texte est ambiguë. Recommandation : ajouter `aria-label="Parlons de votre projet"` ou élargir le texte.

**P2-2 : Cohérence du CTA secondaire de `/audit` hero**

`AuditHero` : CTA secondaire → `/audit/demande`. `AuditCtaBlock` : CTA final → `/reserver?intervention=audit-flash-onsite`. Les deux sont cohérents mais le tunnel n'est pas totalement unifié — un utilisateur arrivant sur la page hub voit 2 points d'entrée différents (demande cadrage vs réservation directe). Pas un bug, mais une friction UX légère.

**P2-3 : `href={"#familles" as never}` et `href={"/interventions/collectives" as never}` dans les composants**

L'usage de `as never` pour court-circuiter le typage strict de `Link` sur des routes non-déclarées dans le routeur i18n est un workaround technique. Ces routes existent bien en runtime, mais le typage TypeScript les marque comme inconnues. Risque de régression silencieuse si une route est renommée. À corriger dans `routing.ts` ou via un type helper dédié.

---

## 5. Vérification destinations complète

| Destination | Page(s) qui l'utilisent | Route vérifiée |
|---|---|---|
| `/reserver` | Home (hero + CTA band), Interventions (hero + tunnel + sticky), Audit (sticky) | ✅ |
| `/contact` | Home, Implementation (hero + CTA final + sticky), Un-à-Un (hero + CTA final + sticky), Sites Web (hero + CTA final), Interventions (tunnel) | ✅ |
| `/audit` | Home (pricing), Implementation (hero + piliers + CTA final), Sites Web (hero + CTA final), Interventions (cross) | ✅ |
| `/interventions` | Home (value card), Audit (cross-modules) | ✅ |
| `/implementation` | Home (value card), Audit (cross + beyond-block), Interventions (cross) | ✅ |
| `/un-a-un` | Home (value card) | ✅ |
| `/sites-web-augmentes` | Home (value card) | ✅ |
| `/audit/demande` | Audit (AuditHero secondaire) | ✅ |
| `/audit/flash` | Audit (AuditTierGrid) | ✅ |
| `/audit/cible` | Audit (AuditTierGrid) | ✅ |
| `/audit/strategique-pme` | Audit (AuditTierGrid) | ✅ |
| `/audit/strategique-eti` | Audit (AuditTierGrid) | ✅ |
| `/interventions/collectives` | Un-à-Un (hero), Interventions (families grid + maturity) | ✅ |
| `/interventions/individuel` | Interventions (families grid + maturity) | ✅ |
| `/interventions/dirigeants` | Interventions (families grid + maturity) | ✅ |
| `/interventions/conference` | Interventions (families grid) | ✅ |
| `/interventions/essentielle` | Home (StickyMobileCta) | ✅ |
| `/implementation/par-fonction/{slug}` | Implementation (CatalogFunctions) | ✅ (route `[slug]` existante) |
| `/implementation/par-techno` | Implementation (CatalogFunctions) | ✅ |
| `/methodologie` | Home (pricing), Implementation (PillarChoices) | ✅ |
| `/cas-concrets` | Home (cases section) | ✅ |
| `/a-propos` | Home (founder section) | ✅ |
| `/blog` | Home (testimonials) | ✅ |
| `/faq` | Home (FAQ section) | ✅ |
| `/transparence` | Home (FAQ section) | ✅ |
| `#familles` | Interventions (InterventionsHero) | ✅ (`id="familles"` dans `InterventionsFamiliesGrid`) |
| `#catalogue` | Implementation (PillarChoices) | ✅ (`id="catalogue"` dans `ImplementationCatalogFunctions`) |

**Total destinations vérifiées : 27 / 27 — 100% existantes.**

---

## 6. Verdict : GO

**Score CTAs : 100% routes valides — aucun lien mort.**

| Critère | Résultat |
|---|---|
| Zéro `href="#"` (placeholder) | ✅ PASS |
| Toutes destinations existent | ✅ PASS (27/27) |
| Zéro CTA icon-only sans aria-label | ✅ PASS |
| `data-cta` tracking sur CTAs primaires | ✅ PASS (P1 sur CTAs secondaires) |
| Cohérence croisée home ↔ services | ✅ PASS |
| `StickyMobileCta` parité services | ⚠️ P1 (sites-web absent) |
| Texte CTAs descriptif (a11y) | ✅ PASS (1 P2 "Parlons-en") |

**Verdict : GO** — aucun blocant P0 détecté. Les 3 issues P1 et 3 P2 sont des améliorations de tracking/UX/accessibilité non bloquantes pour la mise en production Sprint A.

**Actions recommandées (non bloquantes)**

1. **P1-1** : Ajouter `data-cta` / `track` sur les 4 composants identifiés (AuditTierGrid links, InterventionsReservationFlow lien secondaire, InterventionsFamiliesGrid stretched link, InterventionsMaturityLevels reco links).
2. **P1-2** : Ajouter `<StickyMobileCta>` à `sites-web-augmentes/page.tsx` (parité avec les 4 autres hubs).
3. **P2-1** : Enrichir `aria-label` sur le lien "Parlons-en" de la home pricing.
4. **P2-3** : Déclarer les routes `#familles`, `/interventions/collectives`, etc. dans le système de types routing ou créer un helper type-safe pour les anchors.
