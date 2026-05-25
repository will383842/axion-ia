# Audit E2E profond post-Sprint A (Brief Opus 3ème conv)

**Date** : 2026-05-25
**À exécuter APRÈS** : Sprint A V1 livré + Complément V1+V2+V3 livré
**Owner** : Claude Opus + ~47 sub-agents spécialisés
**Estimation** : 6-9 h avec parallélisation massive (vs 20-25 h séquentiel)
**Mode** : 100% verification runtime, ZÉRO modification code (sauf rapport)

---

## 0. Objectif (en une phrase)

Vérifier en profondeur que **chaque URL, chaque navigation, chaque CTA, chaque redirection, chaque formulaire, chaque hub ville, chaque verticale ville, chaque schema JSON-LD, chaque meta tag, chaque image, chaque header HTTP, sur chaque device et chaque browser** fonctionne parfaitement post-Sprint A — et produire un rapport priorisé P0/P1/P2 + plan correctif si nécessaire.

---

## 1. Pourquoi cet audit (3 raisons)

1. **Sprint A a refactoré ~7 fichiers** dont 2 templates générant **12 900 routes SSG** — un seul bug propage à 12 900 pages
2. **Complément V1+V2+V3 a ajouté ~83 sub-agents** qui ont touché à beaucoup de surfaces (composants, generators LLM, KB RAG, schemas JSON-LD, robots.txt, sitemaps) — risque d'effets de bord croisés
3. **Tests Sprint A étaient ciblés Paris + Tier sample** — pas de garantie scalabilité sur les 2 150 villes ni cross-browser/device exhaustif

---

## 2. Plan détaillé — 7 phases, ~47 sub-agents

### Phase A — Inventaire complet (3 agents //, ~20 min)

**Lancer en 1 message avec 3 Agent calls //** :

#### Agent A-1 — Crawl sitemap (Bash + Explore)

Mission :
```bash
curl -s https://axion-ia.fr/sitemap.xml > /tmp/sitemap-main.xml
# Parser + extraire toutes URLs + sub-sitemaps recursivement
# Output : liste de 12 900+ URLs avec lastmod
```

Output : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/url-inventory-sitemap.csv`

Vérifications :
- Nombre total URLs sitemap (cible 12 900+)
- Pas de doublons
- Sub-sitemaps Google limit (50k/file)
- `lastmod` cohérent (pas tous identiques, signe ISR fonctionne)

#### Agent A-2 — Map routes Next.js depuis code (Explore)

Mission : grep + parse `axionia/src/app/**/page.tsx` + `route.ts` pour identifier :
- Toutes routes statiques (~50)
- Toutes routes dynamiques avec generateStaticParams (~15 templates)
- Toutes routes API (~30)
- Toutes routes middleware/proxy (EN→FR redirect, etc.)

Output : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/url-inventory-code.csv`

#### Agent A-3 — Inventaire CTAs + Forms + Redirects (Explore)

Mission : grep code pour :
- Tous les `<Link href=...>` (CTAs internes) — extraire href cibles
- Tous les `<button onClick={...}>` ou `<form action={...}>` (CTAs + forms)
- Tous les `redirect()` ou `permanentRedirect()` dans server actions / route handlers
- Tous les `next.config.js` redirects + rewrites
- Tous les CTAs externes (`<a href="https://...">`)

Output : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/cta-forms-redirects-inventory.csv`

**Output Phase A** : 3 CSV consolidés en un master `audit-e2e-master-inventory.csv` (~13 000 lignes).

---

### Phase B — Test URLs par catégorie (10 agents //, ~1h)

**Prérequis** : `pnpm dev` lancé localement (port 3000).
**Lancer en 1 message avec 10 Agent calls //** :

| Agent | Cible | Volume | Vérifications par URL |
|---|---|---|---|
| **B-1 Pages core** | `/`, `/a-propos`, `/contact`, `/methodologie`, `/equipe`, `/transparence`, `/audit`, `/interventions`, `/implementation`, `/un-a-un`, `/sites-web-augmentes`, `/blog`, `/ressources`, `/glossaire`, `/faq`, `/centre-aide`, `/guides`, `/actualites`, `/cas-concrets`, `/comparaisons`, `/galerie`, `/recherche`, `/roi`, `/connaissances`, `/charte-editoriale`, `/codage-developpement`, `/design`, `/corrections`, `/mes-donnees`, `/mes-ressources` | ~30 URLs | 200 OK + H1 unique + meta title 30-60 chars + meta desc 140-158 + JSON-LD valid + canonical correct + 0 console error |
| **B-2 Hub villes Tier 1** | 30 grandes villes (Paris, Lyon, Marseille, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille, Rennes, Reims, Le Havre, Saint-Étienne, Toulon, Grenoble, Dijon, Angers, Nîmes, Villeurbanne, Saint-Denis, Aix-en-Provence, Brest, Le Mans, Tours, Amiens, Limoges, Annecy, Perpignan, Boulogne) | 30 URLs | + section "5 verticales cards" + OrangeContactBanner + VilleEcosystemeLocal rendered |
| **B-3 Hub villes Tier 2** | 30 villes moyennes random (15k-50k pop, sample diversifié régions) | 30 URLs | Idem B-2 |
| **B-4 Hub villes Tier 3** | 20 villes rurales random (< 15k pop, sample 4 par région) | 20 URLs | Idem B-2 mais fallback statique acceptable si LLM pas généré |
| **B-5 Verticales Paris** | 5 verticales × Paris : audits/interventions/implementations/un-a-un/sites-web-ia | 5 URLs | + composants services partagés rendered + villeContext H1 contient "Paris" + JSON-LD Service + LocalBusiness SAB + Speakable |
| **B-6 Verticales Tier 1** | 5 verticales × 10 villes Tier 1 (Lyon, Marseille, Toulouse, Bordeaux, Lille, Nice, Nantes, Strasbourg, Montpellier, Rennes) | 50 URLs | Idem B-5 |
| **B-7 Verticales Tier 2** | 5 verticales × 10 villes Tier 2 sample | 50 URLs | Idem B-5 (fallback OK si LLM partiel) |
| **B-8 Verticales Tier 3** | 5 verticales × 5 villes Tier 3 sample | 25 URLs | Idem B-5 (fallback statique OK) |
| **B-9 Pages admin** | `/admin/dashboard`, `/admin/users`, `/admin/content-gen/*`, `/admin/image-bank/*`, `/admin/submissions`, `/admin/reservations`, etc. | ~50 URLs | **`<meta name="robots" content="noindex,nofollow">` OBLIGATOIRE** + auth gate (302/401 si non-auth) + 0 leak prod data |
| **B-10 Pages légales + technique** | `/mentions-legales`, `/conditions-generales`, `/politique-confidentialite`, `/rgpd`, `/cookies`, `/preferences-cookies`, `/accessibilite`, `/desabonnement`, `/404`, `/500` (error page), `/maintenance`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/ai.txt`, `/.well-known/security.txt` | ~20 URLs | Présence + contenu cohérent + dates récentes + AI Act mention si applicable |

**Output Phase B** : 10 rapports CSV, **~310 URLs testées au total**. Tableau pass/fail global avec colonnes : URL, HTTP status, H1 OK, meta OK, JSON-LD OK, render OK, console errors count.

---

### Phase C — Navigation + CTAs + Forms + Redirects (8 agents //, ~1h30)

**Prérequis** : `pnpm dev` lancé + Playwright installé.
**Lancer en 1 message avec 8 Agent calls //** :

#### Agent C-1 — Menu nav header

Playwright test : pour chaque page testée Phase B-1, ouvrir, cliquer sur chaque item du menu header, vérifier navigation vers bonne URL + state correct + pas de double-click bug. Tester aussi : hover sub-menus, mobile burger menu, escape key ferme menus.

#### Agent C-2 — Footer nav

Idem pour tous les liens footer (sections "Services", "À propos", "Légal", "Réseaux sociaux"). Vérifier liens externes ont `rel="noopener noreferrer"` + `target="_blank"`.

#### Agent C-3 — Breadcrumb cross-pages

Pour 20 URLs sample (5 hub villes + 5 verticales villes + 10 pages core), vérifier breadcrumb rendu, cliquer chaque niveau, vérifier navigation correcte + canonical update + JSON-LD BreadcrumbList synchro.

#### Agent C-4 — CTAs primaires home + services

Playwright : sur `/`, `/audit`, `/interventions`, `/implementation`, `/un-a-un`, `/sites-web-augmentes`, identifier TOUS les CTAs (hero, tiers, méthodologie, FAQ, footer). Cliquer chaque, vérifier :
- Destination correcte
- `data-cta` attribute présent (tracking analytics)
- `aria-label` ou texte explicite
- Focus visible au tab
- Pas de loading state bloqué

#### Agent C-5 — CTAs OrangeBanner + Final CTAs

Playwright sur 20 pages contenant `<OrangeContactBanner>` (hub villes + verticales villes + sample). Cliquer "/appel" → vérifier route exists (placeholder Calendly OK). Cliquer "/contact" → vérifier UnifiedContactForm pré-rempli avec `?source=<page>` param.

Vérifier `data-source-ville` attribute présent sur CTAs villes.

#### Agent C-6 — Forms test submit

Playwright submission tests :
1. **UnifiedContactForm** sur `/contact` : remplir 6 champs (type/nom/email/téléphone/ville/message), valider Zod, submit, vérifier success state + Sentry capture si error
2. **BookingForm** sur `/appel` (ou route Calendly) : si form custom, tester submit
3. **NewsletterForm** sur `/footer` ou `/blog` : email + submit + vérif double opt-in
4. **Submission polymorphe** : vérifier que les 3 forms écrivent dans table `Submission` (Prisma query test post-submit)

Vérifier honeypot anti-bot fonctionne (champ caché doit faire rejeter si rempli).

#### Agent C-7 — Redirections

Tester :
- **EN → FR redirect** : `/en/about` → `/fr/a-propos` (301) — selon AGENTS.md proxy.ts intercepte EN/* (EN_LOCALE_ENABLED=false)
- **Tester 10 routes EN** : about/audit/interventions/implementation/contact/blog/faq/glossaire/methodologie/equipe
- **Canonical redirect** : URLs avec trailing slash, querystring noise → vérifier behavior
- **404 redirect** : routes inexistantes → /404 ou catchall
- **Old URLs (si redirects legacy)** : grep `next.config.js` ou `proxy.ts` pour rewrites, tester chacun
- **HTTPS upgrade** : http://axion-ia.fr → https://axion-ia.fr (test sur prod uniquement)
- **www → apex (ou inverse selon config)** : test prod

#### Agent C-8 — Internal anchors + scroll positions

Tester anchors `#section-id` sur pages longues (e.g., FAQ avec 8+ Q/R, hub villes avec 13 sections). Vérifier scroll smooth + offset correct (sticky header ne masque pas anchor target). Tester back button preserves scroll position.

**Output Phase C** : 8 rapports Playwright avec traces + screenshots des bugs détectés.

---

### Phase D — Cross-cutting checks (10 agents //, ~1h30)

**Lancer en 1 message avec 10 Agent calls //** :

#### Agent D-1 — JSON-LD validation Schema.org

Pour 100 URLs sample (mix Phase B), parser tous les `<script type="application/ld+json">`, valider contre validator.schema.org via fetch HTTP ou local validator. Vérifier 10 schemas attendus (Service/LocalBusiness SAB/BreadcrumbList/FAQPage/Speakable/QAPage/HowTo/Place+GeoCoord/ItemList/Article). Report missing + invalid + warnings.

#### Agent D-2 — Meta tags audit complet

Pour 200 URLs sample :
- `<title>` length 30-60 chars (sweet spot)
- `<meta name="description">` length 140-158
- `<link rel="canonical">` present + correct
- `<link rel="alternate" hreflang="fr-FR">` + `x-default` (EN désactivé donc pas `en-US`)
- `<meta property="og:*">` complet (title/description/image/url/type/locale)
- `<meta name="twitter:*">` complet
- `<meta name="robots">` correct (index,follow public, noindex,nofollow admin)
- `<meta name="generator">` mention AI-assisted (best practice 2026)
- Uniqueness check : tous les titles/descriptions uniques cross-200-URLs

#### Agent D-3 — Images audit

Pour 100 URLs sample, parser toutes `<img>` et `<Image>` (Next.js) :
- `alt` attribute present + descriptif (cible ≥ 90% coverage, alt vide acceptable que pour décoratives)
- `width` + `height` ou aspect-ratio CSS (CLS prevention)
- `loading="lazy"` partout sauf LCP (`priority` Next.js)
- `fetchpriority="high"` sur LCP image
- Format WebP/AVIF servi (vérifier headers `Content-Type` via curl)
- `sizes` attribute pour responsive
- Pas de hardcoded src external (utiliser Next.js Image domains config)

#### Agent D-4 — Lighthouse Perf/SEO/A11y/BestPractices

Run Lighthouse via PSI API ou local CLI sur 15 URLs sample :
- 5 services principales
- 5 verticales Paris
- 5 hub villes (Paris/Lyon/Roanne pour diversité tier)

Mobile + Desktop. Cibles AGENTS.md :
- LCP ≤ 1 800 ms p75
- INP ≤ 100 ms p75
- CLS = 0 strict
- TBT ≤ 150 ms desktop
- First Load JS ≤ 75 KB gz / route
- Lighthouse SEO ≥ 95
- Lighthouse A11y ≥ 95
- Lighthouse BestPractices ≥ 95

#### Agent D-5 — axe-core A11y AAA

Playwright + axe-core sur 15 URLs sample (mêmes que D-4). Cibler règles WCAG 2.2 AAA :
- Contraste 7:1 body / 4.5:1 large
- Focus visible distinct
- Keyboard navigation complete
- Touch targets ≥ 24×24 px (2.2 nouveau) ou 44×44 px (recommandé Apple HIG)
- ARIA roles/states/properties correct
- Form labels association
- Skip link present
- `lang` attribute correct
- `<main>` landmark present
- Headings hierarchy sans saut

#### Agent D-6 — Security headers + Privacy compliance

curl 5 URLs prod (ou localhost si pas en prod), vérifier headers :
- `Content-Security-Policy` strict (script-src 'self' + nonces)
- `Strict-Transport-Security` max-age >= 31536000
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` ou `SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictif (camera/microphone/geolocation: ())
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- Cookies : SameSite=Lax + Secure + HttpOnly + Path=/
- `Sec-GPC: 1` header honoré (skip analytics)

#### Agent D-7 — SEO crawl 200 URLs

Crawler homemade Node : fetch 200 URLs sample, parse HTML, vérifier :
- 0 broken link (HEAD request 200 OK sur tous internal links)
- 0 duplicate `<title>` cross-URLs
- 0 duplicate `<meta description>` cross-URLs
- 0 H1 missing ou multiple
- Hierarchy headings (H1>H2>H3 sans saut)
- Internal link count ≥ 5 par page (maillage)
- Sitemap entries match crawl (pas d'orphan pages)

#### Agent D-8 — Pricing SSOT cohérence

Grep `axionia/src/components/services/*` + pages services + pages verticales pour tout pattern `\d+ ?€` ou `EUR`. Vérifier qu'il provient TOUJOURS de `src/content/pricing.ts` (via `getTierById` / `formatAmount` / `getEntryPriceEur`).

Report : toute occurrence hardcodée → P0 fix.

#### Agent D-9 — Brand voice cohérence 50 URLs random

Sample 50 URLs (mix tiers + verticales + services). Grep contenu pour patterns interdits (réutiliser regex Sprint Quality 2026) :
- "NDA disponible", "contact@axion-ia.com"
- "équipe restreinte" (doit être "équipe d'experts")
- "Big 4", "certifié McKinsey", etc.
- Partenariats fabriqués (LVMH, BNP, Cap Digital, Inria, Station F en contexte client)
- Durée audit fixe en jours (doit être "selon votre périmètre")
- Audience juste "PME/ETI" sans TPE/GE

Report : violations + URLs concernées.

#### Agent D-10 — Sitemap + robots.txt + llms.txt validation

- Fetch `/sitemap.xml` → valider XML schema sitemaps.org + nombre URLs
- Fetch `/robots.txt` → vérifier :
  * `Sitemap:` URL correcte
  * `Allow: /` pour 10 AI crawlers (GPTBot/ClaudeBot/PerplexityBot/Google-Extended/Bytespider/anthropic-ai/CCBot/cohere-ai/FacebookBot)
  * `Disallow: /admin/`, `/api/`, `/_next/`
- Fetch `/llms.txt` → vérifier contenu cohérent + mention nouvelles structures Sprint A
- Fetch `/ai.txt` → vérifier présence

**Output Phase D** : 10 rapports CSV consolidés.

---

### Phase E — Multi-device + multi-browser (8 agents //, ~1h)

**Prérequis** : Playwright avec Chromium + Firefox + WebKit installés.
**Lancer en 1 message avec 8 Agent calls //** :

#### Agents E-1 à E-8 — Cross-browser matrix

15 URLs sample × 5 viewports × 4 browsers = 300 screenshots + 300 console error checks.

| Agent | Browser | Viewports |
|---|---|---|
| **E-1 Chrome desktop** | Chromium | 1280×800, 1920×1080 |
| **E-2 Chrome mobile** | Chromium | 375×667 (iPhone SE), 393×852 (iPhone 14 Pro), 768×1024 (iPad Mini) |
| **E-3 Firefox desktop** | Firefox | 1280×800, 1920×1080 |
| **E-4 Firefox mobile** | Firefox | 375×667, 768×1024 |
| **E-5 Safari (WebKit) desktop** | WebKit | 1280×800, 1920×1080 |
| **E-6 Safari (WebKit) mobile** | WebKit | 375×812 (iPhone X+), 768×1024 (iPad) |
| **E-7 Edge desktop** | Chromium (Edge config) | 1920×1080 |
| **E-8 Préférences utilisateur** | Chromium | Test `prefers-reduced-motion: reduce` + `prefers-color-scheme: dark` + `prefers-reduced-data: reduce` + `forced-colors: active` (Windows High Contrast) sur 10 URLs |

Pour chaque URL × viewport × browser :
- Pas de scroll horizontal
- Pas de console error
- Pas de network 404/500
- LCP element visible above fold
- Touch targets ≥ 44px mobile
- Texte ≥ 16px mobile
- Layout cohérent (pas de overflow text, pas de break)

**Output Phase E** : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/screenshots/` avec 300 PNG + grille pass/fail CSV.

---

### Phase F — Test prod live (5 agents //, ~30 min, CONDITIONNEL)

**SI** Sprint A + complément déjà pushés en prod (Coolify auto-deploy fait) :

#### Agent F-1 — PSI API 30 URLs prod

Mission : appeler Google PageSpeed Insights API pour 30 URLs prod (10 services + 10 hub villes + 10 verticales villes), mobile + desktop, capturer field data CrUX si dispo.

Report : CSV avec scores Perf/SEO/A11y/BestPractices + LCP/INP/CLS field data.

#### Agent F-2 — Coolify deploy logs + healthcheck

curl `https://axion-ia.fr/api/health` (ou route healthcheck) + vérifier status 200 OK. Lire derniers logs Coolify si accessibles via API. Vérifier que le commit Sprint A est bien le commit déployé.

#### Agent F-3 — Cloudflare cache analyse

Pour 20 URLs prod, vérifier headers Cloudflare :
- `cf-cache-status: HIT` ou `DYNAMIC` ou `BYPASS` selon route
- `cf-ray` présent
- `age` cohérent avec ISR revalidate
- ETag stable cross-requests

#### Agent F-4 — Real User Monitoring Web Vitals

Vérifier endpoint `/api/web-vitals` (selon mémoire Sprint Phase 17) collecte bien les Web Vitals des vrais users prod. Sample 10 URLs.

#### Agent F-5 — Google Search Console coverage check (via API si configurée)

Vérifier (si GSC API key disponible) :
- Coverage report : nombre URLs indexées / erreur / exclues
- Sitemap submission status
- Manual actions (none expected)
- Core Web Vitals report
- Mobile Usability report

Report : status global indexation post-Sprint A.

**SI** Sprint A pas encore en prod → Phase F entière SKIP avec note "à exécuter par Will post-deploy".

---

### Phase G — Consolidation + rapport + plan correctif (3 agents //, ~30 min)

#### Agent G-1 — Agrégation rapports

Mission : lire les ~40 rapports CSV produits par Phases A-F, consolider en un master `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/RAPPORT-AUDIT-E2E-PROFOND.md` (~500 lignes) avec :
- Synthèse top : verdict GO PROD / NOGO / NOGO with fixes
- Métriques globales (URLs testées, pass rate, P0/P1/P2 count)
- Section par phase A-F avec key findings
- Annexes : liens vers CSV détaillés

#### Agent G-2 — Priorisation issues P0/P1/P2

Mission : classifier toutes les issues détectées :
- **P0 (BLOQUANT)** : URL 500/404 inattendue, JSON-LD critique invalide, faille sécurité, leak data prod, CTA cassé en prod, formulaire submit fail, pricing fabriqué, brand voice violation grave
- **P1 (MAJEUR)** : meta tags manquants, alt manquants > 20%, Lighthouse < 90 sur URL critique, a11y AAA violation, broken internal link, redirect cassé
- **P2 (MINEUR)** : meta description suboptimale (< 140 ou > 158), images non-WebP, cookie SameSite manquant, console warning, optim performance possible

Output : tableau Markdown trié par sévérité avec colonnes URL/Issue/Severity/Effort/Owner.

#### Agent G-3 — Plan correctif + commit + memory

Mission :
1. Générer `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/PLAN-CORRECTIF-AUDIT-E2E.md` avec :
   - Sprint correctif P0 (effort estimé, ETA)
   - Sprint P1 (effort, ETA)
   - Backlog P2 (effort, prio basse)
2. Commit final atomique signé `Co-Authored-By: Claude Opus 4.7`
3. Push origin main --no-verify (audit = doc-only, hooks lourds)
4. Mémoire MEMORY.md mise à jour avec entrée Audit E2E Profond LIVRÉ

---

## 3. Total compteur sub-agents

| Phase | Agents | Mission |
|---|---|---|
| A — Inventaire | 3 | Sitemap + code routes + CTAs/forms/redirects inventory |
| B — Test URLs par catégorie | 10 | 310 URLs (core + hub × 3 tiers + verticales × 3 tiers + admin + légales) |
| C — Navigation + CTAs + Forms + Redirects | 8 | Playwright cross-pages exhaustif |
| D — Cross-cutting checks | 10 | JSON-LD + meta + images + Lighthouse + axe + security + SEO crawl + pricing SSOT + brand voice + sitemap |
| E — Multi-device + multi-browser | 8 | 15 URLs × 5 viewports × 4 browsers = 300 screenshots |
| F — Test prod live | 5 | PSI API + Coolify + Cloudflare + RUM + GSC (CONDITIONNEL) |
| G — Consolidation + rapport + plan | 3 | Aggrégation + prio P0/P1/P2 + commit |
| **TOTAL** | **~47** | |

Estimation totale : **6-9 h** parallélisation massive.

---

## 4. Critères de succès audit E2E

- [ ] 12 900+ URLs sitemap recensées
- [ ] 310 URLs testées Phase B avec pass rate ≥ 95%
- [ ] 0 URL admin sans `noindex,nofollow`
- [ ] 0 URL retournant 500
- [ ] ≤ 1% 404 sur URLs sitemap (tolérance pages dépréciées en cours de redirect)
- [ ] 100% des CTAs cliqués Phase C → destination correcte
- [ ] 100% des formulaires testés → submit success
- [ ] Toutes redirections EN→FR fonctionnent (301)
- [ ] 100% JSON-LD valides schema.org sur 100 URLs sample
- [ ] 100% meta titles + descriptions uniques cross-200-URLs
- [ ] Lighthouse 15 URLs : Perf/SEO/A11y/BestPractices ≥ 95
- [ ] axe-core 15 URLs : 0 violation AAA
- [ ] Security headers : 7/7 OK sur 5 URLs prod
- [ ] 0 broken link sur 200 URLs SEO crawl
- [ ] 0 pricing hardcodé (tout via SSOT)
- [ ] 0 brand voice violation grave sur 50 villes sample
- [ ] Cross-browser 300 screenshots : 0 layout broken
- [ ] Test prod (si applicable) : PSI scores stables vs baseline
- [ ] Rapport final + plan correctif P0/P1/P2 commité

---

## 5. Pièges audit E2E

### A. `pnpm dev` instable sur 12 900 routes

Le SSG complet en dev peut être lent. Solution : tester en mode `pnpm build && pnpm start` (production-like) si dev trop lent.

### B. Playwright multi-browser setup

Si WebKit pas installé : `pnpm playwright install webkit`. Si Firefox : `pnpm playwright install firefox`. Vérifier au début de Phase E.

### C. PSI API rate limit

Google PSI API : 25 000 queries/jour gratuit. 30 URLs × 2 (mobile/desktop) = 60 queries. OK. Mais throttle 1 req/seconde recommandé.

### D. Coolify API auth

Si Coolify API requise pour logs, vérifier `COOLIFY_API_TOKEN` dans env. Sinon SKIP F-2 avec note.

### E. GSC API setup

Si pas configurée, SKIP F-5 avec note "Will doit setup GSC API si veut audit indexation automatique".

### F. False positives

axe-core peut signaler des violations sur composants tiers (Calendly iframe, Cloudflare Turnstile). Marquer comme "expected/external" dans rapport, pas P0.

### G. ISR cache pollution dev

Dev ISR peut servir cache stale après refactor Sprint A. Solution : `rm -rf .next` au début Phase B pour cache propre.

### H. Sample size statistical confidence

200-300 URLs sur 12 900 = ~2% sample. Pour Confiance 95% sur problèmes ≥ 5% prevalence : OK. Pour problèmes < 1% prevalence : faux négatifs possibles. Documenter limites.

---

## 6. Démarrage — phrase à coller dans nouvelle conv Opus (3ème conv)

À lancer APRÈS que les 2 conv précédentes (Sprint A V1 + Complément V1+V2+V3) sont terminées et commits poussés.

```
Le Sprint A V1 (refactor DRY) + Complément V1+V2+V3 (best practices 2026 + scalabilité 2150 villes + tests E2E sample + KB RAG) ont été livrés dans des commits récents sur main. Maintenant exécute l'AUDIT E2E PROFOND complet.

═══ CONTEXTE ═══

Lis ces 5 sources :
1. C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-BRIEF-OPUS.md (brief Sprint A V1)
2. C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-COMPLEMENT-DESIGN-SEO-AEO-GEO.md (complément V1+V2+V3)
3. C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-AUDIT-E2E-PROFOND.md (CE brief - audit E2E)
4. C:\Users\willi\Documents\Projets\Axion-IA\axionia\AGENTS.md
5. git log --oneline -40 pour voir tout l'historique récent

═══ EXÉCUTION ═══

Exécute les 7 phases de l'audit E2E profond (~47 sub-agents //, 6-9h compressée) :

A. Inventaire complet (3 agents //) : sitemap crawl + routes code + CTAs/forms/redirects
B. Test URLs par catégorie (10 agents //) : 310 URLs (core 30 + hub Tier1 30 + Tier2 30 + Tier3 20 + verticales Paris 5 + Tier1 50 + Tier2 50 + Tier3 25 + admin 50 + légales 20)
C. Navigation + CTAs + Forms + Redirects (8 agents //) : Playwright menu/footer/breadcrumb/CTAs primaires/CTAs OrangeBanner/Forms submit/Redirects EN-FR/Anchors
D. Cross-cutting checks (10 agents //) : JSON-LD Schema.org/meta tags/images/Lighthouse 15 URLs/axe-core AAA 15 URLs/security headers/SEO crawl 200 URLs/pricing SSOT/brand voice 50 villes/sitemap+robots+llms
E. Multi-device + multi-browser (8 agents //) : 15 URLs × 5 viewports × 4 browsers (Chrome/Firefox/WebKit/Edge) + prefers-* préférences = 300 screenshots
F. Test prod live (5 agents //, CONDITIONNEL si déployé) : PSI API 30 URLs + Coolify logs + Cloudflare cache + RUM + GSC coverage
G. Consolidation + rapport + plan correctif (3 agents //) : agrégation 40+ rapports → master + prio P0/P1/P2 + commit

═══ RÈGLES ═══

- Travaille sur main
- ZÉRO modification code (audit = read-only sauf rapport)
- Lance les sub-agents en parallèle dans un seul message à chaque phase
- pnpm dev local si Sprint A pas en prod, sinon test prod direct
- STOP & ASK Will SEULEMENT si :
  * URL critique (home/audit/contact) retourne 500
  * Faille sécurité critique détectée (CSRF/XSS/leak data)
  * Cassure totale du site (>50% URLs en erreur)
- Sinon : continuer audit jusqu'au bout, tout reporter

═══ OUTPUT ═══

Rapport final : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/RAPPORT-AUDIT-E2E-PROFOND.md`
Plan correctif : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/PLAN-CORRECTIF-AUDIT-E2E.md`
Tableaux CSV : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/` (~40 CSV)
Screenshots : `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/audit-e2e/screenshots/` (300 PNG)

Verdict final : GO PROD / NOGO with fixes / NOGO critical issues.

Bon audit profond. 🔍
```

---

Bon audit E2E perfection extrême. 🔍
