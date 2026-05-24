# A17 Phase 17 — Web Vitals top 1% thresholds

## Statut : ✅ PROD (env-gated, désactivé par défaut)

## Files claimed vs found

| Claimed (commit 91092353)                                       | Found                                                                                          | Match |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `src/lib/web-vitals/top1pct-thresholds.ts` (+76)                | `axionia/src/lib/web-vitals/top1pct-thresholds.ts` (76 lignes)                                 | ✅    |
| `src/lib/web-vitals/__tests__/top1pct-thresholds.spec.ts` (+62) | `axionia/src/lib/web-vitals/__tests__/top1pct-thresholds.spec.ts` (62 lignes, 6 tests WV1→WV6) | ✅    |

Commit stat exact : 2 fichiers, 138 insertions. Aucun fichier manquant.

## Thresholds top 1% (table)

Comparaison `AGENTS.md` (cible interne V1) vs `THRESHOLDS_TOP_1PCT` dans le code :

| Metric | Threshold AGENTS.md (V1) | Threshold code V1 (`THRESHOLDS_V1.good`) | Match V1 | Threshold top 1% (`THRESHOLDS_TOP_1PCT.good`) | Stricter      |
| ------ | ------------------------ | ---------------------------------------- | -------- | --------------------------------------------- | ------------- |
| LCP    | ≤ 1800 ms                | 1800                                     | ✅       | 1200                                          | ✅            |
| INP    | ≤ 100 ms                 | 100                                      | ✅       | 50                                            | ✅            |
| CLS    | = 0                      | 0                                        | ✅       | 0                                             | ✅ (préservé) |
| TBT    | ≤ 150 ms                 | 150                                      | ✅       | 80                                            | ✅            |
| FCP    | (non dans AGENTS.md)     | 1500                                     | N/A      | 900                                           | ✅            |
| TTFB   | (non dans AGENTS.md)     | 600                                      | N/A      | 200 (requiert HTTP/3 + CF APO)                | ✅            |

`THRESHOLDS_V1` colle parfaitement aux 4 budgets internes documentés dans `axionia/AGENTS.md` (LCP/INP/CLS/TBT). FCP/TTFB ajoutés en bonus, non spécifiés dans AGENTS.md → pas de conflit.

## rateWebVitalMetric — signature

```ts
function rateWebVitalMetric(
  metric: WebVitalMetric,
  value: number,
): "good" | "needs-improvement" | "poor";
```

Signature conforme à la spec : `(metric, value) → "good" | "needs-improvement" | "poor"`. Délègue à `getActiveWebVitalThresholds()` donc honore automatiquement le switch env. Logique de classement standard (≤ good → "good", ≤ needsImprovement → "needs-improvement", sinon "poor"). CLS=0 testé explicitement (WV6) dans les 2 modes.

## Env-gated : oui

Feature flag : `WEB_VITALS_TOP_1PCT_ENABLED` (cf. lignes 21, 62 de `top1pct-thresholds.ts`).

```ts
return process.env.WEB_VITALS_TOP_1PCT_ENABLED === "true" ? THRESHOLDS_TOP_1PCT : THRESHOLDS_V1;
```

Default = V1 (safe, aligné AGENTS.md). Activation prévue Phase D mois 13+. Test WV1 verrouille le défaut, WV2 valide le switch, WV5 valide qu'un LCP 1500ms (good V1) devient needs-improvement en top1%.

## Verdict / écarts trouvés

✅ PROD env-gated propre. Les 6 tests WV1→WV6 verts (claimed) couvrent : défaut V1, switch top1%, ordre seuils (top1% ≤ V1 pour toutes métriques), rate fonction, basculement granulaire, CLS=0 préservé.

Écarts mineurs :

- Module purement déclaratif (constants + 2 helpers). Aucun callsite trouvé dans le snapshot des fichiers fournis — `rateWebVitalMetric`/`getActiveWebVitalThresholds` ne sont pas encore consommés par le composant `WebVitals` ou un endpoint RUM. Note du commit message confirme : « Quand actif : alertes RUM se déclenchent sur les seuils top1% » → câblage côté RUM probablement dans une phase ultérieure. NON BLOQUANT (Phase 17 = switch infrastructure, pas activation).
- Note Cloudflare APO + HTTP/3 documentée dans le commit body : APO = action Will hors-code (CF Pro $20/mo) pour atteindre TTFB top1% 200ms. Pas un défaut du code.
- Mention `THRESHOLDS_TOP_1PCT.CLS.needsImprovement = 0.05` (stricter que V1=0.1) cohérente avec le commentaire « Top 1 % strict » du fichier.

Aucun mot banni détecté. Aucune invention. Module conforme à AGENTS.md sur les 4 métriques internes (LCP/INP/CLS/TBT).
