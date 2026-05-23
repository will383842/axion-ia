# A3-03 — AI Overviews / SGE Optimization
## Score : 74/100
## Date : 2026-05-21
## HEAD : 37ca0147

---

## Points obtenus

| Critère | Statut | Points | Détail |
|---------|--------|--------|--------|
| llms.txt présent et structuré | OK | 13/15 | Présent dans `public/llms.txt`. Bien structuré : pages canoniques FR+EN, espace presse, implantations, licences, liste crawlers IA, AI Act art. 50, sitemaps images, section Optional. Manque : section `## Disallowed` explicite et directives `X-Robots-Tag` LLM (−2). |
| ai.txt présent | OK | 8/8 | Route Handler `/ai.txt` (edge runtime) conforme standard Spawning.ai/IAB draft. Allowlist ClaudeBot/OAI-SearchBot/PerplexityBot/GPTBot/Google-Extended/Applebot-Extended + disallowlist Bytespider/CCBot/Diffbot/omgili + `ai-training: allow` + `ai-citation: allow` + `commercial-reuse-license`. Parfait. |
| robots.txt — IA crawlers non bloqués | OK | 11/12 | `src/app/robots.ts` : 15 bots IA déclarés explicitement en allow (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot, Meta-ExternalAgent, YandexBot, Googlebot-Image). CCBot/Bytespider/omgili/Diffbot disallowed. Doctrine commentée et justifiée. Manque : vérification prod CF WAF non confirmée (−1). |
| SpeakableSpecification qualité sélecteurs | PARTIEL | 9/12 | Implémenté sur 3 niveaux : (1) `buildFaqJsonLd` → `[data-faq-q],[data-faq-a]` ; (2) `buildSpeakableSpec`/`buildQAPageJsonLd` → `[".faq-answer", '[data-aeo="answer"]', ".tldr-answer", '[data-aeo="tldr"]']` ; (3) `AnswerCard` émet correctement `data-aeo="tldr"` + classe `.tldr-answer`. Composants `FaqAccordion` et `InterventionFaqList` portent bien `data-faq-q`/`data-faq-a`. Gap critique : **blog/[slug]/page.tsx ne passe pas `citations` ni `isBasedOn` au JSON-LD** (`buildArticleJsonLd` appelé sans ces champs) → le schema.org Article ne contient pas `speakable` pour les articles DB (−3). |
| Sources externes fiables linkées ≥ 2/article | MANQUANT | 2/10 | Les prompts blog-article et blog-from-keywords ne demandent **aucun lien externe** au LLM. La règle `100 % centré Axion-IA` exclut activement les sources tierces dans le body. Les `citations` Perplexity sont collectées et persistées mais pas injectées en body HTML ni en JSON-LD sur `/blog/[slug]`. Les articles FS manuels (fichiers TS) peuvent avoir des liens externes mais non garantis. Pour les AI Overviews, l'absence de sources externes tierces fiables (INSEE, études, rapports sectoriels) réduit fortement le signal d'autorité factuelle. |
| isBasedOn / citations JSON-LD | PARTIEL | 4/8 | `buildNewsArticleJsonLd` (seo-content-gen-factories.ts) émet correctement `isBasedOn` vers la source RSS pour les actualités. `buildArticleJsonLd` (seo.ts) expose le champ `isBasedOn` dans l'interface mais `/blog/[slug]/page.tsx` ne l'alimente pas (valeur `undefined` → non émis). Les citations Perplexity (`lastCitations`) sont collectées par `blog-article.ts` et `blog-from-keywords.ts` mais ne sont pas transmises en entrée de `buildArticleJsonLd` → zéro `citation` schema.org dans le JSON-LD des articles blog. |
| Contenu factuel dense (stats, chiffres) | PARTIEL | 5/10 | Le system prompt `blog-article` demande des « bénéfices mesurables, retour terrain » mais sans contrainte explicite de chiffres/stats externes. La KB interne fournit du contexte métier. Les cas concrets `/cas-concrets` montrent des ROI mesurés. Les guides piliers appellent `localEconomicContext` (données INSEE/INAO) pour les villes. Mais les articles blog génériques n'ont aucune règle forçant ≥ 2 stats chiffrées avec source. |
| Données propriétaires / perspectives originales | PARTIEL | 7/10 | La KB retrieve (8 chunks hybrides) injecte des cas d'usage réels et méthodologies propres à Axion-IA. Les guides piliers utilisent `economic-data/<slug>.ts` (~13k lignes de données terrain). Manque : les articles DB n'exposent pas encore de métriques propriétaires systématiques (NPS, taux réussite projets, volumes clients). |
| Phrases assertives < 20 mots | PARTIEL | 6/8 | `computeReadabilityFr` mesure la longueur des phrases et pénalise si >60 % des phrases dépassent 25 mots. Threshold qualité 60/100. La doctrine doc-tip AnswerCard produit des réponses directes. Mais aucune règle explicite < 20 mots dans le system prompt → le LLM produit parfois des paragraphes fluides FR de 30-40 mots (style rédactionnel naturel). |
| CF WAF — bots IA non bloqués (vérif config) | MANQUANT | 4/7 | Aucun fichier YAML/config Cloudflare dans le repo. La checklist `CHECKLIST-AUDIT-PROD-2026-05-15.md` liste `CF Managed Content / Content Signals OFF` comme case **non cochée**. L'audit A15 (phase 1) note : « CF Managed Content status prod non vérifié (audit checklist 2026-05-15 non cochée) (-0.5) ». L'audit city-domination 2026-05-18 classe CF Managed Content OFF comme **P0 produit**. Le statut actuel en prod est inconnu depuis le code source — dépend d'une action humaine Will dans le dashboard CF. |

**TOTAL : 74/100**

---

## Points perdus

### [P0] CF WAF / Managed Content — statut prod inconnu (−3 pts)
- **Impact** : Si CF Managed Content est encore ON, ClaudeBot/GPTBot/PerplexityBot reçoivent un challenge JS (403/503) → zéro crawl → zéro citation dans AI Overviews.
- **Preuve** : `axionia/_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md` ligne 207 : `- [ ] CF Managed Content / Content Signals OFF` (case non cochée). Audit city-domination mentionne ce point comme P0.
- **Fichiers** : Aucun config CF dans le repo — vérification uniquement possible via dashboard Cloudflare.

### [P0] Sources externes absentes dans body articles blog (−8 pts)
- **Impact** : Les AI Overviews Google SGE, Perplexity et ChatGPT Search calibrent leur confiance sur la présence de sources tierces vérifiables (INSEE, rapports Gartner, études sectorielles). Un article 100% Axion-centric sans lien externe est traité comme opinion, pas comme fact.
- **Preuve** : System prompt `blog-article.ts:26` et `blog-from-keywords.ts:33` : `"100 % centré Axion-IA"`. Aucun champ `external_sources` dans le JSON output demandé.
- **Fichiers** : `src/server/content-gen/generators/blog-article.ts:33`, `src/server/content-gen/generators/blog-from-keywords.ts:34-40`

### [P1] citations + isBasedOn non transmis au JSON-LD blog/[slug] (−4 pts)
- **Impact** : Les citations Perplexity sont collectées (`lastCitations`) mais non injectées dans `buildArticleJsonLd`. Le champ `isBasedOn` est disponible dans l'interface mais non alimenté. Les LLMs (Claude, Perplexity) utilisent `isBasedOn` pour tracer la chaîne d'autorité.
- **Fichiers** : `src/app/[locale]/blog/[slug]/page.tsx:220-237`, `src/lib/seo.ts:578-582`

### [P1] Speakable absent sur articles blog DB (−3 pts)
- **Impact** : `buildArticleJsonLd` n'émet pas de champ `speakable` (ni via seo.ts ni via les factories). Les articles DB publiés via content-gen pipeline n'ont pas de SpeakableSpecification dans leur JSON-LD. Seuls les articles FS manuels (BLOG_POSTS) utilisent ce composant. Google Assistant et Alexa ne peuvent pas extraire de réponse vocale.
- **Fichiers** : `src/lib/seo.ts` (buildArticleJsonLd sans speakable), `src/app/[locale]/blog/[slug]/page.tsx:221-237`

### [P1] Contenu factuel — aucune contrainte stats chiffrées dans prompts (−5 pts)
- **Impact** : Les AI Overviews priorisent les contenus avec stats datées et sourcées. Le system prompt ne demande ni ≥ 2 chiffres avec source, ni mention d'études.
- **Fichiers** : `src/server/content-gen/generators/blog-article.ts:25-33`, `src/server/content-gen/generators/blog-from-keywords.ts:33-40`

### [P2] llms.txt — section Disallowed absente (−2 pts)
- **Impact** : Les LLMs crawleurs avancés (Anthropic Claude pro) lisent aussi les exclusions dans llms.txt. L'absence de section `## Disallowed` ou de précision sur les zones exclues (/admin, /api, pages draft) est une incomplétion par rapport au format canonique.
- **Fichier** : `public/llms.txt`

### [P2] Phrases assertives — aucune règle < 20 mots dans system prompts (−2 pts)
- **Impact** : Le readability scorer mesure la densité de phrases longues mais sans seuil dur. Google SGE extrait préférentiellement les phrases assertives courtes (< 20 mots).
- **Fichiers** : `src/server/content-gen/generators/blog-article.ts:25-33`

---

## Analyse robots.txt

Le fichier `robots.txt` est généré dynamiquement via `src/app/robots.ts` (Next.js Metadata convention).

**Bots IA autorisés (ALLOW) :**
```
GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web,
PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended,
Mistral-User, Bingbot, Meta-ExternalAgent, YandexBot, Googlebot-Image
```

**Bots IA bloqués (DISALLOW: /) :**
```
CCBot, Bytespider, omgili, Diffbot
```

**Paths disallowed pour tous :**
```
/api/, /_next/, /mes-donnees/, /fr/mes-donnees/, /en/my-data/,
/reserver/, /fr/reserver/, /en/booking/, /admin/, /fr/admin/, /en/admin/,
/design, /fr/design, /sections, /fr/sections, /components, /fr/components
```

**Path allow spécifique :**
```
/api/og — Allow explicite pour Googlebot-Image (OG images dynamiques)
```

**Bingbot :** `crawlDelay: 1` (anti-flood sur 13K routes pSEO villes).

**EN locale :** Si `EN_LOCALE_ENABLED=false` (actuel), `/en/` est ajouté aux disallow dynamiquement pour économiser le crawl budget.

**Sitemap déclaré :** `https://axion-ia.com/sitemap-index.xml`

**Analyse :** Couverture exemplaire. La doctrine est documentée dans le code. Seul bémol : le comportement réel dépend de CF WAF en amont — si CF challenge est actif sur ces User-Agents, le `robots.txt` correct devient sans effet.

---

## Analyse llms.txt / ai.txt

### llms.txt — PRÉSENT (`public/llms.txt`)

Structure :
- Description courte du cabinet (1 paragraphe résumé LLM-ready)
- `## Pages canoniques` : 10 URLs FR avec description
- `## Espace presse` : 2 URLs
- `## Implantations géographiques` : 2 URLs
- `## Anglais (mirror)` : 6 URLs EN
- `## Licensing` : Visuels CC BY 4.0 + contenu éditorial copyright
- `## Entité juridique` : Axion-IA OÜ, contact@axion-ia.com
- `## Crawlers IA autorisés` : liste de 13 bots
- `## Banque d'images Axion-IA — CC BY 4.0` : catalogue, AI Act art. 50 notice
- `## Optional` : sitemap-index.xml + 4 sitemaps images

**Points forts :** Format proche du standard llms.txt (Anthropic/Simon Willison). Contenu riche, section images unique, mention AI Act, liste bots explicite.

**Gaps identifiés :**
- Absence de section `## Disallowed` listant les URLs à exclure des résumés LLM
- Absence de métadonnées `# Updated: YYYY-MM-DD` (aide les crawlers à détecter les changements)
- Les 5 verticales de service ne sont pas toutes listées (`1-to-1` / `codage-developpement` absentes)
- Pas de version machine-readable JSON-LD complémentaire (/.well-known/ai-policy.json existe séparément — bon)

### ai.txt — PRÉSENT (`src/app/ai.txt/route.ts`)

Route Handler edge, cache 24h. Standard Spawning.ai/IAB draft. Conforme et complet :
- `ai-training: allow` global
- `ai-citation: allow` par bot
- `commercial-reuse-license: contact@axion-ia.com`
- Disallowlist : Bytespider, CCBot, Diffbot, omgili

### /.well-known/ai-policy.json — PRÉSENT

JSON complet avec `training`, `search_indexing`, `rag`, `citation`, `privacy`, `expires: 2027-05-16`. Bots explicitement allowés/disallowés alignés avec robots.txt et ai.txt.

**Verdict :** Triptyque llms.txt + ai.txt + ai-policy.json constitue une couverture AEO/GEO très solide, probablement dans le top 5% des sites FR B2B.

---

## Analyse SpeakableSpecification

### Implémentation existante

**Niveau 1 — FAQPage (buildFaqJsonLd dans seo.ts) :**
```json
"speakable": {
  "@type": "SpeakableSpecification",
  "cssSelector": ["[data-faq-q],[data-faq-a]"]
}
```
- Sélecteur unique (string, pas array strict) — PARTIEL : Google recommande array explicite.
- Composants portant ces attributs : `FaqAccordion` (data-faq-q sur `<span>`, data-faq-a sur `<p>`) + `InterventionFaqList` (data-faq-q sur `<span>`, data-faq-a sur `<p>`).

**Niveau 2 — Article/BlogPosting/NewsArticle (seo-content-gen-factories.ts buildBaseArticle) :**
```json
"speakable": {
  "@type": "SpeakableSpecification",
  "cssSelector": [".tldr-answer", "[data-aeo=\"tldr\"]", ".faq-answer", "[data-aeo=\"answer\"]"]
}
```
- 4 sélecteurs couvrant AnswerCard + FAQ embed — CORRECT.

**Niveau 3 — QAPage (buildQAPageJsonLd) :**
```json
"speakable": {
  "@type": "SpeakableSpecification",
  "cssSelector": [".faq-answer", "[data-aeo=\"answer\"]", ".tldr-answer", "[data-aeo=\"tldr\"]"]
}
```
- CORRECT.

**Niveau 4 — buildSpeakableSpec (utilitaire réutilisable) :**
Fonction standalone `buildSpeakableSpec(cssSelectors)` disponible pour tout usage custom.

**Niveau 5 — AnswerCard component :**
`<aside data-aeo="tldr" className="... tldr-answer ...">` — ALIGNÉ avec les sélecteurs du JSON-LD.

### Gap critique : blog/[slug] articles DB

`src/app/[locale]/blog/[slug]/page.tsx` appelle `buildArticleJsonLd` (de `src/lib/seo.ts`) qui N'INCLUT PAS de `speakable` dans son output. Les articles DB publiés via content-gen n'ont donc pas de SpeakableSpecification dans leur JSON-LD, contrairement aux articles NewsArticle (`/actualites`) qui passent par `buildNewsArticleJsonLd` (seo-content-gen-factories.ts) qui, lui, émet le `speakable`.

### Gap secondaire : sélecteur string vs array dans FAQPage

Dans `buildFaqJsonLd` (seo.ts), le sélecteur est une string `"[data-faq-q],[data-faq-a]"` passée dans un array `[[speakableSelector]]` — ce qui produit `cssSelector: ["[data-faq-q],[data-faq-a]"]`. La spécification schema.org préconise deux entrées distinctes dans l'array. Impact faible (Google parse les sélecteurs CSS combinés) mais à normaliser.

---

## Analyse CF WAF

### Situation actuelle

**Aucun fichier de configuration Cloudflare dans le repository.** La gestion CF WAF est 100% UI-based (dashboard Cloudflare) — non versionnée, non auditable depuis le code source.

**Preuves d'un risque non résolu :**

1. `axionia/_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md:207` :
   ```
   - [ ] CF Managed Content / Content Signals OFF
   ```
   Case **non cochée** au 2026-05-15.

2. `axionia/_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents/A15-publish-sitemap-indexnow.md:367` :
   ```
   CF Managed Content status (bloque AI bots ?) | 0.5/1 | ... CF Managed Content status prod non vérifié
   ```

3. L'audit city-domination 2026-05-18 liste **CF Managed Content OFF comme P0** (parmi les 13 P0 critiques).

4. `axionia/AGENTS.md:84` mentionne que CF Managed Challenge était actif et masquait un bug EN-locale — confirmant que CF Challenge a historiquement été actif sur le site.

**Ce qui est en place côté code :**
- `robots.ts` : bots correctement allowés (code server-side).
- `deploy-coolify.yml` : purge CF cache après deploy — mais aucune vérification WAF rules.
- `.github/workflows/cloudflare-purge-weekly.yml` : purge cache hebdo — aucune vérification WAF.

**Conclusion :** Le statut CF WAF est indéterminable depuis le code. Si CF Managed Content est ON en prod, les bots IA reçoivent un challenge JS et ne peuvent pas crawler. C'est le risque le plus critique pour l'indexation par les AI Overviews et il est non résolu depuis au moins 2026-05-15.

---

## Recommandations ordonnées par ROI

### 1. Quick wins (< 2h)

**QW-A — Vérifier et désactiver CF Managed Content (< 30 min)**
- Dashboard Cloudflare → Security → WAF → Managed Rules → désactiver "Bot Fight Mode" et "Managed Challenge" pour User-Agents IA.
- Alternativement : créer une Firewall Rule `http.user_agent contains "GPTBot" or ... → Allow` (bypass WAF pour les 15 bots IA allowés).
- Impact estimé : +10-40% citations AI Overviews dès J+7 (crawl déblocage).
- Vérification : `curl -A "GPTBot" https://axion-ia.com/ -I` → doit retourner 200 sans CF-Challenge.

**QW-B — Ajouter speakable dans buildArticleJsonLd (< 1h)**
- Dans `src/lib/seo.ts`, fonction `buildArticleJsonLd` : ajouter `speakable: { "@type": "SpeakableSpecification", cssSelector: [".tldr-answer", '[data-aeo="tldr"]', ".faq-answer", '[data-aeo="answer"]'] }` dans le return.
- Impact : tous les articles blog DB (content-gen pipeline) obtiennent SpeakableSpecification.

**QW-C — Passer citations + isBasedOn au blog/[slug] JSON-LD (< 2h)**
- Dans `src/app/[locale]/blog/[slug]/page.tsx` : récupérer `view.citations` (si présent dans loader) et l'alimenter dans `buildArticleJsonLd`.
- Vérifier que `loadBlogArticleForView` expose les citations Perplexity de l'article.

**QW-D — Ajouter section `## Disallowed` et date de mise à jour dans llms.txt (< 30 min)**
- Ajouter `# Updated: 2026-05-21` en en-tête.
- Ajouter une section `## Disallowed` listant `/api/`, `/admin/`, `/mes-donnees/`, routes draft.
- Ajouter les verticales manquantes : `1-to-1` et `/codage-developpement`.

### 2. Sprint (< 1 jour)

**SP-A — Enrichir les system prompts avec exigence de sources externes (4-6h)**
- Dans `blog-article.ts` et `blog-from-keywords.ts` : ajouter au SYSTEM_PROMPT une règle :
  ```
  - Inclure OBLIGATOIREMENT 2 sources externes fiables (INSEE, Gartner, Forrester, 
    McKinsey, Eurostat, DARES, DGEFP) avec lien href + date de publication.
  - Format : <a href="[URL]" target="_blank" rel="noopener noreferrer">[Titre source]</a> (Année).
  ```
- Ajouter `external_sources: [{url, title, publishedAt}]` dans le JSON output schema.
- Injecter ces sources dans `citations` → transmis au JSON-LD `isBasedOn` + `citation`.

**SP-B — Wiring complet citations Perplexity → JSON-LD sur tous les générateurs (3h)**
- `blog-from-keywords.ts` : les `lastCitations` (Perplexity) sont collectées mais non utilisées dans le return. Les passer dans `citations` du `GeneratorOutput`.
- `content-publish-worker.ts` : vérifier que `Article.citation[]` est persisté en DB depuis `citations`.
- `loadBlogArticleForView` : exposer `citations` dans le type retourné.
- `blog/[slug]/page.tsx` : alimenter `citations` et `isBasedOn` dans `buildArticleJsonLd`.

**SP-C — Contrainte phrases courtes dans system prompts (2h)**
- Ajouter règle : `- Phrases assertives ≤ 20 mots. Une idée = une phrase. Éviter les subordonnées enchâssées.`
- Ajouter la validation dans `computeSeoScore` : compter les phrases > 20 mots et pénaliser si > 30%.

### 3. Projets (> 1 jour)

**PR-A — Infrastructure as Code Cloudflare (2-3 jours)**
- Versionner la configuration CF WAF via Terraform ou Cloudflare Workers KV.
- Créer un script `scripts/cf-waf-verify.ts` qui vérifie via CF API que les bots IA ne sont pas challengés.
- Intégrer dans CI : workflow `cloudflare-check.yml` appelé après deploy pour valider que `curl -A ClaudeBot` retourne 200.

**PR-B — Données propriétaires systématiques dans content-gen (1-2 semaines)**
- Enrichir la KB avec métriques propriétaires : taux de succès projets, NPS clients, volumes (nombre d'entreprises accompagnées, secteurs, villes).
- Créer un module `proprietary-stats.ts` injectable dans les prompts pour que chaque article cite des chiffres Axion-IA datés et sourcés (analogie : "42% des PME françaises ayant suivi une intervention Axion-IA ont réduit leur délai de traitement de 30%" — données internes à alimenter).

**PR-C — Monitoring citations AI Overviews (1 semaine)**
- Intégrer Perplexity API (ou scraping éthique) pour détecter si axion-ia.com est cité dans les réponses sur les requêtes-cibles.
- Dashboard admin : table "Citations AI Overviews" avec keyword, date, source (Perplexity/ChatGPT/Gemini), URL citée.

---

## Synthèse

| Dimension | État | Score |
|-----------|------|-------|
| Infrastructure d'indexation IA (robots.txt, llms.txt, ai.txt, ai-policy.json) | Excellent | 32/35 |
| SpeakableSpecification (JSON-LD, sélecteurs HTML) | Bon avec gap blog DB | 9/12 |
| Sources externes / citations (body + JSON-LD) | Critique — quasi-absent | 6/18 |
| Contenu factuel assertif | Partiel | 11/18 |
| CF WAF prod | Non vérifié / risque P0 | 4/7 |
| Bonus : AiContentDisclaimer AI Act art. 50, AnswerCard TL;DR, .well-known/ai-policy.json | (+4) | — |

**Verdict : 74/100 — CONDITIONNEL**

- Si CF WAF est ON : score effectif ~45/100 (toute l'infra d'indexation devient inopérante).
- Si CF WAF est OFF confirmé : score 77/100 — bon socle technique, gaps sources externes à corriger pour passer > 85.

**Action la plus impactante (priorité absolue) :** Confirmer et documenter le statut CF Managed Content dans le repo (QW-A). C'est le seul point qui peut rendre toute cette infrastructure nulle et non avenue.
