# 07 — Perf + Sécurité + RGPD

> **Pondération** : 130 pts | **Score** : **93/130** (72%) 🟠
> **Note** : **un P0 BLOQUANT MERGE identifié** (RGPD droit à l'oubli).

---

## 7.1 Web Vitals gates — ✅ 10/10

`lighthouserc.json:21-22` :

```json
"url": [
  "http://localhost:3000/fr/galerie",
  "http://localhost:3000/en/gallery"
]
```

Seuils inchangés (LCP ≤ 1800ms, INP ≤ 80ms, CLS ≤ 0.05) — voir `lighthouserc.json:36-38`.

**Action manuelle Sprint 6.x** : ajouter `/fr/galerie/[SAMPLE-SLUG]` une fois image seed publiée (sinon Lighthouse audite l'index vide).

## 7.2 Size-limit bundle — ✅ 10/10

`package.json` size-limit config :

- Bucket `/galerie/**` + `/gallery/**` → 75 KB gz/route ✅

## 7.3 Sécurité upload `image-import.service.ts` — ✅ 15/15

| Check                                               | Result |                                         Line |
| --------------------------------------------------- | ------ | -------------------------------------------: |
| Magic bytes via Sharp metadata (PAS extension-only) | ✅     |                                          L49 |
| Format whitelist `ACCEPTED_INPUT_FORMATS`           | ✅     |                                          L53 |
| Sharp `limitInputPixels: 100_000_000` anti zip-bomb | ✅     |                              constants.ts:64 |
| `MAX_FILE_SIZE_SYNC_BYTES = 5 MB`                   | ✅     |                                          L56 |
| EXIF GPS + datetime + camera stripped               | ✅     | L72-82 (`.withMetadata({ orientation: 1 })`) |

## 7.4 Sécurité download `telecharger/route.ts` — ✅ 20/20

| Check                                                  | Result |                                                  Line |
| ------------------------------------------------------ | ------ | ----------------------------------------------------: |
| Rate-limit Redis 10/min/IP                             | ✅     |     L22-24 (`RATE_LIMIT_MAX = 10`, `WINDOW_SEC = 60`) |
| `ipHash` SHA-256 + `IP_HASH_SALT`                      | ✅     | L30-31 (`createHash("sha256").update(${salt}:${ip})`) |
| Rate key includes `ipHash`                             | ✅     |             L52 (`${RATE_LIMIT_KEY_PREFIX}${ipHash}`) |
| Variant whitelisted `["sm","md","lg","xl","original"]` | ✅     |                                   L26, validation L43 |
| Path traversal check (UUID Prisma)                     | ✅     |                                                L71-78 |
| No hardcoded paths                                     | ✅     |                                                     — |

## 7.5 Sécurité admin — ✅ 18/20

| Check                                                              | Result |
| ------------------------------------------------------------------ | ------ |
| Tous Server Components admin font `auth() + role === "admin"`      | ✅     |
| Server Actions idem (3/3)                                          | ✅     |
| `ADMIN_URL_PREFIX` jamais hardcodé (toujours `params.adminPrefix`) | ✅     |

⚠️ -2 pts : vérification spot-check Server Actions validation Zod robuste (déjà couvert Phase 3).

## 7.6 RGPD — ❌ 0/20 (P0 BLOQUANT MERGE)

### Conformes ✅

- `ipHash` SHA-256 + `IP_HASH_SALT` partout (telecharger/route.ts:30, env.ts:276-292) ✅
- `IP_HASH_SALT` superRefine prod (env.ts:285) ✅
- Retention purge worker 12 mois étendu (retention-purge-worker.ts:194-202) ✅

### ❌ P0 — Endpoint droit à l'oubli ABSENT

**Search exhaustive** :

```bash
find 'src/app/[locale]/(admin)/[adminPrefix]/image-bank' -path '*usage-logs*' -name 'route.ts' → 0
find src/server/actions/image-bank -name '*usage*' → 0
grep -r "deleteUsageLogsByIpHash\|forgetIpHash\|right.to.erasure\|droit.oubli" src/server/image-bank src/server/actions/image-bank → 0
```

**Aucun endpoint `DELETE /admin/image-bank/usage-logs/{ipHash}` ni Server Action `forgetIpHashAction(ipHash)` n'existe**.

**Impact légal** :

- Violation **RGPD art. 17 (Droit à l'effacement)** — UE obligation légale
- Tables concernées : `ImageUsageLog` + `ImageDownloadLog` indexées par `ipHash`
- L'utilisateur final ne peut pas demander la suppression manuelle de ses logs

**Sévérité** : **P0 BLOQUANT MERGE**.

**Patch proposé** : route admin `DELETE /api/admin/image-bank/usage-logs/[ipHash]/route.ts` + page admin `usage-logs/page.tsx` fonctionnelle (recherche par ipHash + bouton « Forget »). Voir `PATCHES-PROPOSES.md` §P0-1.

**Effort estimé** : ~1h30 (route + Server Action + page admin minimale + 1 test).

### ❌ P2 — Hard delete fichiers `deletedAt > 90j`

Soft delete `ImageAsset.deletedAt` OK, mais aucun worker ne hard-delete les variants WebP/AVIF/originaux du storage (S3/local) après 90j. Voir `image-bank-crons-worker.ts:33` (TODOs `seo-score-recalc`, `taxonomy-redetect-batch`, `watermark-backfill` mais pas `hard-delete-files-purge`).

**P2 V1.5** — Worker `image-bank-crons-worker` à étendre avec handler `hard-delete-soft-deleted-files`.

## 7.7 CSP nonce — ✅ 10/10

- `<script type="application/ld+json">` dangerouslySetInnerHTML OK car JSON inline pas exec (galerie/page.tsx:164, [slug]/page.tsx:90) ✅
- `lib/csp.ts` middleware support présent ✅

## 7.8 XSS — ✅ 10/10

- `dangerouslySetInnerHTML` uniquement avec `JSON.stringify(graph)` ✅
- Alt/caption affichés via React (`<p>{tr.caption}</p>`), pas innerHTML → React échappe automatiquement ✅
- Pas de custom HTML injection vectors ✅

---

## 📋 Issues identifiées

### P0 (1) BLOQUANT MERGE

- **P0-1** : Endpoint RGPD droit à l'oubli ABSENT. Violation art. 17 GDPR. Effort 1h30.

### P2 (2)

- **P2-PERF-1** : Lighthouse audit sur `/fr/galerie/[SAMPLE-SLUG]` non-ajouté (manuel Sprint 6.x après image seed). Effort 5min.
- **P2-RGPD-1** : Hard delete fichiers storage si `deletedAt > 90j` (handler `image-bank-crons-worker`). Effort 1-2h.

---

## 🎯 Sous-pondération

| Check                                                           |     Pts |           Score |
| --------------------------------------------------------------- | ------: | --------------: |
| 7.1 Web Vitals gates                                            |      10 |              10 |
| 7.2 Size-limit                                                  |      10 |              10 |
| 7.3 Sécurité upload (magic bytes + Sharp + EXIF strip)          |      15 |              15 |
| 7.4 Sécurité download (rate-limit + ipHash + variant whitelist) |      20 |              20 |
| 7.5 Sécurité admin (auth role check)                            |      20 |              18 |
| 7.6 RGPD (P0 droit à l'oubli)                                   |      25 |               0 |
| 7.7 CSP nonce                                                   |      10 |              10 |
| 7.8 XSS                                                         |      10 |              10 |
| Margin (retention purge worker + IP_HASH_SALT superRefine)      |      10 | 0 (cf. P0 RGPD) |
| **TOTAL**                                                       | **130** |          **93** |

---

## ✅ Verdict Phase 7

**🟠 SPRINT CORRECTIF 93/130 (72%)** — Sécurité upload/download EXCELLENTE (magic bytes, rate-limit, ipHash, variant whitelist, EXIF strip). CSP/XSS OK.

**❌ BLOQUANT MERGE** : endpoint RGPD droit à l'oubli absent. Sans ce fix, V1 ne peut pas être prod en UE.

**Action immédiate** : coder l'endpoint (1h30). Voir patch §P0-1.
