# R-02 — SEO CHAIN

## Diagramme ASCII

```
┌────────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ src/content/*.ts   │ + │ src/lib/seo/*   │ + │ src/lib/seo.ts   │
│ (data per route)   │   │ 17 factories    │   │ (metadata builder)│
└─────────┬──────────┘   └────────┬────────┘   └────────┬─────────┘
          │                       │                     │
          └───────────┬───────────┴─────────────────────┘
                      ▼
            ┌──────────────────────┐
            │ generateMetadata()   │  ← 73 routes / 76 publiques
            │ par page             │
            └──────────┬───────────┘
                       │ + JSON-LD
                       ▼
            ┌──────────────────────┐
            │ <head> SSG rendu     │
            │ + dangerouslySet      │
            │   InnerHTML LD-JSON   │
            └──────────┬───────────┘
                       │ post-build
                       ▼
            ┌──────────────────────┐
            │ scripts/indexnow-     │  ← postbuild ping Bing/Yandex
            │ ping.ts (Top 15 FR+EN)│      INDEXNOW_DISABLED=true skip
            └──────────┬───────────┘
                       ▼
            ┌──────────────────────┐
            │ Search Console + AI   │
            │ Overviews indexation  │
            └───────────────────────┘
```

## Crawl path

```
robots.txt → sitemap-index.xml (200) → 6 sitemaps split
   ⚠️ /sitemap.xml 404 (AGT-04 dégradé en FAUX positif : trade-off Next 16 documenté)
   ⚠️ AGT-04 P0 : Cloudflare Content-Signal robots.txt BLOQUE Claude/GPT/Google-Extended/Applebot/ClaudeBot/PerplexityBot
   → AEO/GEO infra (18 JSON-LD factories) NEUTRALISÉE
```

## Findings clés (Pass B-ready)

1. **AGT-04 P0** Cloudflare Managed Content bloque les bots AEO au niveau `robots.txt` prod (`curl /robots.txt` confirmé Phase 0). Croisé par AGT-05 indépendamment → **P0 CONFIRMÉ Pass B**.
2. **AGT-04 P1** Duplication `· Axion-IA · Axion-IA` dans 17 titres (template + suffix). Tronque sous 60c sur essentielle = 73c.
3. **AGT-04 P1** `/llms-full.txt` → 307 vers `/fr/llms-full.txt` (middleware next-intl intercepte). Spec llmstxt.org veut 200 direct.
4. **AGT-04 P1** `sitemap-index.xml` `lastmod = new Date()` à chaque hit → signal Google low-quality.
5. **AGT-05 P1** og:image localhost-bug **PRÉ-EXISTANT MAIS RÉSOLU** : Phase 0 + AGT-04 confirment `https://axion-ia.com/api/og?...` en prod ✅. Mémoire `axionia_bugs_seo_preexistants_2026-05-09` à mettre à jour.
6. **AGT-05 P0** ratio AxionIA-centric Paris pilote mesuré **76/24** (grep) sous cible 95/5. Section 9 (data INSEE) trop dense.

## Cohérence chaîne

✅ `metadataBase` + `alternates.canonical` + hreflang fr/en/x-default propres (AGT-04).
✅ 73/73 routes publiques avec `generateMetadata`.
⚠️ Si CF Content-Signal bloque les bots AEO, **toute la chaîne SEO/AEO côté Cloudflare est inopérante** sur les LLM crawlers — perte massive de potentiel GEO/AEO 2026.
