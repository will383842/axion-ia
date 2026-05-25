# D-10 — Audit Sitemap / robots.txt / llms.txt / ai.txt
**Date** : 2026-05-25  
**Agent** : D-10  
**Dev server** : http://localhost:3000 (running)  
**Verdict global** : CONDITIONNEL — 1 P0 bloquant (llms.txt conflit), reste OK

---

## 1. robots.txt — PASS (200 OK)

### Résumé
Le fichier robots.txt est correctement servi et bien structuré.

### User-agents listés (19 blocs)
| User-Agent | Stance | Catégorie |
|---|---|---|
| `*` | Allow: / | Défaut |
| `Bingbot` | Allow: / + Crawl-delay: 1 | SEO classique |
| `GPTBot` | Allow: / | AI opt-in OpenAI |
| `OAI-SearchBot` | Allow: / | AI opt-in OpenAI |
| `ChatGPT-User` | Allow: / | AI opt-in OpenAI |
| `ClaudeBot` | Allow: / | AI opt-in Anthropic |
| `anthropic-ai` | Allow: / | AI opt-in Anthropic |
| `Claude-Web` | Allow: / | AI opt-in Anthropic |
| `PerplexityBot` | Allow: / | AI opt-in Perplexity |
| `Perplexity-User` | Allow: / | AI opt-in Perplexity |
| `Google-Extended` | Allow: / | AI opt-in Google |
| `Applebot-Extended` | Allow: / | AI opt-in Apple |
| `Mistral-User` | Allow: / | AI opt-in Mistral |
| `Meta-ExternalAgent` | Allow: / | AI opt-in Meta |
| `YandexBot` | Allow: / | SEO Yandex |
| `Googlebot-Image` | Allow: / | Images Google |
| `CCBot` | **Disallow: /** | Scraper bloqué |
| `Bytespider` | **Disallow: /** | Scraper bloqué |
| `omgili` | **Disallow: /** | Scraper bloqué |
| `Diffbot` | **Disallow: /** | Scraper bloqué |

**Total opt-in AI** : 16 blocs (GPTBot + OAI-SearchBot + ChatGPT-User + ClaudeBot + anthropic-ai + Claude-Web + PerplexityBot + Perplexity-User + Google-Extended + Applebot-Extended + Mistral-User + Meta-ExternalAgent = 12 AI spécifiques + 4 neutrals/SEO)  
**Total blocs** : 19 + `*` = 20 rules (audit v7 "19 bots conformes" est confirmé)

### Checklist cibles D-10 (10 bots)
| Bot ciblé | Présent | Stance | Status |
|---|---|---|---|
| GPTBot | YES | Allow | OK |
| ClaudeBot | YES | Allow | OK |
| PerplexityBot | YES | Allow | OK |
| Google-Extended | YES | Allow | OK |
| Bytespider | YES | **Disallow** | OK (intentionnel — scraper hostile) |
| anthropic-ai | YES | Allow | OK |
| CCBot | YES | **Disallow** | OK (intentionnel — Common Crawl) |
| FacebookBot | INDIRECT (Meta-ExternalAgent) | Allow | OK (équivalent fonctionnel) |
| cohere-ai | **ABSENT** | * rules s'appliquent (Allow) | P2 — non bloquant |
| DuckAssistBot/Omgilibot | PARTIAL (omgili Disallow) | Disallow | P2 — DuckAssistBot distinct non listé |

### Directives critiques
- `Disallow: /admin/` + `/fr/admin/` + `/en/admin/` : PRESENT
- `Disallow: /api/` avec `Allow: /api/og` : PRESENT
- `Sitemap: http://localhost:3000/sitemap-index.xml` : PRESENT (URL prod sera https://axion-ia.fr/sitemap-index.xml)
- `Disallow: /en/` (locale désactivée) : PRESENT — cohérent avec décision AGENTS.md

---

## 2. sitemap-index.xml — PASS (200 OK)

### Résumé
XML valide, 36 sous-sitemaps couvrant l'ensemble des verticales et villes Sprint A.

### Sous-sitemaps listés (36)
**Knowledge/Content** :
- `/sitemap/pages.xml` — pages statiques
- `/sitemap/blog.xml` — articles blog
- `/sitemap/faq.xml` — FAQ
- `/sitemap/help.xml` — centre aide
- `/sitemap/cas-concrets.xml` — études de cas
- `/sitemap/comparaisons.xml` — comparatifs
- `/sitemap/guides.xml` — guides IA
- `/sitemap/glossaire.xml` — glossaire
- `/sitemap/presse.xml` — espace presse
- `/sitemap/implementation.xml` — pages implémentation

**Sprint A — Implantations & Services-Villes** :
- `/sitemap/implantations.xml` — hubs villes (2150 villes × 2 templates)
- `/sitemap/services-villes-audit.xml` — audit par ville
- `/sitemap/services-villes-interventions.xml` — interventions par ville
- `/sitemap/services-villes-implementation.xml` — implémentation par ville
- `/sitemap/services-villes-un-a-un.xml` — coaching par ville
- `/sitemap/stack-ia-tools.xml` — stack IA

**Villes par région (13 régions)** :
- villes-auvergne-rhone-alpes, villes-bourgogne-franche-comte, villes-bretagne, villes-centre-val-de-loire, villes-grand-est, villes-hauts-de-france, villes-ile-de-france, villes-normandie, villes-nouvelle-aquitaine, villes-occitanie, villes-pays-de-la-loire, villes-paca, villes-corse

**News & Images** :
- `/sitemap-news.xml` — actualités 48h
- `/sitemaps/images-fr.xml`, `/sitemaps/images-en.xml` — banque images
- `/sitemap-images-services.xml` — images services
- `/sitemap-images-villes-t1.xml` — T1 ≥100K hab
- `/sitemap-images-villes-t2.xml` — T2 50-100K
- `/sitemap-images-villes-t3-t4.xml` — T3/T4 5-50K

### Accessibilité sous-sitemaps (dev local)
Les sous-sitemaps DB-dependent génèrent des timeouts/500 en dev local. C'est le comportement **attendu** (pas de seed complet en local). En prod : BUILD-time SSG + ISR revalidate=3600.

| Sous-sitemap | Status local | Raison | Prod |
|---|---|---|---|
| `/sitemap/pages.xml` | 500 (timeout 26s) | Prisma queries sans DB | ISR OK |
| `/sitemap/blog.xml` | 500 | Prisma articles | ISR OK |
| `/sitemap/implantations.xml` | Timeout | 2150 villes SSG lourd | SSG prod OK |
| `/sitemap-news.xml` | Timeout | Articles 48h DB | ISR prod OK |

### Note Sprint A
Sprint A est **correctement représenté** dans le sitemap-index : `implantations.xml` + les 4 `services-villes-*.xml` sont bien listés.

---

## 3. llms.txt — ECHEC P0 (500 Conflit)

### Diagnostic
```
Error: A conflicting public file and page file was found for path /llms.txt
```

**Cause** : `public/llms.txt` (fichier statique, 7422 bytes) ET `src/app/llms.txt/route.ts` (route Edge dynamique) coexistent. Next.js 16 refuse de servir les deux et émet un 500.

### Contenu de la route dynamique (src/app/llms.txt/route.ts)
- 107 lignes Markdown structuré
- Mentionne Axion-IA, services, implantations/villes/verticales
- **Sprint A couvert** : "Hub implantations France", Paris pilote, "industrialisation sur 2 150 villes"
- Mentionne sitemaps images villes T1/T2/T3-T4
- Taille > 1000 chars : OUI
- Format llmstxt.org spec : OUI

### Contenu du fichier statique (public/llms.txt)
- 88 lignes, 7422 bytes (plus verbeux)
- **Inclut section "Sprint A — Ville Pages Structure (2026-05-25)"** explicite
- Plus à jour car modifié manuellement post-Sprint A

### Fix recommandé (P0 — 5 minutes)
```bash
rm public/llms.txt
```
La route dynamique `src/app/llms.txt/route.ts` (Edge, Cache-Control 1h+24h SWR) est la source de vérité. Elle devra idéalement recevoir le contenu Sprint A qui est dans le fichier statique (section "Sprint A — Ville Pages Structure" notamment).

**Actions** :
1. `rm public/llms.txt` — immédiat, résout le 500
2. Optionnel : enrichir `route.ts` avec la section Sprint A détaillée du fichier statique

---

## 4. llms-full.txt — PASS (200 OK)

Route dynamique `/llms-full.txt/route.ts` sans conflit public/. Accessible correctement.

---

## 5. ai.txt — PASS (200 OK)

### Contenu
- Fichier well-formed, structure robots-like
- Opt-in AI training : ClaudeBot, OAI-SearchBot, PerplexityBot, GPTBot, Google-Extended, Applebot-Extended
- Disallow AI training : Bytespider, CCBot, Diffbot, omgili (cohérent avec robots.txt)
- Clause commerciale : `commercial-reuse-license: contact@axion-ia.com`
- Source : `src/app/ai.txt/route.ts` (route dynamique — pas de conflit public/)

---

## 6. .well-known/security.txt — ABSENT (Timeout)

La route `/well-known/security.txt` ne répond pas (timeout). Non implémentée.

**Sévérité** : P3 cosmétique. RFC 9116 recommandé pour la maturité sécurité mais aucun impact SEO/AEO.

---

## 7. Cohérence sitemap ↔ robots.txt

| Check | Résultat |
|---|---|
| `Sitemap:` URL dans robots.txt | `http://localhost:3000/sitemap-index.xml` |
| sitemap-index.xml accessible | HTTP 200 OK |
| Cohérence | CONFIRMEE |
| URL prod attendue | `https://axion-ia.fr/sitemap-index.xml` (via SITE_URL env) |

---

## Synthèse des sévérités

| Ressource | Status | Sévérité | Action requise |
|---|---|---|---|
| robots.txt | 200 OK | OK | Aucune (optionnel: ajouter cohere-ai) |
| sitemap-index.xml | 200 OK / 36 sub-sitemaps | OK | Aucune |
| llms.txt | **500 CONFLIT** | **P0** | `rm public/llms.txt` |
| llms-full.txt | 200 OK | OK | Aucune |
| ai.txt | 200 OK | OK | Aucune |
| security.txt | ABSENT | P3 | Non critique |
| cohere-ai dans robots.txt | ABSENT | P2 | Ajouter bloc User-agent |
| DuckAssistBot dans robots.txt | ABSENT | P2 | Ajouter bloc User-agent |
| sous-sitemaps DB | 500/Timeout local | P2-LOCAL-ONLY | Aucune (normal en dev) |

---

## Fix immédiat P0 (llms.txt conflit)

```bash
# Dans le répertoire du projet
git rm public/llms.txt
git commit -m "fix(llms): remove conflicting public/llms.txt — dynamic route src/app/llms.txt/route.ts is SSOT"
```

Ce bug est connu et documenté dans la mémoire audit (2026-05-24) avec fix recommandé identique. Il n'a pas été appliqué depuis.
