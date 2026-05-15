# Agent 7 — In-content links · Anchor text quality

**Échantillon** : 27 URLs ciblées (sur 30 prévues) — stratifié articles factory (fallback `/fr/blog` × 3 + 2 listings) / case-studies × 5 / FAQ × 5 / KB V4 × 5 / pSEO villes × 5 / guides × 2.

**Méthodologie** : fetch HTTPS prod (UA Chrome 125), parse JSDOM avec `runScripts: dangerously` pour résoudre le streaming RSC Next 16 (sinon `<main>` reste squelette), extraction `<a>` dans `<main>`/`<article>` après retrait imbriqué de `<header>`, `<footer>`, `<nav>`.

> **Totaux échantillon (14 pages 200-OK)** : strict-click-here = **0** | weak/short = **0** | empty = **0** | total internal in-content = **66** | total external = **0** | total tier-1 targets = **28**.

---

## 1. Findings positifs

| Critère                                            | Verdict                  | Détail                                                                                                                               |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `cliquez ici` / `click here` / `ici` / `voir plus` | ✅ ZÉRO occurrence       | 0/66 anchors strict-click-here détectés. Excellente discipline anchor-text.                                                          |
| `noopener` / `noreferrer` sur liens externes       | N/A — pas d'externes     | 0 liens externes sur l'ensemble de l'échantillon → aucun risque de tabnabbing (mais voir P0 §2).                                     |
| Anchors vides (sans texte ni `aria-label`)         | ✅ 0                     | Toutes les anchors ont un texte humain.                                                                                              |
| Anchors `#section` cassées                         | ✅ 0                     | Aucun anchor TOC pointant vers ID inexistant.                                                                                        |
| Liens vers concurrents (McKinsey, BCG, etc.)       | ✅ 0                     | Doctrine respectée.                                                                                                                  |
| Anchors descriptives (vs génériques)               | ✅ Globalement excellent | Ex : « Voir l'Essentielle → », « Réserver une intervention · 490 € », « Auditer ma stack actuelle ». Tarif inclus = signal AEO fort. |

---

## 2. Findings négatifs (P0 / P1)

### P0-1 — Aucun lien externe sortant sur l'intégralité de l'échantillon (AEO/GEO penalty)

- `external_count = 0` sur les 14 pages OK (articles, case-studies, FAQ, pSEO, guides).
- Aucune citation vers : INSEE (utilisé en pSEO mais en données embarquées, pas en lien sortant), `economie.gouv.fr`, EU AI Act texte officiel, Anthropic/OpenAI docs, ISO/IEC 42001, ANSSI, CNIL.
- Conséquence : signal E-E-A-T faible vis-à-vis Googlebot + LLM crawler (perplexity / openai-searchbot / claude-bot). Risque dégradation rankings AEO/GEO en 2026.
- **Recommandation** : Cibler 1-3 citations sources autoritaires par article factory + 1 par FAQ + 2-3 par guide. Format `<a href="…" rel="noopener noreferrer" target="_blank">Source : …</a>` placé dans le corps (pas en footer).

### P0-2 — Listing `/fr/actualites` = 0 lien in-content

- Page liste 200 OK mais `<main>` n'expose aucun lien `<a>` en contenu (anchors = `[]`).
- Cause probable : table `Article` filtrée `isNews=true` vide en prod (seule la table Blog est peuplée).
- Conséquence : page utilisateur sans aucun lien sortant + signal "thin content" / soft-404 pour Googlebot.
- **Recommandation** : Soit (a) ajouter un fallback "aucune actualité — voir le blog" avec lien vers `/fr/blog`, soit (b) noindex la page tant que vide, soit (c) injecter les premiers articles Blog en attendant la production de news.

### P0-3 — 13 / 27 URLs renvoient HTTP 503 « no available server » en prod

Pages 503 persistantes (3 retries séparés de 3-10 s, même UA browser) :

- `/fr/blog/pourquoi-auditer-avant-implementer` (article promu dans listing `/fr/blog`)
- `/fr/cas-concrets/cabinet-juridique-comptes-rendus`, `/fr/cas-concrets/tpe-artisan-prospection` (2/5 case-studies)
- `/fr/faq/modules`, `/fr/faq/tools` (2/5 FAQ)
- `/fr/connaissances/*` × 5 — route publique **non implémentée** en code (`src/app/[locale]/connaissances/` n'existe pas, seul `(admin)/[adminPrefix]/connaissances` existe)
- `/fr/interventions/par-ville/toulouse`, `/fr/implementation/par-ville/bordeaux`
- `/fr/guide-ia`

Diagnostic : "no available server" est le message de l'edge Coolify/Caddy quand l'origin retourne 500/timeout sur la route. Connu (mémoire `axionia_prompt_e2e_routes_health.md` mentionne déjà 500 sur `/fr/guide-ia`, `/fr/stack-ia`, `/fr/comparaisons`).

- **Recommandation** : audit forensique route-par-route (cf. agent dédié). Ces 503 cassent navigation, génèrent broken inlinks, et bloquent indexation.

### P0-4 — Case-studies ultra-thin (densité 0.38–0.41 / 1 link, 1 tier-1, 0 externes)

Les 3 cas concrets OK ont chaque fois 1 seul lien in-content : `Réserver l'Essentielle →` (cohérent CTA). Mais :

- Aucun lien vers les autres case-studies (pas de "Cas similaires").
- Aucun lien vers FAQ pertinente, ni vers la page secteur (`/fr/cas-concrets/secteur/[slug]`).
- Aucune citation externe (INSEE secteur, étude marché).
- Densité 0.38-0.41 lien / 1000 chars = ~10× plus faible que la FAQ (4.08) ou pSEO Paris (0.95 avec 21 anchors).
- **Recommandation** : ajouter en bas de page un bloc « Cas similaires (3) » + « Ressources liées (FAQ X, audit Y) » + 1-2 citations sources INSEE/secteur.

### P1-5 — Pages pSEO villes (hors Paris pilote) sous-maillées

| Page                                             | Internal | Tier-1 | Density |
| ------------------------------------------------ | -------: | -----: | ------: |
| `/fr/implantations/ile-de-france/paris` (pilote) |       21 |     13 |    0.95 |
| `/fr/implantations/auvergne-rhone-alpes/lyon`    |        2 |      1 |    2.20 |
| `/fr/audit/par-ville/marseille`                  |        2 |      1 |    2.84 |

- Le pilote Paris est 10× mieux maillé. Les autres villes ont juste le breadcrumb région + le CTA `/fr/reserver?ville=…`.
- Cohérent avec mémoire `axionia_pseo_villes_livre_2026-05-08` (gold standard Paris seulement, industrialisation en attente).
- **Recommandation** : Aligner les 2 156 villes restantes sur le standard Paris (10 sections, ~5000 mots) AVANT lancement industrialisation Sprint 14.10.x.

### P1-6 — Pas de lien sortant vers l'autre famille de pSEO depuis pSEO ville

- `/fr/implantations/auvergne-rhone-alpes/lyon` ne pointe pas vers `/fr/audit/par-ville/lyon` / `/fr/interventions/par-ville/lyon` / `/fr/implementation/par-ville/lyon` (qui existent dans le scope).
- Page Paris pilote le fait (8 tier-1 hrefs incl. `/fr/audit`, `/fr/interventions`, `/fr/implementation`).
- **Recommandation** : section "Services à <ville>" avec 3 cards menant aux 3 templates par-ville.

### P1-7 — Anchor concatenation suspect sur pSEO Paris (UX)

```
Le Pré-Saint-Gervais5 km · 16 993 hab.
Gentilly5 km · 19 963 hab.
Montrouge5 km · 46 324 hab.
```

- Le texte agrège visiblement nom + distance + population sans séparateur en début (Le Pré-Saint-Gervais**5** km). Le HTML contient probablement des `<span>` séparés mais le `textContent` les colle. Pour Googlebot, c'est du `textContent` brut.
- Ce n'est pas un anti-pattern SEO (anchor descriptif riche), mais c'est lisible-machine, illisible-humain.
- **Recommandation** : intercaler `&nbsp;` ou un séparateur visuel/textuel (« — » ou « · ») entre les fragments dans le DOM.

### P1-8 — Faux positif détecté : « `[email protected]` »

- JSDOM remonte `[email protected]` comme anchor text sur les 3 FAQ.
- Ce n'est PAS un bug prod : il s'agit du placeholder émis par Cloudflare Email Address Obfuscation (Scrape Shield). Le `email-decode.min.js` CF le rétablit côté client.
- **Action** : aucune correction code. À noter si on souhaite désactiver CF Email Obfuscation sur cette propriété (préférable pour éviter rendu hostile aux non-JS / Wayback Machine / certains LLM crawlers qui ne lancent pas JS).

### P2-9 — Anchor répété sur Paris (« Voir le calendrier · 490 € » × 2, « Discuter d'un projet » × 2)

- `/fr/implantations/ile-de-france/paris` : 21 anchors, top-repeated = 2 (≤ 30 % donc pas de gate orange).
- Conforme. Mais sur l'industrialisation des 2 156 villes, surveiller que les CTAs ne dépassent pas le seuil PageRank dilution (>30 %).

### P2-10 — Densité in-content très faible sur `/fr/stack-ia` (0.20 / 1000 chars)

- Page riche en contenu (~20K chars) mais seulement 4 anchors in-content.
- Tous 4 vers tier-1 (`/fr/interventions/essentielle`, `/fr/audit/flash` × 2, `/fr/interventions`) → bon ratio qualitatif.
- **Recommandation** : enrichir avec 4-6 liens internes vers FAQ outils, blog "Pourquoi auditer avant…", glossaire.

---

## 3. Tableau récap par page (200-OK uniquement)

| Page                                        | Type            | Internal | Tier-1 | Externe | Density / 1k | Gate         |
| ------------------------------------------- | --------------- | -------: | -----: | ------: | -----------: | ------------ |
| /fr/blog/3-quick-wins-2026                  | article         |        4 |      1 |       0 |         1.53 | ✅           |
| /fr/blog/ia-custom-quand-vraiment           | article         |        4 |      1 |       0 |         1.47 | ✅           |
| /fr/actualites                              | article-listing |        0 |      0 |       0 |            0 | 🔴 zero-link |
| /fr/blog                                    | article-listing |        8 |      1 |       0 |         3.60 | ✅           |
| /fr/cas-concrets/industrie-comptabilite     | case-study      |        1 |      1 |       0 |         0.38 | 🟠 thin      |
| /fr/cas-concrets/retail-tickets-sav         | case-study      |        1 |      1 |       0 |         0.41 | 🟠 thin      |
| /fr/cas-concrets/banque-onboarding          | case-study      |        1 |      1 |       0 |         0.40 | 🟠 thin      |
| /fr/faq/definition                          | faq             |        6 |      1 |       0 |         4.01 | ✅           |
| /fr/faq/data-security                       | faq             |        6 |      1 |       0 |         3.91 | ✅           |
| /fr/faq/billing                             | faq             |        6 |      1 |       0 |         4.31 | ✅           |
| /fr/implantations/ile-de-france/paris       | pseo-city       |       21 |     13 |       0 |         0.95 | ✅ pilote    |
| /fr/implantations/auvergne-rhone-alpes/lyon | pseo-city       |        2 |      1 |       0 |         2.20 | 🟠 thin      |
| /fr/audit/par-ville/marseille               | pseo-city       |        2 |      1 |       0 |         2.84 | 🟠 thin      |
| /fr/stack-ia                                | guide           |        4 |      4 |       0 |         0.20 | ✅ ratio     |

---

## 4. Recommandations agrégées (priorisées)

| Pri | Action                                                                                                                    | Effort | Impact                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| P0  | Corriger les 13 routes 503 (route `/fr/connaissances/[slug]` à créer + diagnostic 500 sur blog/case-study/faq/pseo/guide) | M-L    | Critique — 48 % de l'échantillon broken |
| P0  | Ajouter 1-3 liens externes autoritaires par article/FAQ/guide (INSEE, gouv.fr, EU AI Act, Anthropic docs)                 | S-M    | AEO/GEO + E-E-A-T                       |
| P0  | Fallback in-content `/fr/actualites` (ou noindex)                                                                         | XS     | SEO soft-404                            |
| P1  | Enrichir case-studies : « Cas similaires » + « Ressources liées » + 1-2 citations (passer de 1 lien à 5-7)                | M      | Engagement + SEO                        |
| P1  | Standard Paris sur les pSEO villes (cf. décision industrialisation en attente)                                            | XL     | pSEO maillage                           |
| P2  | Désactiver Cloudflare Email Obfuscation sur `axion-ia.com` pour cohérence anchor text                                     | XS     | UX / Archives / LLM crawlers no-JS      |
| P2  | Enrichir `/fr/stack-ia` (+ 4-6 liens internes contextuels)                                                                | S      | Maillage                                |
