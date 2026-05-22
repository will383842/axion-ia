# SC-26 — Indexation rapide IndexNow + sitemap-news + sitemap-blog

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. Article publié (SC-01)
2. IndexNow ping envoyé (logs worker `indexnow-worker`)
3. Sitemap-news inclut URL dans 5 min
4. Sitemap-blog inclut URL

## Cartographie code

- Worker IndexNow : `axionia/src/server/queue/workers/content-indexnow-worker.ts:66-137`
- Sitemap-index : `axionia/src/app/sitemap.ts:258-306`
- Sitemap-blog DB-aware : `sitemap.ts:489-593`
- HTTP POST direct `api.indexnow.org`, rate-limit 30/min
- Kill-switch check line 74
- TTL fail-streak Redis 1h `indexnow:fail-streak` — escalade Telegram 3/10/30 fails

## Invariants

- ✅ generateSitemaps() chunkage auto 1000 URLs/fichier
- ✅ sub-sitemap blog DB-aware (Article tier-1_indexable)
- ✅ Fallback stub-safe (DB down → empty array)

## 🔴 Gap critique détecté

- **`sitemap-news.xml` route handler MANQUANT** — comment line 265-270 indique "news" RETIRÉ de generateSitemaps (ref § 4.1.3) mais route handler `app/sitemap-news.xml/route.ts` non trouvé.
- **Conséquence** : nouvelles articles `isNews=true` invisibles Googlebot News.

## ⚠️ Gaps

- ❌ Pas de tests : TTL reset, fail-streak threshold, rate-limiter
- ⚠️ Helper `buildExternalLinksPromptSection()` référencé mais source manquante (line 14 external-links-injector.ts)

## Tests

- ❌ Aucun test coverage IndexNow worker

## Verdict 🟡 PARTIAL (code)

IndexNow worker solide MAIS **sitemap-news.xml manquant** = gap P1 SEO actualités à investiguer Will.
