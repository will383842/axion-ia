# 🌐 PROMPT SEO + AEO + GEO 2026 — Axion-IA · Audit perfection extrême

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** : HEAD a déjà 19 factories JSON-LD (5 nouvelles depuis V1) + sitemap-index Next 16 (cf. Sprint 14.8). Recalibrer les attentes en conséquence.
>
> **Version 1.0 · 2026-05-07** · audit laser-focalisé 3 disciplines distinctes
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> Sortie : `_AUDIT/AUDIT-SEO-AEO-GEO-2026.md` + 3 annexes (SEO/AEO/GEO) + `seo-aeo-geo-deltas.json`.
> Durée estimée : 90-120 min (4 agents parallèles + agent principal + vérifications externes).
> À lancer **après** `PROMPT-FRONTEND-AUDIT-V14-2026.md` (qui couvre SEO/AEO/GEO en survol Partie C). Ce prompt approfondit jusqu'à la perfection 2026.

---

## 🎯 SCOPE & POSTURE

**Cible** : pousser SEO + AEO + GEO d'Axion-IA au niveau **« cabinet IA premium B2B citable comme référence »** par les moteurs LLM en 2026 (Perplexity, ChatGPT search, Claude, Google AI Overview/AI Mode, Mistral Le Chat, Bing Copilot, You.com, Brave Summarizer).

**3 disciplines distinctes** (souvent confondues) :

| Discipline                               | Cible                                                                                                            | Mesure de succès                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **SEO** classique                        | Moteurs traditionnels (Google, Bing)                                                                             | Position SERP, CTR, CWV, Lighthouse SEO ≥ 95                                      |
| **AEO** (Answer Engine Optimization)     | LLMs avec citation de la source (Perplexity, Claude, Bing Copilot)                                               | Taux de citation sur 10 questions cibles × 5 LLMs = 50 tests                      |
| **GEO** (Generative Engine Optimization) | Modèles génératifs (ChatGPT, Gemini, Mistral) qui répondent **sans** citer la source mais ont absorbé le contenu | Présence détectée via brand mentions, knowledge panel, autorité E-E-A-T mesurable |

**Posture** : auditeur senior SEO/AEO/GEO, doctrine 2026 (post-évolutions Google AIO/AI Mode + Anthropic Sonar + OpenAI search). Lecture seule strict + tests externes via WebFetch quand pertinent.

---

## 📚 SOURCES DE VÉRITÉ

### Code & contenu

1. `axionia/src/app/sitemap.ts` — sitemap dynamique 25 pathnames × 2 langues + slugs.
2. `axionia/src/app/robots.ts` — règles crawlers + IA bot policy.
3. `axionia/src/app/llms.txt/route.ts` — manifeste LLM.
4. `axionia/src/app/llms-full.txt/route.ts` — version étendue.
5. `axionia/src/lib/seo.ts` — helpers metadata + canonical + alternates.
6. `axionia/src/components/marketing/JsonLd.tsx` — helper JSON-LD.
7. `axionia/src/app/[locale]/**/*.tsx` — toutes pages avec leur `generateMetadata`.
8. `axionia/src/app/api/og/route.tsx` — OG dynamique.
9. `axionia/src/messages/fr.json` + `en.json` — copy SEO (titles, descriptions, alts, blocs réponse directe).
10. `axionia/src/content/*.ts` — fixtures éditoriales (interventions, audit, implementation, transversal, legal, case-studies, comparaisons, automatisations, stack-ia, press, blog).

### Standards 2026

11. **Google Search Essentials 2026** + E-E-A-T guidelines (mise à jour Q1 2026 si applicable).
12. **Schema.org 27.0+** (vocabulaire complet).
13. **W3C Hreflang spec** + RFC 4646.
14. **OpenSearch 1.1** (descriptor pour search box dans résultats Google).
15. **llms.txt v0.1** (proposed standard, anthropic+others).
16. **IndexNow protocol** (Bing/Yandex/Seznam).
17. **Activity Streams 2.0** (Mastodon/Fediverse découvrabilité).
18. **WebSub** (PubSubHubbub, propagation push articles).

### Doctrine projet

19. `_AUDIT/02b-mapping-pages.md` — 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) avec leurs metadata attendues.
20. Skills `axionia-seo-aeo` (LOCKé) — règles internes du projet.
21. `axionia-package/docs/_DECISIONS-FINALES.md` — décisions stack.

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. STOP & ASK uniquement à la fin.
2. **Lecture seule** — aucune modif code. Outils : `git`, `pnpm` (lint/test/build/start), `WebFetch` (validators externes), `grep`, lecture fichiers.
3. **WebFetch autorisé** pour validators externes : Schema.org Validator API, Google Rich Results Test, Bing Webmaster Tools Markup Validator, W3C Validator, securityheaders.com, Mozilla Observatory, Lighthouse via PageSpeed Insights API.
4. **Tests LLMs externes** : pour le citability test, l'agent peut faire WebFetch vers Perplexity public ou autres APIs publiques. Si pas accessible : documenter checklist + fournir prompts exacts à exécuter manuellement par Will.
5. **Citations obligatoires** : `file_path:line_number` + URL externe + commande de reproduction.
6. **Priorisation** : P0 (bloquant SEO/AEO/GEO) · P1 (majeur) · P2 (mineur) · P3 (cosmétique).

---

## 🤖 DISPATCH MULTI-AGENTS (4 agents en parallèle)

| Agent               | Subagent        | Mission                                                                                                                                                                                          |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AGT-SEO-TECH**    | Explore         | SEO technique : sitemap + robots + canonical + hreflang + JSON-LD + OG + Twitter cards + semantic HTML + internal linking + URL structure + redirects                                            |
| **AGT-SEO-CONTENT** | general-purpose | SEO contenu : titles + descriptions + headings + body + alt images + anchor texts + keyword density + topic clustering + pillar pages + cannibalization audit                                    |
| **AGT-AEO**         | general-purpose | AEO : llms.txt + llms-full.txt + blocs direct-answer + FAQPage schema + Q&A pairs + speakable + featured snippet + people-also-ask + citability test 5 LLMs × 10 questions                       |
| **AGT-GEO**         | general-purpose | GEO : E-E-A-T scorecard + brand mentions + co-citation + entity disambiguation + Wikidata/Wikipedia presence + AI bot policy + training-dataset markup + knowledge panel hints + NAP consistency |

L'agent principal pendant ce temps : chapitres « Métriques mesurables » + « Recommandations actionnables » + agrégation finale.

---

# 📐 PARTIE 1 — SEO 2026 perfection (AGT-SEO-TECH + AGT-SEO-CONTENT)

## 1.A — SEO technique

### 1.A.1 · Sitemap multilingue

- `sitemap.xml` valide W3C (`xmllint --noout`).
- Chaque entry a `<xhtml:link rel="alternate" hreflang="fr" href="...">`, `hreflang="en"`, **`hreflang="x-default"`**.
- Pas plus de 50 000 URLs / 50 MB par fichier (sinon sitemap index requis).
- Pages produit ≥ priorité 0.8, légales ≤ 0.3.
- `lastmod` synchronisé avec dernière modification réelle (pas date arbitraire).
- Sitemap soumis Google Search Console + Bing Webmaster + IndexNow ping post-build.
- **Sitemap d'images** séparé si > 100 images uniques.
- **Sitemap de news** si articles publiés < 48h (Google News).
- **Sitemap vidéo** si vidéos hébergées (probable Phase 2).

### 1.A.2 · Robots.txt

- Allow par défaut.
- Disallow actuel HEAD (`src/app/robots.ts`) : `/api/`, `/_next/`, `/design`, `/components`, `/sections` (variantes `/fr/` + `/en/`). Auditer la pertinence d'ajouter `/admin*` quand l'admin existera (Sprint 20). `Allow:` explicite à prévoir pour `/api/og`, `/api/indexnow`, `/api/vitals` si on durcit la règle `/api/`.
- `Sitemap:` directive pointe vers `${SITE_URL}/sitemap.xml` (sitemap-index Next.js 16, cf. `generateSitemaps` → 6 sous-sitemaps `pages|blog|help|cas-concrets|comparaisons|implementation`).
- **AI bot policy** explicite (cf. § GEO 3.D) : `GPTBot`, `ClaudeBot`, `CCBot`, `PerplexityBot`, `Mistral-User`, `Anthropic-AI`, `Google-Extended`, `Applebot-Extended`, `Bytespider`, `Diffbot`, `omgili` — décision Will (allow par défaut pour visibilité, sauf si décision contraire).
- `Crawl-delay` raisonnable (2-5s pour bots lourds).

### 1.A.3 · Canonical & alternates

- `<link rel="canonical">` **absolu HTTPS** sur **chaque** page (pas relatif).
- `<link rel="alternate" hreflang="fr|en|x-default">` cohérent avec sitemap.
- **Self-referencing canonical** sur pages dupliquées (ex: `?utm_source` strippé).
- `<link rel="prev"/"next">` sur pagination si applicable.
- 0 chaîne de redirect > 1 hop (`curl -IL` test).

### 1.A.4 · JSON-LD exhaustif

Pour chaque type de page, types attendus :

| Page                                                | Schema.org types                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Home                                                | `Organization` + `WebSite` + `BreadcrumbList` (vide ou caché)                    |
| Module listing (interventions/audit/implementation) | `CollectionPage` + `ItemList` + `BreadcrumbList`                                 |
| Page produit (ex: essentielle 490€)                 | `Service` + `Offer` + `BreadcrumbList` + `FAQPage` (FAQ inline)                  |
| Cas concret                                         | `Article` + `Person` (auteur) + `Review` + `aggregateRating` (si rating)         |
| Article blog                                        | `Article` + `Author` (`Person`) + `Publisher` + `BreadcrumbList`                 |
| FAQ index `/faq`                                    | `FAQPage` + `Question` + `Answer` + `BreadcrumbList`                             |
| FAQ détail `/faq/[slug]`                            | `QAPage` + `Question` + `Answer` + `BreadcrumbList` (canonique citation LLM)     |
| Help détail `/centre-aide/[slug]`                   | `Article` + `BreadcrumbList`                                                     |
| Help index `/centre-aide`                           | `ItemList` + `BreadcrumbList`                                                    |
| Help catégorie `/centre-aide/categorie/[slug]`      | `CollectionPage` + `BreadcrumbList`                                              |
| Légales                                             | `WebPage` simple                                                                 |
| Contact                                             | `ContactPage` + `ContactPoint`                                                   |
| À propos                                            | `AboutPage` + `Organization` enrichi                                             |
| Témoignages                                         | `Person` (témoignant) + `Review`                                                 |
| Comparaisons                                        | `Article` + tables structurées                                                   |
| Glossaire                                           | `DefinedTermSet` + `DefinedTerm`                                                 |
| **Presse** (si ajoutée)                             | `Organization.subOrganization`/`ContactPoint(presse)` + `NewsArticle` (releases) |

- Validés via **Schema.org Validator API** (WebFetch).
- Validés via **Google Rich Results Test** (WebFetch).
- `@id` URLs cohérentes pour graph linking inter-schémas.
- `inLanguage` correct (`fr-FR`, `en-US`).
- `sameAs` Organization pointe vers : LinkedIn, YouTube, GitHub si applicable, Crunchbase, e-Business Register estonien (registrikood URL), Wikidata si éligible.

### 1.A.5 · OG + Twitter + autres

- OG images **dynamiques 1200×630** sur les 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) (`/api/og?...`).
- `og:type` : `website` home, `article` blog/cas, `product` pages produit (extension Open Graph).
- `og:locale` + `og:locale:alternate`.
- `og:site_name` constant.
- Twitter `summary_large_image` partout.
- **LinkedIn** spécifique `<meta property="og:type" content="company">` sur À propos.
- **Pinterest Rich Pins** si pertinent (Phase 2).

### 1.A.6 · Headers & Performance SEO

- HTTP/3 activé (vérifier en prod, `curl --http3`).
- Compression Brotli 11 ou Zstd dynamique.
- 103 Early Hints sur pages stables.
- **Core Web Vitals** seuils Google 2026 :
  - LCP ≤ 2.5s (good), ≤ 4s (needs improvement), > 4s (poor).
  - INP ≤ 200ms (good), ≤ 500ms (NI), > 500ms (poor).
  - CLS ≤ 0.1 (good), ≤ 0.25 (NI), > 0.25 (poor).
- **Mobile-Friendly** : test Google Search Console.
- HTTPS partout (HSTS 1 an + preload).
- 0 mixed content.

### 1.A.7 · Internal linking

- **Pillar pages** identifiées : `/interventions`, `/audit`, `/implementation`, `/cas-concrets`, `/blog`, `/centre-aide`, `/a-propos`.
- Chaque pillar a ≥ 5-10 sub-pages liées sémantiquement.
- Internal links density : ≥ 3 liens contextuels par page éditoriale (blog/cas/help).
- **Anchor texts** descriptifs (jamais « cliquez ici », « en savoir plus » seul).
- **Hub & spoke pattern** : pillars relient sub-pages, sub-pages relient back to pillar + cross-links 2-3 vers autres sub-pages.
- **TF-IDF** : pages produit ne se cannibalisent pas (audit `screaming-frog` ou équivalent — à exécuter manuellement post-deploy).
- **Orphan pages** : 0 (chaque page atteignable en ≤ 3 clics depuis home).

### 1.A.8 · URL structure

- **kebab-case** partout (jamais `_` ou camelCase).
- Pathnames traduits cohérents : FR canon, EN miroir typé via next-intl `pathnames`.
- Pas de paramètres tracking dans canonical (UTM strippé).
- Profondeur ≤ 4 (ex: `/blog/categorie/intelligence-artificielle/article-slug` = profondeur 3, OK).

## 1.B — SEO contenu

### 1.B.1 · Titles & descriptions

- `<title>` 50-60 chars, mot-clé principal en première position.
- `<meta description>` 140-160 chars, value-proposition + CTA implicite.
- Unicité 100 % (aucun duplicate `<title>` ni description sur les 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)).
- FR/EN traduits sémantiquement (pas mot-à-mot).

### 1.B.2 · Headings

- **Un seul `<h1>`** par page, mot-clé principal + différenciateur.
- Hiérarchie h1→h6 cohérente, pas de saut (pas h1 → h3).
- 5-15 `<h2>` par pillar page, 3-8 sur pages produit.

### 1.B.3 · Body content

- Pillar pages ≥ 1500 mots.
- Pages produit 800-1500 mots.
- Articles blog 1200-2500 mots.
- FAQ entries 80-200 mots par réponse.
- **Densité mot-clé principal** 1-2 % (pas plus = stuffing).
- **Mots-clés sémantiques** (LSI) : tableau des termes co-occurrents attendus pour chaque pillar.
- **Lisibilité** : Flesch FR/EN ≥ 60 (lisible).
- **Listes & tableaux** : présents pour scannabilité (Googlebot adore).

### 1.B.4 · Images

- **Alt** descriptif sur chaque image (jamais vide sauf décoratif `alt=""`).
- Filename SEO-friendly (ex: `cabinet-ia-tallinn-equipe.avif` pas `IMG_2398.avif`).
- AVIF + WebP fallback + lazy loading (sauf LCP).
- `width`/`height` explicites pour éviter CLS.
- Compression : ≤ 200 KB par image hero, ≤ 100 KB body.

### 1.B.5 · Topic clustering & cannibalization

- **Topic clusters** identifiés (intervention IA, audit IA, implémentation IA, cas concrets, ROI IA, formation IA en intent uniquement).
- Aucune page ne cible le même mot-clé qu'une autre (cannibalization audit grep + manuel).
- Si ambiguïté → consolider via canonical ou supprimer.

### 1.B.6 · Featured snippets & PAA

- **Direct-answer blocks** 40-80 mots en haut de chaque page produit/blog/FAQ (cf. § AEO).
- Format question-réponse explicite citable.
- Réponses courtes scannables (listes, étapes numérotées, tableaux).

---

# 🤖 PARTIE 2 — AEO 2026 perfection (AGT-AEO)

## 2.A — Manifestes LLM

### 2.A.1 · llms.txt

- Présent racine site (`/llms.txt`).
- Format markdown avec sections `# Axion-IA`, `> tagline`, links pillar pages.
- Validé contre proposed standard llms.txt v0.1 (anthropic+others).
- ≤ 500 lignes.

### 2.A.2 · llms-full.txt

- Version étendue avec contenu complet pillar pages concaténé.
- Mise à jour automatique build-time.
- ≤ 5 MB (sinon split par section).
- `<!-- AEO-CITABLE -->` markers autour blocs prioritaires pour LLMs.

### 2.A.3 · IndexNow

- Ping automatique post-build vers Bing/Yandex/Seznam (clé API en env).
- Test manuel : modification page → ping → vérification dashboard Bing 24h.

### 2.A.4 · RSS feeds

- HEAD : `/blog/feed.xml`, `/cas-concrets/feed.xml`, `/faq/feed.xml` (3 feeds). `/presse/feed.xml` à ajouter quand la page presse passera de listing simple à listing communiqués (Sprint 14.6+).
- Le feed `/faq/feed.xml` est déjà découvrable via `<link rel="alternate">` dans le `<head>` de `/faq` — confirmer le même pattern sur `/blog` et `/cas-concrets`.
- Validés W3C Feed Validator.
- Format Atom alternatif pour anciens agrégateurs.
- `<atom:link rel="self">` correct.

### 2.A.5 · JSON Feed (alternatif)

- `/blog/feed.json` JSON Feed 1.1 valide.

## 2.B — Structured data pour LLMs

### 2.B.1 · FAQPage exhaustif

- Page `/faq` + FAQ inline pages produit + FAQ blog si applicable.
- `Question` + `acceptedAnswer` (`Answer`) + `dateCreated` + `author` (Organization).
- `inLanguage` cohérent.
- Au moins 5 questions par FAQ.

### 2.B.2 · Q&A pairs sur pages éditoriales

- Sections `<h2>` formulées en question (« Comment fonctionne un audit IA ? »).
- Réponse directe en 1-3 paragraphes courts.
- `itemscope itemtype="https://schema.org/Question"` + `<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">` (microdata + JSON-LD double signal).

### 2.B.3 · Speakable

- `<meta name="speakable-css-selector" content=".aeo-direct-answer">` ou JSON-LD `speakable.cssSelector`.
- Sections speakable identifiées sur chaque page produit (40-80 mots, citable voice).

### 2.B.4 · DefinedTermSet (glossaire)

- `/glossaire` avec `DefinedTermSet` racine + `DefinedTerm` par entrée.
- Cross-linked depuis pages éditoriales (liens contextuels « → définition »).

## 2.C — Direct-answer blocks (le cœur AEO)

### 2.C.1 · Format obligatoire

```html
<div class="aeo-direct-answer" itemscope itemtype="https://schema.org/Answer">
  <h2 itemprop="text">Qu'est-ce qu'un cabinet IA opérationnel ?</h2>
  <p>
    Un cabinet IA opérationnel est une structure de conseil spécialisée dans l'intervention sur site
    auprès d'entreprises pour identifier, démontrer et déployer des cas d'usage d'intelligence
    artificielle à ROI mesurable sous 90 jours. Axion-IA est un cabinet IA opérationnel basé à
    Tallinn (OÜ estonienne), intervenant en français et en anglais auprès de PME et ETI.
  </p>
</div>
```

- 40-80 mots strict.
- Réponse factuelle citable telle quelle par un LLM.
- Mot-clé principal en début.
- Différenciateur clair (« OÜ estonienne », « ROI 90 jours », « PME/ETI »).
- Présent en haut de chaque page produit/blog/cas/FAQ/help.

### 2.C.2 · Density

- ≥ 1 bloc direct-answer par page éditoriale.
- ≥ 3 Q&A pairs supplémentaires en milieu de page (h2 questions + paragraphes courts).
- Pages produit : 1 direct-answer hero + 1 par sub-section (livrables, prix, déroulé, FAQ).

## 2.D — Citability test 2026 (50 tests)

### 2.D.1 · Questions cibles (10)

1. « cabinet IA premium France »
2. « cabinet IA opérationnel PME ETI »
3. « audit IA entreprise méthodologie »
4. « intervention IA sur site journée »
5. « formation IA équipes » (intent uniquement, mot banni en copy)
6. « implémentation chatbot IA RAG entreprise »
7. « cabinet IA OÜ estonienne TVA EE »
8. « ROI projet IA 90 jours mesurable »
9. « simulateur ROI intelligence artificielle gratuit »
10. « Axion-IA avis cabinet IA »

### 2.D.2 · 5 moteurs LLM 2026

- **Perplexity** (Pro + free) — interface web
- **ChatGPT search** (GPT-4o + GPT-5) — toggles « Search the web »
- **Claude** (claude.ai avec web search activée + via Brave Search API)
- **Google AI Overview** (`google.com/?udm=14` AI Mode + AIO classique)
- **Mistral Le Chat** (Pro avec web search)
- _(bonus si temps : Bing Copilot, You.com, Brave Search Summarizer, Kagi Assistant)_

### 2.D.3 · Tableau de citation

| Question                  | Perplexity                       | ChatGPT     | Claude               | Google AIO        | Mistral | Score |
| ------------------------- | -------------------------------- | ----------- | -------------------- | ----------------- | ------- | ----- |
| cabinet IA premium France | ✅ cité ligne 3, snippet « ... » | ❌ pas cité | ⚠️ mention sans lien | ✅ AIO position 2 | ❌      | 2/5   |
| ...                       |                                  |             |                      |                   |         |       |

- **Score baseline** : taux de citation moyen × qualité du snippet.
- Comparer avec Pass B post-Sprint 23 pour mesurer progression.
- Si AGT-AEO ne peut pas accéder aux moteurs LLM (login required, captcha), documenter checklist + prompts exacts à exécuter manuellement par Will.

### 2.D.4 · Optimisation post-test

- Si Axion-IA non cité sur question N → identifier la page qui devrait être cible → renforcer direct-answer block + mots-clés sémantiques + entity signals.
- Si cité mais snippet mauvais → réécrire le direct-answer pour qu'il soit le snippet idéal.

---

# 🏛️ PARTIE 3 — GEO 2026 perfection (AGT-GEO)

## 3.A — E-E-A-T (Experience, Expertise, Authoritativeness, Trust)

### 3.A.1 · Experience signals

- **First-hand experience** documenté : cas concrets avec méthodologie réelle, pas génériques.
- **Photos terrain** (intervenants en mission, équipe sur site) — pas stock photos.
- **Dates de mission** explicites dans cas concrets.
- **Chiffres réels** (ROI mesuré, KPIs avant/après) avec sourcing.

### 3.A.2 · Expertise signals

- **Author bylines** sur chaque article blog : `Person` schema avec `jobTitle`, `worksFor`, `sameAs` LinkedIn pro, `knowsAbout` (compétences).
- **Bio expert** sur À propos avec credentials, années d'expérience, références.
- **Person.alumniOf** si formations/diplômes pertinents.
- **Publications externes** (conférences, articles invités) listées avec liens.

### 3.A.3 · Authoritativeness signals

- **Mentions médias** (page presse, cf. § Page presse).
- **Citations externes** (autres sites qui linkent vers Axion-IA — backlinks de qualité).
- **Interventions publiques** (podcasts, conférences) listées.
- **Reconnaissance pro** (awards, certifications, partenariats officiels).

### 3.A.4 · Trustworthiness signals

- **Mentions OÜ estonienne** + registrikood + adresse Tallinn complète sur footer + mentions légales.
- **DPO joignable** : email RGPD documenté.
- **CGV/CGU/Politique confidentialité/Cookies/RGPD** complètes (6 légales livrées Sprint 10).
- **Témoignages authentiques** : photos + role + company réels (jamais Lorem Ipsum, jamais stock).
- **HTTPS partout** + headers A+ securityheaders.com + ssllabs A+.
- **Avis clients** vérifiables (lien Trustpilot/Google My Business si applicable).
- **Transparence pricing** : 490€ Essentielle affiché, autres prix dans audit/implémentation, devis pour custom.

### 3.A.5 · E-E-A-T scorecard

| Signal                               | Présence | Qualité | Page exemple | Action |
| ------------------------------------ | -------- | ------- | ------------ | ------ |
| Author bylines                       | ✅/❌    | A/B/C   | `/blog/...`  | ...    |
| Last-modified dates                  |          |         |              |        |
| Trust signals (OÜ/RGPD/HTTPS)        |          |         |              |        |
| Brand consistency (« Axion-IA »)     |          |         |              |        |
| Entity disambiguation (registrikood) |          |         |              |        |
| First-hand experience (cas concrets) |          |         |              |        |
| Bio expert (À propos)                |          |         |              |        |
| Mentions médias (page presse)        |          |         |              |        |
| Témoignages authentiques             |          |         |              |        |
| Pillar pages structure               |          |         |              |        |
| Internal linking density             |          |         |              |        |

## 3.B — Brand mentions & consistency

### 3.B.1 · Brand consistency strict

- **« Axion-IA »** écrit identiquement partout : copy, alt, meta, structured data, code commits.
- Anti-patterns : `Axion IA` (avec espace), `Axionia` (capitalisation), `Axion-IA` (tiret), `axion-ia` (lowercase) — sauf URL (`axion-ia.com` accepté).
- Grep CI : `pnpm brand:check` (script à ajouter si pas déjà fait).
- 100 % occurrences vérifiées.

### 3.B.2 · NAP consistency (Name, Address, Phone)

- **Nom** : Axion-IA OÜ.
- **Adresse** : adresse complète Tallinn identique partout (footer, contact, mentions légales, structured data, Google My Business si créé).
- **Téléphone** : format E.164 international identique partout.
- **Email** : `contact@axion-ia.com` cohérent.
- **VAT** : numéro TVA EE cohérent.

### 3.B.3 · Co-citation entities

- Pages mentionnent l'écosystème pertinent : Hetzner (hébergement UE), Cloudflare (CDN), OÜ Estonia (juridiction), e-Residency (programme officiel).
- Renforcement autorité par association.
- LinkedIn `Organization.sameAs` + autres profils officiels.

## 3.C — Entity disambiguation

### 3.C.1 · Identifier officiel

- `Organization.identifier` avec **registrikood estonien** (numéro registre commerce).
- `Organization.taxID` avec numéro TVA EE.
- `Organization.iso6523Code` si applicable (EU compliance).

### 3.C.2 · Knowledge panel hints

- `Organization.sameAs` complet : LinkedIn, YouTube, GitHub si applicable, Crunchbase profile, Bloomberg si listé, e-Business Register URL.
- `Organization.logo` ImageObject avec dimensions.
- `Organization.contactPoint` ContactPoint complet (téléphone, email, languages, contactType `customer service`).
- `Organization.address` PostalAddress complet (streetAddress, addressLocality `Tallinn`, postalCode, addressCountry `EE`).
- `Organization.foundingDate`, `Organization.founder`, `Organization.numberOfEmployees`.

### 3.C.3 · Wikidata / Wikipedia presence

- **Wikidata** : créer entrée `Axion-IA` avec :
  - P31 (instance of) : Q4830453 (business)
  - P17 (country) : Q191 (Estonia)
  - P159 (headquarters location) : Q1770 (Tallinn)
  - P856 (official website) : `https://axion-ia.com`
  - P1448 (official name) : `Axion-IA OÜ`
  - P1320 (registrikood) : numéro
  - P1454 (legal form) : Q1062671 (osaühing)
- **Wikipedia** : différer (notabilité requise = mentions médias indépendantes ≥ 3, voir GEO 3.A.3 → page presse).

## 3.D — AI bot policy (robots.txt)

### 3.D.1 · Décision Will requise

Liste des bots IA 2026 et leur traitement par défaut suggéré (à valider Will) :

| Bot                               | Trafic                      | Recommandation | Justification                      |
| --------------------------------- | --------------------------- | -------------- | ---------------------------------- |
| `GPTBot` (OpenAI training)        | training set GPT            | **Allow**      | Visibilité ChatGPT search          |
| `OAI-SearchBot` (OpenAI search)   | search index                | **Allow**      | Citation ChatGPT search            |
| `ClaudeBot` (Anthropic training)  | training Claude             | **Allow**      | Visibilité Claude.ai               |
| `anthropic-ai`                    | search index                | **Allow**      | Citation Claude search             |
| `Google-Extended` (Bard/Gemini)   | training Gemini             | **Allow**      | Visibilité Google AIO              |
| `Applebot-Extended` (Apple AI)    | training Apple Intelligence | **Allow**      | Visibilité Siri Apple              |
| `CCBot` (Common Crawl)            | training open               | **Allow**      | Visibilité multi-LLMs (CC dataset) |
| `PerplexityBot`                   | search Perplexity           | **Allow**      | Citation Perplexity                |
| `Mistral-User` / `MistralAI-User` | search Mistral              | **Allow**      | Citation Mistral Le Chat           |
| `Meta-ExternalAgent`              | search Meta                 | **Allow**      | Visibilité Meta AI                 |
| `Bytespider` (ByteDance)          | training                    | **Allow**      | Visibilité Doubao/TikTok IA        |
| `omgili`, `Diffbot`, `Scrapy`     | scraping divers             | **Disallow**   | Anti-scraping content theft        |

### 3.D.2 · Format robots.txt

```
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

[...]

User-agent: omgili
Disallow: /

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Allow: /api/og
Allow: /api/indexnow
Allow: /api/vitals

Sitemap: https://axion-ia.com/sitemap.xml
```

## 3.E — Training-dataset-friendly markup

### 3.E.1 · SSR/SSG strict

- 100 % du contenu lisible sans JS (test : `curl https://axion-ia.com/page | grep <expected-content>`).
- Pas de hydration-only content (LLM ne voit que SSR HTML).
- `Suspense` boundaries OK mais avec fallback contenant le contenu essentiel.

### 3.E.2 · Sémantique HTML5 stricte

- `<article>` pour articles blog/cas.
- `<section>` pour sections logiques.
- `<aside>` pour contenu connexe.
- `<nav>` pour navigation.
- `<header>` `<footer>` `<main>` standards.
- `<figure>` `<figcaption>` pour images avec légende.

### 3.E.3 · Microdata + JSON-LD double signal

- `itemscope itemtype` cohérent avec JSON-LD pour redondance.
- LLMs parsers parfois utilisent l'un ou l'autre.

### 3.E.4 · Meta IA-spécifiques

- `<meta name="generator" content="Next.js">` propre (transparence stack).
- Pas de `<meta name="noai">` ni `<meta name="noimageai">` (sauf décision business contraire).
- `<meta name="ai-content-declaration" content="human-authored">` (proposed standard).

## 3.F — Pillar pages & topic authority

### 3.F.1 · Pillar pages identifiées

- `/interventions` — pillar Module 1.
- `/audit` — pillar Module 2.
- `/implementation` — pillar Module 3.
- `/cas-concrets` — pillar proof.
- `/blog` — pillar éditorial.
- `/centre-aide` — pillar support.
- `/a-propos` — pillar brand.
- `/presse` (si ajoutée) — pillar autorité médias.

### 3.F.2 · Topical authority signals

- Chaque pillar a `WebPage.mainEntity` cohérent.
- Pillar → 5-10 sub-pages reliées.
- Sub-pages → back to pillar via breadcrumb + texte.
- Cross-links 2-3 vers autres sub-pages du même cluster.
- Densité de mots-clés sémantiques élevée (LSI).

### 3.F.3 · Hub & spoke audit

- Pour chaque pillar, lister sub-pages effectives + lien interne entrant + lien interne sortant.
- Détecter sub-pages orphelines (linkée 0 fois depuis pillar).
- Détecter sub-pages cannibales (même cluster, même mot-clé cible).

---

# 📊 PARTIE 4 — Métriques mesurables (agent principal)

## 4.A — SEO mesurable

| Métrique                      | Source                        | Cible 2026 | Mesuré |
| ----------------------------- | ----------------------------- | ---------- | ------ |
| Lighthouse SEO mobile médian  | LHCI sur 30 URLs              | ≥ 95       | ...    |
| Lighthouse desktop médian     | LHCI                          | ≥ 98       | ...    |
| LCP p75 mobile                | CrUX / RUM                    | ≤ 2.5s     | ...    |
| INP p75                       | CrUX / RUM                    | ≤ 200ms    | ...    |
| CLS p75                       | CrUX / RUM                    | ≤ 0.1      | ...    |
| Sitemap entries valides       | sitemap.xml                   | 100 %      | ...    |
| Hreflang couverture           | grep + sitemap                | 100 %      | ...    |
| Canonical présent             | grep `<link rel="canonical">` | 100 %      | ...    |
| Broken links internes         | linkinator                    | 0          | ...    |
| Duplicate titles/descriptions | grep + script                 | 0          | ...    |

## 4.B — AEO mesurable

| Métrique                         | Cible                      | Mesuré |
| -------------------------------- | -------------------------- | ------ |
| llms.txt présent + valide        | ✅                         | ...    |
| llms-full.txt présent + ≤ 5 MB   | ✅                         | ...    |
| Pages avec direct-answer block   | 100 % éditoriales          | ...    |
| FAQPage schema sur /faq + inline | 100 %                      | ...    |
| Q&A pairs par pillar             | ≥ 5                        | ...    |
| Speakable markup pages produit   | 100 %                      | ...    |
| Citability test score (50 tests) | ≥ 30/50 baseline (60 %)    | ...    |
| RSS feeds valides                | 4 (blog, cas, FAQ, presse) | ...    |

## 4.C — GEO mesurable

| Métrique                         | Cible                 | Mesuré |
| -------------------------------- | --------------------- | ------ |
| E-E-A-T scorecard score          | ≥ 9/11 lignes vertes  | ...    |
| Brand consistency « Axion-IA »   | 100 %                 | ...    |
| NAP consistency                  | 100 %                 | ...    |
| Organization schema sameAs       | ≥ 3 profils officiels | ...    |
| Wikidata entrée créée            | ✅                    | ...    |
| AI bots allow/disallow explicite | ✅ ≥ 12 bots listés   | ...    |
| Content lisible sans JS          | 100 %                 | ...    |
| Pillar pages identifiées         | 7-8                   | ...    |
| Author bylines articles          | 100 %                 | ...    |
| Last-modified dates              | 100 % éditoriales     | ...    |

---

# 📋 SORTIE — `_AUDIT/AUDIT-SEO-AEO-GEO-2026.md`

```markdown
# AUDIT SEO + AEO + GEO 2026 — Axion-IA

- Date : 2026-MM-DD
- Auditeur : Claude Opus 4.7 (1M context) + 4 agents
- Sprint audité : Sprint 14 + polish + doctrine v3 commitée (HEAD <sha>)
- Standards : Google Search Essentials 2026, Schema.org 27.0+, llms.txt v0.1, IndexNow

## 1. Verdict global SEO/AEO/GEO

- [ ] PERFECTION ATTEINTE ✅ (score ≥ 95 % sur les 3 disciplines)
- [ ] EXCELLENT avec polish ⚠️ (score 80-95 %)
- [ ] CORRECT à approfondir ⚠️ (score 60-80 %)
- [ ] INSUFFISANT ❌ (score < 60 %)

## 2. Scores par discipline

| Discipline | Score    | Détail                                                                                            |
| ---------- | -------- | ------------------------------------------------------------------------------------------------- |
| SEO        | XX / 100 | technical X/50 + content X/50                                                                     |
| AEO        | XX / 100 | manifestes X/20 + structured X/30 + direct-answer X/20 + citability X/30                          |
| GEO        | XX / 100 | E-E-A-T X/40 + brand X/15 + entity X/15 + AI bot policy X/10 + training markup X/10 + pillar X/10 |

## 3. Findings P0 (à corriger AVANT prod)

[...]

## 4. Findings P1, P2, P3

[...]

## 5. Citability test 2026 (50 tests)

[Tableau 10 questions × 5 LLMs]

## 6. E-E-A-T Scorecard

[Tableau 11 lignes]

## 7. Recommandations actionnables

### Court terme (≤ 1 semaine)

[...]

### Moyen terme (Phase 2)

[...]

### Long terme (Phase 3)

[...]

## 8. Annexes

- A — SEO technique + contenu détaillé (`AUDIT-SEO-detail.md`)
- B — AEO détaillé + tableau citability complet (`AUDIT-AEO-detail.md`)
- C — GEO détaillé + E-E-A-T scorecard complète (`AUDIT-GEO-detail.md`)
- Deltas machine-readable : `seo-aeo-geo-deltas.json`
```

---

# ▶️ DÉMARRAGE

Confirme en 5 lignes. Charge les 21 sources de vérité. Lance les **4 agents en parallèle** (1 message). Pendant ce temps, agent principal exécute Partie 4 (Métriques mesurables) + agrégation.

Tools dynamiques externes (LHCI, citability LLMs, Wikidata, Google Search Console) : si non accessibles via WebFetch, marquer « checklist méthodologie + commandes pour exécution manuelle Will ».

À la fin, **renvoie à Will (≤ 250 mots)** :

- Verdict global PERFECTION / EXCELLENT / CORRECT / INSUFFISANT.
- 3 scores SEO/AEO/GEO sur 100.
- Top 5 findings P0.
- Top 3 quick wins (< 1h chacun).
- Recommandation working copy : aucune action requise (lecture seule).
- Question fermée : « OUI applique les quick wins / CONTINUE on documente seulement / STOP corrections majeures requises ».
