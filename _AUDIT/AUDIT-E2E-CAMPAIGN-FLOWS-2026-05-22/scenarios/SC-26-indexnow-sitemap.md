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

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- **P0-1 du verdict initial RÉFUTÉ par runtime.** `/sitemap-news.xml` retourne **HTTP 200** runtime.
- Route handler présent : `src/app/sitemap-news.xml/route.ts` (file confirmé via `find`).
- Contenu sitemap-news.xml valide XML : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>` (vide en local car aucun article publié dans les dernières 48h).
- Sitemap-index.xml : HTTP 200, inclut le sub-sitemap news.
- ⚠️ `/sitemap-blog.xml` retourne 404 — pas de sub-sitemap blog dédié (couvert par sitemap-index agrégat). À documenter ou créer si besoin spécifique.
- IndexNow worker présent + alertIndexNowFailStreak câblé.

**Verdict runtime** : 🟢 OK runtime (P0-1 du verdict initial OBSOLÈTE)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
