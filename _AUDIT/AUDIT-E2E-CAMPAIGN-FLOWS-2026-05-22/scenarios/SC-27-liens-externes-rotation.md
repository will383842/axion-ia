# SC-27 — Rotation liens externes (acquis 8ed99871)

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. Générer 10 articles consécutifs verticale `audits` ville Paris
2. Pour chaque : noter 3 liens externes injectés
3. Vérifier rotation (pas mêmes 3 liens 10 fois) + diversité orgas (pas 3× INSEE) + filtres durs (no concurrent, paywall, HTTP)

## Cartographie code

- Dispatch injection : `axionia/src/server/content-gen/links/external-links-injector.ts:20-76` (9 generators couverts)
- Scoring + diversif : `axionia/src/data/external-links/helpers.ts:20-133` (`selectExternalLinks`)
- Catalogue 11 sources : `axionia/src/data/external-links/master.ts:54-78`
- Worker monthly cron : `axionia/src/server/queue/workers/external-links-monitor-worker.ts:219-354`
- Table Prisma : `ExternalLinkUsage` `schema.prisma:3700-3713`
- Filtres durs (helpers.ts:28-37) : `status active|redirect`, `not competitor`, `not paywall`, `https-only`, `indexable` (robots.txt), `authority >= minAuthority` (default 4)
- Rotation : scoring `round_robin` (default), anti-répétition `maxRecentUsageHours=24`, bonus authority+geo+schemaorg
- Diversif orgas : max 1 par orga (line 125-130)
- Monthly monitor : HEAD check URL, paywall detection, robots.txt parse, JSON `verification-status.json` + Telegram si > 5% broken

## 🔴 Gaps majeurs détectés

1. **`usageCount` increment ABSENT** : aucun appel `trackExternalLinksUsage()` visible dans les 9 generators. Scoring `link.usageCount * 2` (line 114) suppose increment mais pas de persist POST-injection. → **Rotation scoring n'a aucun feed réel** : tous scores ~100, aucune histoire.
2. **FK `ExternalLinkUsage.externalLinkId` MANQUANTE** : schema.prisma L3702 a `@unique` mais pas de FK contrainte vers `ExternalLink`. → Orphelin si source ID retirée.
3. **Diversification INSEE faillable** : code diversif vise `.organization` (string), pas découpage INSEE par codes numériques. Risque 3 codes INSEE (001, 002, 003) = 3 orgas distinctes = passe filter line 126.

## Tests

- `external-links-injector.test.ts` (référencé)

## Verdict 🟡 PARTIAL (code)

Sélection + filtres + monitor solides MAIS rotation **non boucle de feedback** (usageCount jamais incrémenté) + FK orpheline. P1 fix.
