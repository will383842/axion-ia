# P-07 — INDEXATION

## IndexNow

Le script `scripts/indexnow-ping.ts` est invoqué automatiquement en `postbuild` (`package.json:19`). AGT-04 indique : Top 15 routes × 2 locales = ~30 URLs pinguées par déploiement vers Bing + Yandex + Seznam.

### Clé IndexNow

- Servie via `src/app/api/indexnow/key/route.ts` (GET public, force-dynamic).
- AGT-12 confirme la route active prod.
- ✅ Présence confirmée. Validation effective depuis Search Console Bing : `[ACTION WILL]`.

### Logs IndexNow

- L'audit n'accède pas aux logs Coolify directs (Phase 4 = lecture API + curl only).
- Pour confirmer ping réussi → `[ACTION WILL]` : `coolify api app/<uuid>/logs --filter indexnow` ou similaire.

## Google Search Console

`[ACTION WILL]` : prompt master § 0.6 décide skip live API.

Will doit vérifier dans Search Console :

1. **Couverture** : nombre d'URLs indexées vs sitemap. Doit être ≈ 200-300 URLs (sitemap volume mesuré P-04). Si plus = pSEO leak. Si moins = problème robots.txt CF Managed Content (cross-confirmé Pass B).
2. **Erreurs d'indexation** : 404 sitemap.xml peut-il dérouter Google ? Bouclier = `robots.txt` doit déclarer `Sitemap: https://axion-ia.com/sitemap-index.xml` explicitement.
3. **CWV core** : LCP/INP/CLS p75 sur 28j. Confirme les baseline Web Vitals patches V1-V2.

## Plausible

`[ACTION WILL]` : prompt master § 0.6.

## Bing Webmaster Tools

`[ACTION WILL]` : vérifier IndexNow pings reçus.

## Bots AEO / GEO

Cross-référence AGT-04/AGT-05 P0 : CF Managed Content bloque ClaudeBot/GPTBot/Google-Extended au robots.txt en tête. **Indexation AI / Answer Engines très probablement neutralisée**. La seule façon de confirmer formellement :

- Vérifier `cache:axion-ia.com` dans ChatGPT / Claude / Perplexity (la réponse devrait être lacunaire).
- Vérifier les referrers Plausible : tag `referrer:` ChatGPT / claude.ai / perplexity.ai → si 0 visiteurs en 30j, P0 confirmé empiriquement.

## Synthèse

| Critère                           | Status                                                    |
| --------------------------------- | --------------------------------------------------------- |
| IndexNow ping postbuild           | ✅ (code présent, runtime à confirmer Will)               |
| IndexNow key endpoint             | ✅                                                        |
| sitemap-index accessible aux bots | ✅                                                        |
| sitemap.xml accessible            | ⚠️ 404 (trade-off, robots.txt doit pointer sitemap-index) |
| Google Search Console             | `[ACTION WILL]`                                           |
| Plausible analytics               | `[ACTION WILL]`                                           |
| Bing Webmasters                   | `[ACTION WILL]`                                           |
| AEO bots indexation               | 🚨 probablement bloquée CF Managed Content                |
