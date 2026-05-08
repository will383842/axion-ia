# Walkthrough Will — chapitre 23 du PROMPT-FRONTEND-DEEP-CHECK

**Date** : à dater quand tu le fais
**Branche** : `main` à `f2ea1e6` (ou plus récent)
**Lancement local** : `cd axionia && pnpm dev` puis `http://localhost:3000`

> Ce walkthrough remplace les checks runtime que je ne peux pas exécuter (axe-core, Lighthouse, NVDA/VoiceOver, AEO citability — Sprint 21 par design). Il prend ~1 h 30 si tu enchaînes. **Sans ce walkthrough validé, le verdict GO Sprint 15 reste théorique.**

---

## Préparation (5 min)

```bash
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
pnpm dev
```

Ouvre Chrome en mode incognito → `http://localhost:3000` → tu arrives sur `/fr` (locale auto-détectée).

**Outils ouverts en permanence** :

- DevTools (F12) → onglets : **Console** (must rester vide d'erreurs), **Lighthouse**, **Network** (throttling), **Rendering** (reduced-motion toggle), **Accessibility** (headings tree)
- DevTools Device Mode (Ctrl+Shift+M) prêt à 360 / 375 / 768 / 992 / 1280 / 1920

**Démarrer chaque page avec** :

- F12 → Console : doit être vide (pas de warning React, pas de hydration mismatch)
- Tab depuis l'URL bar → doit focus le **Skip-to-content** invisible

---

## 15 pages prioritaires

Pour CHAQUE page : ① clavier seul (Tab/Shift+Tab/Enter/Escape) · ② mobile 360 px · ③ FR↔EN switch.

| #      | URL                                           | Pourquoi                                                          | Ce qui doit te déranger si tu le vois                                                                                                                                |
| ------ | --------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | `/fr`                                         | First impression, dense, plusieurs JSON-LD, 4 modules             | Hero sans h1 · Header dropdown · texte gris-700 illisible sur bg blanc · CLS au mount                                                                                |
| **2**  | **`/fr/interventions/essentielle`** ★         | Page phare conversion 490 € · ProductHero accent border-left bleu | Price tabular nums absents · CTA `cta-translate` ne glisse pas 6 px au hover · sticky Header pas opaque au scroll · breadcrumb absent · h1 absent                    |
| **3**  | `/fr/audit`                                   | Module 2 accent **orange** + PriceMatrix 4×2                      | Couleur orange invisible sur eyebrow · PriceMatrix déborde horizontalement mobile · h1 absent                                                                        |
| **4**  | `/fr/audit/demande`                           | AuditForm wizard 5 étapes                                         | Tab ne focus pas les étapes ordonnées · `aria-current="step"` invisible · pas de `aria-invalid` sur erreur · bouton « Précédent » réinitialise les valeurs           |
| **5**  | `/fr/implementation`                          | Module 3 accent **purple**                                        | Purple invisible / mauvais contraste sur bg · 9 cartes mal alignées mobile · h1 absent                                                                               |
| **6**  | `/fr/implementation/ia-custom`                | **Tension Webflow Blue ↔ premium B2B**                            | Tu sens « SaaS startup » plutôt que « cabinet IA premium pour CxO » → finding **DSN-tension**                                                                        |
| **7**  | `/fr/cas-concrets`                            | Filtres URL-driven (industry+size)                                | Filtres pas focusables clavier · accent **green** invisible · keyboard order incohérent                                                                              |
| **8**  | `/fr/cas-concrets/industrie-comptabilite`     | Article + Review JSON-LD + métrique                               | Métric Badge illisible mobile · breadcrumb retour cassé                                                                                                              |
| **9**  | `/fr/blog`                                    | ArticleCard hover `cta-translate`                                 | Cards pas focusables individuellement · pas de tab-stop par card                                                                                                     |
| **10** | `/fr/blog/pourquoi-auditer-avant-implementer` | Article JSON-LD, prose lisible                                    | Article largeur > 65 char par ligne · `aria-current` parent module manquant                                                                                          |
| **11** | `/fr/faq`                                     | FAQPage JSON-LD, accordéon Radix                                  | Accordion ne s'ouvre pas Enter · contenu sr-only mal annoncé                                                                                                         |
| **12** | **`/fr/faq/definition`** ★ NOUVEAU            | QAPage JSON-LD pour Perplexity/ChatGPT                            | Cross-link 4 autres questions absent · breadcrumb 3 niveaux · texte AEO answer pas en lead paragraph                                                                 |
| **13** | `/fr/reserver`                                | HouseCalendar → BookingForm Sheet                                 | Flèches clavier ne naviguent pas dans calendrier · `aria-selected` (pas `pressed`) · sélection slot pas annoncée par live region · bouton « Précédent » pas restauré |
| **14** | `/fr/roi`                                     | RoiSimulator 4 sliders + aria-live                                | Sliders pas pilotables clavier (Home/End/PgUp/PgDn) · `aria-valuetext` muet · résultats live region pas annoncés · CTA pré-rempli absent                             |
| **15** | `/fr/contact`                                 | ContactForm 5 fields + 3 cards                                    | Touch targets 3 cards < 44 px · ContactForm `aria-invalid` absent · Cards mal grid mobile                                                                            |

---

## Tests transverses obligatoires

À faire **une seule fois** sur n'importe quelle page :

### A. Drawer mobile

1. DevTools 375 px → cliquer le hamburger (44×44 attendu)
2. Le Sheet Radix s'ouvre droite plein écran
3. **Tab** doit rester piégé dans le Sheet (focus trap)
4. **Escape** ferme + restaure le focus sur le hamburger
5. Click backdrop ferme aussi
6. Animation glide 250 ms
7. Drawer scrollable indépendamment du body (body locked)

**KO si** : Tab sort du Sheet · Escape ne ferme pas · backdrop click ne ferme pas · pas d'animation.

### B. LocaleSwitcher (path-traduit)

1. Aller sur `/fr/interventions/essentielle` → URL `essentielle`
2. Cliquer le LocaleSwitcher → `EN`
3. URL devient `/en/interventions/essential` (path TRADUIT, pas juste préfixe)
4. Aller sur `/fr/audit/complet` → switch EN → `/en/audit/full`
5. Aller sur `/fr/cas-concrets` → switch EN → `/en/case-studies`

**KO si** : URL ne change que le préfixe (`/en/interventions/essentielle`) → routing.ts pathnames cassé.

### C. Skip-to-content

1. URL bar → **Tab** une fois
2. Le lien « Aller au contenu » doit apparaître en haut à gauche (sr-only → focus visible)
3. **Enter** → focus saute au `<main>` (skip Header)

**KO si** : pas visible au focus · Enter ne fait rien · saute pas le Header.

### D. Reduced-motion override (cta-translate)

1. DevTools → Rendering → `prefers-reduced-motion: reduce`
2. Hover un CTA primaire (bouton bleu)
3. Le CTA ne doit PAS glisser 6 px (override Phase E)
4. Hover survol couleur OK, mais pas de translation

**KO si** : ça bouge encore → le `transform: none !important` dans `globals.css` est mal pris.

### E. Header active state (parent module highlight)

1. Aller sur `/fr/audit` → l'item « Audit » dans Header est souligné (after:bg-primary 2px)
2. Aller sur `/fr/audit/complet` → l'item « Audit » du Header reste souligné (parent module)
3. Aller sur `/fr/cas-concrets` → l'item « Cas concrets » est souligné

**KO si** : aucun underline · ou underline sur la mauvaise route · ou perd le highlight sur sous-page.

### F. 404 localisé

1. Aller sur `/fr/page-inexistante`
2. Affiche la page `not-found` localisée FR
3. Breadcrumb retour OK
4. `/en/nonexistent` → not-found EN

**KO si** : page blanche · 500 au lieu de 404 · pas de breadcrumb retour.

---

## Bonus mobile-first (5-10 min)

| Test                                   | Comment                                                    | KO si                                |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| **PriceMatrix `/fr/audit`** mobile 360 | Vérifier table 4×2 lisible sans débordement horizontal     | scroll horizontal apparu             |
| **HouseCalendar** mobile 360           | Cellules grid 7 colonnes ≥ 44 px                           | cellules trop petites · doigt manque |
| **AuditForm step 4** mobile 360        | 4 inputs empilés verticalement, label au-dessus            | overflow texte · button cut          |
| **Dialog/Sheet** mobile 360            | `max-w-lg` + `p-6` tient dans 360 px                       | dialog overflow · close button caché |
| **Footer 5 zones** mobile 360          | Stack vertical propre, NewsletterForm input pleine largeur | grid cassée · input déborde          |
| **TestimonialsCarousel** mobile 360    | CSS scroll-snap doigt OK + flèches 44 px                   | scroll horizontal saccadé            |

**Si TOUT OK mobile-first** : on peut affirmer mobile-first « validé manuellement », mais Sprint 21 confirmera avec Playwright cross-device.

---

## Bonus Core Web Vitals (10 min)

⚠️ **C'est ICI que tu mesures réellement les CWV** — sans ça la prétention « CWV OK » est creuse.

### B.1 Lighthouse mobile sur `/fr` (page d'accueil)

1. F12 → Lighthouse → cocher **Mobile** + **Performance + Accessibility + Best Practices + SEO**
2. **Run audit**
3. Cible : ≥ 95 sur les 4 axes (≥ 98 desktop)

**Résultats à noter** :

- Performance : \_\_ / 100
- Accessibility : \_\_ / 100
- Best Practices : \_\_ / 100
- SEO : \_\_ / 100
- LCP : \_\_ ms (cible < 2.5 s mobile, < 1.8 s page produit)
- INP : \_\_ ms (cible < 200 ms)
- CLS : \_\_ (cible < 0.1)
- TTFB : \_\_ ms (cible < 600 ms)
- FCP : \_\_ ms (cible < 1.8 s mobile)
- TBT : \_\_ ms (cible < 200 ms)

### B.2 Lighthouse mobile sur `/fr/interventions/essentielle` (page phare conversion)

Même protocole. **C'est cette page qui doit être la plus optimisée.**

### B.3 Lighthouse mobile sur `/fr/audit/demande` (page form lourde)

Même protocole. C'est la page avec le plus de hydratation client (AuditForm 5-step + RHF + zod).

### B.4 DevTools Performance record (1 min)

1. F12 → Performance → ⚫ Record
2. Aller sur `/fr` → cliquer 4 modules dans Header → revenir accueil → cliquer un cas concret → `/fr/audit/demande` → remplir step 1 → step 2
3. Stop record
4. Cherche les **INP > 200 ms** dans les events Click/KeyDown

**KO si** : INP > 200 ms répétés sur les forms wizards.

### B.5 Network throttling Slow 4G

1. F12 → Network → Throttling « Slow 4G »
2. Reload `/fr`
3. Vérifier que rien ne casse, skeleton s'affiche, pas de page blanche

**KO si** : page blanche > 3 s · CLS visible · texte invisible attendant fonts.

### B.6 Coverage tab

1. F12 → ⋮ → More tools → Coverage → Reload `/fr`
2. Voir le % JavaScript **unused**
3. Cible : < 40 % unused

**Si > 50 %** : confirmer PERF-001 = bundle root JS 197 KB gzip > 100 KB cible → Sprint 17 split.

### B.7 iOS Safari réel (iPhone perso si tu en as un)

1. iPhone connecté en USB → Safari → Web Inspector
2. Tester `/fr/reserver` au touch
3. View Transitions Safari fallback (si support)
4. AVIF supporté iOS 16+

### B.8 Android Chrome réel

1. Tester `/fr/audit/demande` clavier mobile
2. `inputmode="email"` doit déclencher clavier email
3. `inputmode="tel"` doit déclencher clavier numérique

---

## Bonus AEO / SEO validators (15 min)

### V.1 Google Rich Results Test

- URL : https://search.google.com/test/rich-results
- Tester :
  - `/fr/interventions/essentielle` → Service + FAQPage attendus
  - `/fr/cas-concrets/industrie-comptabilite` → Article + Review + BreadcrumbList
  - `/fr/faq/definition` → **QAPage** ★ (nouveau Phase A, critique AEO)
  - `/fr/comparaisons/cabinet-ia-vs-saas-generique` → Article
  - `/fr/glossaire` → DefinedTermSet

### V.2 Schema.org Validator

- URL : https://validator.schema.org/
- Tester `/fr/faq/definition` (QAPage doit valider à 100 %)

### V.3 Twitter Card Validator

- URL : https://cards-dev.twitter.com/validator
- Tester avec `/fr/interventions/essentielle?` → preview avec OG image dynamique `/api/og`

### V.4 hreflang inspector

- DevTools → onglet Network → recharger `/fr/audit`
- Vérifier headers `<link rel="alternate" hreflang="fr">`, `hreflang="en"`, `hreflang="x-default"`

### V.5 RSS validator

- URL : https://validator.w3.org/feed/
- Tester :
  - `/fr/blog/feed.xml`
  - `/fr/cas-concrets/feed.xml`
  - `/fr/faq/feed.xml`

### V.6 robots.txt + sitemap.xml + llms.txt + llms-full.txt

- `/robots.txt` : Disallow `/api/*`, `/_next/*`, `/components`, `/design`, `/sections`
- `/sitemap.xml` : 100+ URLs avec hreflang alternates, pas de `[slug]` littéral
- `/llms.txt` : 4 modules listés, FR principal
- `/llms-full.txt` : FAQ + cas concrets + méthodologie

---

## Synthèse à remplir après le walkthrough

| Bloc                                              | Status                      | Notes                            |
| ------------------------------------------------- | --------------------------- | -------------------------------- |
| 15 pages clavier                                  | ☐ OK / ☐ findings           | …                                |
| 15 pages mobile 360                               | ☐ OK / ☐ findings           | …                                |
| 15 pages FR↔EN switch                             | ☐ OK / ☐ findings           | …                                |
| Tests transverses A→F                             | ☐ OK / ☐ findings           | …                                |
| Bonus mobile-first                                | ☐ OK / ☐ findings           | …                                |
| Lighthouse `/fr` mobile                           | ** /100 perf · ** /100 a11y | LCP ** ms · INP ** ms · CLS \_\_ |
| Lighthouse `/fr/interventions/essentielle` mobile | \_\_ /100 perf              | …                                |
| Lighthouse `/fr/audit/demande` mobile             | \_\_ /100 perf              | …                                |
| Performance record INP                            | \_\_ ms max                 | hot path : …                     |
| Network Slow 4G                                   | ☐ OK / ☐ KO                 | …                                |
| Coverage % unused JS                              | \_\_ %                      | (cible < 40 %)                   |
| Tension Webflow Blue ↔ premium B2B                | ☐ acceptable / ☐ à revoir   | …                                |
| Rich Results Test 5 URLs                          | ☐ tous valides / ☐ findings | …                                |
| Twitter Card preview                              | ☐ OK / ☐ findings           | …                                |
| RSS validators 3 feeds                            | ☐ tous valides / ☐ findings | …                                |

---

## Verdict final à émettre

À la fin du walkthrough, choisir :

- ☐ **GO Sprint 15** — démarre Prisma, on dispatch les éventuels findings P2/P3 en parallèle backend
- ☐ **GO avec mini-fix** — listing X findings critiques à corriger (~1-3 h) puis Sprint 15
- ☐ **STOP** — findings P0 redécouverts, fix avant Sprint 15

---

## Findings nouveaux découverts pendant le walkthrough

(à remplir au fur et à mesure)

| ID    | Page | Priorité | Description | Fix |
| ----- | ---- | -------- | ----------- | --- |
| W-001 | …    | …        | …           | …   |
| W-002 | …    | …        | …           | …   |
| W-003 | …    | …        | …           | …   |
