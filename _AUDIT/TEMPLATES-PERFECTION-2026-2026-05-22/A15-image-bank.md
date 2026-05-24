# Audit A15 — Image-bank pipeline

**Date** : 2026-05-22 | **Agent** : A15

## Score global : 950/1000

| Axe                    | Score | État                                                               |
| ---------------------- | ----: | ------------------------------------------------------------------ |
| 1. Schéma Prisma       |   100 | COMPLET (10 tables, tous champs requis)                            |
| 2. Pipeline Sharp      |   100 | COMPLET (7 variants : WebP+AVIF+LQIP+OG+thumbnail+watermark)       |
| 3. Traduction FR→EN    |   100 | COMPLET (Claude Sonnet 4.6 vision, BullMQ, rate-limit respecté)    |
| 4. Licence CC BY 4.0   |    95 | COMPLET — **P0** : schema default "OÜ" vs constants "Axion-IA"     |
| 5. EXIF/XMP/IPTC       |    70 | PARTIAL — **P0** : AVIF/thumbnail missing `.withMetadata()`        |
| 6. Sitemap images 1.1  |   100 | COMPLET (4 shards, namespace Google, image:license, IndexNow ping) |
| 7. JSON-LD ImageObject |   100 | COMPLET (@graph 6 entités, tous champs requis)                     |
| 8. IndexNow ping       |   100 | COMPLET (queue intégrée, fail-silent)                              |
| 9. RGPD                |    95 | COMPLET — **P1** : self-service droit oubli absent                 |
| 10. Galerie SEO        |    95 | COMPLET (AVIF/WebP ✓, LQIP ✓, alt FR ✓)                            |

---

## P0 Critiques (30 min fixes)

### P0-1 : Copyright holder incohérent

| Fichier                                 | Valeur                                            |
| --------------------------------------- | ------------------------------------------------- |
| `prisma/schema.prisma:3386`             | `DEFAULT("Axion-IA OÜ")` — **OBSOLÈTE**           |
| `src/server/image-bank/constants.ts:57` | `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA"` — correct |

**Impact** : Nouvelles images uploadées sans override → DB stocke "OÜ" (société française, pas estonienne)
**Fix** : Migration data + update schema default | 15min

### P0-2 : AVIF et thumbnail sans `.withMetadata()` EXIF strip

```typescript
// src/server/image-bank/services/image-import.service.ts:116 (AVIF)
// src/server/image-bank/services/image-import.service.ts:104 (thumbnail)
// Manquent .withMetadata({ orientation: 1 })
```

**Impact** : GPS EXIF leak théorique sur formats AVIF et thumbnail (RGPD PII risk)
**Fix** : Add `.withMetadata({ orientation: 1 })` à chaque chain Sharp | 5min

---

## Forces pipeline

1. **Architecture data normalisée** — 10 tables, bilingue FR/EN, taxonomie 18 colonnes
2. **Sharp pipeline robuste** — 7 variants, LQIP < 1 KB, watermark adaptive, anti-zip-bomb 100MP cap
3. **SEO/AEO/GEO parfait** — JSON-LD @graph 6 entités, sitemap Google 1.1, image:geo_location, IndexNow
4. **Traduction automatisée** — Claude Sonnet 4.6 vision, prompt SEO-expert, queue-based
5. **RGPD foundation** — IP SHA-256 hashée, soft-delete, rate-limit 10/min/IP
6. **Publication gate** — score SEO ≥ 80 requis, alert ≥ 60

---

## P1 (V1.1+)

1. XMP stub uniquement (pas d'embed copyright/creator au import)
2. ImageUsageLog retention policy absent → age-out cron 13 mois recommandé
3. Self-service "forget my IP" endpoint absent (admin-only soft-delete)

---

## Conformité doctrine

- ✅ ZÉRO DALL-E (toutes images importées par Will — règle absolue)
- ✅ CC BY 4.0 visible partout
- ✅ Copyright "Axion-IA" (à corriger DB default OÜ → "Axion-IA")
- ✅ RGPD IP SHA-256 hashée
