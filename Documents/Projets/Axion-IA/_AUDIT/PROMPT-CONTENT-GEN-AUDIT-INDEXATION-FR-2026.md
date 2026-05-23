# 🔎 PROMPT AUDIT INDEXATION FR EXTRÊME 2026 — Content Generator + pSEO

> Audit dédié indexation auto + sitemaps + crawl budget + ranking FR.
> Focus marché France primaire (Google.fr 91 % PdM) + Bing FR + Qwant +
> Ecosia + DuckDuckGo + IndexNow multi-moteurs.
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.
>
> Complémentaire à `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md`
> qui traite AGENT 4 indexation en surface (/90 sur /900). Cet audit
> approfondit l'indexation à /700 dédié.
>
> Score cible : ≥ 630 / 700 (90 %) pour 🟢 indexation prod-ready France.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT INDEXATION FR 2026)

Tu es l'auditeur indexation extrême perfection 2026 pour Axion-IA. V1
+ V2 + KB V4 + pSEO villes 12 942 routes SSG + factory 100/jour (si
KB_AUTO_PUBLISH=true) sont livrés. Le site cible le marché B2B FRANCE
PRIMAIRE (cabinet IA opérationnel pour PME/ETI françaises).

Ton job : vérifier que CHAQUE URL publiable est :
1. Découvrable par Googlebot / Bingbot / Qwant / Ecosia / DuckDuckGo
   sans intervention humaine
2. Indexée RAPIDEMENT (< 48h Google idéal, < 7j max acceptable)
3. Indexée DURABLEMENT (pas désindexée pour duplicate / HCU / spam)
4. Re-indexée à chaque update significatif (dateModified bump)
5. Désindexée proprement quand article dépublié / supprimé
6. Visible Google.fr en FR (langue + région ciblées)
7. Tracée dans Search Console + Bing Webmaster + Yandex (pour reporting)

PHILOSOPHIE 2026 :
- Sitemap = invitation, IndexNow = sonnette, Search Console submit = clé
- France = marché Google-dominant (91 % PdM 2025) mais ne pas négliger
  Bing (5 %, croît avec Edge default), Qwant (1 %), Ecosia (1 %),
  DuckDuckGo (1 %)
- pSEO villes = 12 942 routes → crawl budget Googlebot CRITIQUE (Hetzner
  self-hosted = pas de "discovery boost" Vercel)
- Factory 100/jour publié → 36 500 nouveaux articles/an. Sans indexation
  auto fiable = 90 % travail perdu (page exists ≠ page indexed)
- Google Indexing API officiellement limité JobPosting + BroadcastEvent.
  L'usage best-effort sur articles = toléré mais pas garanti.
- IndexNow = standard ouvert Microsoft 2021. Bing + Yandex + Naver +
  Seznam ingèrent. Google n'utilise PAS IndexNow officiellement.

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition code, aucun commit, aucun push, aucun migrate
- Aucune SOUMISSION manuelle URL (zéro POST mutant sur APIs externes)
- Aucun appel API IA externe (OpenAI / Anthropic / Voyage / Perplexity)
- curl + lecture Search Console API + lecture Bing Webmaster API +
  lecture IndexNow status API = AUTORISÉ en read-only
- Si bug détecté → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Code stack :
1. `axionia/src/app/sitemap.xml/route.ts` (sitemap index)
2. `axionia/src/app/sitemap-*.xml/route.ts` (sous-sitemaps)
3. `axionia/src/app/robots.txt/route.ts`
4. `axionia/src/app/llms.txt/route.ts` (si présent)
5. `axionia/src/app/ai.txt/route.ts` (si présent)
6. `axionia/src/app/<key>.txt/route.ts` (IndexNow key file)
7. `axionia/src/lib/indexnow.ts` (helper centralisé commit b7cbfb4)
8. `axionia/src/lib/google-indexing.ts`
9. `axionia/src/lib/bing-indexnow.ts` (si distinct)
10. `axionia/src/lib/sitemap-builder.ts` ou équivalent
11. `axionia/src/lib/seo/*` (canonical, hreflang helpers)
12. `axionia/src/workers/factory-publish.ts` ou trigger publish
13. `axionia/src/workers/sitemap-rebuild.ts` (si cron)
14. `axionia/src/jobs/indexnow-batch.ts` (si présent)
15. `axionia/middleware.ts` (canonical redirects)
16. `prisma/schema.prisma` modèles Article + Page + KbDocument

Données prod (read-only) :
17. Google Search Console (Will partage export ou API token read-only)
18. Bing Webmaster Tools (Will partage API key read-only)
19. Sitemap public en prod : curl `/sitemap.xml`
20. robots.txt public : curl `/robots.txt`

Référentiels :
21. `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL.md` AGENT 4
22. `_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  8 AGENTS PARALLÈLES                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Sitemap architecture complète ══════════════════════════ /100

**1.1 — Sitemap index racine**
- `GET /sitemap.xml` → status 200, Content-Type `application/xml`
- Format `<sitemapindex>` (pas `<urlset>` au top)
- Liste tous les sous-sitemaps avec `<sitemap>` + `<loc>` + `<lastmod>`
- Pas de Mixed content top-level (interdit)

**1.2 — Sous-sitemaps obligatoires Content-Gen V2 + pSEO**
Vérifier la présence de chaque sous-sitemap :
- `sitemap-pages.xml` (pages statiques < 500)
- `sitemap-news.xml` (Google News : MAX 1000 URLs **< 48h** strict
  quota, sinon Google News ignore complet)
- `sitemap-articles.xml` (articles factory > 48h)
- `sitemap-faq.xml` (hub FAQ)
- `sitemap-aide.xml` (help articles)
- `sitemap-etudes-de-cas.xml` (case studies)
- `sitemap-connaissances.xml` (KB V4 publique)
- `sitemap-villes.xml` ou `sitemap-villes-1.xml` + `-2.xml` etc.
  (12 942 routes → split obligatoire car > 50 000 hors limite mais
  ≈ 13K reste sous limite — split optionnel par région recommandé)
- `sitemap-interventions.xml` (familles + sous-pages)

Pour chaque sous-sitemap :
- < 50 000 URLs (limite Google + Bing stricte)
- < 50 MB non-compressé (compress gzip recommandé `.xml.gz`)
- `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
- Chaque `<url>` : `<loc>` absolu HTTPS, `<lastmod>` ISO 8601,
  `<changefreq>` optionnel, `<priority>` optionnel
- `lastmod` doit refléter dateModified réel DB (pas tous identiques —
  Google ignore les sitemaps trop "frais" suspects)

**1.3 — Sitemap-news.xml spécifique Google News**
- Quota strict : **MAX 1000 URLs < 48h** (Google publishing).
  Au-delà = sitemap-news ignoré entièrement (pas d'inclusion partielle)
- Tags Google News obligatoires :
  ```xml
  <news:news>
    <news:publication>
      <news:name>Axion-IA Actualités</news:name>
      <news:language>fr</news:language>
    </news:publication>
    <news:publication_date>2026-05-15T10:00:00+02:00</news:publication_date>
    <news:title>Titre article</news:title>
  </news:news>
  ```
- Pas de keywords (deprecated 2019)
- Site doit être accepté dans Google News Publisher Center

**1.4 — Sitemap-images.xml + sitemap-video.xml**
- Si images factory générées (GPT-image-1 V2) ou Unsplash :
  inclusion images inline dans sitemap-articles.xml via
  `<image:image>` + `<image:loc>` + `<image:caption>` + `<image:license>`
- Boost Image Search Google + Bing Visual Search

**1.5 — hreflang dans sitemap**
- Si FR + EN bilingue : `<xhtml:link rel="alternate" hreflang="fr"` +
  `hreflang="en"` + `hreflang="x-default"` sur CHAQUE `<url>`
- Validation cohérence : URL FR pointe vers URL EN qui pointe vers
  URL FR (réciprocité obligatoire)

**1.6 — Robots.txt référence sitemap**
- Directive `Sitemap: https://axion-ia.com/sitemap.xml` présente
- Une ligne par sitemap si plusieurs index

Gate : sitemap.xml status ≠ 200 = 🔴 ROUGE bloquant
Gate : `<sitemap>` > 50 000 entries dans un sitemap = ROUGE
Gate : sitemap-news > 1000 URLs < 48h = ROUGE (drop Google News complet)
Gate : `lastmod` tous identiques = ORANGE (signal spam)
Gate : hreflang non-réciproque = ROUGE (Google ignore hreflang)

═══ AGENT 2 — robots.txt + llms.txt + ai.txt + IndexNow key ══════════ /70

**2.1 — robots.txt audit complet**
Curl `GET /robots.txt` :
- Status 200, Content-Type `text/plain`
- Directive `Sitemap:` présente
- `User-agent: *` cohérent
- `Disallow: /admin/` + `Disallow: /api/` + `Disallow: /mes-donnees/`
- `Allow:` explicite pour /actualites/, /connaissances/, /faq/
- Pas de blocage accidentel /sitemap*.xml

**2.2 — User-agent par bot IA training (décision Will explicite)**
- `GPTBot` : Allow ou Disallow ? (recommandé Allow pour visibilité GEO)
- `Google-Extended` : Allow ou Disallow ?
- `Applebot-Extended` : Allow ou Disallow ?
- `Bytespider` (TikTok) : Disallow recommandé (peu pertinent FR)
- `Amazonbot` : Disallow recommandé (peu pertinent)
- `Meta-ExternalAgent` : Disallow recommandé
- `CCBot` (Common Crawl) : Disallow recommandé (training non-conversational)
- `cohere-ai` : décision Will

**2.3 — User-agent par bot IA search-time (Allow OBLIGATOIRE)**
Sans ces Allow = perte massive citations 2026 :
- `ClaudeBot` ✓
- `Claude-Web` ✓
- `OAI-SearchBot` ✓
- `ChatGPT-User` ✓
- `PerplexityBot` ✓
- `Perplexity-User` ✓

**2.4 — llms.txt (standard Jeremy Howard 2024)**
Curl `GET /llms.txt` :
- Status 200, Content-Type `text/markdown` ou `text/plain`
- Format attendu :
  ```markdown
  # Axion-IA
  > Cabinet IA opérationnel B2B pour PME/ETI françaises.
  
  ## Services
  - [Audit conformité IA](https://axion-ia.com/audit-conformite-ia) : ...
  - [Implémentation IA](https://axion-ia.com/implementation-ia) : ...
  
  ## Connaissances
  - [FAQ](https://axion-ia.com/faq) : ...
  ```
- Si absent : flagger P1 GEO-readiness
- Optionnel : `/llms-full.txt` (chaque page inline en MD complet)

**2.5 — ai.txt (opt-in/opt-out training)**
Curl `GET /ai.txt` :
- Status 200
- Politique training claire : Allow / Deny par usage
- Format attendu (standard émergent) :
  ```
  User-Agent: *
  Disallow: training
  Allow: search
  ```

**2.6 — IndexNow key file**
- `INDEXNOW_KEY` env var Coolify renseignée ?
- Fichier `/<key>.txt` exposé racine (curl 200 + body = clé)
- Format clé : 8-128 chars alphanumériques

Gate : robots.txt status ≠ 200 = ROUGE
Gate : bot IA search-time disallow dans robots.txt = 🚨 CRITIQUE
Gate : llms.txt absent = ORANGE (P1)
Gate : IndexNow key file 404 = ROUGE

═══ AGENT 3 — IndexNow auto-trigger + multi-moteurs ══════════════════ /90

**3.1 — Endpoints IndexNow officiels**
- Bing : `https://api.indexnow.org/IndexNow` (universal, redistribue)
- Yandex : `https://yandex.com/indexnow`
- Naver : `https://searchadvisor.naver.com/indexnow`
- Seznam : `https://search.seznam.cz/indexnow`
- Recommandé : utiliser `api.indexnow.org` qui redistribue à tous

**3.2 — Auto-trigger à la publication**
Lecture code factory worker :
- Trigger `indexnow.ts` appelé sur Article.publish ?
- Trigger sur Article.update si dateModified bump ?
- Trigger sur Article.unpublish avec `urlOmit` (deprecated, utiliser
  `urlSet` filtré)
- Trigger sur slug change avec ancien + nouveau URL (canonical 301)

**3.3 — Format payload IndexNow**
```json
{
  "host": "axion-ia.com",
  "key": "<INDEXNOW_KEY>",
  "keyLocation": "https://axion-ia.com/<key>.txt",
  "urlList": ["https://axion-ia.com/actualites/article-1", ...]
}
```
- `urlList` (officiel) ET `urls` (alias supporté — bug fix commit b7cbfb4
  mémoire 2026-05-13)
- Batch MAX 10 000 URLs par requête
- Rate limit : 1 req / 10 sec recommandé

**3.4 — Logs + retries**
- Tous appels IndexNow logged ?
- Retry exponentiel sur 5xx ?
- Alerte Telegram si échec persistant ?
- Audit log immutable (KB V4 audit_log hash-chain) ?

**3.5 — Bing Webmaster Tools alternative**
- API Bing Webmaster directe (legacy) supportée ?
- IndexNow couvre Bing automatiquement (recommandé)
- Site soumis dans Bing Webmaster Tools (action humaine) ?

**3.6 — Yandex + Naver + Seznam (faible volume FR mais zéro effort)**
- IndexNow universal = couvre tous, zéro config additionnelle
- Naver pertinent si trafic ASEAN expat (faible pour Axion-IA)
- Yandex pertinent si Russie/CEI (n/a)
- Seznam pertinent si Tchéquie (n/a)

Gate : factory publish sans IndexNow trigger = ROUGE
Gate : Article.update sans re-ping IndexNow = ORANGE
Gate : `urls` vs `urlList` bug récurrent = ROUGE (mémoire b7cbfb4)

═══ AGENT 4 — Google Indexing API + Search Console ═══════════════════ /90

**4.1 — Google Indexing API (officiel JobPosting + BroadcastEvent)**
Lecture `src/lib/google-indexing.ts` :
- JWT service account chargé via `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`
- Scope : `https://www.googleapis.com/auth/indexing`
- Endpoint : `https://indexing.googleapis.com/v3/urlNotifications:publish`
- Payload : `{ "url": "...", "type": "URL_UPDATED" | "URL_DELETED" }`
- Quota : 200 requêtes/jour par défaut (request quota increase pour 10K)
- Factory 100/jour → marge faible mais OK

**4.2 — Usage best-effort articles (hors-scope officiel)**
Google n'a pas confirmé l'usage Indexing API pour articles génériques.
Toléré mais pas garanti. Stratégie :
- Utiliser Indexing API pour signaler updates rapides (best-effort)
- NE PAS y compter exclusivement → sitemap + IndexNow restent primaires
- Logger les rejets API (400/403) pour détecter changement politique

**4.3 — Google Search Console (GSC)**
- Site `axion-ia.com` vérifié dans GSC ? (mémoire 2026-05-13 dit oui)
- Sitemap soumis et accepté dans GSC ?
- API GSC Search Analytics accessible (read-only) ?
- Property type : Domain (recommandé) vs URL prefix
- Données Crawl Stats disponibles (28 derniers jours) ?

**4.4 — Crawl Stats GSC**
Si Will partage export ou OAuth API token read-only :
- Total crawl requests / jour
- Avg response time Googlebot
- Crawl budget utilisé vs disponible
- Top URLs crawlées
- 4xx/5xx errors rate
- Si factory publie 100/jour mais GSC indique crawl < 50/jour = problème

**4.5 — URL Inspection Tool (read-only via API)**
Pour 20 URLs sample (5 par catégorie) :
- /actualites/[slug] récent (< 24h)
- /faq/[slug] V2
- /connaissances/[slug] KB V4
- /fr/implantations/ile-de-france/paris (pSEO pilote)
- /audit/par-ville/lyon

Pour chaque : "URL is on Google" ou "URL is not on Google" ?
- Si "not on Google" + URL ≥ 7 jours publié = ROUGE
- Indexabilité crawled vs not crawled ?
- Mobile-friendly OK ?
- Schema.org reconnu ?

**4.6 — Soumission manuelle sitemap GSC**
- Sitemap status = "Success" dans GSC ?
- Last fetched date < 7 jours ?
- Discovered URLs vs Submitted URLs ratio ?
- Errors / warnings ?

Gate : sitemap GSC status ≠ Success = ROUGE
Gate : > 30 % articles "not on Google" après 7j = ROUGE
Gate : Indexing API non câblée alors que env var renseignée = ORANGE

═══ AGENT 5 — Crawl budget + frequence Googlebot ═════════════════════ /80

**5.1 — Volume du site vs crawl capacity**
Total URLs publiables Axion-IA :
- Pages statiques : ~50
- Articles factory : ~36 500/an cible (100/jour)
- FAQ V2 : ~200
- KB V4 : variable (factory KB 100/jour si KB_AUTO_PUBLISH)
- pSEO villes : 12 942
- TOTAL ≥ 50 000 URLs après 1 an

Capacité crawl Googlebot Hetzner CPX42 :
- Pas de discovery boost Vercel
- TTFB critique (< 600 ms sinon Googlebot abandonne)
- Concurrence Googlebot peut atteindre 8-16 connections //
- Risque : surcharge serveur si 100K URLs nouvelles d'un coup

**5.2 — Stratégie crawl prioritization**
Pour optimiser crawl budget :
- Page principales (home, hubs, services) : `<priority>1.0`
- Articles récents : `<priority>0.8`
- pSEO villes : `<priority>0.5-0.7` selon population
- Pages legacy : `<priority>0.3`

**5.3 — Lazy publication pSEO**
Vérifier stratégie pSEO villes :
- Toutes les 12 942 publiées d'un coup ? (mémoire dit oui SSG)
- Risque : Googlebot crawl 5-10 % et abandonne (perçoit comme spam pSEO)
- Recommandé : phasing par tier (1 = top 100 villes, 2 = top 500, 3 = reste)

**5.4 — Crawl-delay Bingbot**
- robots.txt `Crawl-delay: 1` pour `User-agent: bingbot` ?
- Sinon Bingbot peut sur-crawler (Bing plus agressif que Google)

**5.5 — Soft 404 detection**
Pages pSEO villes avec contenu minimal = risque soft 404 :
- Vérifier templates ville ≥ 40 % unique (HCU 2024 bouclier)
- Vérifier sample 20 villes différentes : aucune copy-paste 100 %
- Maillage interne contextualisé par ville (pas générique)

**5.6 — Discovery via maillage interne**
- Mega-menu Footer : maillage services × villes pilotes (mémoire confirme)
- Liens contextuels dans articles factory vers pages produit ?
- Liens pSEO villes ↔ services contextuels ?

Gate : pSEO routes sans maillage interne = ROUGE (orphan pages)
Gate : Soft 404 détecté > 5 % pSEO = ROUGE
Gate : Bingbot crawl-delay absent = ORANGE

═══ AGENT 6 — Indexation FR spécifique (Google.fr + alternatives) ════ /100

**6.1 — Google.fr ciblage géo-linguistique**
- `<html lang="fr">` ou `lang="fr-FR"` ✓
- Domaine `.com` (international) + GSC International Targeting : France ?
- Si `.fr` envisagé : décision Will (CTLD = boost FR mais migration coût)
- hreflang `fr-FR` (ou `fr`) + `x-default` cohérent
- Pages EN avec hreflang `en` + `x-default` → vérifier réciprocité

**6.2 — Google Business Profile (cabinet IA local services)**
- Axion-IA cabinet IA opérationnel = entité locale ?
- Google Business Profile créé (action Will, hors-code) ?
- Categories : "Consultant" + "Business Management Consultant"
- Service area : France métropolitaine (cohérent pSEO)
- Photos + Q&A + Reviews collection
- Maps Mention citations locales pour pSEO villes

**6.3 — Annuaires FR (citations locales NAP)**
NAP cohérent (Name + Address + Phone) sur :
- PagesJaunes (gratuit) ?
- Mappy ?
- Yelp FR ?
- Société.com (auto-indexé si SIRET FR — sauf qu'Axion-IA = OÜ EE)
- Trustpilot ?
Vérifier `Organization` JSON-LD + `LocalBusiness` cohérents.

**6.4 — Bing FR**
- Bing Webmaster Tools site vérifié ?
- Sitemap soumis Bing ?
- Bing Places for Business (équivalent Google Business) ?
- 5 % PdM FR mais croît avec Edge default Windows 11

**6.5 — Qwant FR (moteur français basé Bing index)**
- Qwant utilise Bing index → indexation Bing = indexation Qwant
- Pas de soumission directe nécessaire
- Vérifier visibilité requête test : `site:axion-ia.com` sur Qwant

**6.6 — Ecosia (basé Bing index)**
- Même logique Qwant : Ecosia = Bing index
- Vérifier visibilité

**6.7 — DuckDuckGo FR**
- DuckDuckGo utilise Bing + crawl propre
- DuckDuckBot autorisé robots.txt ?
- Vérifier visibilité `site:axion-ia.com`

**6.8 — Lilo (français, basé multi-sources)**
- Marginal mais green branding
- Aucune action requise

**6.9 — Test de visibilité prod live**
Pour 10 requêtes FR cibles (lecture seule Google/Bing) :
- "audit IA Paris" → Axion-IA présent ? rang ?
- "cabinet IA PME France" → présent ?
- "implémentation IA dirigeant" → présent ?
- "formation IA équipe" → présent ?
- "consultant IA Lyon" → présent ? (pSEO test)
- "audit conformité IA AI Act" → présent ?
- "Axion-IA" (brand search) → #1 obligatoire ?
- "Manon Axion-IA" → présent ?
- "[ville] audit IA" sample 3 villes pSEO

Gate : `site:axion-ia.com` retourne < 50 % URLs publiées = ROUGE
Gate : "Axion-IA" brand search non #1 = ROUGE
Gate : 0 visibilité pSEO sur 3 requêtes sample = ROUGE

═══ AGENT 7 — Cycle de vie URL : create → update → delete ═══════════ /80

**7.1 — Publish flow auto-indexation**
À la publication d'un article factory :
1. Article.published = true en DB
2. `revalidatePath('/actualites')` + `revalidatePath('/actualites/[slug]')`
3. Sitemap-articles.xml mis à jour (cron rebuild ou on-demand ?)
4. Sitemap-news.xml mis à jour si < 48h
5. IndexNow ping batch (avec urlList article + sitemap parent)
6. Google Indexing API ping (URL_UPDATED)
7. Audit log entry hash-chain (KB V4)
8. Alerte Telegram si échec étape 5/6

Vérifier chaque étape dans code factory worker.

**7.2 — Update flow re-indexation**
À la modification d'un article :
1. dateModified bump DB
2. revalidatePath
3. Sitemap lastmod auto-bump
4. IndexNow ping (URL_UPDATED)
5. Google Indexing API ping (URL_UPDATED)

**7.3 — Slug change (canonical redirect)**
À un slug rename :
- Ancien slug → 301 redirect (next.config.redirects ou middleware)
- IndexNow ping ANCIEN + NOUVEAU URL
- GSC Removal Tool optionnel (outdated content)
- Audit log + Telegram

**7.4 — Unpublish flow (article archived)**
À la dépublication :
1. Article.published = false en DB
2. Sitemap retire l'URL
3. Article URL → 410 Gone (preferred) ou 404 Not Found
4. IndexNow ping avec **`urlOmit`** (deprecated) — utiliser `urlSet`
   filtré ou laisser GSC découvrir 410 naturellement
5. Google Indexing API : `type: URL_DELETED`
6. GSC Removal Tool (manuel, action Will pour cas sensibles)

**7.5 — Delete flow (article supprimé hard)**
À la suppression complète :
- Même que unpublish + suppression row DB
- Vérifier audit log immutable préservé (hash-chain KB V4)

**7.6 — Bulk operations**
Si batch unpublish 100 articles :
- IndexNow ping batch URL deleted
- Pas de spam GSC Removal Tool
- Sitemap rebuild une seule fois

Gate : unpublish sans IndexNow ping = ORANGE (Google découvre lentement)
Gate : delete sans Google Indexing API URL_DELETED = ORANGE
Gate : slug change sans 301 = ROUGE (perte SEO accumulé)
Gate : audit log absent = ROUGE (KB V4 compliance)

═══ AGENT 8 — Monitoring + alerting indexation ═══════════════════════ /90

**8.1 — Dashboard admin indexation**
- `/admin/indexation` ou équivalent existe ?
- Affiche : count articles indexed vs published (par tier)
- Affiche : last IndexNow ping success/fail
- Affiche : GSC errors récents
- Affiche : sitemap fetch status GSC

**8.2 — Alertes Telegram critiques**
Listées dans master prompt § 12.3bis :
- IndexNow fail > 3 fois consécutives ?
- Google Indexing API rejet 403 (quota) ?
- Sitemap GSC error status ?
- Spike 5xx Googlebot dans CF logs ?
- pSEO villes désindexées massivement (Discovery → Indexed gap) ?

**8.3 — GSC API monitoring auto (Sprint 16 prévu)**
- Si Sprint 16 livré : worker query GSC daily
- Stocker en DB IndexedUrl + DiscoveredUrl + IndexedDate
- Alerte si decay (indexed → discovered = désindexation)

**8.4 — Bing Webmaster API monitoring**
- Worker query Bing Webmaster daily ?
- Stocker stats Bing in DB

**8.5 — Plausible Search Engine referer**
- Plausible Custom Properties : track `referer_source` (google.fr / bing /
  qwant / duckduckgo / perplexity / chatgpt-direct)
- Dashboard : trafic search organic par moteur 7j/28j

**8.6 — Search Console Insights**
Action humaine Will : check hebdo Search Console :
- Total clicks 7j
- Top queries
- Page experience signals (Core Web Vitals + HTTPS + mobile)
- Manual actions / security issues

Gate : aucune alerte Telegram indexation cassée = ROUGE
Gate : dashboard admin indexation absent = ORANGE (Sprint 16)
Gate : Plausible search referer non tracé = ORANGE

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLE UNIQUE                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

Fichier : `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-XX-XX.md`

Structure :
1. **Résumé exécutif** (score /700, verdict, top 10 P0)
2. AGENT 1 Sitemap architecture (/100)
3. AGENT 2 robots.txt + llms.txt + ai.txt + IndexNow key (/70)
4. AGENT 3 IndexNow auto-trigger + multi-moteurs (/90)
5. AGENT 4 Google Indexing API + Search Console (/90)
6. AGENT 5 Crawl budget + Googlebot frequency (/80)
7. AGENT 6 Indexation FR (Google.fr + Bing/Qwant/Ecosia/DDG) (/100)
8. AGENT 7 Cycle de vie URL create/update/delete (/80)
9. AGENT 8 Monitoring + alerting indexation (/90)
10. **TOP 20 patches recommandés** (P0 → P3, gain estimé)
11. **Checklist activation factory 100/jour côté indexation** :
    - [ ] sitemap-index split appliqué prod
    - [ ] IndexNow key file `/<key>.txt` accessible
    - [ ] IndexNow trigger câblé factory publish + update + delete
    - [ ] Google Indexing API JWT chargé + premier ping testé
    - [ ] GSC sitemap soumis status Success
    - [ ] Bing Webmaster sitemap soumis
    - [ ] llms.txt + ai.txt déployés
    - [ ] hreflang FR/EN réciproque vérifié
    - [ ] pSEO villes phasing tier 1/2/3 décidé
    - [ ] Alerte Telegram IndexNow fail câblée
    - [ ] Dashboard `/admin/indexation` accessible
12. **Verdict** : 🟢 GO / 🟡 CONDITIONAL / 🔴 NO-GO

**Scoring /700 :**
- AGENT 1 Sitemap : /100
- AGENT 2 robots/llms/ai/IndexNow key : /70
- AGENT 3 IndexNow multi-moteurs : /90
- AGENT 4 Google Indexing + GSC : /90
- AGENT 5 Crawl budget : /80
- AGENT 6 Indexation FR : /100
- AGENT 7 Cycle de vie URL : /80
- AGENT 8 Monitoring : /90

**Seuils verdict :**
- ≥ 630 (90 %) : 🟢 INDEXATION PROD-READY FRANCE
- 525-629 (75-89 %) : 🟡 CONDITIONAL — P0 < 1 semaine
- < 525 (75 %) : 🔴 NO-GO — sprint correctif obligatoire

⛔ RAPPEL : aucun fix code. Si bug trouvé → ligne dans top 20 patches.

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Domaine `axion-ia.com` (Namecheap, pas axionia.eu — mémoire 2026-05-08)
- Stack Hetzner CPX42 + Coolify + CF Free
- Naming "Axion-IA" partout (cabinet IA opérationnel FR / operational
  AI consultancy EN)
- France marché primaire (Google.fr 91 % PdM)
- AI Act EU 2026 : Manon persona disclosed
- AUDIT-ONLY STRICT : zéro code, zéro commit, zéro soumission manuelle

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES INDEXATION 2026 FR                      ║
╚═══════════════════════════════════════════════════════════════════════╝

- Sitemap = invitation, IndexNow = sonnette, GSC submit = clé
- Google domine FR (91 %), mais Bing croît (Edge default Windows 11)
- Qwant + Ecosia + DDG = Bing index → soumission Bing = couverture tous
- Google Indexing API officiel = JobPosting + BroadcastEvent. Articles
  toléré best-effort, pas garanti.
- IndexNow = standard ouvert. Google NE l'utilise PAS officiellement.
- Crawl budget Hetzner self-hosted = critique (pas de boost Vercel)
- pSEO 12 942 routes = phasing recommandé pour ne pas saturer Googlebot
- Article "exists" ≠ Article "indexed". Vérifier via GSC URL Inspection.
- 90 % SEO 2026 = indexation rapide + structured data + canonical
  rigoureux. Le reste = backlinks + E-E-A-T.
- Brand search "Axion-IA" doit être #1 (sinon problème de marque)
- pSEO villes = stratégie "longue traîne hyper-locale". Risque HCU 2024
  si < 40 % unique par ville. Bouclier déjà posé (mémoire 2026-05-08).
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche)

> Lance l'audit `_AUDIT/PROMPT-CONTENT-GEN-AUDIT-INDEXATION-FR-2026.md` en mode AUDIT-ONLY strict extrême perfection 2026. 8 agents parallèles, scoring /700, focus marché France primaire (Google.fr 91 % PdM + Bing FR + Qwant + Ecosia + DuckDuckGo + Lilo). Mesure sitemap architecture (sitemap-index split news/articles/faq/villes/connaissances + Google News quota 1000/48h + hreflang FR/EN réciproque + image sitemap) + robots.txt + llms.txt + ai.txt + IndexNow key file + IndexNow auto-trigger multi-moteurs (Bing/Yandex/Naver/Seznam universal) + Google Indexing API JWT + Search Console URL Inspection (20 URLs sample) + crawl budget Googlebot Hetzner + pSEO villes 12 942 routes phasing + indexation FR (Google Business Profile + annuaires NAP cohérents + Bing Webmaster + visibilité Qwant/Ecosia/DDG) + cycle de vie URL complet (publish/update/slug-change/unpublish/delete + audit log hash-chain) + monitoring (dashboard /admin/indexation + alertes Telegram + Plausible search referer + GSC API daily worker). Produis le rapport `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md`. Aucun fix, aucun commit, aucune soumission manuelle URL, aucun appel API IA externe. Verdict /700 avec top 20 patches P0-P3 + checklist activation factory 100/jour côté indexation (cible ≥ 630 pour 🟢 INDEXATION PROD-READY FRANCE).
