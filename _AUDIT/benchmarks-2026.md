# Agent B — Benchmarks navigation 2026 (13 sites)

> Date : 2026-05-07
> Méthode : WebFetch + extraction factuelle (pas d'interprétation)
> Sites audités : 13 (8 disponibles, 5 partiellement ou totalement bloqués)
> Source prompt : `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md` v1.3

## État de disponibilité WebFetch

| #     | Site                           | État                  | Note                                                                                     |
| ----- | ------------------------------ | --------------------- | ---------------------------------------------------------------------------------------- |
| 1     | anthropic.com                  | OK                    | Header + mega-menus + footer extraits                                                    |
| 2     | stripe.com                     | OK                    | Header + footer extraits, mega-menu inféré via footer                                    |
| 3     | vercel.com                     | OK                    | Header + footer extraits                                                                 |
| 4     | linear.app                     | OK                    | Header + footer partiellement extraits                                                   |
| 5     | apple.com                      | OK                    | Header + footer (US)                                                                     |
| 6     | openai.com                     | BLOQUÉ                | HTTP 403 sur 3 paths (`/`, `/about`, `/index/`)                                          |
| 7     | mistral.ai                     | OK                    | Header + footer extraits                                                                 |
| 8     | cohere.com                     | OK                    | Header + mega-menus complets + newsletter                                                |
| 9     | booking.com                    | PARTIEL               | Home et `/destinations.html` 403/404, mais `/country/fr.html` OK → patterns URL extraits |
| 10    | airbnb.com                     | BLOQUÉ                | 403 sur `.com`, `.fr`, `news.`, sitemaps                                                 |
| 11    | mckinsey.com                   | BLOQUÉ                | Socket closed sur 3 paths (`/`, `/about-us`, `/featured-insights`, `/quarterly`)         |
| 11bis | deloitte.com                   | OK (fallback)         | Pris à la place de McKinsey                                                              |
| 12    | qonto.com                      | OK                    | Header + mega-menus + footer + 8 locales                                                 |
| 12bis | pennylane.com                  | OK (bonus FR)         | Header + footer extraits                                                                 |
| 13    | gouvernement.fr → info.gouv.fr | BLOQUÉ après redirect | 403                                                                                      |
| 13bis | service-public.gouv.fr         | OK (fallback)         | Référence FR observée                                                                    |

---

## Matrice synthétique

| Site                              | Items header   | Mega-menu (colonnes)              | ⌘K visible                                       | Sticky               | Footer cols             | Breadcrumbs home           | Note clé                                                 |
| --------------------------------- | -------------- | --------------------------------- | ------------------------------------------------ | -------------------- | ----------------------- | -------------------------- | -------------------------------------------------------- |
| anthropic.com                     | 5 + CTA        | OUI (2-3 cols)                    | Non observable                                   | Sticky figé          | 8 hubs                  | Non                        | Header solution-driven, footer riche                     |
| stripe.com                        | 5 + 2 CTA      | OUI (3-4 cols inférés via footer) | Non observable                                   | Non observable       | 6 hubs                  | Non                        | Hiérarchie footer = miroir mega-menu                     |
| vercel.com                        | 4-5            | OUI (3 cols × 3 menus)            | Non observable                                   | Non observable       | 7 hubs                  | Non                        | Mega-menus 3-col uniformes                               |
| linear.app                        | 4 + CTA        | OUI (cols non quantifiées)        | Non observable                                   | Non observable       | 6 hubs                  | Non                        | Pas de switcher locale                                   |
| apple.com                         | 9-12           | NON observable                    | Icône recherche présente                         | Non observable       | 4 hubs principaux       | Non                        | Locale switcher footer "United States"                   |
| openai.com                        | —              | —                                 | —                                                | —                    | —                       | —                          | BLOQUÉ HTTP 403                                          |
| mistral.ai                        | 4 + 2 CTA      | NON (liens directs)               | Non                                              | Non observable       | 4 hubs                  | Non                        | "Try Studio" CTA dominant, switcher EN seul              |
| cohere.com                        | 5 + 2 CTA      | OUI (1-3 cols)                    | Non                                              | Reste visible scroll | 5 hubs                  | Non                        | Newsletter footer présente                               |
| booking.com                       | (home bloquée) | —                                 | Barre recherche centrale (référence sectorielle) | —                    | Multi-hubs destinations | OUI sur pages internes     | URL pattern hiérarchique pays/région/ville/landmark      |
| airbnb.com                        | —              | —                                 | —                                                | —                    | —                       | —                          | BLOQUÉ HTTP 403 partout                                  |
| mckinsey.com                      | —              | —                                 | —                                                | —                    | —                       | —                          | BLOQUÉ socket/timeout                                    |
| deloitte.com (fallback)           | 5              | OUI (3-4 cols)                    | Non observable                                   | Non observable       | 4 hubs                  | Non                        | Switcher "GLOBAL - EN" en header                         |
| qonto.com                         | 6              | OUI (2-3 cols)                    | Non                                              | Non observable       | 8 hubs                  | Non                        | 8 locales (FR/DE/ES/IT/AT/BE/PT/NL)                      |
| pennylane.com (bonus)             | 6              | NON (linéaire)                    | Non                                              | Header persistant    | 4 hubs                  | Non                        | Très simple, pas de mega-menu                            |
| service-public.gouv.fr (fallback) | 7              | OUI (2 niveaux)                   | Recherche header "Rechercher sur le site"        | Non observable       | 8 sections              | Inférés sur pages internes | Pas de pattern régions/villes (codes F-XXXXX uniquement) |

---

## Détails par site

### 1. anthropic.com — OK

- **Header** : 5 items principaux : `Research`, `Economic Futures`, `Commitments`, `Learn`, `News` + CTA `Try Claude` + options utilisateur.
- **Mega-menus** :
  - `Commitments` : 2 colonnes (Initiatives | Trust center) — 3+1 sous-items.
  - `Learn` : 3 colonnes apparentes (Learn | Company) — 4+3 sous-items.
  - `Try Claude` : 3 colonnes (Products | Models | Log in) — 7 produits, 3 modèles (Opus, Sonnet, Haiku).
- **Command palette ⌘K** : non observable.
- **Sticky** : header figé en haut, pas de hide-on-scroll observé.
- **Locale** : EN par défaut. Switcher "EN" présent (dropdown placeholder vide observé).
- **Footer** : 8 hubs : Products | Models | Solutions | Claude Platform | Resources | Help and security | Company | Terms and policies.
- **Breadcrumbs** : non observés sur home.
- **Newsletter / social** : pas de newsletter visible. Réseaux sociaux : LinkedIn, X, YouTube.
- **Faille → leçon AxionIA** : la doctrine "solution-driven" se voit jusque dans la nomenclature (`Economic Futures`, `Commitments`) — privilégier des libellés substantifs et différenciants plutôt que génériques (`Solutions` seul).

### 2. stripe.com (FR) — OK

- **Header** : 5 items : `Produits`, `Solutions`, `Développeurs`, `Ressources`, `Tarifs` + `Se connecter` + CTA `Contacter notre équipe`.
- **Mega-menus** : non capturés en hover (HTML statique), mais le footer indique la profondeur :
  - Produits : 20+ sous-items (Atlas, Billing, Checkout, Connect, Terminal…).
  - Solutions : 12+ catégories (Grandes entreprises, Startups, E-commerce, SaaS…).
  - Développeurs : Documentation, API, Bibliothèques.
  - Ressources : Guides, Blog, Témoignages, Roadmap.
  - Inférence : 3-4 colonnes par mega-menu.
- **⌘K** : non observable depuis WebFetch (mais documenté ailleurs comme présent — non confirmable ici).
- **Sticky** : non observable depuis HTML statique.
- **Locale** : URL `/fr/`. Switcher footer `France(Français)` observé.
- **Footer** : 6 colonnes : Produits et tarifs | Solutions | Développeurs | Intégrations | Ressources | Entreprise + Support.
- **Breadcrumbs** : non observés sur home.
- **Newsletter / social** : non observés dans l'extrait.
- **Faille → leçon AxionIA** : footer = miroir hiérarchique du mega-menu, ce qui sert le crawl SEO et la mémoire utilisateur. À répliquer.

### 3. vercel.com — OK

- **Header** : 4-5 items : `Products`, `Resources`, `Solutions`, `Enterprise`, `Pricing`.
- **Mega-menus** : 3 colonnes uniformes :
  - Products : AI Cloud | Core Platform | Security.
  - Resources : Company | Learn | Open Source.
  - Solutions : Use Cases | Tools | Users.
- **⌘K** : non observable depuis HTML statique (réputation ⌘K confirmée ailleurs, non visible ici).
- **Sticky** : non observable.
- **Locale** : pas de switcher visible. EN par défaut.
- **Footer** : 7 colonnes : Get Started | Build | Scale | Secure | Resources | Learn | Frameworks/SDKs/Use Cases/Company/Community.
- **Breadcrumbs** : non observés.
- **Newsletter / social** : GitHub, LinkedIn, X, YouTube + Status page. Pas de newsletter.
- **Faille → leçon AxionIA** : 3 colonnes uniformes par mega-menu = lisibilité maximale. Imposer un gabarit visuel constant pour tous les mega-menus AxionIA.

### 4. linear.app — OK

- **Header** : 4 items principaux : `Product`, `Resources`, `Customers`, `Pricing` + extras (`Now`, `Contact`, `Docs`, `Open app`, `Log in`, `Sign up`).
- **Mega-menus** : présents sous `Product` et `Resources`, colonnes non quantifiées dans l'extrait.
- **⌘K** : non observable.
- **Sticky** : non observable.
- **Locale** : EN. Pas de switcher visible.
- **Footer** : 6 hubs : Product | Features | Company | Resources | Connect | Legal.
- **Breadcrumbs** : non observés.
- **Newsletter / social** : X, GitHub, YouTube. Pas de newsletter.
- **Faille → leçon AxionIA** : pas de switcher locale = positionnement EN-only assumé. AxionIA en FR/EN doit avoir un switcher visible (différenciation OÜ estonienne).

### 5. apple.com — OK

- **Header** : 9-12 items : `Apple`, `Store`, `Mac`, `iPad`, `iPhone`, `Watch`, `Vision`, `AirPods`, `TV & Home`, `Entertainment`, `Accessories`, `Support`.
- **Mega-menus** : non détectés en HTML statique (Apple les rend en JS au hover).
- **Recherche** : icône loupe `[](/us/search)` présente.
- **Sticky** : non observable depuis HTML statique (réputation : sticky avec condensation, non confirmable ici).
- **Locale** : `/us/` par défaut. Switcher footer `"United States"` → `/choose-country-region/`.
- **Footer** : 4 hubs principaux : Shop and Learn | Apple Wallet | Account | Entertainment + sections complémentaires (Apple Store, Business, Education, Healthcare, Government, Values, About).
- **Breadcrumbs** : non détectés sur home.
- **Newsletter / social** : non observés.
- **Faille → leçon AxionIA** : 9+ items header = catalogue produit. Pour un cabinet B2B, viser 5-7 max pour préserver lisibilité — pattern Apple n'est pas transposable au consulting.

### 6. openai.com — BLOQUÉ

- **État** : HTTP 403 Forbidden sur `https://openai.com`, `https://www.openai.com/`, `https://www.openai.com/about`, `https://openai.com/index/`.
- **Action** : aucune extraction possible via WebFetch. Site protégé par WAF/Cloudflare strict.
- **Faille → leçon AxionIA** : non observable. À compléter manuellement par capture d'écran si critique.

### 7. mistral.ai — OK

- **Header** : 4 items principaux : `Products`, `Solutions`, `Research`, `Blog`, `Customers`, `Company` + CTAs `Contact Sales` et `Try Studio`.
- **Mega-menus** : aucun observable. Items = liens directs vers `/solutions`, `/models`, `/news`, `/customers`.
- **⌘K** : non.
- **Sticky** : non observable.
- **Locale** : EN. Switcher locale `en` visible footer.
- **Footer** : 4 colonnes : Why Mistral | Explore | Build | Legal. Réseaux sociaux : X, LinkedIn, Discord. Pas de newsletter.
- **Breadcrumbs** : non.
- **Faille → leçon AxionIA** : Mistral mise sur la simplicité (liens directs, pas de mega-menu) — efficace pour startup mais sous-exploite le footer en hub SEO. AxionIA doit faire mieux côté hubs (modèle Stripe).

### 8. cohere.com — OK

- **Header** : 5 items : `Products`, `Solutions`, `Research`, `Resources`, `Company` + CTAs `Sign in` et `Request a demo`.
- **Mega-menus** :
  - Products : 3 colonnes (Workplace Systems | Generative Models | Advanced Retrieval Models).
  - Solutions : 2 colonnes (Industries 7 secteurs | Model Vault + Security + Private Deployments).
  - Research : 2 colonnes (Cohere Labs + Aya | Resources + Initiatives).
  - Resources : 2 colonnes (Resources | Community).
  - Company : 1 colonne.
- **⌘K** : non.
- **Sticky** : navigation reste visible au scroll.
- **Locale** : EN. Pas de switcher langue dans header.
- **Footer** : 5 colonnes : Products | Solutions | Resources | Company | Réseaux sociaux. **Newsletter présente avec formulaire email.**
- **Breadcrumbs** : non.
- **Réseaux sociaux** : LinkedIn, Discord, X, Support.
- **Faille → leçon AxionIA** : Cohere = seul site IA observé avec newsletter footer explicite. Pour AxionIA (cabinet premium B2B), une newsletter "Stratégie IA" en footer est légitime et différenciante.

### 9. booking.com — PARTIEL (URL patterns extraits)

- **Home `booking.com`** : timeout/non extrait directement.
- **Page pays `booking.com/country/fr.html`** : OK, patterns clairs :
  - **URL pattern hiérarchique** :
    - Pays : `/country/fr.html`
    - Région : `/region/fr/[region-slug].html` — ex. `south-of-france`, `provence-alpes-cote-d-azur`, `french-alps`, `loire-valley`.
    - Ville : `/city/fr/[city-slug].html` — ex. `paris`, `cannes`, `nice`, `marseille`, `lyon`.
    - Landmark : `/landmark/fr/[landmark-slug].html`.
  - **Breadcrumbs** : présents — format `Home > Hotels > France`.
  - **Footer hubs** : All destinations | All flight destinations | All car rental locations | All vacation destinations.
  - **Densité** : Paris = 23 978 hôtels, South of France = 164 295 hôtels (compteurs visibles).
- **Faille → leçon AxionIA** : pattern `/[type]/[locale]/[slug]` (4 niveaux : country/region/city/landmark). Pour AxionIA pSEO villes/régions, transposer en `/regions/[slug]` + `/villes/[slug]` + `/secteurs/[slug]/[ville]` avec breadcrumbs canoniques `Accueil > Régions > Île-de-France > Paris`.

### 10. airbnb.com — BLOQUÉ

- **État** : HTTP 403 sur `airbnb.com`, `airbnb.fr`, `news.airbnb.com`, `airbnb.com/sitemaps/v2`, `airbnb.fr/s/Paris`. Bot detection agressif.
- **Faille → leçon AxionIA** : non observable. Le pattern Airbnb (`/s/<lieu>--<pays>/homes`) est connu ailleurs mais non confirmable ici.

### 11. mckinsey.com — BLOQUÉ

- **État** : socket closed unexpectedly / timeout sur `/`, `/about-us`, `/featured-insights`, `/quarterly`. Probable WAF anti-bot.
- **Faille → leçon AxionIA** : non observable directement. Fallback Deloitte ci-dessous.

### 11bis. deloitte.com (FR) — OK (fallback McKinsey)

- **Header** : 5 items : `Qui sommes-nous ?`, `Notre savoir-faire`, `Nos points de vue`, `Carrière`, switcher `GLOBAL - EN`.
- **Mega-menus** :
  - Qui sommes-nous ? : 4 sous-items.
  - Notre savoir-faire : 3 colonnes (Services | Industries | Alliances).
  - Nos points de vue : 4 options.
  - Carrière : sections imbriquées + filtres géographiques.
- **Recherche** : non explicitement présente.
- **Sticky** : non observable depuis HTML statique.
- **Locale** : FR-FR par défaut, switcher `GLOBAL - EN` présent en header (rare — la plupart le mettent footer).
- **Footer** : 4 hubs : Travailler avec nous | Bureau locations (8 villes) | Expertises (6 services) | Further resources (events, press, alumni). Pas de newsletter. Réseaux : LinkedIn, Instagram, YouTube.
- **Breadcrumbs** : non sur home.
- **Faille → leçon AxionIA** : libellés FR substantifs (`Qui sommes-nous ?`, `Notre savoir-faire`, `Nos points de vue`) au lieu d'anglicismes. Pour AxionIA FR, préférer `Cabinet`, `Méthode`, `Vues` plutôt que `About`/`Solutions`/`Insights`.

### 12. qonto.com — OK

- **Header** : 6 items : `Business account`, `Company creation`, `Financial tools`, `Credit`, `Pricing`, `About us`.
- **Mega-menus** :
  - Business account : 3+ colonnes (Account & cards | Tools | Incoming/Outgoing payments | Resources).
  - Company creation : 2 colonnes (Online business setup | Resources).
  - Financial tools : 2 colonnes (Solutions | Resources).
  - Credit : 2 colonnes (Solutions | Resources).
  - Pricing : 2 colonnes (Business account pricing | Company creation pricing).
  - **Chaque mega-menu inclut une image promotionnelle** (visual anchor).
- **⌘K / recherche** : aucune dans header.
- **Sticky** : non observable.
- **Locale** : EN par défaut, **switcher 8 options** : France, Deutschland, España, Italia, Österreich, België, Portugal, Nederland. Plus exhaustif que tous les autres benchmarks.
- **Footer** : 8 colonnes : Business Account | Business Cards | Company Creation | Get Paid + Financing | Financing Tools | Resources | Company | For Developers + badges réglementaires (ACPR, FGDR).
- **Breadcrumbs** : non sur home.
- **Réseaux sociaux** : Facebook, X, LinkedIn, Instagram, Medium + App Store / Play Store. Pas de newsletter.
- **Faille → leçon AxionIA** : 1) image promotionnelle dans chaque mega-menu = pattern différenciant (à étudier pour AxionIA si compatible doctrine). 2) badges réglementaires footer (ACPR, FGDR) = trust signals — équivalent AxionIA = mention OÜ estonienne, RGPD, mentions légales.

### 12bis. pennylane.com — OK (bonus FR)

- **Header** : 6 items : `Produit`, `Activité`, `Tarifs`, `Ressources`, `Facturation électronique`, `Démarrer maintenant`.
- **Mega-menus** : aucun multi-colonnes détecté. Navigation linéaire / dropdowns simples.
- **Recherche** : non.
- **Sticky** : header persistant indiqué par répétition logo.
- **Locale** : `France` en footer (switcher implicite).
- **Footer** : 4 colonnes : Nos ressources utiles (7) | À propos (8) | Aide (6) | Experts-comptables (7). Sociaux : LinkedIn, TikTok, Instagram, YouTube.
- **Breadcrumbs** : non sur home.
- **Faille → leçon AxionIA** : Pennylane = preuve qu'un SaaS B2B FR peut survivre sans mega-menu, mais le footer est plus pauvre que Qonto. Trade-off à éviter pour AxionIA qui vise la profondeur SEO via pSEO villes/régions.

### 13. gouvernement.fr — REDIRECT puis BLOQUÉ

- **État** : `gouvernement.fr` redirige vers `info.gouv.fr`, qui retourne 403 Forbidden.
- **Fallback** : `service-public.gouv.fr` ci-dessous.

### 13bis. service-public.gouv.fr — OK (fallback gouv.fr)

- **Header** : 7 items : `Accueil`, `Actualité de vos droits et démarches`, `Fiches pratiques par événement de vie`, `Fiches pratiques par thème`, `Démarches, aides et outils`, `Annuaire de l'administration`, `Contacter Service Public`.
- **Mega-menus** :
  - "Fiches pratiques par événement de vie" : 8 items (2 visibles + 6 hidden + "Voir tous").
  - "Fiches pratiques par thème" : 8 items (7 visibles + "Voir tous les thèmes").
  - "Démarches, aides et outils" : 2 items.
  - **Profondeur : 2 niveaux maximum.**
- **Recherche** : header avec placeholder `Rechercher sur le site`.
- **Sticky** : non observable.
- **Locale** : FR uniquement, pas de switcher.
- **Footer** : 8 sections : Fiches pratiques par thèmes (11 liens) | Démarches et outils (6) | Nous connaître (6) | Related services (3) | Legal/compliance (6) | Partner logos (4).
- **Breadcrumbs** : structure suggérée sur pages internes (non visibles sur home).
- **URL pattern** : `/particuliers/vosdroits/[CODE]` — ex. `F14128`, `F16225`. **Pas de pattern régions/villes** : codes opaques uniquement.
- **Faille → leçon AxionIA** : service-public.fr = anti-pattern pour pSEO local. Codes F-XXXXX au lieu de slugs sémantiques `paris`, `marseille`. AxionIA doit faire l'inverse : slugs SEO-friendly (`/regions/ile-de-france`, `/villes/paris`, `/secteurs/sante/lyon`).

---

## Synthèse — patterns dominants 2026 (sites premium accessibles)

### Pattern 1 — Header : 4-6 items max

Tous les sites premium accessibles convergent sur **4 à 6 items** dans le header desktop (Anthropic 5, Stripe 5, Vercel 4-5, Linear 4, Cohere 5, Mistral 4, Qonto 6, Deloitte 5, Pennylane 6). Apple à 9-12 est l'exception (catalogue produit). Pour AxionIA (cabinet B2B), viser **5-6 items** : `Méthode/Approche`, `Interventions`, `Cabinet`, `Vues/Insights`, `Stack IA`, + CTA.

### Pattern 2 — Mega-menus : 2-3 colonnes uniformes

Quand mega-menu il y a, la majorité tourne autour de **2 à 3 colonnes** : Vercel 3 cols partout, Cohere 1-3 cols, Anthropic 2-3 cols, Qonto 2-3 cols. **Vercel impose un gabarit de 3 colonnes uniforme sur tous ses mega-menus** = lisibilité maximale. À répliquer pour AxionIA. Profondeur : 1-2 niveaux, jamais plus.

### Pattern 3 — ⌘K command palette : non observable depuis WebFetch

Aucun site n'expose la palette ⌘K dans le HTML statique fetched (rendue côté JS). Stripe et Vercel sont réputés l'avoir, mais non confirmable. **Conclusion** : la ⌘K n'est pas un signal SEO mais un bonus UX premium. Pour AxionIA, la prévoir Sprint 17+ (post-pSEO).

### Pattern 4 — Footer = miroir hiérarchique du header

Stripe, Vercel, Anthropic, Qonto : le footer reproduit la structure des mega-menus en colonnes hub (6-8 colonnes typiquement). Cela sert le crawl SEO et la mémoire utilisateur. **Pour AxionIA** : footer 6-8 hubs minimum (Cabinet | Méthode | Interventions | Stack IA | Vues | Régions | Villes | Légal).

### Pattern 5 — Newsletter rare, sociaux systématiques

Sur 8 sites observables, 1 seule newsletter footer explicite (Cohere). Réseaux sociaux : systématique (LinkedIn dominant, X universel, GitHub/Discord pour devs, YouTube pour content). Pour AxionIA premium : LinkedIn + X + (option) Newsletter "Stratégie IA" = différenciant.

### Pattern 6 — Locale switcher : 1 à 8 langues

Stripe (multi), Apple (`United States` → choisir), Mistral (1 EN), Cohere (none), Qonto (8 locales), Pennylane (FR only), Linear (none). **Qonto à 8 locales est le maximum observé**. Pour AxionIA OÜ estonienne ciblant FR + EN, switcher header/footer visible obligatoire (≠ Linear EN-only).

### Pattern 7 — Breadcrumbs : invisibles sur home, présents sur pages internes

Aucun benchmark n'expose breadcrumbs sur la home. Booking.com confirmé sur pages pays/région : `Home > Hotels > France`. Pour AxionIA, breadcrumbs obligatoires sur toutes pages > niveau 1 (Sprint 14.6 et au-delà), avec JSON-LD `BreadcrumbList`.

### Pattern 8 — Sticky behavior : non confirmable depuis HTML statique

Le comportement sticky/condensation est piloté CSS+JS, non visible dans WebFetch. Anthropic confirme "figé sticky" ; Cohere "reste visible au scroll" ; les autres : non observable. Pour AxionIA, doctrine `/interventions` HEAD impose sticky avec condensation au scroll.

---

## Synthèse — patterns pSEO villes/régions

### Booking.com — référence absolue (extraite via `/country/fr.html`)

- Pattern URL hiérarchique à 4 niveaux : `/country/[locale].html` → `/region/[locale]/[region-slug].html` → `/city/[locale]/[city-slug].html` → `/landmark/[locale]/[landmark-slug].html`.
- Slugs sémantiques en kebab-case (`south-of-france`, `provence-alpes-cote-d-azur`, `french-alps`).
- Breadcrumbs : `Home > Hotels > France` (3 niveaux observés, plus profond sur ville/landmark).
- Compteurs de densité visibles (`23978 hotels`) = signal de freshness + autorité.
- Footer hub `All destinations` = exhaustivité crawl.

### Airbnb.com — non observable (403)

- Pattern connu ailleurs : `/s/[lieu]--[pays]/homes`, mais non confirmable depuis cette session.

### Service-public.gouv.fr — anti-pattern

- Slugs opaques `F14128`, `F16225` au lieu de slugs sémantiques.
- Pas de hiérarchie régions/villes officielles dans la nav.
- Leçon : ne pas reproduire ce pattern. AxionIA doit privilégier **`/regions/[slug]`, `/villes/[slug]`, `/secteurs/[slug]/[ville]`** avec breadcrumbs `Accueil > Régions > Île-de-France > Paris`.

### Recommandation pSEO AxionIA (prompt PROMPT-HEADER-NAVIGATION-2026 §pSEO ~3500 pages)

- Pattern URL : `/regions/[region-slug]`, `/villes/[ville-slug]`, `/secteurs/[secteur-slug]/[ville-slug]`.
- Slugs sémantiques (`ile-de-france`, `paris`, `lyon`, `provence-alpes-cote-d-azur`).
- Breadcrumbs JSON-LD `BreadcrumbList` sur 100% pages.
- Footer hub `Toutes les régions` + `Toutes les villes` (modèle Booking).
- Compteurs de densité (X interventions, Y études de cas) si data disponible.
- Sitemap XML segmenté par type (`/sitemap-regions.xml`, `/sitemap-villes.xml`, `/sitemap-secteurs.xml`).

---

## 13 leçons pour AxionIA (1 site = 1 phrase)

1. **anthropic.com** — Privilégier des libellés substantifs et différenciants (`Economic Futures`, `Commitments`) plutôt que génériques (`Solutions`, `About`).
2. **stripe.com** — Le footer doit être un miroir hiérarchique du mega-menu pour servir crawl SEO + mémoire utilisateur.
3. **vercel.com** — Imposer un gabarit de 3 colonnes uniforme sur tous les mega-menus pour la lisibilité.
4. **linear.app** — Ne pas suivre Linear sur le EN-only : AxionIA OÜ doit avoir un switcher locale FR/EN visible header.
5. **apple.com** — 9+ items header est un anti-pattern pour un cabinet B2B ; rester à 5-6.
6. **openai.com** — (non observable) protection WAF agressive = preuve qu'un site IA premium peut/doit hardener son edge ; AxionIA peut prévoir un rate-limit raisonnable côté Vercel/Caddy.
7. **mistral.ai** — Liens directs sans mega-menu = simplicité startup, mais sous-exploite le footer en hub SEO ; AxionIA doit faire mieux côté hubs.
8. **cohere.com** — Newsletter footer explicite + form email = différenciant pour cabinet IA premium (à intégrer Sprint 14.x).
9. **booking.com** — URL pattern hiérarchique à 4 niveaux + breadcrumbs canoniques + compteurs densité = doctrine pSEO villes/régions à transposer pour AxionIA.
10. **airbnb.com** — (non observable) le pattern Airbnb 403 partout suggère un Cloudflare très strict ; ne pas viser ce niveau de protection sur AxionIA (impacterait crawl Google).
11. **mckinsey.com** — (non observable) consulting top-tier = WAF strict + pas d'API ouverte ; AxionIA visant le même segment doit soigner son edge sans bloquer Googlebot.
    11bis. **deloitte.com** — Libellés FR substantifs (`Qui sommes-nous ?`, `Nos points de vue`) plutôt qu'anglicismes ; AxionIA FR doit imposer le même standard.
12. **qonto.com** — 8 locales + image promotionnelle dans chaque mega-menu + badges réglementaires footer = trust signals à répliquer (mention OÜ, RGPD, mentions légales footer AxionIA).
    12bis. **pennylane.com** — Pas de mega-menu = trade-off lisibilité ↔ profondeur SEO ; AxionIA doit choisir la profondeur (modèle Stripe/Vercel) car pSEO ~3500 pages.
13. **service-public.gouv.fr** — Slugs opaques `F14128` = anti-pattern absolu ; AxionIA doit privilégier slugs sémantiques kebab-case (`/regions/ile-de-france`, `/villes/paris`).

---

## Sites bloqués / non extraits — récapitulatif

| Site                           | État                    | Tentatives                                                                    |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| openai.com                     | HTTP 403                | `/`, `/about`, `/index/`                                                      |
| airbnb.com                     | HTTP 403                | `.com`, `.fr`, `news.`, `/sitemaps/v2`, `/s/Paris`                            |
| mckinsey.com                   | Socket closed / timeout | `/`, `/about-us`, `/featured-insights`, `/quarterly`                          |
| gouvernement.fr → info.gouv.fr | 301 puis 403            | redirect chain bloqué                                                         |
| booking.com (home)             | timeout                 | `/destinations.html` 404, mais `/country/fr.html` OK → données pSEO extraites |

**Fallbacks utilisés** : Deloitte (pour McKinsey), service-public.gouv.fr (pour gouvernement.fr), Pennylane (en bonus FR). 8 sites pleinement extraits + 1 site partiellement (Booking via page pays) sur 13 cibles initiales.

---

_Fin du livrable Agent B — Benchmarks navigation 2026._
