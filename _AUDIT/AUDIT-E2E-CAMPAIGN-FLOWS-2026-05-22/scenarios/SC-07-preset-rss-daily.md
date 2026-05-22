# SC-07 — Preset `rss-daily` (RSS quotidien)

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. Preset `rss-daily` (recurringSchedule daily, contentType=`blog_from_rss`)
2. `totalTargetCount=1` — article généré via `blog-from-rss` generator
3. Vérifier ABSENCE mention "Source :" + traçabilité `isBasedOn` JSON-LD

## Cartographie code

- Seed `seed-campaign-templates.ts:19-132` (slug `rss-daily`, recurringSchedule cron daily, tz Europe/Paris)
- Generator : `axionia/src/server/content-gen/generators/blog-from-rss.ts` (cf. SC-17 détail)
- Worker fetch RSS : `axionia/src/server/queue/workers/content-rss-fetch-worker.ts`

## Invariants

- ✅ Cron quotidien validé via `CronExpressionParser`
- ✅ Anti-plagiat gate Jaccard ≤ 0.10 vs source (`blog-from-rss.ts:243-244`)
- ✅ Interdiction "Source :" enforced (line 61 system prompt + line 286-292 inverse gate)
- ⚠️ Persona Manon D3 ABSENT du system prompt (journaliste générique line 57) — gap brand voice
- ⚠️ AuthorByline absent sur pages `/actualites/[slug]` (pattern NewsArticle)
- ✅ JSON-LD `isBasedOn` traçabilité rssSourceUrl (`enrichOutputWithNewsArticleJsonLd` line 416-448)

## Tests

- ⚠️ Pas de test vitest dédié `blog-from-rss.spec.ts`

## Verdict 🟡 PARTIAL (code)

Preset RSS opérationnel ; gaps brand (Manon, byline) — peut être intentionnel pour neutralité journalistique mais à valider Will. Pas de runtime exécuté.
