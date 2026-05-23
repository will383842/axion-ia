# 🧭 PROMPT AUDIT E2E NAVIGATION + CTA PERFECTION 2026

> Audit master AUDIT-ONLY pour vérifier la **navigation bout-en-bout** entre
> **TOUTES** les pages, **TOUTES** les URLs et **TOUS** les CTAs d'Axion-IA
> en production (`https://axion-ia.com`) — perfection extrême 2026.
>
> Pendant que `PROMPT-E2E-ROUTES-HEALTH-2026.md` vérifie que CHAQUE route
> répond 200, ce prompt-ci vérifie que CHAQUE page est **atteignable**,
> **liée correctement**, **dotée des bons CTAs**, et que le **funnel de
> conversion** (home → service → booking → confirmation) marche du premier
> au dernier clic, FR + EN, mobile + desktop, avec et sans JS.
>
> Couvre : header mega-menu, footer, breadcrumbs, switcher locale, CTAs
> primaires/secondaires (Réserver, Audit, Devis), liens in-content, anchor
> text SEO, crawl graph complet (orphans / dead-ends / click depth),
> Speculation Rules prefetch, mobile drawer, recherche interne, anchor
> links #section, external links rel, funnels conversion mesurés, et la
> cohérence cross-pages pour les 12 942 routes pSEO villes + Content-Gen
> factory V2 + KB V4 + image-bank (si déployé).
>
> Mode **🔒 AUDIT-ONLY STRICT**. Zéro fix, zéro commit, zéro mutation prod.
> Production : **1 dossier** `_AUDIT/E2E-NAV-CTA-2026-XX-XX/` avec 13 fichiers.
>
> Score cible : **≥ 900 / 1000** (90 %) pour 🟢 GO « navigation parfaite ».

---

```
Skill : axionia-core (mode 🔒 AUDIT E2E NAVIGATION + CTA PERFECTION 2026)

Tu es l'auditeur de navigation Axion-IA — extrême perfection 2026. Tu
ne codes pas, tu ne fixes pas, tu ne commit pas. Tu CRAWL + tu MESURES
+ tu CARTOGRAPHIES + tu PRESCRIS.

CONTEXTE NAVIGATION 2026 :
- Domaine prod : https://axion-ia.com (FR canonical + EN miroir)
- 104 pages publiques + ~80 pages dynamiques sample + 101 admin
- 12 942 routes pSEO villes (4 templates × 2 157 villes + 13 régions)
- 7 sous-arbres : /interventions /audit /implementation /actualites
  /blog /cas-concrets /centre-aide + hubs /faq /comparaisons /guides
  /connaissances (KB V4 publique) + /implantations (pSEO)
- Header terracotta avec mega-menus (décision Will 2026-05-07)
- Footer maillage interne services × villes pilotes (cf. Sprint 14.10.1)
- Booking V1 sur branche non mergée (calendrier 14 formats) — flagger
  les CTAs Réserver qui pointent vers prod si feature pas en main
- Image-bank skill v1.1 PRÊT mais /galerie pas encore deploy — flagger

OBJECTIF MÉTIER :
La navigation doit MAXIMISER les conversions B2B :
1. Un dirigeant arrive sur n'importe quelle page → en ≤ 3 clics il peut
   réserver un audit flash ou demander un devis ou comparer.
2. Chaque page de contenu (article, FAQ, case study, ville pSEO) doit
   ramener vers une page service ou un CTA conversion.
3. Aucune page « cul-de-sac » sans CTA ni lien sortant interne.
4. Locale switcher FR ↔ EN doit envoyer vers la VRAIE page miroir, pas
   vers home EN générique.
5. Pas de fuite SEO via orphan pages (pages indexées mais non liées).

⛔ MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES :
- AUCUNE édition code, AUCUN commit, AUCUN push, AUCUN deploy
- AUCUN clic mutant (zéro POST form submit en prod sauf endpoints
  EXPLICITEMENT idempotents et publics type /api/indexnow GET)
- Playwright headless autorisé en LECTURE-SEULE :
  * `page.goto()` ✅
  * `page.click()` ✅ sur liens internes uniquement (navigation read-only)
  * `page.click()` ❌ sur boutons « Valider », « Payer », « Envoyer » de form
  * `page.fill()` autorisé UNIQUEMENT si suivi de page.goBack() sans submit
- Si bug trouvé → noter, NE PAS fix
- Si CTA cassé → noter URL + label + page parent + page cible attendue
- Seul livrable : dossier `_AUDIT/E2E-NAV-CTA-2026-XX-XX/`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Référentiels :
1. _AUDIT/PROMPT-E2E-ROUTES-HEALTH-2026.md (audit santé routes, parent)
2. _AUDIT/PROMPT-HEADER-NAVIGATION-2026.md (référentiel header mega-menu)
3. _AUDIT/AUDIT-PARITY-V14-FINAL.md (parity cross-pages bouclée 2026-05-08)
4. _AUDIT/CHANGELOG-V1-BOOKING.md (booking V1 calendrier 14 formats)
5. mémoire `axionia_pseo_villes_livre_2026-05-08.md` (mega-menu + footer
   maillage interne services × villes pilotes)
6. mémoire `axionia_session_2026-05-12_interventions_hubs.md` (4 familles
   × 14 formats heading SSOT)

Code stack navigation :
7. axionia/src/components/Header.tsx ou similaire (mega-menus terracotta)
8. axionia/src/components/Footer.tsx
9. axionia/src/components/Breadcrumbs.tsx + helpers BreadcrumbList JSON-LD
10. axionia/src/components/LocaleSwitcher.tsx (round-trip FR ↔ EN)
11. axionia/src/components/MobileDrawer.tsx ou MobileNav
12. axionia/src/components/SpeculationRules.tsx (prefetch hover)
13. axionia/src/components/CTA.tsx (composant CTA standardisé, si présent)
14. axionia/src/components/admin/AdminCommandPalette.tsx (Cmd+K admin)
15. axionia/src/content/pricing.ts (SSOT tarifs — labels CTAs « 590 € »)
16. axionia/src/content/interventions-taxonomy.ts (4 familles × 14 formats)
17. axionia/src/lib/navigation/* (helpers nav + sitemap config)
18. axionia/src/app/[locale]/recherche/page.tsx + Pagefind config (Sprint 15)
19. axionia/src/app/[locale]/[...catchall]/page.tsx + not-found.tsx + error.tsx

╔═══════════════════════════════════════════════════════════════════════╗
║                  10 AGENTS PARALLÈLES                                 ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Crawl graph complet + orphans + click depth ════════════ /180

Crawler le site en profondeur (Playwright headless ou wget --spider) à
partir de la home FR + home EN, suivre tous les `<a href>` internes, BFS
jusqu'à profondeur 6 (depth = nombre de clics depuis home).

Construire le graphe complet :
- Nœuds = URLs (≈ 320 routes + sample pSEO 50 villes stratifié)
- Arêtes = liens directs `<a>` HTML (pas JS-only)
- Source = home FR (puis croisé avec home EN)

Mesures par nœud :
- **depth** : distance minimale depuis home FR (BFS shortest path)
- **in-degree** : nb de pages internes qui pointent vers cette URL
- **out-degree** : nb de liens sortants internes
- **out-degree-external** : nb de liens vers domaines externes
- **anchor texts** : liste des labels qui pointent vers cette URL
- **first parent** : page qui découvre cette URL en premier (BFS)

Détection critique :
- **Orphan pages** : URL en sitemap.xml mais in-degree = 0 dans crawl
  → SEO gaspillé, indexable mais invisible navigation
- **Dead-end pages** : URL avec out-degree internal = 0 (pas de CTA, pas
  de lien sortant interne) → cul-de-sac conversion
- **Deep pages** : URL à depth > 3 → recommandation Google « < 3 clics »
- **Hub pages** : URL avec in-degree > 50 → pages stratégiques à monitorer
- **Isolated cluster** : sous-graphe non connecté au reste du site

Sample pSEO villes : 50 villes stratifiées (5 par région INSEE × 13 régions
— prendre Paris/Lyon/Marseille + 47 random)
- Doivent être atteignables via /implantations/[region] hub (depth = 2)
- Doivent pointer vers services tier-1 (audit, implementation, interventions)
- Pas trop de cross-linking ville→ville (anti-doorway HCU 2024)

Gates ROUGE :
- > 5 orphan pages dans sitemap = ROUGE
- > 10 dead-end pages (sans CTA, sans lien interne sortant) = ROUGE
- Page conversion (reserver, demande-devis, audit/flash) à depth > 2 = ROUGE
- Cluster isolé (ex : 5 pages qui ne se connectent qu'entre elles) = ROUGE
- Catchall `/[...catchall]` capturant > 5 routes valides = ROUGE
- pSEO ville à depth > 3 = ROUGE (Google ne crawl pas profond ces volumes)

Livrable AGENT 1 :
- `agent1-graph.json` (graphe JSON Cytoscape-compatible)
- `agent1-orphans.tsv` (URLs en sitemap absentes du crawl)
- `agent1-deadends.tsv` (URLs sans out-link interne)
- `agent1-depth.tsv` (URLs × depth × in/out degree)
- `agent1-summary.md` (top 30 problèmes graphe + heatmap par catégorie)

═══ AGENT 2 — Header + mega-menus coverage ═══════════════════════════ /120

Auditer le header sur 10 pages représentatives (home, hub /interventions,
ville pSEO, article factory, FAQ, admin login, /reserver, contact, 404,
not-found.tsx).

2.1 — Inventaire mega-menus
- Combien de mega-menus ?
- Chaque mega-menu : combien de colonnes, combien de liens par colonne ?
- Sections présentes : Services, Implantations, Ressources, À propos ?
- Mega-menu Services :
  * Doit pointer vers /interventions hub + 4 familles (collectives,
    individuel, dirigeants, conference)
  * Doit pointer vers /audit + /implementation + /implantations
  * Sous-pages clés (audit/flash, implementation/ia-custom, etc.)
- Mega-menu Ressources :
  * /actualites /blog /cas-concrets /faq /centre-aide /guides /glossaire
    /comparaisons /connaissances (KB V4) /presse
- Mega-menu Implantations :
  * 13 régions INSEE + lien hub /implantations
  * Villes pilotes (Paris/Lyon/Marseille au moins)

2.2 — Cohérence label vs cible
- Pour chaque lien : vérifier label cohérent avec `<title>` de la page cible
- Pas de "cliquez ici" (anti SEO)
- Pas de label tronqué ou ambigu

2.3 — Différences mobile vs desktop
- Mobile drawer : tous les liens du desktop accessibles ?
- Hamburger ouvre/ferme correctement (testé Playwright)
- Focus trap actif dans drawer (a11y)

2.4 — Speculation Rules
- Vérifier `<script type="speculationrules">` présent dans <head>
- Mode : `prerender` ou `prefetch`
- Eagerness : `moderate` recommandé (cf. mémoire perf-audit-2026-05-07)
- Routes incluses : nav primaire
- Routes EXCLUSES : /admin/* /api/* /reserver (form)

2.5 — Search bar / ⌘K
- Si présent dans header : test ouverture + fermeture + recherche
- Page /recherche accessible depuis header ?
- Pagefind index chargé (Sprint 15) ?

Gates ROUGE :
- Page conversion (audit/flash, reserver) absente du header = ROUGE
- Mega-menu cassé (lien 404, label vide, sous-menu non clickable) = ROUGE
- Mobile drawer non accessible (a11y focus trap absent) = ROUGE
- Speculation Rules `eager` sur nav primaire = ROUGE (régression connue)
- Search bar broken = ORANGE (P1)

Livrable AGENT 2 :
- `agent2-header-inventory.tsv` (chaque lien × cible × status)
- `agent2-megamenu-coverage.md` (pages stratégiques manquantes)
- `agent2-mobile-vs-desktop.md`

═══ AGENT 3 — Footer + maillage interne services × villes ═══════════ /80

3.1 — Inventaire footer
- Combien de colonnes ? Sections présentes ?
- Liens légaux : /mentions-legales /politique-confidentialite /cookies
  /conditions-generales /rgpd /accessibilite /sous-processeurs
  /politique-deplacement
- Pages utiles : /contact /a-propos /equipe /presse /faq /centre-aide
- Services tier-1 : /audit /implementation /interventions
- Newsletter signup : présent ? RGPD checkbox ?
- Réseaux sociaux : présents ? rel="noopener" ?
- Mention "Cabinet IA opérationnel" cohérente (mémoire naming)
- Mention "Axion-IA OÜ" (Estonie) cohérente

3.2 — Maillage villes pilotes (Sprint 14.10.1)
- Footer doit pointer vers ~5-10 villes pilotes (Paris/Lyon/Marseille/
  Toulouse/Bordeaux par ex.)
- Pas exhaustif (sinon spammy SEO), juste pilotes
- Chaque ville × service tier-1 (cross-linking croisé)

3.3 — Année copyright dynamique
- `© 2026 Axion-IA OÜ` (ou current year)
- Vérifier que pas hardcodé sur ancienne année

Gates ROUGE :
- Lien légal manquant (RGPD, mentions-legales) = ROUGE
- Footer pointe vers URL 404 = ROUGE
- Year hardcodé < 2026 = ORANGE
- Newsletter signup sans RGPD checkbox = ROUGE (RGPD)
- Réseau social sans rel="noopener noreferrer" = ROUGE (sécurité)

Livrable AGENT 3 :
- `agent3-footer.tsv` (chaque lien × cible × status)
- `agent3-maillage-villes.md`

═══ AGENT 4 — Breadcrumbs cohérence + JSON-LD ═══════════════════════ /80

Vérifier les breadcrumbs sur 30 pages sample (tous types : home, hub,
sub-hub, leaf, ville pSEO, article factory, admin) :

4.1 — Présence visuelle
- Composant Breadcrumbs affiché en haut de page (sauf home + admin/login)
- Format : Home › Section › Sous-section › Page courante
- Page courante non-clickable (current item)
- Sépérateur cohérent (›, /, →) cross-pages

4.2 — Cohérence chemin
- Le chemin breadcrumb correspond à l'URL canonical
- Ex : /fr/interventions/collectives/1-jour →
  Home › Interventions › Collectives › 1 jour
- Pas de saut de hiérarchie (skip intermediate)

4.3 — JSON-LD BreadcrumbList
- `<script type="application/ld+json">` avec `@type: BreadcrumbList`
- `itemListElement` complet avec position + name + item URL
- Validé via schema.org parser (read-only)
- Présent sur 100 % pages (sauf home)

4.4 — Bilingue
- En EN : "Home › Services › ..." (pas "Accueil › Services" sur page EN)
- Labels traduits dans i18n

Gates ROUGE :
- Breadcrumbs absents sur page leaf indexable = ROUGE
- Breadcrumb pointe vers 404 = ROUGE
- JSON-LD BreadcrumbList invalide ou absent = ROUGE
- Labels non traduits en EN = ROUGE

Livrable AGENT 4 :
- `agent4-breadcrumbs.tsv` (30 pages × 6 critères)
- `agent4-jsonld-issues.md`

═══ AGENT 5 — CTAs primary/secondary cohérence + funnels ═════════════ /160

CŒUR DE L'AUDIT CONVERSION.

5.1 — Inventaire CTAs par page (50 pages sample)
Sur chaque page : combien de CTAs primary, combien de secondary ?
Position (above-the-fold ? sticky bottom mobile ?)
Label + cible URL

CTA primary attendu (selon contexte) :
- Pages services → "Réserver un audit flash" ou "Demander un devis"
- Pages produit interventions → "Réserver cette formation" + prix dynamique
- Pages contenu (articles, FAQ, case studies) → "Réserver un audit" ou
  "Voir nos interventions"
- Home → "Réserver un audit flash" + "Voir nos interventions"
- /reserver → bouton Stripe checkout (NE PAS submit)
- /demande-devis → bouton submit form (NE PAS submit)
- /contact → bouton submit form (NE PAS submit)

CTA secondary :
- "En savoir plus", "Découvrir", "Voir la méthodologie", "Téléchargez le guide"

5.2 — Cohérence pricing.ts SSOT
- Tout CTA qui affiche un prix doit dériver de `src/content/pricing.ts`
- Vérifier que les prix dans CTAs cohérents avec page produit
- Mémoire : pricing.ts est SSOT (Sprint 14.10.5 zéro hardcode)
- Ex : CTA "Approfondie dès 880 €" doit matcher pricing.ts entry-tier TPE

5.3 — Funnel paths complets (test Playwright headless)
Tester 10 funnels critiques en navigation pure (sans submit) :
1. Home → /interventions → /interventions/collectives → /interventions/collectives/1-jour → bouton Réserver (vérifier href Stripe ou /reserver)
2. Home → /audit → /audit/flash → bouton Réserver
3. Home → /implementation → /implementation/ia-custom → CTA Devis
4. Home → /actualites → article factory → CTA bas article (lien vers service)
5. Home → /cas-concrets → case study → CTA "réaliser un audit similaire"
6. Home → /faq → /faq/[slug] → CTA "Réserver un audit"
7. Home → /implantations → /implantations/ile-de-france → /implantations/ile-de-france/paris → CTAs services × ville
8. Home → /audit/par-ville/lyon → CTAs services Lyon
9. Home → /comparaisons → /comparaisons/[slug] → CTA produit comparé
10. Page 404 → CTA "Retour accueil" ou "Voir nos services"

Pour chaque funnel : compter nombre de clics, vérifier que chaque étape
affiche un CTA visible, mesurer dropout potentiel.

5.4 — Labels CTAs (anti-fatigue + AEO friendly)
- Pas de "Cliquez ici" (anti SEO)
- Labels variés (pas tous "En savoir plus" sur même page)
- Verbes d'action : "Réserver", "Demander", "Comparer", "Découvrir"
- Pas de label vide (CTA sans texte = invisible)
- Cohérence cross-pages (même label = même action)

5.5 — Sticky bottom CTA mobile
- Sur mobile, présence d'un sticky CTA bottom sur pages services ?
- Si présent : un seul CTA primary (pas concurrence avec autres)
- Si absent : flagger comme P1 conversion

5.6 — CTAs A/B (si trackés)
- Plausible / Clarity Goals câblés sur CTAs primary ?
- Tracking event onClick fonctionnel ?

Gates ROUGE :
- Page service sans CTA primary visible = ROUGE
- CTA pointant vers URL 404 = ROUGE
- CTA pointant vers locale wrong (FR sur page EN) = ROUGE
- Prix CTA divergent de pricing.ts = ROUGE
- > 3 CTAs primary concurrents sur même page = ROUGE (paralysie choix)
- Page 404 sans CTA retour = ROUGE
- Funnel cassé à l'étape N (CTA absent ou broken) = ROUGE
- Label "Cliquez ici" trouvé = ROUGE

Livrable AGENT 5 :
- `agent5-cta-inventory.tsv` (50 pages × CTA primary + secondary + label + href)
- `agent5-funnels.md` (10 funnels critiques × succès/échec)
- `agent5-pricing-ssot-drift.md` (divergences pricing.ts)
- `agent5-labels-quality.md`

═══ AGENT 6 — Locale switcher FR ↔ EN round-trip ════════════════════ /80

Tester le switcher locale sur 30 pages sample (couvrant les 7 sous-arbres) :

6.1 — Présence + position
- Switcher visible dans header (desktop + mobile)
- Position cohérente cross-pages
- Affiche locale courant + cible (drapeau, code, label)

6.2 — Round-trip pages statiques
- Sur /fr/a-propos → cliquer EN → doit aller sur /en/about (slug traduit)
  OU /en/a-propos (slug FR conservé si choix global)
- Cliquer FR depuis EN → retour exact URL FR de départ
- 30 pages sample testées : 100 % round-trip OK

6.3 — Round-trip pages dynamiques
- /fr/actualites/[slug] → /en/news/[slug] (si slug traduit) OU
  /en/actualites/[slug] (si slug FR conservé pour articles factory)
- /fr/blog/[slug] → /en/blog/[slug-en] si traduit
- Vérifier que pas de fallback vers /en (home générique)

6.4 — Cas spéciaux
- /fr/<adminPrefix>/login → /en/<adminPrefix>/login (admin bilingue ?)
- /fr/recherche → /en/search (slug traduit ?)
- /fr/[...catchall] → /en/[...catchall] (404 bilingue)

6.5 — Hreflang vs switcher cohérence
- Le switcher doit pointer vers l'URL exacte annoncée dans `<link rel="alternate" hreflang>`
- Si hreflang annonce URL A mais switcher envoie vers URL B = bug

Gates ROUGE :
- Switcher absent sur page indexable = ROUGE
- Switcher envoie vers home générique au lieu de page miroir = ROUGE
- > 10 % pages avec round-trip cassé = ROUGE
- Divergence switcher vs hreflang = ROUGE

Livrable AGENT 6 :
- `agent6-locale-roundtrip.tsv` (30 pages × FR→EN status × EN→FR status)
- `agent6-issues.md`

═══ AGENT 7 — Liens in-content + anchor text SEO ════════════════════ /100

Sur 30 pages de contenu sample (articles, FAQ, case studies, KB V4, ville
pSEO) auditer les liens dans le corps de texte :

7.1 — Densité liens internes
- Articles factory : 5-15 liens internes attendus (cf. doctrine Sprint 14)
- Case studies : 3-8 liens internes vers services concernés
- FAQ : 2-5 liens vers pages services ou autres FAQ
- KB V4 : 5-15 liens vers articles connexes
- pSEO ville : 8-20 liens (services × ville × région parent)

7.2 — Anchor text quality
- Pas de "ici", "cliquez ici", "voir plus", "ce lien"
- Anchor descriptif et SEO-friendly (mots-clés de la page cible)
- Variation cross-pages (pas toujours le même anchor pour même cible)
- Anchor text correspond au sujet de la page cible

7.3 — Liens vers pages services depuis contenu
- Chaque article doit pointer vers ≥ 1 page service tier-1
- Chaque case study doit pointer vers le service réalisé
- Chaque FAQ doit pointer vers la page action correspondante
- Cf. doctrine "ramener le trafic vers conversion"

7.4 — Liens externes (sources)
- Doivent avoir `rel="noopener noreferrer"`
- Doivent avoir `target="_blank"` si externe
- Vérifier qu'ils ne fuient pas vers concurrents directs
- Sources autoritaires : INSEE, gouv.fr, AI Act EU, etc.

7.5 — Anchor links #section
- Sur pages longues (méthodologie, articles factory), TOC avec anchors
- Tester chaque anchor : doit scroller à la section correspondante
- IDs uniques par page

7.6 — Liens dupliqués
- Pas de répétition du même lien interne 3+ fois dans même page (sauf TOC)
- Premier lien gagne (PageRank flow)

Gates ROUGE :
- Article factory avec 0 lien interne vers service tier-1 = ROUGE
- "Cliquez ici" trouvé en anchor text = ROUGE
- Lien externe sans rel="noopener" = ROUGE (sécurité tabnabbing)
- Anchor #section pointant vers ID inexistant = ROUGE
- > 30 % anchors identiques sur même page = ORANGE (PageRank dilution)

Livrable AGENT 7 :
- `agent7-incontent-links.tsv` (30 pages × densité × qualité anchors)
- `agent7-anchor-quality.md`
- `agent7-broken-anchors.md`

═══ AGENT 8 — Recherche interne + Pagefind ═══════════════════════════ /60

8.1 — Page /recherche
- Existe ? Retourne 200 ?
- Champ search visible et fonctionnel ?
- Pagefind index chargé (vérifier réseau : /_pagefind/*.js + .pf_meta + index)
- Si pas Pagefind : flagger comme P1 (Sprint 15 du plan)

8.2 — Tests de recherche
- Mots-clés sample : "audit IA", "Paris", "Manon", "ROI", "Stripe"
- Pour chaque : nombre de résultats, pertinence top 3, surlignage match
- Vérifier que résultats pointent vers URLs valides (non 404)

8.3 — Recherche depuis header (⌘K si présent)
- Composant AdminCommandPalette (admin) : test ouverture + recherche
- Search bar header public : test si présent

8.4 — Vide / no-result state
- Tester "xqzpwlk" (nonsense) → doit afficher "Aucun résultat" propre
- Pas de blank page ni erreur

8.5 — i18n recherche
- Recherche EN sur /en/search → résultats EN (pas mix FR/EN)

Gates ROUGE :
- /recherche 404 = ROUGE (Sprint 15 non livré)
- Pagefind index manquant = ROUGE
- Résultats pointant vers 404 = ROUGE
- No-result state cassé = ORANGE

Livrable AGENT 8 :
- `agent8-search.md`

═══ AGENT 9 — Mobile drawer + a11y navigation ═══════════════════════ /80

9.1 — Mobile drawer
- Hamburger button visible en mobile
- Clic ouvre drawer (animation fluide)
- Drawer contient TOUS les liens du desktop mega-menus
- Sous-sections accessibles (accordéon ou full screen)
- Bouton fermer visible
- ESC ferme drawer
- Backdrop click ferme drawer

9.2 — Focus management
- À l'ouverture : focus envoyé au premier élément focusable du drawer
- Focus trap actif : Tab/Shift+Tab cycle dans drawer uniquement
- À la fermeture : focus revient au hamburger button

9.3 — Skip link
- `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>` ?
- Premier élément du body, visible au focus clavier
- WCAG 2.1 AA obligatoire

9.4 — ARIA + sémantique
- `<nav aria-label="Main">`, `<nav aria-label="Footer">`
- aria-expanded sur hamburger (true/false)
- aria-current="page" sur lien page courante dans nav
- role="dialog" sur drawer + aria-modal="true"

9.5 — Touch targets
- Boutons / liens nav ≥ 44 × 44 px (WCAG 2.5.5 mobile)
- Pas de tap target overlap

9.6 — Keyboard navigation desktop
- Tab traverse menu logiquement
- Enter ouvre sous-menu mega-menu
- Esc ferme sous-menu
- Focus ring visible (`focus-visible:outline`)

Gates ROUGE :
- Drawer mobile non fermable = ROUGE
- Focus trap absent = ROUGE (a11y bloquant)
- Skip link absent = ROUGE (WCAG)
- Touch target < 44 px = ROUGE (mobile a11y)
- aria-current absent = ORANGE

Livrable AGENT 9 :
- `agent9-mobile-nav.md`
- `agent9-a11y-nav.md`

═══ AGENT 10 — Cross-cuttings : pSEO + Content-Gen + KB + Image-bank ═ /160

10.1 — pSEO villes maillage (50 villes sample)
- /implantations/[region]/[ville] doit avoir :
  * CTAs primary : Réserver audit + Demander devis (cible /reserver et /demande-devis avec param ville)
  * Liens vers 4 templates ville :
    - /audit/par-ville/[ville]
    - /interventions/par-ville/[ville]
    - /implementation/par-ville/[ville]
  * Liens vers région parent
  * Liens vers 3-5 villes voisines (pas plus, anti-doorway HCU)
- /audit/par-ville/[ville] doit pointer vers /audit/flash + /reserver
- /interventions/par-ville/[ville] doit lister formats disponibles
- /implementation/par-ville/[ville] doit pointer vers /implementation hub

Mémoire : cap doctrine ~95 % AxionIA-centric + ~5 % data INSEE.

10.2 — Content-Gen factory (V1.0.3 tag) maillage articles
- /actualites/[slug] (articles factory) doit avoir :
  * 5-15 liens internes vers services / autres articles connexes
  * CTA bas article vers /reserver ou /demande-devis
  * "Articles similaires" en bas (recommendations)
  * Author byline → /equipe/manon (persona disclosed)
  * Date published + date modified visibles
  * Catégorie + tags clickables vers archive

10.3 — KB V4 publique /connaissances
- /connaissances hub liste articles par catégorie
- /connaissances/[slug] doit avoir :
  * Liens internes vers articles connexes
  * CTA "Réserver un audit" ou "Demander un devis"
  * Breadcrumb : Home › Connaissances › [Catégorie] › [Article]
  * Liens "Voir aussi" cross-references
- Vérifier que articles KB non publiés ne sont PAS exposés (admin only)

10.4 — Booking V1 (si feature branch mergée)
- /reserver doit avoir :
  * Calendrier 14 formats accessibles
  * CTA Stripe checkout par format (NE PAS submit)
  * Lien retour /interventions
  * Lien FAQ booking si présent
- /booking/[token]/cancel + /booking/[token]/reschedule : accessibles via
  email links (test avec token mock)

10.5 — Image-bank /galerie (si déployé)
- /galerie hub doit avoir CTAs vers services pertinents
- /galerie/[slug] doit avoir :
  * License CC BY 4.0 visible
  * Lien retour catégorie
  * "Images similaires" en bas
  * Si pas encore déployé : flagger P1 (skill v1.1 prêt)

10.6 — Admin internal navigation
- /admin (dashboard) doit avoir sidebar / topbar nav couvrant 101 pages
- Cmd+K palette accessible
- Breadcrumbs admin présents
- Bouton "Voir sur le site" sur edit pages (preview live)
- Logout button visible

Gates ROUGE :
- pSEO ville sans CTA conversion = ROUGE
- Article factory sans CTA bas = ROUGE
- KB article exposé non-publié = 🚨 CRITIQUE (fuite contenu draft)
- /reserver CTAs cassés = ROUGE (revenu perdu)
- Image-bank déployé mais navigation cassée = ROUGE

Livrable AGENT 10 :
- `agent10-pseo-maillage.tsv`
- `agent10-content-gen-maillage.md`
- `agent10-kb-maillage.md`
- `agent10-booking-flow.md`
- `agent10-image-bank-flow.md`
- `agent10-admin-nav.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLES (dossier complet)                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Dossier unique : `_AUDIT/E2E-NAV-CTA-2026-XX-XX/`

Contenu obligatoire (13 fichiers + sous-dossiers) :
1. `README.md` — TL;DR exécutif + score /1000 + verdict + 5 P0 immédiats
2. `agent1-graph.json` + `agent1-orphans.tsv` + `agent1-deadends.tsv`
   + `agent1-depth.tsv` + `agent1-summary.md`
3. `agent2-header-inventory.tsv` + `agent2-megamenu-coverage.md`
   + `agent2-mobile-vs-desktop.md`
4. `agent3-footer.tsv` + `agent3-maillage-villes.md`
5. `agent4-breadcrumbs.tsv` + `agent4-jsonld-issues.md`
6. `agent5-cta-inventory.tsv` + `agent5-funnels.md`
   + `agent5-pricing-ssot-drift.md` + `agent5-labels-quality.md`
7. `agent6-locale-roundtrip.tsv` + `agent6-issues.md`
8. `agent7-incontent-links.tsv` + `agent7-anchor-quality.md`
   + `agent7-broken-anchors.md`
9. `agent8-search.md`
10. `agent9-mobile-nav.md` + `agent9-a11y-nav.md`
11. `agent10-pseo-maillage.tsv` + `agent10-content-gen-maillage.md`
    + `agent10-kb-maillage.md` + `agent10-booking-flow.md`
    + `agent10-image-bank-flow.md` + `agent10-admin-nav.md`
12. `TOP-PATCHES-PRIORISES.md` — 30 patches P0/P1/P2/P3 avec :
    - Page/composant concerné
    - Symptôme observé (CTA cassé, orphan, depth > 3, etc.)
    - Patch recommandé (1 phrase, sans coder)
    - Effort estimé
    - Risque non-fix (revenu perdu / SEO / a11y / conversion)
13. `VERDICT.md` — GO/CONDITIONAL/NO-GO + conditions de levée
14. `nav-graph.html` (optionnel, render Cytoscape du graphe complet)

**Scoring /1000 :**
- AGENT 1 Crawl graph + orphans + depth : /180 ← **POIDS LE PLUS FORT**
- AGENT 2 Header mega-menus : /120
- AGENT 3 Footer + maillage villes : /80
- AGENT 4 Breadcrumbs + JSON-LD : /80
- AGENT 5 CTAs + funnels conversion : /160 ← **2e poids (cœur revenu)**
- AGENT 6 Locale switcher FR/EN : /80
- AGENT 7 In-content links + anchor SEO : /100
- AGENT 8 Search interne + Pagefind : /60
- AGENT 9 Mobile drawer + a11y : /80
- AGENT 10 Cross-cuttings (pSEO + Content-Gen + KB + image-bank) : /160

**Seuils verdict :**
- ≥ 900 (90 %) : 🟢 **GO** — navigation parfaite, monitoring continu
- 750-899 (75-89 %) : 🟡 **CONDITIONAL** — P0 < 1 semaine obligatoire
- 500-749 (50-74 %) : 🟠 **SPRINT CORRECTIF** — refonte nav partielle
- < 500 (50 %) : 🔴 **NO-GO** — refonte nav massive nécessaire

╔═══════════════════════════════════════════════════════════════════════╗
║                  STRUCTURE TECHNIQUE ROBUSTE                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Scripts obligatoires (reproductibles post-deploy) :
- `agent1-crawl.mjs` (node + Playwright headless, BFS depth 6, < 10 min)
- `agent2-header.mjs` (Playwright, 10 pages × extraction header DOM)
- `agent5-funnels.mjs` (Playwright, 10 funnels critiques click-through)
- `agent6-locale.mjs` (Playwright, 30 pages × round-trip switcher)
- `agent7-anchors.mjs` (parse HTML + extraction <a> + scoring)
- `agent9-a11y.mjs` (Playwright + @axe-core/playwright lecture-seule)
- `run-all.sh` — orchestrateur 10 agents en parallèle (< 30 min total)

Format `nav-edges.tsv` (gold standard graphe) :
```
source	target	anchor	location	rel	rel_target
https://axion-ia.com/fr	https://axion-ia.com/fr/interventions	Interventions	header_menu	internal	same-domain
https://axion-ia.com/fr	https://axion-ia.com/fr/reserver	Réserver un audit	hero_cta	internal	same-domain
...
```

═══ Idempotence garantie ═══
- Aucun script ne submit form en prod
- Aucun script ne crée de booking, payment, ou GDPR request
- Click sur liens internes uniquement (navigation pure)
- Reservation de tokens : utiliser tokens mock si dispo, sinon SKIP

═══ Scalabilité (rejouable post-deploy) ═══
- GitHub Action peut rejouer `run-all.sh` après chaque deploy
- Output graphe JSON / TSV → ingérable Plausible custom dashboard
- Coût zéro : Playwright headless + node stdlib

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Stack Hetzner CPX42 + Coolify + CF Free
- Direction visuelle commitée HEAD intouchable (terracotta header)
- Naming "Axion-IA" partout (FR + EN)
- Persona Manon disclosed (AI Act 2026)
- pricing.ts SSOT (Sprint 14.10.5)
- 4 familles × 14 formats interventions taxonomy SSOT
- AUDIT-ONLY : zéro fix, zéro commit, zéro mutation
- Masquage `<ADMIN_PREFIX>` dans livrables (pas de leak)

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES NAVIGATION 2026                         ║
╚═══════════════════════════════════════════════════════════════════════╝

- **Click depth ≤ 3 depuis home** = doctrine Google 2026 (toute page leaf
  doit être atteignable en ≤ 3 clics, sinon PageRank dilué)
- **Orphan pages** = SEO gaspillé : indexable mais invisible utilisateur
  → forcer un lien depuis hub ou footer
- **Dead-end pages** = friction conversion : visiteur arrive, bloque, repart
  → CTA primary obligatoire sur chaque page
- **CTA primary unique above-the-fold** = doctrine UX 2026 (paralysie choix
  si > 1 CTA primary concurrent)
- **Anchor text descriptif** = signal SEO fort (Google pondère anchor)
- **Locale switcher round-trip exact** = doctrine multilingue 2026 (Google
  Search Console pénalise hreflang divergent du switcher)
- **Breadcrumbs JSON-LD** = passport rich snippet Google (CTR +30 %)
- **Mobile drawer focus trap** = obligation WCAG 2.1 AA (légal RGAA FR)
- **pSEO ville cap maillage** = anti-doorway HCU 2024 (max 3-5 villes
  voisines liées, pas tout-à-tous)
- **Article → service link** = doctrine "ramener vers conversion"
  (Plausible Goal tracker câblé)
- **Speculation Rules moderate** = pas eager (régression connue
  axionia_perf_audit_2026-05-07)
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche)

> Lance l'audit `_AUDIT/PROMPT-E2E-NAVIGATION-CTA-PERFECTION-2026.md` en mode AUDIT-ONLY STRICT. 10 agents parallèles, scoring /1000. Crawl le site en BFS depth 6 depuis home FR + home EN (Playwright headless), construis le graphe complet (≈ 320 routes + 50 pSEO villes sample stratifié), détecte orphans (sitemap mais in-degree 0) + dead-ends (pas de CTA, pas de lien interne sortant) + deep pages (depth > 3) + clusters isolés. Audite header mega-menus (10 pages sample × inventory + cohérence labels + Speculation Rules moderate + mobile drawer parity). Audite footer (légaux + maillage villes pilotes + newsletter RGPD + réseaux rel=noopener). Audite breadcrumbs visuels + JSON-LD BreadcrumbList sur 30 pages. CŒUR : audite CTAs primary/secondary sur 50 pages, cohérence pricing.ts SSOT, 10 funnels conversion critiques (home→service→reserver), labels qualité anti "cliquez ici", sticky bottom mobile. Audite locale switcher FR↔EN round-trip sur 30 pages (pas de fallback home générique). Audite in-content links + anchor text SEO sur 30 articles/FAQ/case studies/KB/pSEO. Audite /recherche + Pagefind. Audite mobile drawer + focus trap + skip link + ARIA + touch targets ≥ 44 px (WCAG 2.1 AA). Audite cross-cuttings : pSEO villes maillage (cap anti-doorway HCU), Content-Gen articles factory liens vers services, KB V4 /connaissances, Booking V1 /reserver flow, image-bank /galerie si déployé, admin internal nav 101 pages. Produis le dossier `_AUDIT/E2E-NAV-CTA-2026-05-15/` avec 13 fichiers + agent1-graph.json (Cytoscape-compatible) + TOP-PATCHES-PRIORISES.md (30 patches P0-P3) + VERDICT.md. Aucun fix, aucun commit, aucun submit form en prod, aucune mutation. Scripts node+Playwright idempotents rejouables post-deploy. Verdict /1000 avec conditions de levée si CONDITIONAL/NO-GO.
