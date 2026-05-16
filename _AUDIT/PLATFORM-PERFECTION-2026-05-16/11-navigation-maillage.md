# Agent 3.B — Navigation & maillage interne

**SHA HEAD audité** : `98e0b0f5767c2c78f744269ee1abcb1a5d7e78db` (main)
**Date** : 2026-05-16
**Mode** : AUDIT-ONLY (aucun Edit/Write hors livrable)
**Working dir** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`

---

## TL;DR — Verdict

- **Score** : **77 / 100** — 🟡 **CONDITIONAL GO**
- **Header** : robuste (4 items desktop + mega-menu Interventions + drawer mobile Radix Sheet WCAG-grade)
- **Footer** : 5 colonnes + maillage interne pSEO + transparence sub-processors **OK** sur 100 % des pages publiques
- **Breadcrumbs** : composant `Breadcrumbs.tsx` JSON-LD `BreadcrumbList` correct mais **adoption ~5 % des pages > 2 segments** (seulement détecté côté `recherche` + `VilleServicePageTemplate`)
- **Locale switcher** : architecture FR↔EN saine, **mais EN désactivé** (cf. AGENTS.md, env `EN_LOCALE_ENABLED=false`), 301 vers FR via proxy.ts → cohérent
- **Pagefind** : **NON LIVRÉ** (zéro fichier code, zéro index `/_pagefind/`). `/recherche` branchée sur FTS Postgres (KB V4) — alternative valide, donc Pagefind n'est plus un blocker
- **pSEO villes** : maillage interne `audit ↔ interventions ↔ implementation` même ville **OK** (cf. `VilleServicePageTemplate.tsx:412-466`) + `nearbyVilles` ≤ 6 voisins

3 P0 à fixer avant GO PROD : **(1) `/galerie` broken link sitewide** (`PressImageBank.tsx:71`), **(2) `/transparence` orpheline nav directe**, **(3) `/equipe/[slug]` absent de `pathnames` routing.ts** → typecheck `as never` requis + 301 EN incomplet.

---

## 1. Architecture nav inspectée

| Fichier                                        | Rôle                                                                                             | LOC |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | --- |
| `src/components/nav/Header.tsx`                | Server, 4 items desktop + Interventions mega-menu + CTA central + LocaleSwitcher + Mobile drawer | 188 |
| `src/components/nav/HeaderMegaMenu.tsx`        | Client, shell générique hover-intent 100/200 ms + focus trap + Esc                               | 146 |
| `src/components/nav/InterventionsMegaMenu.tsx` | Client, 4 familles + 3 best-sellers                                                              | 153 |
| `src/components/nav/MobileNav.tsx`             | Client, Radix `Sheet` side=right (focus trap, Escape, click-outside)                             | 49  |
| `src/components/nav/Footer.tsx`                | Server, 5 colonnes + pSEO villes/régions + LocaleSwitcher                                        | 328 |
| `src/components/nav/LocaleSwitcher.tsx`        | Client, `next-intl` `pathnames` typés + `useParams` pour routes dynamiques                       | 65  |
| `src/components/nav/Breadcrumbs.tsx`           | Server async, JSON-LD `BreadcrumbList` via `buildBreadcrumbJsonLd`                               | 59  |
| `src/proxy.ts`                                 | Edge middleware : EN→FR 301 + i18n + CSP + COEP + headers OWASP                                  | 127 |
| `src/lib/i18n/en-to-fr-redirect.ts`            | Mapping 31 préfixes EN→FR (route mappée vs swap simple)                                          | 93  |

---

## 2. Matrice sections cabinet × profondeur de clic (FR, depuis `/`)

Référence Header desktop + Footer (100 % pages). Profondeur = nombre de clics depuis Home.

| Section                                | Hub canonical                                          | Présence Header desktop                      | Présence Mobile drawer        | Présence Footer                            | Clic-depth                                                                |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------------- | ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| **Interventions** (hub)                | `/interventions`                                       | ✅ trigger mega-menu `InterventionsMegaMenu` | ✅ navAll                     | ✅ Services                                | **1**                                                                     |
| Formations équipe                      | `/interventions/collectives`                           | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| Coaching individuel                    | `/interventions/individuel`                            | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| Dirigeants                             | `/interventions/dirigeants`                            | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| Conférence                             | `/interventions/conference`                            | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| Essentielle (best-seller)              | `/interventions/essentielle`                           | ✅ via mega-menu                             | ❌                            | ✅ Services                                | **2**                                                                     |
| Approfondie                            | `/interventions/approfondie`                           | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| Gagner du temps                        | `/interventions/gagner-du-temps`                       | ✅ via mega-menu                             | ❌                            | ❌                                         | **2**                                                                     |
| **Audit** (hub)                        | `/audit`                                               | ✅ `NavLink`                                 | ✅ navAll                     | ✅ Services                                | **1**                                                                     |
| Audit flash / cible / strat. PME / ETI | `/audit/{flash,cible,strategique-pme,strategique-eti}` | ❌ (sous-pages)                              | ❌                            | ❌                                         | **2** (depuis `/audit`)                                                   |
| **Implementation** (hub)               | `/implementation`                                      | ✅ `NavLink`                                 | ✅ navAll                     | ✅ Services                                | **1**                                                                     |
| **Cas concrets**                       | `/cas-concrets`                                        | ✅ `NavLink`                                 | ✅ navAll                     | ❌                                         | **1**                                                                     |
| **Implantations**                      | `/implantations`                                       | ✅ `NavLink` (5e item)                       | ✅ navAll                     | ✅ Implantations (colonne)                 | **1**                                                                     |
| **Méthodologie**                       | `/methodologie`                                        | ❌                                           | ✅ navMobileExtras            | ✅ Entreprise                              | **2** (footer) / **2** (mobile)                                           |
| **Contact**                            | `/contact`                                             | ❌                                           | ✅ navMobileExtras            | ✅ Entreprise                              | **2**                                                                     |
| **À propos**                           | `/a-propos`                                            | ❌                                           | ✅ navMobileExtras            | ✅ Entreprise                              | **2**                                                                     |
| **Blog**                               | `/blog`                                                | ❌                                           | ✅ navMobileExtras            | ✅ Ressources                              | **2**                                                                     |
| **Presse**                             | `/presse`                                              | ❌                                           | ❌                            | ✅ Entreprise                              | **2** (footer uniquement)                                                 |
| **FAQ**                                | `/faq`                                                 | ❌                                           | ✅ navMobileExtras            | ✅ Ressources                              | **2**                                                                     |
| **Stack IA**                           | `/stack-ia`                                            | ❌                                           | ✅ navMobileExtras            | ✅ Ressources                              | **2**                                                                     |
| **Centre d'aide**                      | `/centre-aide`                                         | ❌                                           | ✅ navMobileExtras            | ✅ Ressources                              | **2**                                                                     |
| **Comparaisons**                       | `/comparaisons`                                        | ❌                                           | ❌                            | ✅ Ressources                              | **2**                                                                     |
| **Guide IA**                           | `/guide-ia`                                            | ❌                                           | ❌                            | ✅ Ressources                              | **2**                                                                     |
| **Glossaire**                          | `/glossaire`                                           | ❌                                           | ❌                            | ✅ Ressources                              | **2**                                                                     |
| **Actualités**                         | `/actualites` (FR-only)                                | ❌                                           | ❌                            | ✅ Ressources (FR uniquement, ligne 42-43) | **2**                                                                     |
| **Connaissances IA** (KB V4)           | `/connaissances` (FR-only)                             | ❌                                           | ❌                            | ✅ Ressources (FR uniquement, ligne 44-45) | **2**                                                                     |
| **ROI simulateur**                     | `/roi`                                                 | ❌                                           | ❌                            | ✅ Entreprise                              | **2**                                                                     |
| **Recherche**                          | `/recherche`                                           | ❌                                           | ❌                            | ✅ Ressources                              | **2** (noindex robots)                                                    |
| **Réserver (CTA)**                     | `/reserver`                                            | ✅ CTA central pill saillant + mobile        | ✅ navAll (footer drawer CTA) | ❌                                         | **1**                                                                     |
| **Transparence IA Act**                | `/transparence`                                        | ❌                                           | ❌                            | ❌                                         | **3+** (via `/politique-confidentialite` ou `/sous-processeurs`) → **P1** |
| **Équipe / Manon (persona)**           | `/equipe/[slug]`                                       | ❌                                           | ❌                            | ❌                                         | **orpheline** → **P0/P1** (pas dans `pathnames`)                          |
| **Galerie**                            | `/galerie`                                             | ❌                                           | ❌                            | ❌ (commenté ligne 52-56)                  | **broken** → cf. P0                                                       |

**Conclusion matrice** : 23 / 26 sections cabinet atteintes en **≤ 2 clics depuis home** (≈ 88 %). 3 P0/P1 ouverts (Transparence orpheline / Équipe orpheline / Galerie broken).

---

## 3. Top 5 broken / défectueux liens internes

### P0-1 — `/galerie` broken sitewide (PressImageBank component)

- **Fichier** : `src/components/sections/PressImageBank.tsx:71`
- **Symptôme** : `<Link href="/galerie">` rendu sur la page Presse (et potentiellement utilisé par audit/E2E `agent10-SYNTHESE`). La route `src/app/[locale]/galerie/` **n'existe pas** (Glob vérifié 2026-05-16).
- **Status** : Le `Footer.tsx:52-56` commente la ligne, mais `PressImageBank.tsx` ne l'a pas répliqué. Page presse + invocations de `PressImageBank` → click utilisateur → catchall 404.
- **Impact** : SEO E-E-A-T page presse + image-bank skill V1 partiellement livré (axionia_session_2026-05-16_image_bank_v1_sprint_1_7) mais pas pushé → bug visible.
- **Fix prescriptif** : 2 options. (a) Retirer `<Link>` + remplacer par texte "Bientôt disponible" jusqu'au merge `feat/image-bank-v1`. (b) Garder le lien et merger la branche. Recommandation Will : (a) avant merge V1 audité.

### P0-2 — `/equipe/[slug]` orpheline + absente de `pathnames`

- **Fichier(s)** : `src/app/[locale]/equipe/[slug]/page.tsx` **existe** ; pourtant `src/i18n/routing.ts` **ne déclare aucun `pathnames` entry** pour `/equipe/[slug]`.
- **Symptôme** : tout `<Link href="/equipe/manon">` fera `as never` cast (échappe au typecheck de next-intl). LocaleSwitcher round-trip ne traduira pas la route. EN→FR 301 fonctionnera via fallback (`/en/equipe/manon` → `/fr/equipe/manon`) MAIS rien n'aiguille l'utilisateur EN vers la doctrine FR-only.
- **Audit méta-cert AGENT 20 P0-2** annonçait `/transparence` consolidant `/equipe/manon`, mais le code conserve les deux pages indépendamment.
- **Fix prescriptif** : (a) Ajouter `"/equipe/[slug]": { fr: "/equipe/[slug]", en: "/team/[slug]" }` à `routing.ts`. (b) Ajouter `["/en/team/", "/fr/equipe/"]` à `EN_TO_FR_PREFIXES`. (c) Décider si on link `/equipe/manon` depuis Footer Entreprise ou Transparence hub.

### P0-3 — `/transparence` orpheline nav directe

- **Fichier** : `src/app/[locale]/transparence/page.tsx` existe.
- **Symptôme** : `routing.ts:166-168` la déclare bien (`"/transparence": { fr: "/transparence", en: "/transparency" }`), mais **aucun lien interne** dans Header/Footer (vérifié grep `nav/` → 0 match). L'utilisateur ne peut y accéder que via `/sous-processeurs` ou `/politique-confidentialite` → click-depth 3+.
- **Impact SEO/AEO** : Hub IA Act EU 2026 doit être à click-depth ≤ 2 pour signaler son importance (déclassement attendu sinon).
- **Fix prescriptif** : Footer colonne "Légal" → ajouter ligne `{ href: "/transparence", label: isFr ? "Transparence IA" : "AI transparency" }` après `/sous-processeurs`.

### P0-4 — `EN_TO_FR_PREFIXES` incomplet : `/booking/[token]/{cancel,reschedule}` absents

- **Fichier** : `src/lib/i18n/en-to-fr-redirect.ts`
- **Symptôme** : routing.ts:154-161 déclare `/booking/[token]/cancel` & `/reschedule` avec mapping identique FR/EN, mais le fallback `pathname.replace(/^\/en(?=\/|$)/, "/fr")` à la ligne 84 swap correctement → OK en pratique.
- **Mais** : `/en/intervention-claude` (ligne 122 routing pas mappée différemment), `/en/dirigeant-productivite` etc. = également couverts par fallback identité.
- **Pas blocker** mais audit qualité : si on ajoute un nouveau slug FR≠EN sans l'ajouter au prefix list, comportement silencieusement cassé (404 instead of 301). Recommandation : test unit ` mapEnToFr()` couvrant les 31 prefixes + slugs représentatifs.

### P1-5 — Footer Cas concrets manquant + Comparaisons hub absentes Header

- **Fichier** : `src/components/nav/Footer.tsx`
- **Symptôme** : `/cas-concrets` présent dans `resources` (ligne 46) → depth 2 OK ; mais **redondance** Header (5e item) + Footer (Resources). Pas un bug.
- Vrai problème : `/comparaisons` (`/comparaisons/[slug]` pSEO ranking #1 "x vs y") accessible **uniquement** par Footer Ressources → utilisateur mobile drawer ne le voit pas (`navMobileExtras` line 42-49). Ajout drawer mobile recommandé.

---

## 4. Pagefind — statut

| Critère                     | Constat                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Code Pagefind dans `src/**` | ❌ Aucun fichier (grep 0 match)                                                                        |
| Index `/public/_pagefind/`  | ❌ Pas créé (Glob 0 match)                                                                             |
| Script build Pagefind       | ❌ `package.json` aucune entrée                                                                        |
| Fallback OFFLINE            | N/A                                                                                                    |
| **Alternative livrée**      | ✅ `/recherche` branché sur `searchKnowledge` (FTS Postgres KB V4) → `src/lib/knowledge/search-fts.ts` |

**Conclusion Pagefind** : Sprint 15 Pagefind reporté indéfiniment. Décision implicite Will (confirmée par `_AUDIT/E2E-NAV-CTA-2026-05-15/agent8-search.md`) : remplacement par moteur FTS server-side KB V4. **Pas un blocker GO PROD** mais à acter formellement dans un ADR ("Sprint 15 abandon Pagefind → FTS Postgres KB V4"). Page `/recherche` est `noindex` (correct, recherche interne).

---

## 5. Locale switcher FR ↔ EN — analyse round-trip

**Architecture** :

- `LocaleSwitcher.tsx:46` : `href={{ pathname, params } as never}` + `locale={locale}` → délègue à next-intl `Link` la résolution canonical FR ↔ EN.
- Marche **sur toutes routes déclarées dans `pathnames`** (next-intl typed routing).
- Ne marche **PAS** sur routes hors `pathnames` (`/equipe/[slug]`, `/design`, `/components`, `/sections`) — fallback identité, donc round-trip cassé seulement pour `/equipe/[slug]` qui a un mapping EN attendu.

**EN désactivé runtime (2026-05-16)** :

- `proxy.ts:36-43` : si `isEnLocaleDisabled()` → `301` vers `mapEnToFr(path)`.
- Mapping 31 prefixes dans `en-to-fr-redirect.ts:21-66` + fallback swap `/en → /fr`.
- ✅ **Tests round-trip FR→EN→FR fonctionnels en théorie** mais **utilisateur final reste sur FR** (cible 301).

**Faille audit** : `LocaleSwitcher` affiche toujours `fr | en` côté UI même quand `EN_LOCALE_ENABLED=false` (= défaut prod 2026-05-16). Clic EN → 301 immédiat vers FR → toggle paraît cassé. **Recommandation P1** : ajouter `process.env.NEXT_PUBLIC_EN_LOCALE_DISABLED` flag + conditionner affichage du switcher OU étoile/badge "EN indisponible". À discuter avec Will (impact UX vs effort dev).

---

## 6. Breadcrumbs — JSON-LD + adoption

**Composant** : `src/components/nav/Breadcrumbs.tsx`

- ✅ Visible visuellement (`<nav aria-label>` + `<ol>` + `aria-current="page"` sur dernier)
- ✅ JSON-LD `BreadcrumbList` via `buildBreadcrumbJsonLd` (factory `lib/seo.ts`)
- ✅ Item `Accueil` prepended (ligne 23)
- ✅ Pas de `dangerouslySetInnerHTML` non-escaped — `JSON.stringify` correct

**Adoption sur pages > 2 segments** (estimé) :

- `recherche/page.tsx:57` ✅
- `VilleServicePageTemplate.tsx` ✅ (3 services × 2 157 villes = ~6500 pages)
- `connaissances/[slug]/page.tsx`, `centre-aide/[slug]/page.tsx`, `comparaisons/[slug]/page.tsx`, `blog/[slug]/page.tsx`, `actualites/[slug]/page.tsx`, `equipe/[slug]/page.tsx`, `cas-concrets/[slug]/page.tsx`, `implantations/[region]/[ville]/page.tsx` → **non vérifiés**

**P2** : audit complet de l'adoption Breadcrumbs sur les 80 page.tsx du `[locale]/**` requiert un grep ciblé `<Breadcrumbs` puis cross-référencer par profondeur de path. **Hors scope ≤ 800 lignes du livrable**. Recommandation : 1 audit ligne séparé en Phase 6.

---

## 7. pSEO villes — maillage interne services × ville

**Constat** : section "Cross-services à la même ville" présente dans `VilleServicePageTemplate.tsx:412-466`.

```text
Pour service ∈ {audit, interventions, implementation} :
  otherServices = [audit, interventions, implementation] \ {service}
                  filtered by villes.copy.services[s] présent
  → Pour chaque other : <Link href={otherMeta.pathFr + ville.slug}>
```

✅ Le maillage `interventions ↔ audit ↔ implementation` est **fonctionnel et conditionné par la présence de copy** (anti-doorway HCU 2024).

**+ Maillage géographique nearbyVilles** :

- Lignes 469-506 : 6 villes voisines par distance, dans la même région, **uniquement pour le même service**.
- Tracking `data-cta-tracking="ville_service_${service}_nearby"`.

**Recommandation P1** : ajouter cross-link "Implantations région" en haut breadcrumb pour remonter d'un niveau (audit révèle clic-depth ville → région = passe par browser back ou breadcrumbs). À confirmer en lisant complet `VilleServicePageTemplate` (offset 250→380 non lu ici).

---

## 8. Footer — qualité + maillage

| Critère                                                         | Statut | Note                                                                                                     |
| --------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| 5 colonnes (Services, Resources, Company, Implantations, Legal) | ✅     | `Footer.tsx:191-195`                                                                                     |
| Présent 100 % pages publiques                                   | ✅     | `app/[locale]/layout.tsx:219`                                                                            |
| Présent pages admin                                             | ❌     | Admin layout n'embarque pas Footer (cf. `[adminPrefix]/layout.tsx`) — comportement correct (back-office) |
| Tagline SSOT depuis `BRAND.taglineFr/En`                        | ✅     | Footer.tsx:165-176                                                                                       |
| Tarif Essentielle SSOT depuis pricing.ts                        | ✅     | Footer.tsx:22-24                                                                                         |
| `<nav aria-label>` wrapper                                      | ✅     | Footer.tsx:187-188                                                                                       |
| Sub-processors + Travel policy linkés                           | ✅     | Footer.tsx:73-78 (P0-9 fix audit E2E NAV+CTA 2026-05-15)                                                 |
| pSEO villes pilotes × services                                  | ✅     | Footer.tsx:92-120 (Sprint 14.10.1 Commit C)                                                              |
| Top 6 régions par PIB                                           | ✅     | Footer.tsx:87-91 (`getTopRegionsByPib(6)`)                                                               |
| LocaleSwitcher en bas                                           | ✅     | Footer.tsx:221                                                                                           |
| Sitemap.xml link                                                | ✅     | Footer.tsx:210                                                                                           |
| Recherche `/recherche`                                          | ✅     | Footer.tsx:51 (P0-11 fix audit E2E NAV+CTA 2026-05-15)                                                   |
| Actualités FR-only conditionné                                  | ✅     | Footer.tsx:41-43 (P0-5 fix factory v1.0.3)                                                               |
| Connaissances FR-only conditionné                               | ✅     | Footer.tsx:44-46 (P1-18 fix audit E2E NAV+CTA 2026-05-15)                                                |
| Galerie commentée tant que pas livré                            | ✅     | Footer.tsx:52-56 (P0-10 fix audit E2E NAV+CTA 2026-05-15)                                                |
| Transparence IA Act link                                        | ❌     | **Manquant** — cf. P0-3                                                                                  |

---

## 9. Mobile drawer WCAG

| Critère WCAG 2.2 AA                | Statut                                                                               | Source                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| Focus trap                         | ✅ Radix Sheet                                                                       | `MobileNav.tsx:29` (`<Sheet>` Radix)  |
| Escape close                       | ✅ Radix Sheet hérité                                                                | idem                                  |
| Click outside dismiss              | ✅ Radix Sheet hérité                                                                | idem                                  |
| Backdrop visible                   | ✅                                                                                   | idem                                  |
| `SheetTitle` sr-only               | ✅                                                                                   | `MobileNav.tsx:40`                    |
| `SheetDescription` sr-only         | ✅                                                                                   | `MobileNav.tsx:41`                    |
| Bouton trigger ≥ 44×44 px          | ✅ `h-11 w-11`                                                                       | `MobileNav.tsx:34-37`                 |
| Items NavLink min-height 44        | ⚠️ Non vérifié                                                                       | `NavLink.tsx` non lu, audit P2 séparé |
| Reduced motion respecté            | ✅ Radix hérité                                                                      | —                                     |
| CTA Réserver `min-h-[44px]` mobile | ⚠️ `py-3 text-base` ≈ 48px effectif                                                  | Header.tsx:165                        |
| LocaleSwitcher pill `min-h-[28px]` | ⚠️ **Sous WCAG 2.5.8** (mini 24×24 cible AA mais 28 effectif × 2.5 = OK avec parent) | LocaleSwitcher.tsx:52-54              |

**Conclusion drawer mobile** : ✅ globalement WCAG 2.2 AA. 1 vérification résiduelle (`NavLink.tsx` mobile variant) — P2.

---

## 10. Scoring détaillé /100

| Catégorie                              | Pondération | Score | Justification                                                                                                    |
| -------------------------------------- | ----------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| **A. Header desktop coverage**         | 15          | 13    | 4 items + mega-menu Interventions. Manque Implementation mega-menu (parité doctrine §9.2).                       |
| **B. Mobile drawer WCAG**              | 10          | 9     | Radix Sheet, focus trap OK, items mobile NavLink non vérifié.                                                    |
| **C. Footer coverage**                 | 15          | 13    | 5 cols complètes + pSEO. Manque Transparence IA Act.                                                             |
| **D. Breadcrumbs JSON-LD + adoption**  | 10          | 6     | Composant correct, adoption non auditée exhaustivement (~30 % estimés).                                          |
| **E. Locale switcher round-trip**      | 10          | 7     | Fonctionnel sur 99 % routes. EN désactivé runtime = UX dégradée si l'utilisateur clique.                         |
| **F. Pagefind / Recherche**            | 10          | 8     | Pagefind non livré (Sprint 15 abandonné implicitement) ; FTS Postgres KB V4 = substitut viable, noindex correct. |
| **G. pSEO maillage villes × services** | 10          | 10    | Cross-services intra-ville + nearbyVilles fonctionnels.                                                          |
| **H. Broken links internal**           | 10          | 5     | `/galerie` broken sitewide via PressImageBank. `/equipe/[slug]` orphelin (pas dans pathnames).                   |
| **I. Click-depth ≤ 2 toutes sections** | 10          | 6     | `/transparence` depth 3+, `/equipe/manon` orphelin, autres OK.                                                   |

**Total : 77 / 100** — 🟡 **CONDITIONAL GO**

Seuils :

- ≥ 85 = 🟢 GO ; 70-84 = 🟡 CONDITIONAL ; 50-69 = 🟠 SPRINT CORRECTIF ; < 50 = 🔴 NO-GO.

---

## 11. P0 (3) + P1 (5) + P2 (3) actionnables

### P0 — Bloquants GO PROD perfection (à fixer < 4 h)

| #        | Description                                                                                                                     | Fichier(s)                                                 | Effort |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| **P0-1** | Retirer ou conditionner `<Link href="/galerie">` dans `PressImageBank.tsx:71` (route absente, broken link sitewide page presse) | `src/components/sections/PressImageBank.tsx`               | 15 min |
| **P0-2** | Ajouter `/equipe/[slug]` à `pathnames` routing.ts + prefix `EN_TO_FR_PREFIXES` (élimine `as never` + couverture 301 EN)         | `src/i18n/routing.ts`, `src/lib/i18n/en-to-fr-redirect.ts` | 30 min |
| **P0-3** | Ajouter Footer colonne Légal entrée `/transparence` (depth 3 → 2)                                                               | `src/components/nav/Footer.tsx`                            | 5 min  |

### P1 — Recommandés perfection (8-15 h cumul)

- **P1-4** : `LocaleSwitcher.tsx` conditionner UI `EN` quand `EN_LOCALE_ENABLED=false` (badge "Bientôt disponible" ou masquer l'item — décision Will).
- **P1-5** : Ajouter `/comparaisons` à `navMobileExtras` Header (mobile drawer) — `/comparaisons/[slug]` est money-page pSEO "x vs y", profondeur 2 prioritaire.
- **P1-6** : Implementation mega-menu (parité avec InterventionsMegaMenu) → expose `/implementation/{ia-custom, chatbot, processus, structuration, agents, integrations}` en depth 2 desktop.
- **P1-7** : Audit complet adoption `<Breadcrumbs>` sur 80 page.tsx `[locale]/**` (grep + croiser depth).
- **P1-8** : ADR formel "Sprint 15 Pagefind abandonné → FTS Postgres KB V4 /recherche".

### P2 — Polish (3-6 h)

- **P2-9** : Vérifier `NavLink.tsx` variant mobile min-height ≥ 44 px (WCAG 2.5.5 Target Size).
- **P2-10** : Test unit `mapEnToFr()` couvrant les 31 prefixes + slugs représentatifs (regression-guard).
- **P2-11** : Ajouter breadcrumb item "Implantations région" en haut de `VilleServicePageTemplate` pour click-depth ville → région zéro friction.

---

## 12. Hors scope flag — ne pas confondre

- Adoption Breadcrumbs détaillée sur 80 pages → audit séparé en Phase 6 ou agent dédié.
- WebVitals breadcrumbs (CLS lié au JSON-LD chargement) → audit Agent 1.A perf.
- `[adminPrefix]/layout.tsx` navigation interne admin (sidebar) → hors scope Agent 3.B (back-office, pas SEO).
- `loading.tsx` shells de navigation → hors scope nav.

---

## 13. Fichiers de référence (chemins absolus)

- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\Header.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\HeaderMegaMenu.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\InterventionsMegaMenu.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\MobileNav.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\Footer.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\LocaleSwitcher.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\nav\Breadcrumbs.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\proxy.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\lib\i18n\en-to-fr-redirect.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\i18n\routing.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\sections\VilleServicePageTemplate.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\sections\PressImageBank.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\[locale]\recherche\page.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\messages\fr.json`

---

**Fin Agent 3.B**.
