# 21 — INDEXATION MANAGEMENT 2026 (crawl budget + sitemap split + IndexNow)

> **Audit indexation à l'échelle** : à 100K-300K URLs, l'indexation devient un sujet stratégique. Crawl budget Google fini, sitemap > 50K = split obligatoire, IndexNow + Search Console API à exploiter.
> Lancer fenêtre fraîche.

## 0. Contexte

Google indexe en moyenne 10-30 % d'un site large nouveau sans signaux forts. À 100K URLs Axion-IA, on vise ≥ 80 % grâce à :

- Sitemap split + lastmod accurate
- IndexNow ping immédiat
- Internal linking dense vers nouvelles pages
- Anti-doorway HCU (qualité, sinon Google rejette)
- Crawl budget management

## 1. Audit en 6 chapitres × 10 critères = 60 points

### Chapitre 1 — Sitemap

1.1 Sitemap-index actif (`/sitemap.xml` qui pointe vers sitemaps enfants)
1.2 Split par catégorie (`sitemap-pages.xml`, `sitemap-villes.xml`, `sitemap-regions.xml`, `sitemap-blog.xml`)
1.3 < 50K URLs par sitemap (limite Google)
1.4 < 50 MB par sitemap (limite Google)
1.5 lastmod accurate (timestamp publish réel, pas build time uniforme)
1.6 changefreq et priority utilisés stratégiquement (ou omis — Google ignore largement)
1.7 Sitemap auto-régénéré sur publish (pas batch nightly)
1.8 Soumis Search Console + Bing Webmaster Tools
1.9 Sitemap accessible robots-txt allow + listé dans `robots.txt`
1.10 Validation sitemap (xmllint ou validator) en CI

### Chapitre 2 — IndexNow API

2.1 Implémenté (`POST https://api.indexnow.org/indexnow`)
2.2 Key fichier hosté (`/{indexnow-key}.txt`)
2.3 Ping sur publish atomique (1 URL ou batch ≤ 10K)
2.4 Logs des pings (succès/échec)
2.5 Retry on failure (exponential backoff)
2.6 Quota IndexNow respecté (10K URLs / 24h depuis 1 host)
2.7 Multi-engines : Bing + Yandex + DuckDuckGo + Naver + Seznam (tous via api.indexnow.org)
2.8 Ping sur depublish (URL devenue 410 ou 404)
2.9 Monitoring impact : indexation Bing avant/après IndexNow
2.10 Documentation runbook (où changer la key, comment debugger)

### Chapitre 3 — Search Console & Google indexing

3.1 Search Console connecté + property vérifiée
3.2 Sitemap soumis (sitemap-index)
3.3 URL Inspection API : monitoring sample 100/jour (quota 600/jour)
3.4 Indexation rate trackée : `Indexed / Submitted` ratio cible ≥ 80 %
3.5 Crawl errors monitoring (404, 5xx, redirect loops)
3.6 Mobile-friendly check (Lighthouse + Search Console mobile usability)
3.7 Core Web Vitals report (CrUX) trackée par origine
3.8 Manual actions monitoring (penalty alerting)
3.9 Coverage report : Excluded categories triées (canonical, noindex, soft 404, etc.)
3.10 Backlinks tracking (Search Console links report)

### Chapitre 4 — Crawl budget

4.1 robots.txt optimisé : disallow paths inutiles (`/api/`, `/admin/`, `/*.json$`, etc.)
4.2 Pas de paramètres URL crawlables (canonical strict)
4.3 Anti-doorway HCU : noindex sur villes non pilotes (= n'utilise pas crawl budget)
4.4 Internal linking depth ≤ 3 vers chaque page indexable
4.5 Liens depuis hub (sitemap interne footer ou hub page) vers nouvelles pages
4.6 Pages low-priority (CGV, mentions légales) en noindex,follow
4.7 Pagination canonicalisée (rel=canonical sur page 2+ vers page 1 ou self)
4.8 Faceted navigation contrôlée (pas d'explosion combinatoire indexable)
4.9 Crawl-delay configuré pour Bingbot/autres si abus (Googlebot ignore crawl-delay)
4.10 Server response time < 200 ms (Google réduit crawl si lent)

### Chapitre 5 — AI bots strategy (LLMO 2026)

5.1 robots.txt strategy AI bots documentée :

- GPTBot (OpenAI) : allow ou disallow ?
- ClaudeBot / Claude-Web (Anthropic) : allow ?
- Google-Extended : allow (pour AI Overviews) ?
- PerplexityBot : allow ?
- CCBot (Common Crawl) : allow ?
- Bytespider (TikTok / ByteDance) : allow ?
- facebookexternalhit : allow (preview cards) ?
  5.2 Décision documentée par bot dans ADR
  5.3 robots.txt User-agent règles cohérentes
  5.4 llms.txt + llms-full.txt à jour (déjà ✅)
  5.5 Headers AI metadata (`X-Robots-Tag` cohérent)
  5.6 Schema.org E-E-A-T enrichi (Person + Organization + datePublished + dateModified)
  5.7 Author bio pages (Person schema, sameAs LinkedIn/Twitter)
  5.8 Citations sourcées (sources externes traçables)
  5.9 Brand mentions tracking (search « Axion-IA » sur web mensuel)
  5.10 Wikipedia entity considered (long-terme E-E-A-T)

### Chapitre 6 — Monitoring indexation

6.1 Dashboard indexation (`/admin/pseo-stats` Sprint 20) : page count par statut
6.2 Search Console API daily fetch : indexation rate
6.3 Bing Webmaster Tools API : idem côté Bing
6.4 Anomaly detection : drop > 10 % indexation = alerte
6.5 Per-region/per-template indexation rate trackée
6.6 New URL → indexed time tracking (cible ≤ 7 jours)
6.7 Lost URLs tracking (page indexée puis désindexée)
6.8 Manual actions alerting
6.9 Plan B si Google réduit crawl : audit qualité + boost internal linking
6.10 Reporting mensuel Will : volume indexé, top pages, gaps

## 2. Méthode

### Phase A — Mesure baseline

1. Sitemap actuel : structure, taille, dernière régénération
2. Search Console : sitemap submitted, indexed count, errors
3. robots.txt audit
4. IndexNow : implémenté ou pas
5. AI bots policy actuelle

### Phase B — Diagnostic /60

### Phase C — Plan

1. Sitemap split si pas déjà fait (ou amélioration split actuel)
2. IndexNow API integration
3. Search Console API monitoring
4. robots.txt AI bots policy (ADR à valider Will)
5. Crawl budget optimisations

### Phase D — STOP & ASK

Livre :

- `audit-21-indexation-SYNTHESE.md`
- `audit-21-indexation-DIAGNOSTIC.md`
- `audit-21-indexation-PLAN.md`
- `audit-21-indexation-AI-BOTS-POLICY.md` (ADR proposition)

### Phase E — Application après GO

## 3. STOP & ASK obligatoires

1. Avant changement robots.txt (impact massif possible)
2. Avant ADR AI bots policy (décision business)
3. Avant intégration IndexNow API (key génération)
4. Avant intégration Search Console API (OAuth setup)
5. Avant changement structure sitemap
6. Avant tout commit
7. Si indexation rate < 50 % détecté

## 3bis. Anti-patterns à éviter (Pitfalls)

- ❌ Sitemap > 50 K URLs sans split (Google ignore au-delà)
- ❌ lastmod uniforme (signal fraîcheur fake détecté)
- ❌ IndexNow ping sans key host (rejeté)
- ❌ Crawl budget gaspillé sur paramètres URL (canonical strict)
- ❌ robots.txt disallow trop large (bloque indexation utile)
- ❌ AI bots policy implicite (pas d'ADR = décision floue)
- ❌ Pages noindex,nofollow sur villes non pilotes (perte transmission PageRank)
- ❌ Search Console non connecté (cécité indexation)

## 4. Cible

> _« Indexation rate ≥ 80 % à J+30 sur nouvelles URLs ; sitemap split conforme limites Google ; IndexNow ping atomique sur publish ; AI bots policy documentée ADR ; monitoring indexation auto via dashboard. »_

## 5. Livrables

```
audit-21-indexation-SYNTHESE.md
audit-21-indexation-DIAGNOSTIC.md
audit-21-indexation-PLAN.md
audit-21-indexation-AI-BOTS-POLICY.md  (ADR proposition)
```

---

**FIN DU PROMPT 21.**
