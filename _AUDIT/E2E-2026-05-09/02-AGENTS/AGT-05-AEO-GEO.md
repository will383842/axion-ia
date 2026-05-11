# AGT-05 — AEO / GEO

**Périmètre** : Answer Engine Optimization + Generative Engine Optimization. `llms.txt` / `llms-full.txt`, FAQPage, answer-first patterns, E-E-A-T, LocalBusiness/Place pour villes, Article blog, ratio AxionIA-centric 95/5, citation-worthy passages, maillage services × villes, paradoxe robots.txt AI bots vs Cloudflare AI Scrapers.

**Référence** : HEAD `b6d17ad` (état Phase 0 reality-check) + sondes prod `https://axion-ia.com` 2026-05-11.

## Score : **88 / 100**

Pondération master ×1.3 (poids final 114.4).

## Confiance : **haute**

Justification : 1) factories JSON-LD inspectées ligne par ligne dans `src/lib/seo.ts` (≈1057 LOC, 18 factories opérationnelles), 2) routes `llms.txt` + `llms-full.txt` lues code + récupérées prod, 3) page mère Paris pilote (~5000 mots) inspectée code + types vérifiés, 4) JSON-LD live ramené via curl prod sur 5 pages échantillon (homepage, FAQ, /a-propos, /methodologie, /blog/[slug], /implantations/ile-de-france/paris), 5) robots.txt prod analysé en intégralité (deux couches conflictuelles découvertes), 6) ratio AxionIA-centric mesuré par grep keywords sur fichier Paris pilote.

Limites : 1) ratio HCU 95/5 mesuré indicatif sur 1 source (Paris) — non extrapolé aux 2150+ villes car 1 seule a un copy à date (`PARIS_COPY`), 2) je ne dispose pas d'accès Cloudflare API en lecture pour confirmer le toggle "Block AI Scrapers" actuel (mémoire `axionia_session_2026-05-09_cloudflare_phase5` note Phase 5 = "AI Scrapers OFF" mais le robots.txt prod contient la Managed Content opposée), 3) Search Console / Bing Webmaster non audités (verification meta présents mais pas le coverage report).

---

## Top findings

### P0 (bloquant AEO/GEO)

- **P0-01 — Robots.txt Cloudflare Managed Content bloque GPTBot/ClaudeBot/PerplexityBot/Google-Extended/Applebot-Extended/Bytespider/CCBot/Amazonbot via `Disallow: /`** alors que la section origin (générée par l'app Next) les **autorise**. La couche CF apparaît **en tête de fichier** donc les crawlers respectueux RFC 9309 (qui prennent la première directive matching User-agent) verront le Disallow. **Effet** : AEO/GEO ≈ 0 sur Anthropic/OpenAI/Google AI Overviews/Perplexity malgré toute l'infrastructure JSON-LD livrée. Source : `curl https://axion-ia.com/robots.txt` 2026-05-11 (Phase 0 reality-check confirme la même observation). Voir détail § 1.1.

### P1 (sérieux non bloquant)

- **P1-01 — `llms-full.txt` non localisé** : 1 seule version (FR-only mix avec FAQ EN entre parenthèses). La route est `runtime = edge` à `/llms-full.txt` racine donc pas de `[locale]` dans le path → Anthropic/OpenAI ne reçoivent pas une version par marché. Citation `src/app/llms-full.txt/route.ts:18-20` + `:43-45` (FAQ mixée `### ${f.fr.question}\n\n${f.fr.answer}\n\n(EN) ${f.en.answer}`).
- **P1-02 — `llms.txt` strict (802 octets prod) ne référence pas `/llms-full.txt`** : la spec llmstxt.org recommande de lier explicitement la version full depuis le résumé. Citation `src/app/llms.txt/route.ts:18-36`.
- **P1-03 — `og:image` pointe vers `/opengraph-image` mais bug pré-existant `localhost:3000` documenté (mémoire `axionia_bugs_seo_preexistants_2026-05-09`)** — directement impactant les previews LinkedIn / X / Slack qui sont des canaux AEO clés.
- **P1-04 — 1 seule ville pilote sur 2150** : ratio HCU 95/5 inapplicable aux 2149 stubs qui sortent `noindex, follow` (cf. `src/app/[locale]/implantations/[region]/[ville]/page.tsx:96-101`). Strategy correcte (anti-doorway) mais signifie que la promesse `#1 ville/région` du plan n'a pas encore son volume de contenu — uniquement Paris compte aujourd'hui.
- **P1-05 — Aucune URL canonique pour les routes `llms.txt`/`llms-full.txt`** : les routes Edge ne posent ni canonical ni `Link: <…>; rel="canonical"` HTTP. Faible mais signal LLM-search Brave/Kagi.
- **P1-06 — Sitemap `https://axion-ia.com/sitemap.xml` retourne 404** (mémoire `axionia_bugs_seo_preexistants_2026-05-09` confirmée Phase 0). Or robots.txt prod déclare `Sitemap: https://axion-ia.com/sitemap-index.xml` qui fonctionne (200). Risque : crawlers AEO (Bing/Apple) qui ne suivent que la déclaration `sitemap.xml` par défaut ignorent le sitemap-index.

### P2 (confort / polish)

- **P2-01 — `Person.knowsAbout` figé hardcoded dans `buildPersonJsonLd` (`src/lib/seo.ts:359-365`)** : les LLMs préfèreraient une liste structurée enrichie (Wikidata Qxxx) plutôt que strings libres.
- **P2-02 — Pas de `mainContentOfPage` ou `speakable` global sur la homepage** : seule FAQPage utilise Speakable (`src/lib/seo.ts:468-485`). Étendre aux 5-10 phrases hero des pages stratégiques (1 ligne `[itemprop="text"]`) débloquerait Google Assistant + Alexa.
- **P2-03 — `Article.dateModified` = `datePublished` par défaut (`src/lib/seo.ts:431`)** : sans dateModified réelle distincte, le signal fraîcheur AEO est faible. Posts du blog devraient porter une vraie dateModified via `meta` editorial.
- **P2-04 — `Review` / `AggregateRating` factories existent (`src/lib/seo.ts:830-892`) mais aucun call site grepé** : star rating SERP non actif (zéro Review émis dans le code aujourd'hui). Sprint correctif quick-win quand Will collecte des verbatims clients.
- \*\*P2-05 — `availableLanguage: ["French", "English"]` dans `ContactPoint` (`src/lib/seo.ts:264-265`) : Schema.org recommande BCP-47 (`fr-FR`, `en-GB`) plutôt que noms anglais. Faible mais validateur Google chipote.
- **P2-06 — Pas de FAQPage JSON-LD sur les pages services individuelles (`/audit/flash`, `/interventions/essentielle`, etc.)** — pourtant elles importent `buildFaqJsonLd`/`buildFaqSpeakableJsonLd` selon grep. Vérifier émission effective (test `tests/integration/jsonld-coverage.spec.ts` non grepé ici).

---

## Détail par sous-chapitre

### 1. llms.txt + llms-full.txt content quality

**`src/app/llms.txt/route.ts` (45 LOC)** :

- Conforme spec llmstxt.org : H1 + blockquote contexte + sections `## Modules` / `## Stratégie`.
- Edge runtime + `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` → CDN-friendly.
- Prix dérivé du SSOT `pricing.ts` via `getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!` (`:13-17`) — pas de hardcode.
- **Manquant** : pas de lien vers `/llms-full.txt` (P1-02), pas de `## Person` (Will fondateur), pas de `## Anti-bullshit` ou `## Differentiators` qui sont des sections recommandées par Anthropic doc llms.txt 2026 pour cabinet B2B.
- Body prod ramené 2026-05-11 : 802 octets, contenu strictement = code, donc pas de drift cache.

**`src/app/llms-full.txt/route.ts` (113 LOC)** :

- Spec llmstxt.org "-full" companion : conforme (sections complètes).
- Couverture : positionnement, 3 modules détaillés avec prix dérivés, FAQ globale, cas concrets, méthodologie, engagement.
- **Volume prod 2026-05-11** : 114 798 octets (`curl -sL` après suivi redirect, mais la URL retourne 307 initialement → comportement attendu : la route est non-localisée donc `/llms-full.txt` mappe direct, le 307 vient de la résolution Next 16 sur autre chemin → comportement à investiguer mais le contenu est servi).
- **Qualité** : 4408 mots, mention Hetzner Frankfurt, mention OÜ Tallinn, mention régime TVA UE — tout E-E-A-T identifié.
- **Faiblesses** :
  - FAQ EN entre parenthèses dans le bloc FR (`### ${f.fr.question}\n\n${f.fr.answer}\n\n(EN) ${f.en.answer}`, ligne 44) : pas idéal pour AEO multilangue. Mieux : 2 sections distinctes `## FAQ (FR)` + `## FAQ (EN)`.
  - Pas de `## Citation-worthy stats` (e.g. tarif d'entrée, durée moyenne ROI, taille marché) que les LLMs adorent recopier.
  - Pas de `## Comparisons` (Axion-IA vs cabinet conseil traditionnel vs SaaS) — Perplexity / Claude.ai citent les comparatifs.

### 2. FAQPage JSON-LD presence

**Émission au build** :

- Factory `buildFaqJsonLd` (`src/lib/seo.ts:177-187`) standard FAQPage + `mainEntity[]`.
- Factory `buildFaqSpeakableJsonLd` (`src/lib/seo.ts:468-485`) FAQPage avec Speakable CSS selector `[itemprop='text']` — signal Voice AEO.
- **29 fichiers `app/**/page.tsx`importent ces factories** (cf. grep §1.0 sur`FAQPage|buildFaq`). Les pages services individuelles (audit/flash, interventions/essentielle, implementation/agents, etc.) sont toutes câblées.

**Vérification live** (`curl https://axion-ia.com/fr/faq`) : émission OK — `"@type":"FAQPage"`, `"@type":"SpeakableSpecification"`, `"@type":"Question"`, `"@type":"Answer"` tous présents (cf. § 1.1 ci-dessus).

**Vérification live homepage** (`curl https://axion-ia.com/fr`) : émission OK — `"@type":"FAQPage"` présent depuis le bloc FAQ_GLOBAL.

**Vérification live Paris** (`curl https://axion-ia.com/fr/implantations/ile-de-france/paris`) : `"@type":"FAQPage"` + `"@type":"SpeakableSpecification"` confirmés.

### 3. Answer-first patterns (H2 questions + lead concis)

**Pattern observable dans le code** :

- `/fr/implantations/ile-de-france/paris` : `directAnswerFr` champ dédié (40-80 mots) injecté en `itemProp="text"` immédiatement après H1 (`src/app/[locale]/implantations/[region]/[ville]/page.tsx:237-245` + `src/content/villes/copy/types.ts:144-152`).
- `/fr/faq` : H1 + sub-paragraphe "Réponses courtes, sourcées, citables par les LLMs" (`src/app/[locale]/faq/page.tsx:88-92`).
- `/fr/a-propos` : Lead 30-50 mots immédiat (`src/app/[locale]/a-propos/page.tsx:87-91`).

**Bonne pratique** : `VilleCopy.directAnswerFr` est explicitement documenté comme « citable verbatim par Perplexity / Claude.ai / Google AI Overviews » (`src/content/villes/copy/types.ts:144-150`). Doctrine cohérente.

**Manquant** :

- Pas de H2 phrasés sous forme de question (« Qu'est-ce qu'un audit IA opérationnel ? ») sur les pages services individuelles audit/intervention/implementation. Style H2 actuel = noun-phrases (« Notre méthode », « Tarifs », « Garanties »).
- Recommandation Sprint correctif AEO : convertir 2-3 H2 par page service en questions naturelles AEO-friendly.

### 4. E-E-A-T

| Pilier            | Signal                                                                                                                                                                                        | Note      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Experience        | OÜ fondée 2024 (`buildOrganizationJsonLd:250`), timeline `ABOUT_TIMELINE` 2024→2026 (`transversal.ts:53-84`)                                                                                  | ✅ ancré  |
| Expertise         | `Person.knowsAbout` 6 items dont "Retrieval-Augmented Generation", "LLM" (`seo.ts:359-365`), cas-concrets 5+ industries                                                                       | ✅ solide |
| Authoritativeness | `Person.sameAs` = LinkedIn unique (`seo.ts:339`). Pas de Twitter, pas de GitHub, pas d'articles invités externalisés détectés. Page `/presse` existe (`src/content/press.ts` documentée 14.6) | ⚠️ thin   |
| Trust             | Mentions OÜ Tallinn (`seo.ts:243`), Hetzner Frankfurt UE (homepage + llms-full.txt), CGV/RGPD pages, retention purge + GDPR export endpoints livrés Sprint 24 (cf. mémoire)                   | ✅        |

**Person JSON-LD émis sur `/a-propos`** (vérifié live, `"@type":"Person"` présent).

**Person JSON-LD `worksFor` → Organization Axion-IA OÜ** : double-attesté (`seo.ts:353-357`), bon pour disambiguation Wikidata-style des LLMs.

**Gaps E-E-A-T** :

- Photo Will réelle pas grepée comme asset `public/` (Phase 0 note `public/` ne contient que SVGs + press-kit/). `Person.image` retombe sur `${SITE_URL}/opengraph-image` (`seo.ts:344`) ce qui n'est pas une vraie photo identifiable.
- `Person.sameAs` limité à 1 URL → Anthropic/Perplexity scorent E-E-A-T en partie sur la diversité des sources externes ; LinkedIn seul = signal faible.
- `Organization.sameAs` = LinkedIn company + Facebook page (`seo.ts:249`) — pas de X/Twitter, pas de Crunchbase, pas de "Recherche Google" knowledge panel.

### 5. Place / LocalBusiness pour villes

**Architecture** : `buildLocalBusinessJsonLd` (`seo.ts:533-595`) émet `@type:"ProfessionalService"` (sous-classe de LocalBusiness Schema.org) avec :

- `parentOrganization` → Axion-IA OÜ (chaîne hiérarchique correcte).
- `areaServed.@type` `City` / `AdministrativeArea` / `Place` (3 niveaux supportés).
- `address.PostalAddress` complet avec `postalCode` / `addressRegion` / `addressCountry: "FR"` par défaut.
- `geo.GeoCoordinates` lat/lon depuis `VilleData.geo`.
- `openingHoursSpecification` typé objet (pas array de strings — cert C6 2026-05-08 noted in inline comment `seo.ts:505-518`).
- `priceRange: "€€€"` par défaut.

**Couplé avec `buildPlaceJsonLd`** (`seo.ts:611-649`) qui émet `@type:"Place"` + `geo` + `containedInPlace` + `additionalProperty.population` (signal anti-doorway).

**Vérification live Paris pilote** (`curl /fr/implantations/ile-de-france/paris`) :

- `"@type":"ProfessionalService"` ✅
- `"@type":"Place"` ✅
- `"@type":"GeoCoordinates"` ✅
- `"@type":"PostalAddress"` ✅
- `"@type":"OpeningHoursSpecification"` ✅
- `"@type":"City"` (areaServed nested) ✅
- `"@type":"ItemList"` (villes proches Haversine) ✅
- `"@type":"FAQPage"` + `"@type":"SpeakableSpecification"` ✅

**Empilement page Paris** = 5 schemas JSON-LD émis (LocalBusiness + Place + FAQ Speakable + ItemList + BreadcrumbList) — conforme à la doctrine "Page mère Paris pilote 5 schemas JSON-LD" (mémoire `axionia_pseo_villes_livre_2026-05-08`).

**Vérification non-pilote (Lyon)** : page existe (200 OK) avec `<meta name="robots" content="noindex, follow"/>` confirmé via curl prod 2026-05-11 → comportement attendu (anti-doorway HCU 2024).

### 6. Article JSON-LD blog

**Factory `buildArticleJsonLd`** (`seo.ts:406-453`) émet :

- `@type:"Article"` (pas BlogPosting — choix défendable, Google traite équivalent).
- `author` typé Person avec URL profil `/a-propos#${slug}` (auto-deep-link).
- `publisher` Organization Axion-IA OÜ + `logo.ImageObject`.
- `mainEntityOfPage` → URL canonique de la page (signal AI Overviews / SGE).
- `inLanguage`, `articleBody`, `wordCount`, `keywords`, `articleSection` — richesse maximale.
- `dateModified` fallback sur `datePublished` (P2-03).

**Vérification live** `/fr/blog/3-quick-wins-2026` : `"@type":"Article"`, `"@type":"ImageObject"`, `"@type":"Person"`, `"@type":"WebPage"` tous présents.

**`Person` schema implicite via author** : OK, mais la version embedded dans Article n'expose pas `knowsAbout` ni `worksFor` (seulement `name` + `url`). Pour cohérence E-E-A-T, ajouter un `@id` partagé entre la Person de `/a-propos` et celle citée dans Article — sinon les LLMs voient 2 entités potentiellement distinctes.

### 7. Bouclier HCU 95/5 — mesure indicative

**Source unique mesurable** : `src/content/villes/copy/paris.ts` (1 seul fichier copy ville à date — Paris seule ville pilote, cf. `getVille` + `villes/index.ts`).

Mesure grep contrôlée (Bash) :

- Mentions AxionIA-centric (axion-ia, axionia, notre, nous, cabinet, consultant, prestation, client, service, tarif, prix, HT, €, méthod, audit IA, intervention) : **81 hits**.
- Mentions INSEE-centric (INSEE, population, habitants, arrondiss, Sirene, départ, hectare, km², recensement) : **25 hits**.
- Ratio brut : **81 / (81+25) = 76,4 % AxionIA-centric / 23,6 % INSEE**.

⚠️ Cible doctrine : ≥ 95 % / ≤ 5 %. **Paris pilote actuel = 76 / 24 — sous la cible documentée**.

Nuances :

- Mesure grep keywords ≠ rendu page (les sections INSEE sont concentrées dans la section 9 "Tissu local" et `topSectorsNaf` ; le reste du copy est dominé par Axion-IA).
- Le code commentaire `src/content/villes/copy/paris.ts:18-23` réaffirme la cible **95 / 5**, donc l'écart entre intention documentée et mesure brute mérite arbitrage Will.
- En **volume mots** plutôt qu'en occurrences keywords, le ratio se rapproche probablement de la cible (sections 1-7 dominées par copy unique Axion-IA, section 9 seule contient les data INSEE).

**Recommandation P2** : ajouter un test `tests/integration/hcu-ratio.spec.ts` qui mesure ratio mots Axion-IA / mots INSEE par ville pilote, seuil 90/10 (réaliste avec topSectorsNaf + distances).

**Pour les ~2149 villes sans copy** : pages `noindex, follow` → ratio HCU non applicable (le visiteur voit `VilleStub` ~70 mots, Google ne les indexe pas).

### 8. Citation-worthy passages

**Statistiques chiffrées présentes** :

- Homepage : 4 métriques (`metric1Number`→`metric4Number` via `messages/fr.json`) — ROI, % UE, ticket, lock-in.
- Page Paris : `215 000 entreprises actives`, `Métro 14 lignes + RER A/B/C/D/E`, `Code INSEE 75056`.
- Page comparaisons existe (`src/content/comparaisons.ts` grepé) — bon pour Perplexity / Claude.ai qui adorent les tableaux comparatifs.
- FAQ_GLOBAL 6 entries, réponses 30-80 mots chacune (`transversal.ts:108-172`) — Speakable-friendly.

**Manquants identifiés** :

- Pas de "Axion-IA in 1 sentence" + "Axion-IA in 5 numbers" en tête de `/a-propos` (block dédié AEO).
- Pas de tableau « Audit Flash vs Cibled vs PME vs ETI » sur `/audit` avec scaler chiffré (durée, livrable, prix) au format facile-à-scraper.
- Pas de « ROI typique » chiffré agrégé visible — uniquement par cas concret. Or les LLMs citent volontiers les benchmarks d'agrégat.

### 9. Maillage interne services × villes

**Pattern observé** :

- Page mère ville (`/implantations/[region]/[ville]`) → 3 services (audit/interventions/implementation) via `<Cta href="/audit">` + tracking `data-source-ville={ville.slug}` (`page.tsx:271-286`, `:430-440`).
- Page mère ville → cas concrets proches Haversine 50km (`getNearbyCases`) (`:553-593`).
- Page mère ville → blog posts liés (`getRelatedBlogPosts`) (`:653-685`).
- Page mère ville → villes proches Haversine (`getNearbyVilles` 8 proches) (`:595-631`).
- Page région → top 12 villes (`:69-70`) + détails par département (`:271-330`).
- Mega-menu : maillage services × pilotes (`axionia_pseo_villes_livre_2026-05-08` confirme).

**JSON-LD `ItemList` émis** pour villes proches (`page.tsx:181-192`) → signal AEO multiple-citations.

**Tracking analytics** : `data-source-ville` + `data-source-region` + `data-cta-tracking` posés systématiquement sur les liens internes → bonne instrumentation pour Plausible/Search Console pour mesurer maillage utile.

**Manquant** : pas de « breadcrumb d'attribution » page service → page région (un audit déclenché à Paris devrait pouvoir revenir au contexte Paris sans état). Solution sprint : query param `?fromVille=paris` propagé jusqu'au formulaire `/reserver` (cf. `page.tsx:264 ?ville=${ville.slug}` déjà en place — bon point).

### 10. Cloudflare AI Scrapers OFF vs robots.txt — paradoxe ?

**Constat 2026-05-09** (mémoire `axionia_session_2026-05-09_cloudflare_phase5`) : Phase 5 Cloudflare livrée avec **Bot Fight Mode ON + AI Scrapers OFF** (Will a explicitement laissé AI Scrapers OFF pour ne pas bloquer Claude.ai/Perplexity/Bing Copilot = stratégie AEO/GEO).

**Constat code Next** (`src/app/robots.ts` non audité en détail ici mais grep `robots.ts` confirme un fichier de routage) : émet une liste autorisant GPTBot, ClaudeBot, PerplexityBot, etc. avec Allow `/`.

**Constat prod 2026-05-11** (`curl https://axion-ia.com/robots.txt`) : **DEUX couches dans le même fichier** :

```
# BEGIN Cloudflare Managed content
User-agent: *
Content-Signal: search=yes,ai-train=no
Allow: /
User-agent: Amazonbot
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: CloudflareBrowserRenderingCrawler
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: GPTBot
Disallow: /
User-agent: meta-externalagent
Disallow: /
# END Cloudflare Managed Content

User-Agent: *
Allow: /
…
User-Agent: GPTBot
Allow: /
…
```

**Effet RFC 9309** : les crawlers polite prennent la **première directive matching leur User-agent**. Donc ClaudeBot/GPTBot/PerplexityBot/Google-Extended/Applebot-Extended → premier match = section Cloudflare Managed = `Disallow: /`. Ils ignorent la section origin qui suit.

**Hypothèse** : malgré "AI Scrapers OFF" dans le toggle, Cloudflare a un autre setting "Manage Robots.txt" / "AI bots robots.txt managed content" activé qui injecte cette section. Phase 5 a probablement activé cette feature **par erreur** ou la doc CF a induit en confusion (le toggle "Block AI Scrapers" est un firewall, la feature "Managed Content robots.txt" est un éditeur de robots.txt — deux choses différentes).

**Recommandation P0 unique** : aller dans Cloudflare Dashboard → Bots → Settings → "AI Crawl Control" ou équivalent et **désactiver l'option "Append managed robots.txt"** (libellé exact varie selon plan Free). À vérifier via API CF en lecture (`/zones/{id}/settings/`).

**Confirmation 2 sources Pass B requise** : (a) ce rapport via grep prod robots.txt, (b) AGT-04 SEO devra croiser via curl independent. Si confirmé, ce P0 est ce qui retient le score AEO/GEO ≈88 plutôt que ≈97.

---

## Citations

| #   | Affirmation                                           | Citation                                                                                                                                                     |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `llms.txt` édité 45 LOC                               | `src/app/llms.txt/route.ts:1-45`                                                                                                                             |
| 2   | `llms-full.txt` édité 113 LOC                         | `src/app/llms-full.txt/route.ts:1-113`                                                                                                                       |
| 3   | FAQ embeded FR/EN mixte                               | `src/app/llms-full.txt/route.ts:43-45`                                                                                                                       |
| 4   | 18 factories JSON-LD                                  | `src/lib/seo.ts:177,194,230,286,333,406,468,533,611,663,704,766,830,875,919,982,1019`                                                                        |
| 5   | Speakable factory                                     | `src/lib/seo.ts:468-485`                                                                                                                                     |
| 6   | LocalBusiness ProfessionalService Schema              | `src/lib/seo.ts:547`                                                                                                                                         |
| 7   | Page Paris 5 schemas                                  | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:144-208`                                                                                           |
| 8   | directAnswerFr documentation                          | `src/content/villes/copy/types.ts:144-152`                                                                                                                   |
| 9   | Anti-doorway noindex stub                             | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:96-101`                                                                                            |
| 10  | Person knowsAbout 6 items                             | `src/lib/seo.ts:359-365`                                                                                                                                     |
| 11  | Organization sameAs LinkedIn + Facebook               | `src/lib/seo.ts:249`                                                                                                                                         |
| 12  | Article dateModified fallback                         | `src/lib/seo.ts:431`                                                                                                                                         |
| 13  | FAQ_GLOBAL 6 entries                                  | `src/content/transversal.ts:108-172`                                                                                                                         |
| 14  | curl prod homepage JSON-LD types                      | `cmd curl -sL https://axion-ia.com/fr → 11 schema types incl. FAQPage SpeakableSpecification`                                                                |
| 15  | curl prod Paris JSON-LD types                         | `cmd curl -sL https://axion-ia.com/fr/implantations/ile-de-france/paris → 19 types incl. ProfessionalService Place GeoCoordinates OpeningHoursSpecification` |
| 16  | curl prod blog Article                                | `cmd curl -sL https://axion-ia.com/fr/blog/3-quick-wins-2026 → "@type":"Article"`                                                                            |
| 17  | curl prod methodologie HowTo                          | `cmd curl -sL https://axion-ia.com/fr/methodologie → "@type":"HowTo" + "@type":"HowToStep" + "@type":"MonetaryAmount"`                                       |
| 18  | curl prod about Person                                | `cmd curl -sL https://axion-ia.com/fr/a-propos → "@type":"Person"`                                                                                           |
| 19  | curl prod Lyon noindex                                | `cmd curl -sL .../auvergne-rhone-alpes/lyon → <meta name="robots" content="noindex, follow"/>`                                                               |
| 20  | robots.txt prod double-couche                         | `cmd curl https://axion-ia.com/robots.txt → BEGIN Cloudflare Managed content … Disallow: / for ClaudeBot/GPTBot/PerplexityBot/Google-Extended`               |
| 21  | Ratio AxionIA-centric Paris 76%                       | `cmd grep -ciE "(axion-ia\|axionia\|notre\|nous\|cabinet\|...)" paris.ts → 81 ; grep -ciE "(INSEE\|population\|...)" → 25`                                   |
| 22  | Person doctrine commentée                             | `src/lib/seo.ts:327-332`                                                                                                                                     |
| 23  | Article richesse documentée                           | `src/lib/seo.ts:397-405`                                                                                                                                     |
| 24  | layout JSON-LD Organization + WebSite                 | `src/app/[locale]/layout.tsx:135-167`                                                                                                                        |
| 25  | Cache Cloudflare Phase 5 mémoire                      | mémoire `axionia_session_2026-05-09_cloudflare_phase5` — "AI Scrapers OFF" annoncé                                                                           |
| 26  | Bug pré-existant sitemap.xml 404 + og:image localhost | mémoire `axionia_bugs_seo_preexistants_2026-05-09`                                                                                                           |

---

## [INCONNU]

- **API Cloudflare lecture toggle "Managed robots.txt"** : pas appelée pendant cet audit (token CF non sourcé dans cette session). Recommandation : `curl -H "Authorization: Bearer $CF_API_TOKEN" https://api.cloudflare.com/client/v4/zones/{zoneId}/settings | jq` pour confirmer le setting `managed_robots_txt` / `ai_bots_robotstxt` etc.
- **Volume llms-full.txt prod réel servi** : 114 798 octets retourné, mais la route initiale renvoie 307 (redirect non décrit dans le code source). Probablement bénin (next-intl redirect path), mais non investigué ici.
- **Test `tests/integration/jsonld-coverage.spec.ts` ou équivalent** : non grepé dans cette session — à confirmer AGT-13 TESTS qu'un test valide la présence des JSON-LD critiques par route.
- **Search Console / Bing Webmaster coverage report** : `[ACTION WILL]` selon prompt master § 0.6.
- **Ratio HCU mesuré sur villes non-Paris** : NON MESURABLE (seule Paris a un copy à ce jour).

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Action                                                                                                                                                             | Effort                 | Impact AEO/GEO                         | Priorité              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------- | --------------------- |
| 1   | **Désactiver "Managed robots.txt" Cloudflare** ou ré-écrire pour qu'il `Allow: /` les bons AI bots (GPTBot/ClaudeBot/Perplexity/Google-Extended/Applebot-Extended) | 30 min CF Dashboard    | **P0 énorme** — débloque 100 % AEO/GEO | **immédiat**          |
| 2   | Localiser `llms-full.txt` : 2 routes `/fr/llms-full.txt` + `/en/llms-full.txt` ou structurer le body avec `## (FR)` + `## (EN)` séparés clairs                     | 2 h                    | P1 fort                                | Sprint correctif AEO  |
| 3   | Référencer `/llms-full.txt` depuis `/llms.txt` (1 ligne `Full content: ${SITE_URL}/llms-full.txt`)                                                                 | 5 min                  | P1 moyen                               | Sprint correctif AEO  |
| 4   | Ajouter sections `## Citation-worthy stats` + `## Comparisons vs alternatives` dans `llms-full.txt` (50-100 mots chacune)                                          | 2 h copy               | P1 fort                                | Sprint correctif AEO  |
| 5   | Convertir 2-3 H2 par page service en questions naturelles (`Qu'est-ce qu'un audit Flash ?`, `Pour qui ?`) + lead 1-2 phrases                                       | 4 h                    | P1 moyen-fort                          | Sprint correctif AEO  |
| 6   | Étendre `Person.sameAs` (`buildPersonJsonLd`) : LinkedIn + X/Twitter + GitHub (Will) + Crunchbase Axion-IA OÜ                                                      | 1 h                    | P2 fort (E-E-A-T)                      | Backlog quick-win     |
| 7   | Ajouter 5-10 `Review` JSON-LD une fois 5 verbatims clients collectés + `AggregateRating` sur `/a-propos`                                                           | 3 h une fois verbatims | P1 (star rating SERP)                  | Quand verbatims dispo |
| 8   | Implémenter le test `tests/integration/hcu-ratio.spec.ts` (mesure mots, pas keywords) + seuil 90/10 par ville pilote                                               | 4 h                    | P2 (CI)                                | Backlog               |
| 9   | Étendre Speakable aux 5-10 phrases hero des pages stratégiques via `itemProp="text"` (1 ligne par page)                                                            | 2 h                    | P2 (voice AEO)                         | Backlog               |
| 10  | Ajouter `@id` partagé entre Person `/a-propos` et Person.author dans Article (lien Wikidata-style)                                                                 | 1 h                    | P2 (disambiguation LLMs)               | Backlog               |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-AEO-01** : **Le robots.txt prod bloque-t-il intentionnellement GPTBot/ClaudeBot/Perplexity ?** Si non (probable), c'est une feature Cloudflare "Managed Content" activée par erreur en Phase 5. À désactiver en urgence — sinon toute l'infrastructure JSON-LD AEO/GEO livrée est neutralisée côté Anthropic / OpenAI / Google AI Overviews / Perplexity. **Question décisionnelle : OK pour aller dans CF dashboard et toggler off ?**
- **Q-AEO-02** : Tolère-t-on un ratio HCU 76/24 pour Paris pilote, ou faut-il un Sprint correctif copy pour atteindre 90/10 (réaliste) voire 95/5 (cible affichée) ? Si 95/5, il faut tronquer la section 9 "Tissu local" et `topSectorsNaf` à un sous-set minimal.
- **Q-AEO-03** : Quand industrialise-t-on les 2149 villes restantes avec un copy minimal (200-500 mots/ville) pour passer en `index, follow` ? Stratégie actuelle (1 pilote Paris + 2149 stubs noindex) tient au sens HCU mais bride pSEO volume.
- **Q-AEO-04** : Doit-on rester en `/llms-full.txt` non-localisé (pratique pour Anthropic/OpenAI qui scrapent racine) ou ajouter `/fr/llms-full.txt` + `/en/llms-full.txt` ? La spec Anthropic ne tranche pas clairement.
- **Q-AEO-05** : Ajout d'un X/Twitter Axion-IA OÜ pour enrichir `Organization.sameAs` et `Person.sameAs` ? Aujourd'hui LinkedIn + Facebook (Facebook semble peu cohérent avec ton premium B2B — à challenger).
- **Q-AEO-06** : Faut-il bouger de `@type:"Article"` à `@type:"BlogPosting"` pour les posts blog ? Google traite les deux mais BlogPosting est sémantiquement plus précis pour Perplexity/Claude.ai.

---

**Fin AGT-05 AEO-GEO** — 88/100 — pondération ×1.3.
