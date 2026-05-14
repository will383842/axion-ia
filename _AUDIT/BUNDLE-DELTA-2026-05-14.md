# Bundle delta — Sprint S6.2 (Pass B P1-10)

> Procédure de mesure du bundle First Load JS post-S6.1 + S6.2 fixes.
> Pass B P1-10 demandait une trace explicite (`size-limit` config présent
> mais pas de rapport `_AUDIT/`).

## 1. Commandes

```bash
# Bundle analyzer (rapport HTML interactif)
pnpm bundle:analyze

# Size-limit gate CI (compare contre seuils package.json)
pnpm bundle:check
```

## 2. Budget doctrine (`AGENTS.md`)

| Route                                   | Budget First Load JS (gz) | Notes                                            |
| --------------------------------------- | ------------------------- | ------------------------------------------------ |
| `/`, `/fr`, `/en`                       | ≤ 75 KB                   | Doctrine 15 pages stratégiques                   |
| `/fr/interventions` + sous-pages        | ≤ 75 KB                   | Idem                                             |
| `/fr/audit`, `/fr/implementation`       | ≤ 75 KB                   | Idem                                             |
| `/fr/reserver`                          | ≤ 110 KB                  | Exception calendrier client-heavy                |
| `/fr/blog/[slug]` (article content-gen) | ≤ 75 KB                   | Tier-1 généré                                    |
| `/fr/actualites/[slug]` (RSS-derived)   | ≤ 80 KB                   | Tolérance +5 KB (NewsArticle JSON-LD plus lourd) |
| `/fr/faq/[slug]` (Q/R derived)          | ≤ 75 KB                   | QAPage Speakable                                 |
| Admin `/[adminPrefix]/content-gen/**`   | non-budgétisé             | Admin authentifié, pas d'enjeu Web Vitals public |

`size-limit` config (package.json) bloque les PR avec delta > +5 KB gz vs `main`.

## 3. Mesures historiques

| Date       | Commit                             | Route critique | First Load JS gz         | Δ vs précédent                       |
| ---------- | ---------------------------------- | -------------- | ------------------------ | ------------------------------------ |
| 2026-05-08 | `941a8e1` (Web Vitals V1+V2 livré) | `/fr`          | mesure à archiver        | baseline doctrine                    |
| 2026-05-14 | `61ba6dd` (S6.1 fixes)             | n/a            | **non mesuré post-S6.1** | gap audit (P1-10)                    |
| 2026-05-14 | S6.2 (ce commit)                   | à mesurer      | **à archiver**           | objectif : Δ ≤ +2 KB gz vs `61ba6dd` |

## 4. Risques de régression bundle introduits par S6.1 → S6.2

| Source                                   | Risque                                  | Atténuation             |
| ---------------------------------------- | --------------------------------------- | ----------------------- |
| `cost-tracker.ts` + `pii-safe.ts`        | Bundle serveur uniquement (server-only) | aucun impact First Load |
| `constants.ts` content-gen admin         | Routes admin uniquement                 | aucun impact public     |
| `tiptap-sanitize` import dans KB preview | Route admin uniquement                  | aucun impact public     |
| Tests vitest + Playwright                | dev/test only, exclus du bundle         | aucun                   |
| Vitest thresholds 60 %                   | config CI, hors bundle                  | aucun                   |

→ **Pas de modif bundle public attendue côté S6.2**. Mesure post-deploy reste obligatoire pour confirmer.

## 5. Action

```bash
# 1. Run sur PR post-merge S6.2
pnpm bundle:analyze
# 2. Capture le rapport HTML .next/analyze/client.html
# 3. Annoter cette table avec le résultat (route critique + First Load gz)
# 4. Commit la mise à jour de ce fichier
```

CI bloquera automatiquement via `size-limit` si dépassement seuil.

---

_Auteur : autopilote Pass B S6.2 (2026-05-14). Référence § 9.10 master prompt + AGENTS.md Performance budget._
