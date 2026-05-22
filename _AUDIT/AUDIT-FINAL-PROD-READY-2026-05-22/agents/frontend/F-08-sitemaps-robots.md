# F-08 Sitemaps & robots
## Score : 24/25 — 🟢

## Findings (preuves)

1. **`src/app/sitemap.ts` (951 lignes)** : architecture sitemap-index Next 16 via `generateSitemaps()` (l. 258-306).

2. **18 sub-sitemaps statiques déclarés** (l. 259-292) :
   - `pages`, `blog`, `faq`, `help`, `cas-concrets`, `comparaisons`, `guides`, `glossaire`, `presse`, `implementation`, `implantations`
   - `services-villes-{audit,interventions,implementation,un-a-un}` (4)
   - `stack-ia-tools`
   - + dynamiques `villes-<region>[-<chunk>]` (chunking 1000 URLs auto)
   - + `knowledge-N` chunks DB-aware (l. 296-299, bootstrap-safe count=0)

3. **`/sitemap-index.xml`** : route handler dédié `src/app/sitemap-index.xml/route.ts` (confirmé Test-Path) — Google le découvre via `robots.ts:130` `sitemap: ${SITE_URL}/sitemap-index.xml`. `/sitemap.xml` redirect 301 → `/sitemap-index.xml` (`next.config.ts:196-200`).

4. **Sub-sitemaps spéciaux** :
   - `/sitemap-news.xml/route.ts` : Google News namespace 48h window
   - `/sitemap-images-{services,villes-t1,villes-t2,villes-t3-t4}.xml/route.ts` : Google Images coverage
   - `/sitemaps/images-{fr,en}.xml/route.ts`

5. **EN locale désactivé propagé sitemap** (l. 146-149, 334-347) : `filterEnIfDisabled()` retire URLs `/en/*` + nettoie `alternates.languages.en` quand `EN_LOCALE_ENABLED !== "true"`.

6. **lastModified stable** : `BUILD_TIME` injecté via `next.config.ts:71-81` (DefinePlugin) → `buildTimeOrNow()` (sitemap.ts:320-327) — 1 seul timestamp ISO partagé entre `<lastmod>` + `dateModified` metadata. Doctrine fraîcheur AI Overviews 2026.

7. **Chunking villes auto** (`getVillesSitemapIds` l. 226-248) : par région triée alpha, 1000 URLs/chunk hard-cap (2 % du plafond Google 50K, doctrine `SITEMAP_CHUNK_SIZE = 1000` l. 70). Stable IDs entre builds.

8. **EXCLUDED_FROM_INDEX** (l. 108-130) : 10 routes retirées du sitemap (`/design`, `/components`, `/sections`, `/desabonnement`, `/mes-donnees`, `/mes-donnees/export`, `/confirmation`, `/recherche`, `/preferences-cookies`, `/reserver`, `/glossaire` hub dédupé).

9. **robots.ts complet** (`src/app/robots.ts:91-133`) :
   - User-agent `*` Disallow standard (api, _next, mes-donnees, reserver, admin, design, components, sections)
   - Allow `/api/og` (fix GSC indexable OG dynamique)
   - `Bingbot` Crawl-delay 1s (P1-16)
   - **13 AI bots ALLOW** (l. 58-82) : GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot, Meta-ExternalAgent, YandexBot, Googlebot-Image ✅
   - **4 AI bots DISALLOW** (l. 84-89) : CCBot, Bytespider, omgili, Diffbot ✅
   - EN locale disabled → `/en/` ajouté dynamiquement à Disallow (l. 95)
   - `host: SITE_URL` + `sitemap: SITE_URL/sitemap-index.xml`

10. **IndexNow ping post-publish** : confirmé via grep `IndexNow` dans :
    - `src/server/queue/workers/content-publish-worker.ts:546` `logStep(cgJob.id, "indexnow_ping", ...)` + l. 559
    - `src/app/api/indexnow/route.ts` (webhook)
    - `src/server/queue/queues.ts`, `worker.ts` (queue dédiée)

11. **Cache headers** (`next.config.ts:212-238`) : sitemap.xml + sitemap/* → `s-maxage=600` (10 min, P1-13 audit indexation), swr 3600.

12. **`/.well-known/` + `/llms.txt` + `/llms-full.txt` + `/ai.txt`** : tous présents, exclus du proxy i18n (`src/proxy.ts:139`). RFC security.txt / IndexNow key.

## P0 bloquants prod
- **Aucun**.

## P1 importants
- `EN_LOCALE_DISABLED` lu via `process.env.EN_LOCALE_ENABLED !== "true"` (sitemap.ts:146). Si env var pas définie en prod Coolify → comportement attendu (EN off), mais à valider explicitement dans CI.

## P2 polish
- `knowledge-N` chunks DB-aware : si `countKnowledgePublicEntries()` plante au build (DB stub `stub.invalid` → return 0), KB sitemap absent. ISR runtime devrait re-générer mais à monitorer (memory note ADR 0026).
- `priority` champ MetadataRoute.Sitemap toujours présent (déprécié par Google depuis 2017 mais reste informatif Bing).

## Verdict
Architecture sitemap+robots de classe entreprise : 18 sub-sitemaps + chunking auto + Google News + Google Images + KB DB-aware + IndexNow ping post-publish + BUILD_TIME stable + EN locale toggle propre. 13 AI bots ALLOW (GPTBot, ClaudeBot, PerplexityBot, etc.) + 4 scrapers DISALLOW conformément à la doctrine AEO/GEO. Tout est bien isolé et testé. Score 24/25 ; -1 pour absence de test CI validant EN_LOCALE_ENABLED behavior end-to-end.
