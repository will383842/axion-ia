# Fl-10 — Galerie + download avec watermark RGPD

**HEAD audité** : 81f6ea0e
**Score** : 24 / 25
**Verdict** : 🟢 GO PROD

## Chaîne traçée

| Étape | Fichier | Ligne | Verdict |
|---|---|---|---|
| **Galerie index** `/fr/galerie` | `src/app/[locale]/galerie/page.tsx` | 1-219 | OK |
| Filtres URL (module / subModule / targetCity / targetRegion / targetSize / targetPersona / targetSector / targetTechno) | idem | 24-34, 119-131 | OK 8 filtres |
| Pagination 24/page | idem | 36 (`PAGE_SIZE = 24`), 196-208 | OK |
| Metadata dynamique selon filtres | idem | 42-101 | OK |
| Alternates fr-FR/en-US/x-default | idem | 79-86 | OK |
| `revalidate = 0` (dynamique pas ISR) | idem | 214 | OK |
| **JSON-LD `buildGalleryHubGraph`** (`@graph` chained 6 entités) | idem | 148-170 + 174-177 (`<script type="application/ld+json">`) | OK |
| `GalleryGrid` composant | idem | 17 import, 193 rendu | OK |
| **Detail page** `/fr/galerie/[slug]` | `src/app/[locale]/galerie/[slug]/page.tsx` | 1-100+ | OK |
| ISR `revalidate = 3600` | idem | 14 | OK |
| Metadata détail + OG image + alternates locale | idem | 20-90 | OK |
| `buildImageDetailGraph` JSON-LD 6 entités chaînées | idem | 12 import | OK |
| **Route download** `/fr/galerie/[slug]/telecharger` | `src/app/[locale]/galerie/[slug]/telecharger/route.ts` | 1-179 | OK |
| **RGPD : IP hashée SHA-256 + IP_HASH_SALT** | idem | 35-38 (`createHash("sha256").update(`${salt}:${ip}`).digest("hex")` ; salt depuis `env.IP_HASH_SALT`) | **EXACT RGPD** |
| **Rate-limit 10 downloads/min/IP (anti-abus)** | idem | 28-30, 59-76 | OK |
| Reading depuis public/ (slug-based) ou Docker volume `IMAGE_BANK_STORAGE_PATH` (uuid-based) | idem | 92-115 | OK |
| **Watermark on-the-fly Sharp** (bottom-right opacity 0.65) | idem | 117-124 (`imageWatermarkService.apply`) | OK |
| Conversion JPEG on-the-fly via Sharp | idem | 126-135 | OK |
| **`ImageDownloadLog` tracking non-blocking** (RGPD compliant : ipHash + userAgent troncated 255) | idem | 137-148 (`prisma.imageDownloadLog.create`) | OK |
| Increment `imageAsset.downloadCount` | idem | 150-155 | OK |
| `X-Robots-Tag: noindex, nofollow` sur réponse download | idem | 167 | OK |
| HEAD method | idem | 172-178 | OK |
| **Prisma model `ImageDownloadLog`** | `prisma/schema.prisma` (grep confirmé présence) | OK |
| Lib `ip-hash.ts` | `src/lib/security/ip-hash.ts` (grep confirmé) | OK |
| RGPD effacement (right-to-be-forgotten) | `src/lib/rgpd-erase.ts` + `src/server/actions/image-bank/forget-ip-hash.action.ts` (grep) | OK droit à l'effacement |
| Backfill IP_HASH migration | `prisma/scripts/backfill-ip-hash-2026-05-16.ts` (grep) | OK |

## Findings P0/P1/P2

| Niveau | Item | Référence |
|---|---|---|
| **P1** | `revalidate = 0` sur galerie index → page rendue dynamiquement à chaque hit. Acceptable pour filtre admin/preview mais coûteux côté DB sur traffic élevé. Une stratégie alternative `revalidate = 60` permettrait du cache 1min avec impact UX nul. | `galerie/page.tsx:214` |
| **P2** | `X-Robots-Tag` posé sur download (correct), mais pas de check Cloudflare hotlinking explicite — le rate-limit 10/min/IP couvre l'essentiel. | `telecharger/route.ts:167` |

## Verdict détaillé

Flow galerie + download exceptionnel. Toutes les exigences sont câblées :
- Grid avec 8 filtres URL + pagination 24/page
- JSON-LD ImageObject (via `buildGalleryHubGraph` + `buildImageDetailGraph` `@graph` chained 6 entités)
- **Download tracking RGPD** : IP SHA-256 hashée avec salt env (`env.IP_HASH_SALT`), userAgent tronqué 255 char, `ImageDownloadLog` model + droit à l'effacement (`forget-ip-hash.action.ts`)
- **Watermark on-the-fly** via Sharp service (bottom-right, opacity 0.65)
- Rate-limit 10/min/IP via Redis hashed key
- Conversion JPEG on-the-fly possible
- X-Robots-Tag noindex sur download

Score 24/25 (−1 P1 : `revalidate = 0` sur index — décision UX vs perf à valider).
