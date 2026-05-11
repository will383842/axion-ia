# AGT-02 — ROUTES-MAILLAGE

> E2E Deep Audit Axion-IA · 2026-05-11
> Pondération : ×1.2 (transverse, Phase 2)
> Mode : AUDIT-ONLY (zéro modification code)
> Périmètre : nav exhaustivité, breadcrumbs, liens orphelins, prefetch, Speculation Rules, ancrages, 404 internes, mega-menus, footer
> Horloge : ~70 min

---

## Score : 86/100

Note rang : **A−** (maillage dense et bien typé ; quelques orphelins documentables, 1 lien sitemap.xml en partie cassé en prod, copy mineur à harmoniser).

## Confiance : haute

Justifications :

- Lecture exhaustive des 4 composants nav (`Header.tsx`, `Footer.tsx`, `HeaderMegaMenu.tsx` + 2 implémentations, `MobileNav.tsx`, `Breadcrumbs.tsx`, `LocaleSwitcher.tsx`, `NavLink.tsx`).
- Croisement avec inventaire Phase 1 (75 pages publiques `page.tsx` hors sandbox, 36 admin), SSOT routes `src/lib/routes.ts`, SSOT pathnames `src/i18n/routing.ts`.
- Grep ciblé sur `Breadcrumbs|buildBreadcrumbJsonLd` (74 fichiers, 68 `page.tsx` + 1 template partagé), `Speculation Rules`, `prefetch`, `adminPrefix` (37 fichiers — tous dans `(admin)`), `href` orphelins.
- Cohérence avec `00-REALITY-CHECK.md` (sitemap.xml 404 prod) et `AGT-04-SEO.md` (trade-off documenté Next 16).

## Top findings (P0 / P1 / P2)

### P0 — bloquants

Aucun P0. La nav est fonctionnelle, typée, et 0 lien interne dynamique vers une route inexistante.

### P1 — à corriger avant sign-off prod publique

| #        | Finding                                                                                                                                                                                                                                                                                                                                                                                                              | Citation                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-01** | **Footer émet un `<a href="/sitemap.xml">` raw** alors que `/sitemap.xml` répond **404 en prod** (confirmé Phase 0 Reality Check + AGT-04). Le lien visible « Plan du site » casse pour tout visiteur qui clique. Il faut le pointer vers `/sitemap-index.xml` (200 OK) ou retirer le lien — Google crawl `sitemap-index.xml` via `robots.txt` directive, pas besoin de l'exposer dans le footer UI.                 | `src/components/nav/Footer.tsx:179`                                                                                                                                                                                                                         |
| **R-02** | **`/desabonnement` orphelin de toute UI** mais référencé uniquement par token email signé. ✅ OK pour cible utilisateur (RGPD). ⚠️ MAIS la route est **exclue du sitemap** (`src/app/sitemap.ts:79`) et n'apparaît dans aucune nav — confirmé acceptable, à documenter formellement.                                                                                                                                 | `src/app/sitemap.ts:75-84`, `src/app/[locale]/desabonnement/page.tsx` (présent), `src/components/nav/*.tsx` (absent)                                                                                                                                        |
| **R-03** | **`/mes-donnees` et `/preferences-cookies` sont orphelins** : aucune nav, aucun lien dans `politique-confidentialite`, `cookies`, `rgpd`. Or ce sont les pages RGPD qu'un utilisateur cherche (« exporter mes données », « modifier mes consentements cookies »). Bug RGPD UX : portabilité Art. 20 invisible. Vérifié 3 grep : aucune occurrence dans `src/app/[locale]/{rgpd,politique-confidentialite,cookies}/`. | `src/app/[locale]/mes-donnees/page.tsx` (page existe), `src/app/[locale]/preferences-cookies/page.tsx`, `src/components/nav/Footer.tsx:51-57` (col legal sans entrée), grep 0 hit dans `src/app/[locale]/{rgpd,cookies,politique-confidentialite}/page.tsx` |
| **R-04** | **`Footer` lien `<a>` plat `/sitemap.xml`** au lieu d'utiliser `Link from '@/i18n/navigation'`. Sans préfixe locale, le lien part vers `/sitemap.xml` (qui 404), pas vers `/fr/sitemap.xml` (qui n'existe pas non plus). Bug double : lien cassé + bypass next-intl.                                                                                                                                                 | `src/components/nav/Footer.tsx:178-183`                                                                                                                                                                                                                     |
| **R-05** | **Page `/blog` sans pagination ni tri** — `src/app/[locale]/blog/page.tsx` n'a ni `searchParams.page` ni cursor, le listing renvoie tout. Acceptable V1 si < 50 posts mais P1 dès Phase 2 contenu. Pas de `rel="next"`/`rel="prev"` non plus.                                                                                                                                                                        | `src/app/[locale]/blog/page.tsx` (aucun match `searchParams\|page=\d\|cursor`)                                                                                                                                                                              |
| **R-06** | **Speculation Rules : prerender `/${locale}/audit/*` agrégé** inclut `/audit/par-ville/[ville]` (~2150 routes). En `eagerness: moderate` c'est conservateur, mais `prefetch eagerness: eager` sur le même wildcard signifie : au hover de la nav `/audit`, le browser peut prefetch des routes ville random. Bandwidth Cloudflare risk déjà signalé memory `axionia_audit_web_vitals_v3_v6_pending`.                 | `src/app/[locale]/layout.tsx:188,215` (wildcards `/audit/*`, `/interventions/*`)                                                                                                                                                                            |
| **R-07** | **Header.tsx référence `getIndexableVilles()` qui retourne potentiellement N>1 villes pilotes** — mais le mega-menu dimensionne col 2 sans pagination ni virtualisation. Si Will ajoute 10 villes pilotes (Sprint 14.10.x suite), le mega-menu va déborder. Layout pas robuste à la croissance attendue.                                                                                                             | `src/components/nav/HeaderImplantationsMenu.tsx:101-185`                                                                                                                                                                                                    |
| **R-08** | **`Footer.tsx` col Implantations** itère `pilotVilles.flatMap` avec **3 sous-liens par ville** (audit / interventions / implementation). V1 = 1 ville (Paris) → 4 entrées. Quand Will industrialise (memory `axionia_pseo_industrialisation_decision`) à ~280 villes Auvergne-Rhône-Alpes seules → footer explose à >1000 entrées. Bombe à retardement.                                                              | `src/components/nav/Footer.tsx:70-99`                                                                                                                                                                                                                       |

### P2 — qualité / optimisation

| #        | Finding                                                                                                                                                                                                                                                                                                | Citation                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **R-09** | **Copy `/implantations` mentionne « 12 régions »** alors que `REGIONS` contient 13 entrées (12 indexable + Corse noindex). Sémantiquement correct (12 indexable) mais la même page rend ensuite 13 vignettes dans la section « Toutes les régions ». Lecteur peut compter 13 et trouver l'incohérence. | `src/app/[locale]/implantations/page.tsx:36-37,86-87,175`, `src/content/regions.ts:48-267`                                            |
| **R-10** | **3 sandbox pages `/design`, `/components`, `/sections`** sont accessibles publiquement et **non gatées par `NODE_ENV`**. Robots.txt les bloque pour crawl mais elles restent ouvertes à un visiteur direct (URL devine ou logs CF). Sandbox pas trivial à découvrir, mais P2 hygiène.                 | `src/app/[locale]/{design,components,sections}/page.tsx` (aucun gate `process.env.NODE_ENV`), `src/app/robots.ts:13-25` (disallow ✅) |
| **R-11** | **`Breadcrumbs` posent un `<script type="application/ld+json">` par page** ET la page elle-même émet souvent un autre JSON-LD BreadcrumbList via `buildBreadcrumbJsonLd` (cf. `VilleServicePageTemplate.tsx:281,326`). Double émission BreadcrumbList possible — flag à recouper agent SEO (Pass B).   | `src/components/nav/Breadcrumbs.tsx:53-56`, `src/components/sections/VilleServicePageTemplate.tsx:280-326`                            |
| **R-12** | **Admin pages utilisent `<a href={`/fr/${adminPrefix}/...`}>` raw** (hardcoded FR locale, bypass next-intl). Cohérent puisque admin est mono-locale, mais incohérent avec convention `Link from '@/i18n/navigation'`. À documenter.                                                                    | `src/app/[locale]/(admin)/[adminPrefix]/{users,help,categories,calendrier,...}/page.tsx` (30+ occurrences)                            |
| **R-13** | **`MobileNav` drawer ne propose pas tous les liens du Footer** (ex `/comparaisons`, `/guide-ia`, `/glossaire`, `/roi`). Le drawer mobile expose 4 items principaux + 6 extras (`stack-ia`, `blog`, `faq`, `centre-aide`, `a-propos`, `contact`). Footer rich mais mobile drawer pauvre.                | `src/components/nav/Header.tsx:45-52` (navMobileExtras), `src/components/nav/Footer.tsx:34-50`                                        |
| **R-14** | **Speculation Rules ne couvrent pas `/blog` et `/cas-concrets`** alors que ce sont des destinations stratégiques pour AEO/GEO (citations LLM). Le `prefetch eager` cible 15 routes uniquement.                                                                                                         | `src/app/[locale]/layout.tsx:185-228`                                                                                                 |
| **R-15** | **Page `/audit` utilise `<a href="#level-flash">` raw** au lieu d'un Link Next 16 avec `scroll` API. Pas un bug (ancre intra-page = `<a>` correct) mais 2 occurrences sur 1 même target = redondant.                                                                                                   | `src/app/[locale]/audit/page.tsx:645,657`                                                                                             |

---

## Détail par sous-chapitre

### 1) Liens internes par grand bloc

#### Header (`src/components/nav/Header.tsx`)

- **Desktop** : Logo `ROUTES.home` (1), nav gauche 2 (`/interventions`, `/audit`), CTA central `/reserver` (1), nav droite 3 (`/implementation`, `/cas-concrets`, `/implantations`), `LocaleSwitcher`. Total **6 liens nav + 1 CTA + 1 logo = 8**.
- **Mega-menus** : `HeaderInterventionsMenu` 7 formats + 1 hub (`src/components/nav/HeaderInterventionsMenu.tsx:68-143`), `HeaderImplantationsMenu` Top 6 régions + N villes pilotes × ≤3 services + hub (`src/components/nav/HeaderImplantationsMenu.tsx:54-225`). Densité maillage interne **excellente**.
- **Mobile drawer** : 4 items principaux + 6 extras + CTA réserver = **11 liens** (`Header.tsx:31-52,177-213`).

#### Footer (`src/components/nav/Footer.tsx`)

- Brand col : logo home + 2 socials LinkedIn/Facebook externes (`Footer.tsx:115-156,268-296`).
- 5 colonnes (services 4, resources 8, company 5, implantations dynamiques, legal 5) = **22 entrées statiques + N dynamiques** (`Footer.tsx:25-99`).
- Bottom strip : `<a href="/sitemap.xml">` + `Link /rgpd` + `LocaleSwitcher` (`Footer.tsx:169-191`). **Lien sitemap.xml cassé en prod** (R-01).

#### Body (au cas-par-cas)

- Pages produit (interventions/_, audit/_, implementation/\*) émettent `CtaBlock` + `Breadcrumbs` + cross-links vers pages frères (vérifié 68 `page.tsx` ayant `Breadcrumbs`).
- 404/error pages proposent 4 suggestions internes (`src/app/[locale]/not-found.tsx:12-17`, `src/app/[locale]/error.tsx:54-58`).

### 2) Breadcrumbs : présence et JSON-LD

**Couverture mesurée** :

- 68/75 pages publiques (hors admin) importent `Breadcrumbs` ou `buildBreadcrumbJsonLd` directement.
- 7 exceptions :
  1. `src/app/[locale]/page.tsx` (home — pas de breadcrumb attendu, ✅).
  2. `src/app/[locale]/components/page.tsx` (sandbox dev — disallow robots, ✅).
  3. `src/app/[locale]/design/page.tsx` (sandbox dev, ✅).
  4. `src/app/[locale]/sections/page.tsx` (sandbox dev, ✅).
  5. `src/app/[locale]/audit/par-ville/[ville]/page.tsx` → délégué à `VilleServicePageTemplate.tsx:21,194` ✅.
  6. `src/app/[locale]/interventions/par-ville/[ville]/page.tsx` → idem ✅.
  7. `src/app/[locale]/implementation/par-ville/[ville]/page.tsx` → idem ✅.

→ **Couverture effective 100 % des pages éligibles** ✅.

**JSON-LD BreadcrumbList** : émis automatiquement par `Breadcrumbs.tsx:53-56` (factory `buildBreadcrumbJsonLd` depuis `lib/seo.ts:3`). Risque R-11 de double émission sur `VilleServicePageTemplate` à vérifier (Phase 4 prod-live cross-grep agent SEO).

**Profondeur testée** :

- Profondeur 1 : `/audit`, `/blog`, etc. — breadcrumb [Home, X] ✅.
- Profondeur 2 : `/audit/flash`, `/blog/[slug]` — [Home, Audit, Flash] ✅.
- Profondeur 3 : `/implantations/[region]/[ville]` — `Breadcrumbs items={[{home},{region},{ville}]}` (`src/app/[locale]/implantations/[region]/[ville]/page.tsx:117-120`) ✅.

### 3) Liens orphelins (pages sans entrée nav explicite)

| Page                                  | Orphelin de                       | Justification                                                           | Verdict                                                                               |
| ------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/desabonnement`                      | Header/Footer/Mobile              | Lien arrivé par email signé (R-02)                                      | ✅ ACCEPTABLE — exclu sitemap (`sitemap.ts:79`), `robots:false` à confirmer agent SEO |
| `/mes-donnees`                        | Header/Footer/Mobile/RGPD pages   | **Page RGPD Art.20 portabilité** orpheline (R-03)                       | ⚠️ **P1** — doit apparaître au moins dans politique-confidentialite + `/rgpd`         |
| `/preferences-cookies`                | Header/Footer/Mobile/cookies page | Page CMP orpheline (R-03)                                               | ⚠️ **P1** — doit être linkée depuis `/cookies` et bannière                            |
| `/recherche`                          | Header/Footer/Mobile              | `noindex` (`recherche/page.tsx:31`), opt-in via Pagefind UI (Sprint 15) | ✅ ACCEPTABLE — orphelin temporaire jusqu'au câblage Pagefind                         |
| `/confirmation`                       | Toute UI                          | Page tunnel post-booking, atterrissage forcé via redirect               | ✅ ACCEPTABLE — exclu sitemap (`sitemap.ts:80`)                                       |
| `/confirmation/newsletter`            | Toute UI                          | Page tunnel post-newsletter                                             | ✅ ACCEPTABLE                                                                         |
| `/maintenance` (hors `[locale]`)      | Toute UI                          | Page courtoisie déclenchée par flag env                                 | ✅ ACCEPTABLE                                                                         |
| `/politique-deplacement`              | Footer/Header                     | Linkée uniquement depuis `/audit:1053` (zone géographique)              | ⚠️ **P2** — devrait être dans Footer legal ou linkée depuis `/conditions-generales`   |
| `/design`, `/components`, `/sections` | Toute UI publique                 | Sandbox dev (R-10)                                                      | ⚠️ **P2 hygiène** — gate `NODE_ENV` recommandé                                        |

→ **3 orphelins légitimes RGPD (R-03)** + 1 sitemap cassé (R-01).

### 4) Speculation Rules

Source : `src/app/[locale]/layout.tsx:168-239` (production-only via `process.env.NODE_ENV === "production"`).

**Configuration actuelle (P-013 déjà appliqué)** :

- `prerender` `eagerness: moderate` sur 15 routes Top 80/20 (home + interventions* + audit* + implementation + cas-concrets + methodologie + comparaisons + stack-ia + implantations + paris + reserver + contact).
- `prefetch` `eagerness: eager` sur les mêmes 15 routes.
- `prefetch` `eagerness: moderate` fallback sur `/${locale}/*` (tout le reste).

**Analyse** :

- ✅ Production-gated (évite saturation Turbopack en dev, mémoire `axionia_perf_audit_2026-05-07`).
- ✅ Top 15 ciblées explicitement (mémoire `axionia_audit_web_vitals_2026-05-08`).
- ⚠️ R-06 : wildcard `/audit/*` + `/interventions/*` inclut les ~2150 routes par-ville en `prefetch eager`. Le browser ne charge qu'au hover, mais sur un device mobile en zone faible, `eager` consomme bandwidth Hetzner egress.
- ⚠️ R-14 : `/blog` et `/cas-concrets` (hubs SEO) non listés en `eager`. Manque d'opportunité INP.
- ✅ Browsers sans support (Safari, Firefox) ignorent silencieusement.

### 5) Prefetch Next.js Link

Tous les liens internes utilisent `Link from '@/i18n/navigation'` (alias `next-intl`). Par défaut Next 16 `prefetch={true}` sur viewport intersect + hover. Aucun `prefetch={false}` ou `prefetch={true}` explicite trouvé (grep 0 hit, sauf le bloc Speculation Rules `layout.tsx:206`).

→ Comportement par défaut respecté. **Aucun lien navigation ne désactive le prefetch** ce qui est correct pour des routes SSG.

### 6) Pagination + ancrages

**Ancrages intra-page** :

- 9 hits `href="#..."` : `SkipToContent.tsx:9` (a11y), `comparaisons/page.tsx:149`, `blog/page.tsx:173`, `cas-concrets/page.tsx:179`, `presse/page.tsx:211`, `audit/page.tsx:645,657`, `faq/page.tsx:122`, `contact/page.tsx:212`.
- Tous utilisent `Cta href="#..."` ou `<a href="#...">` direct — correct pour scroll intra-page (pas de Link Next).
- R-15 : 2 ancres `#level-flash` sur même page (redondance mineure).

**Pagination listing** :

- ❌ Aucune pagination implémentée sur `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`. R-05 P1.
- ✅ Calendrier admin a pagination month-aware (`calendrier/page.tsx:86-99`).

### 7) 404 internes (liens cassés)

Grep exhaustif des `href={'/...'}` puis cross-check vs `routing.pathnames` :

| Href trouvé                                                                                                                                                                                                                                  | Existe ?                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/a-propos`, `/audit`, `/blog`, `/cas-concrets`, `/centre-aide`, `/conditions-generales`, `/contact`, `/cookies`, `/guide-ia`, `/implantations`, `/implementation`, `/interventions`, `/politique-deplacement`, `/reserver`, `/rgpd`, `/roi` | ✅ tous mappés `routing.ts:11-176`                                 |
| `/audit/flash`, `/implementation/ia-custom`, `/implementation/par-techno`, `/interventions/essentielle`                                                                                                                                      | ✅                                                                 |
| `/sitemap.xml`                                                                                                                                                                                                                               | ❌ 404 prod (R-01, R-04)                                           |
| `/blog/exemple`, `/cas-concrets/exemple`, `/cas-concrets/exemple-1..3`                                                                                                                                                                       | ⚠️ Sandbox `/components`, `/sections` uniquement — disallow robots |
| `/x`                                                                                                                                                                                                                                         | Test fixture (`button.test.tsx:17`) — non distribué                |
| `/api/healthz`, `/api/vitals`, etc.                                                                                                                                                                                                          | ✅ routes API présentes                                            |

→ **1 seul lien cassé en prod** : `/sitemap.xml` (R-01). Tous les autres targets résolvent.

### 8) Routes admin → leak depuis pages publiques

Grep `adminPrefix|ADMIN_URL_PREFIX` retourne **37 fichiers, tous sous `src/app/[locale]/(admin)/`**. Aucune fuite vers public.

- ✅ Header/Footer/MobileNav : 0 référence admin.
- ✅ Pages publiques : 0 référence admin.
- ✅ Mega-menus : 0 référence admin.
- ✅ Robots.txt n'a pas de Disallow `/admin*` car le segment est dynamique (`[adminPrefix]`), anti-énumération préservée.

→ **Aucun leak admin** ✅.

### 9) Maillage interne services × villes (pilotes pSEO)

**Footer `implantationsLinks`** (`Footer.tsx:62-99`) :

- 1 lien hub + 6 régions + N villes pilotes × (1 + ≤3 services) flatMap.
- V1 (Paris seul) = 1 + 6 + 4 = **11 entrées Footer Implantations**.
- ⚠️ R-08 : à 280 villes Auvergne-Rhône-Alpes, le footer émet ~1120 liens en col Implantations seule. **Explosion HTML payload**.

**Header mega-menu Implantations** (`HeaderImplantationsMenu.tsx:62-225`) :

- Col 1 : 6 régions top PIB.
- Col 2 : N villes pilotes avec sous-liens services.
- Col 3 : hub map + CTA.
- ⚠️ R-07 : layout pas robuste si N > 3.

**Pages region/ville croisées** :

- `/implantations` linke vers les 13 régions + villes pilotes (✅ exhaustif `implantations/page.tsx:119-244`).
- `/implantations/[region]` linke vers Top 12 villes + sections services (✅ `[region]/page.tsx:188-303`).
- `/implantations/[region]/[ville]` linke vers villes proches + retour région (✅ `[ville]/page.tsx:611,872`).
- `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]` → templates partagés `VilleServicePageTemplate.tsx`.

→ Maillage **3 niveaux profondeur**, breadcrumbs cohérents, signaux Geo internes OK.

### 10) Couverture loading.tsx / error.tsx / not-found.tsx

| Fichier                                                       | Présent ? | Notes                                                                                                                                                   |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/not-found.tsx`                                       | ✅        | Root 404 bilingue (`not-found.tsx:19-61`)                                                                                                               |
| `src/app/[locale]/not-found.tsx`                              | ✅        | Locale 404 avec 4 suggestions internes (`not-found.tsx:12-17`)                                                                                          |
| `src/app/[locale]/error.tsx`                                  | ✅        | Boundary 500 client avec retry + Sentry digest (`error.tsx:14-77`)                                                                                      |
| `src/app/[locale]/loading.tsx`                                | ✅        | Fallback global                                                                                                                                         |
| `src/app/[locale]/audit/loading.tsx`                          | ✅        | Dédié page audit (hero lourd)                                                                                                                           |
| `src/app/[locale]/contact/loading.tsx`                        | ✅        | Dédié formulaire                                                                                                                                        |
| `src/app/[locale]/reserver/loading.tsx`                       | ✅        | Dédié calendrier client-heavy                                                                                                                           |
| `src/app/[locale]/implantations/[region]/[ville]/loading.tsx` | ✅        | Dédié page ville pilote (~5000 mots)                                                                                                                    |
| Autres routes lourdes ?                                       | ⚠️        | Pas de `loading.tsx` spécifique sur `/methodologie`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/implementation/*` — fallback global utilisé. |

→ Couverture conforme V14 doctrine. **Aucun trou bloquant**.

---

## Citations

| Sujet                                    | Path:line                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Header desktop nav split 2+CTA+3         | `src/components/nav/Header.tsx:31-52`                                                  |
| Header mega-menus                        | `src/components/nav/Header.tsx:124-170`                                                |
| Mobile drawer items principaux + extras  | `src/components/nav/Header.tsx:177-213`                                                |
| Footer 5 colonnes + brand                | `src/components/nav/Footer.tsx:25-99`                                                  |
| Footer sitemap.xml link cassé prod       | `src/components/nav/Footer.tsx:179`                                                    |
| Speculation Rules production-gated       | `src/app/[locale]/layout.tsx:176-239`                                                  |
| Breadcrumbs JSON-LD factory              | `src/components/nav/Breadcrumbs.tsx:25-56`                                             |
| VilleServicePageTemplate breadcrumb      | `src/components/sections/VilleServicePageTemplate.tsx:194,280-326`                     |
| ROUTES SSOT                              | `src/lib/routes.ts:21-89`                                                              |
| routing.pathnames source                 | `src/i18n/routing.ts:11-176`                                                           |
| robots.txt sandbox disallow              | `src/app/robots.ts:13-25`                                                              |
| Sitemap exclusions (orphelins légitimes) | `src/app/sitemap.ts:75-84`                                                             |
| HeaderMegaMenu hover-intent 100/200ms    | `src/components/nav/HeaderMegaMenu.tsx:20-21,66-74`                                    |
| LocaleSwitcher preserves pathname        | `src/components/nav/LocaleSwitcher.tsx:21-62`                                          |
| NavLink active state `aria-current`      | `src/components/nav/NavLink.tsx:18-54`                                                 |
| Implantations region listing             | `src/app/[locale]/implantations/[region]/page.tsx:68-77,188,303`                       |
| Implantations 13 régions data            | `src/content/regions.ts:48-267`                                                        |
| Admin hardcoded `/fr/${adminPrefix}/`    | `src/app/[locale]/(admin)/[adminPrefix]/users/[id]/page.tsx:42,114` (et 30+ autres)    |
| Not-found locale                         | `src/app/[locale]/not-found.tsx:9-60`                                                  |
| Error boundary client                    | `src/app/[locale]/error.tsx:14-77`                                                     |
| Loading dedicated routes                 | `src/app/[locale]/{audit,contact,reserver,implantations/[region]/[ville]}/loading.tsx` |

---

## [INCONNU]

- **Statut runtime Speculation Rules en prod** : non vérifié runtime que `<script type="speculationrules">` apparaît bien sur `https://axion-ia.com/fr/` (Reality Check note 2 occurrences via curl mais Phase 4 prod-live doit confirmer Top 15 routes). À cross-checker AGT-03 PERFORMANCE.
- **Double émission BreadcrumbList JSON-LD** (R-11) : suspect mais non confirmé en lecture statique. `Breadcrumbs.tsx:53` émet 1 script, et `VilleServicePageTemplate.tsx:281` émet `breadcrumbJsonLd` puis passe `items` à `<Breadcrumbs>`. À tester runtime (view-source) sur `/fr/audit/par-ville/paris` Phase 4.
- **Volume réel HTML payload Footer** sur prod `/fr/` : à mesurer Phase 4 (peut déjà être P0 si Will a poussé pilot villes au-delà de Paris).
- **`/sitemap.xml` doit-il être maintenu ?** : décision doctrine ouverte (Next 16 expose `/sitemap-index.xml` mais Google attend historiquement `/sitemap.xml`). Trade-off documenté `AGT-04-SEO.md:25`. **Décision dépend ADR à formaliser**.
- **Couverture EN exhaustive** : non systématiquement vérifiée. Le LocaleSwitcher utilise `useParams` pour les routes dynamiques mais certaines routes legal (`/cookies`, `/rgpd`, `/blog`) n'ont pas de `en` distinct dans `routing.pathnames` (alias identique). Si Will switch locale sur `/fr/cookies`, doit-il aller vers `/en/cookies` ? Comportement actuel = oui (alias) → OK.

---

## Recommandations

### Immédiates (Sprint correctif post-E2E)

1. **R-01 + R-04** : remplacer le `<a href="/sitemap.xml">` du Footer par soit (a) `<a href="/sitemap-index.xml">` si Will veut garder un lien UI, soit (b) supprimer le lien et garder uniquement `robots.txt` qui pointe sur `/sitemap-index.xml`. Décision Will requise.

2. **R-03** : ajouter dans `Footer.tsx` col Legal :
   - `/preferences-cookies` (entre `/cookies` et `/accessibilite`).
   - `/mes-donnees` (Art. 20 RGPD portabilité).
     Et linker `/mes-donnees` + `/preferences-cookies` depuis `src/app/[locale]/{rgpd,politique-confidentialite,cookies}/page.tsx`.

3. **R-08** : refacto `Footer.tsx:70-99` avec un cap `pilotVilles.slice(0, MAX_FOOTER_VILLES)` (ex `MAX=5`) et un lien « voir toutes » vers `/implantations`. Anti-bombe payload pour la mise à l'échelle 2150 villes.

### Pré-prod-publique

4. **R-05** : implémenter pagination `searchParams.page` sur `/blog`, `/cas-concrets` (server-side, SSG-compatible via `generateStaticParams` enrichi). Ajouter `rel="next"/"prev"` metadata.

5. **R-06** : retirer les wildcards `/audit/*` + `/interventions/*` + `/implementation/par-ville/*` de la liste `prefetch eager` (`layout.tsx:185-228`). Garder uniquement routes top-level (déjà OK pour `/audit` simple, mais `/audit/*` est trop large).

6. **R-07** : prévoir un layout adaptatif `HeaderImplantationsMenu` quand `pilotVilles.length > 3` (scroll vertical interne, ou bascule vers une colonne 4 régions / 1 col villes condensée).

### V2 / hygiène

7. **R-10** : gater les sandbox pages `/design`, `/components`, `/sections` :

   ```tsx
   if (process.env.NODE_ENV === "production") notFound();
   ```

   Ou les déplacer hors `[locale]` vers un préfixe gardé par middleware Coolify (basic-auth).

8. **R-09** : harmoniser le copy `/implantations` ("12 régions" mais affichage 13 vignettes) — soit retirer Corse de la liste publique pour V1, soit clarifier "13 régions dont 12 indexables V1".

9. **R-12** : extraire un helper `adminPath(p: string)` qui prefixe `/fr/${adminPrefix}` proprement, et migrer les 30+ `<a href={`/fr/${adminPrefix}/...`}>` vers ce helper (mémoire `axionia_session_2026-05-09_sprint_24` mentionne déjà `adminPath()` introduit Sprint 24 — vérifier adoption).

10. **R-13** : ajouter dans `navMobileExtras` (Header.tsx:45-52) au minimum `/comparaisons`, `/guide-ia`, `/glossaire`, `/roi` pour parité Footer ↔ Mobile drawer.

11. **R-14** : ajouter `/blog` et `/cas-concrets` à la liste `prefetch eager` Speculation Rules (P-013 update).

12. **R-11** : si confirmé double JSON-LD BreadcrumbList, supprimer l'émission redondante côté `VilleServicePageTemplate` (laisser `<Breadcrumbs>` être SSOT).

---

## STOP & ASK

### STOP & ASK 1 — Décision sur `/sitemap.xml` (R-01 + R-04)

**Question** : faut-il maintenir un endpoint `/sitemap.xml` qui réponde 200 (alias vers sitemap-index OU vraie static map condensée) ?

**Contexte** : Google Search Console préfère historiquement `/sitemap.xml` ; Next 16 routes-handler ne génère que `/sitemap-index.xml`. La doctrine actuelle (AGT-04-SEO) note "Pas un bug : trade-off Next 16 documenté". Le Footer expose `/sitemap.xml` comme lien UI ; en l'état, **cliquer renvoie 404**.

**Options** :

- (A) Ajouter `src/app/sitemap.xml/route.ts` qui `redirect()` vers `/sitemap-index.xml` (302 OU permanent 308).
- (B) Modifier `Footer.tsx:179` pour pointer `/sitemap-index.xml` directement.
- (C) Retirer le lien du Footer (`robots.txt` couvre crawl Google, UI plus simple).

Recommandation perso : **(B) + (C combiné)** — Footer UI ne sert que les humains qui veulent voir un sitemap (rare), redirige plutôt vers `/sitemap-index.xml`.

### STOP & ASK 2 — Pages RGPD orphelines (R-03)

**Question** : `/mes-donnees` et `/preferences-cookies` sont-elles des pages destinées à être linkées en UI, ou des sous-routes accédées par un autre flow (ex bandeau cookies CMP custom = `/preferences-cookies` ; export RGPD = `/api/gdpr-export` qui sert un fichier) ?

**Contexte** : Si Will a un CMP custom (pas Didomi/Axeptio), la bannière cookies devrait linker `/preferences-cookies`. Si export RGPD est self-serve, `/mes-donnees` devrait être linké depuis `/rgpd`. Sinon, ce sont des pages mortes qui pollutent `routing.ts` et le typecheck.

**Décision attendue** : (a) brancher les liens, (b) supprimer les routes, (c) garder en stand-by Sprint 16.

### STOP & ASK 3 — Layout Footer scaling villes (R-08)

**Question** : à quelle échelle (combien de villes pilotes) Will arrête de tout exposer en footer et bascule vers une logique « villes pilotes ≤ N + lien vers hub » ?

**Contexte** : V1 = 1 ville (Paris) → 11 entrées Footer Implantations, payload acceptable. Si Will industrialise (~280 Auvergne, ~150 PACA…) sans cap, footer explose. Doit-on poser dès maintenant `MAX_FOOTER_VILLES = 5` ?

**Décision attendue** : valeur exacte du cap, et critère (ex top 5 par PIB, top 5 par traffic Search Console, top 5 par densité PME).

### STOP & ASK 4 — Speculation Rules wildcards (R-06)

**Question** : faut-il restreindre `/audit/*` et `/interventions/*` à 5-10 sous-routes nommées (les sous-pages produit) au lieu de globber 2150+ routes par-ville ?

**Risque non chiffré** : impact Cloudflare egress sur device mobile en zone faible (4G/5G saturé). Mémoire `axionia_audit_web_vitals_2026-05-08` flag déjà mais sans patch chiffré.

**Décision attendue** : OK pour expliciter les ~25 sous-routes critiques au lieu du wildcard, ou bien attendre Phase 4 prod-live avec mesure CrUX réelle ?

### STOP & ASK 5 — Sandbox pages gating (R-10)

**Question** : doit-on bloquer `/fr/design`, `/fr/components`, `/fr/sections` en prod via `notFound()` conditionnel `NODE_ENV`, ou les laisser ouvertes (robots.txt suffit) ?

**Trade-off** :

- (A) Gate `NODE_ENV` → 0 expo prod, mais nécessite redeploy si Will veut montrer le design system à un client.
- (B) Garder ouvertes → expo URL devinable, mais utile pour démos commerciales.

**Décision attendue** : politique pour V1.

---

**Fin AGT-02 ROUTES-MAILLAGE**. Pondération ×1.2 → 86 × 1.2 = **103.2 / 120**. Note rang A−.
