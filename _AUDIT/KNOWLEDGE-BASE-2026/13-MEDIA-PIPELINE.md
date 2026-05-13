# 13 — MEDIA PIPELINE, ASSET LIBRARY & IMAGE OPTIMIZATION — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` — section "Agent 13 — Pipeline médias, asset library, image optimization"
> Agent : 13 — Pipeline médias / asset library / image optimization (AUDIT-ONLY)
> Date : 2026-05-13
> Statut : DRAFT (Phase A audit-only, blueprint pour Sprint KB-11)
> Référence : HEAD `main` (commit `95bba36`)
> Reality-check feed : `00-REALITY-CHECK.md` §4.2 (BullMQ existant), §9.13 (Médias)
> Doctrine appliquée : RGPD strip EXIF, Web Vitals budget (`AGENTS.md` First Load JS ≤ 75 KB gz), Hetzner CPX32 + Cloudflare Free, code = SSOT

---

## 0. TL;DR

- **Verdict** : **GO**. La pile BullMQ (`bullmq@5.76.5`) + Redis + worker process séparé Coolify est déjà en prod (Sprint 15/M8), il suffit d'ajouter un worker `knowledge-image-process` et la dépendance `sharp` (déjà whitelistée dans `pnpm.onlyBuiltDependencies`, donc le terrain est préparé).
- **À installer** : `pnpm add sharp` en Sprint KB-11. Pas de `@tiptap/html` côté server non plus (cf. agent 17 sécurité contenu) — mais hors scope agent 13.
- **STOP & ASK ouverts** : volume Coolify pour `/data/knowledge-assets/` non confirmé (mémoire `axionia_session_2026-05-08_first_deploy` ne mentionne aucun volume persistant pour fichiers user-uploadés ; les seuls volumes prod existants sont `postgres_data_prod`, `redis_data_prod`, `caddy_data`, `caddy_config` cf. `docker/docker-compose.production.yml:210-214`). Réponse Will impérative avant Sprint KB-11.
- **Pattern figé** : service via Caddy direct (pas via Next API route), hash content-addressed SHA-256 sharded `<hash[0:2]>/<hash>`, cache CF immutable 1 an. Identique au pattern static asset standard.

---

## 1. MODÈLE PRISMA `KnowledgeAsset` (cible Sprint KB-1)

### 1.1 Schéma exhaustif

```prisma
// KnowledgeAsset — asset library médias unifiée pour la Knowledge Base.
// Stockage volume Coolify monté + service via Caddy direct (jamais Next API).
// Anti-pattern : pas de base64 inline dans Tiptap JSON.
model KnowledgeAsset {
  id              String              @id @default(cuid())

  // Content addressing (immutable hash-based filename)
  hash            String              @unique               // SHA-256 hex (64 chars)
  mimeType        String                                    // image/jpeg, image/png, image/webp, image/avif, application/pdf, etc.
  bytes           Int                                       // taille originale (octets)

  // Geometry (images uniquement, null pour docs)
  width           Int?
  height          Int?

  // Filesystem layout (sharded par préfixe hash pour éviter dir trop large)
  // Format : /data/knowledge-assets/<hash[0:2]>/<hash>.<ext>
  originalPath    String                                    // chemin absolu host (audit + GC)
  processedPaths  Json                                      // map { avif: {320, 640, 1024, 1920, 3840, cover}, webp: {...}, jpg: {...} }
                                                            // chaque variant : { path, bytes, width, height }

  // Editorial metadata
  altText         String?                                   // requis pour publish d'une entry qui réfère l'asset (Agent 12 a11y)
  caption         String?                                   // optionnel, légende sous l'image
  uploadedById    String                                    // FK AdminUser.id
  uploadedBy      AdminUser           @relation(fields: [uploadedById], references: [id], onDelete: Restrict)

  // Usage tracking (GC mensuel, soft-delete après 30j sans usage)
  usageCount      Int                 @default(0)           // incrémenté par hook editor on insert, décrémenté on remove
  lastUsedAt      DateTime?                                 // null si jamais référencé

  // Timestamps + soft delete
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  deletedAt       DateTime?                                 // soft-delete (T+30j sans usage → real delete par GC)

  // Reverse relations (cover image)
  coverForEntries KnowledgeEntry[]    @relation("KnowledgeEntryCover")

  @@index([hash])                                           // lookup déjà unique mais index explicite pour query plan stability
  @@index([usageCount])                                     // GC orphans (usageCount = 0)
  @@index([deletedAt])                                      // GC real-delete (deletedAt IS NOT NULL AND deletedAt < now() - 30d)
  @@index([uploadedById, createdAt(sort: Desc)])            // asset library filter "mes uploads récents"
  @@index([mimeType])                                       // asset library filter par type
  @@map("knowledge_assets")
}
```

### 1.2 Choix de schéma justifiés

| Champ                     | Choix                     | Justification                                                                                                                                                                                                 |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hash` unique             | SHA-256 content-addressed | Dédup gratuit (upload du même fichier → row existant retourné, usageCount++) + cache-busting natif (filename = hash, donc filename change si contenu change).                                                 |
| `processedPaths` Json     | Map nested                | Permet d'ajouter facilement de nouvelles tailles en V1.5 sans migration de schéma (ex. ajouter `1440`). Compromis assumé : Json non-typé côté DB, mais accès via helper typé `lib/knowledge/assets/paths.ts`. |
| `width`/`height` nullable | Images-only               | Docs (PDF, DOCX V1.5) n'ont pas de dim. — null sur docs, NOT NULL côté app via Zod.                                                                                                                           |
| `originalPath` stocké     | Audit + GC                | On garde le path absolu pour le GC final (rm file from disk) — pas reconstruit depuis hash car le sharding peut évoluer.                                                                                      |
| `uploadedById` Restrict   | Pas de cascade            | Si un admin est désactivé, ses assets restent (audit + traçabilité ownership).                                                                                                                                |
| `usageCount` int          | Compteur explicite        | Plus rapide que count(\*) chaque GC. Maintenu par hooks editor (cf. §6).                                                                                                                                      |
| `deletedAt` soft-delete   | 30j grâce                 | Permet undo (admin reseed à T+15j sans perte) + audit (savoir qui/quand a supprimé).                                                                                                                          |

### 1.3 Anti-collisions

- Aucun modèle `Asset` existant dans `schema.prisma` (vérifié reality-check §1.1).
- Naming `KnowledgeAsset` + `@@map("knowledge_assets")` cohérent avec préfixe `Knowledge*` de la KB.
- Pas d'enum dédié `MimeType` : on stocke string contraint côté Zod (liste blanche §3.1).

---

## 2. PIPELINE D'UPLOAD — server action `uploadAsset.ts`

### 2.1 Flow synchrone (server action)

```
[User admin]
   │
   ▼
[POST /admin/.../connaissances/medias (Server Action uploadAssetAction)]
   │
   ├── 1. Auth check (AdminRole >= EDITOR)
   ├── 2. Rate limit (Redis bucket : 30 uploads / 5 min / admin user)
   ├── 3. Zod validation
   │     - mimeType ∈ whitelist
   │     - file.size ≤ MAX_BYTES (10 MB image, 50 MB doc)
   │     - filename présent (utilisé pour caption fallback)
   ├── 4. Magic bytes check (sniff réel vs déclaré, anti-spoofing)
   ├── 5. Compute SHA-256 (stream du buffer)
   ├── 6. Lookup KnowledgeAsset WHERE hash = ? AND deletedAt IS NULL
   │     ├── HIT → return existing (dédup gratuit) + usageCount unchanged (incrément à l'insert dans editor)
   │     └── MISS → continue
   ├── 7. EXIF/GPS strip (sharp().rotate().keepIccProfile().withMetadata({ exif: {} }))
   │                       └─ rotate() applique l'orientation EXIF avant strip (préserve l'orientation visuelle)
   │                       └─ withMetadata({ exif: {} }) wipe tous tags EXIF (incl. GPS, Camera, Author, DateTime)
   ├── 8. Persist original sur disque : /data/knowledge-assets/<hash[0:2]>/<hash>.<ext>
   ├── 9. INSERT KnowledgeAsset (status: processing implicite — processedPaths = {})
   ├── 10. Enqueue BullMQ : knowledgeImageProcessQueue.add({ assetId })
   └── 11. Return { id, status: "processing" } → admin UI affiche placeholder + polling SWR
```

### 2.2 Zod schema (à placer dans `src/server/actions/knowledge/_zod-schemas.ts`)

```ts
// Whitelist mime types V1
export const KNOWLEDGE_ASSET_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif", // accepté mais converti à WebP (pas d'AVIF anim CPX32-friendly)
  "image/svg+xml", // bypass pipeline sharp (servi tel quel, sanitized)
] as const;

export const KNOWLEDGE_ASSET_DOC_MIMES = [
  "application/pdf",
  // V1.5 si besoin : DOCX, ODT, MD — décision Will Sprint KB-11
] as const;

export const KNOWLEDGE_ASSET_MAX_BYTES_IMAGE = 10 * 1024 * 1024; // 10 MB
export const KNOWLEDGE_ASSET_MAX_BYTES_DOC = 50 * 1024 * 1024; // 50 MB

export const uploadAssetSchema = z
  .object({
    file: z
      .instanceof(File)
      .refine((f) => f.size > 0, "Fichier vide")
      .refine(
        (f) =>
          [...KNOWLEDGE_ASSET_IMAGE_MIMES, ...KNOWLEDGE_ASSET_DOC_MIMES].includes(f.type as never),
        "Type de fichier non autorisé",
      )
      .refine(
        (f) =>
          KNOWLEDGE_ASSET_IMAGE_MIMES.includes(f.type as never)
            ? f.size <= KNOWLEDGE_ASSET_MAX_BYTES_IMAGE
            : f.size <= KNOWLEDGE_ASSET_MAX_BYTES_DOC,
        "Fichier trop volumineux",
      ),
    altText: z.string().max(280).optional(), // recommandé saisir tout de suite
    caption: z.string().max(500).optional(),
  })
  .strict();
```

### 2.3 Magic bytes check (anti-spoofing)

```ts
// src/lib/knowledge/assets/sniff.ts
const SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46, /* RIFF */ 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  "image/avif": [[/* ftyp avif */ 0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/svg+xml": [
    [0x3c, 0x73, 0x76, 0x67] /* <svg */,
    [0x3c, 0x3f, 0x78, 0x6d, 0x6c] /* <?xml */,
  ],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

export function sniffMime(buf: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(SIGNATURES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => byte === 0 || buf[i] === byte)) return mime;
    }
  }
  return null;
}

// Refus si sniffed !== declared (anti polyglot)
```

### 2.4 Strip EXIF/GPS — RGPD obligatoire

```ts
// Pattern sharp post-RGPD GDPR art. 5.1.c (minimisation données)
import sharp from "sharp";

async function stripExifAndNormalize(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate() // applique orientation EXIF AVANT strip
    .withMetadata({
      // wipe tout sauf ICC (couleur photo)
      exif: {},
      icc: undefined, // garde ICC (préserve gamut)
      orientation: undefined, // déjà appliqué via rotate()
    })
    .toBuffer();
}
```

**Vérification post-strip** (test Vitest obligatoire Sprint KB-11) :

```ts
import exifr from "exifr"; // dev-dep only, pour tests — pas en prod
test("strip EXIF/GPS removes all sensitive metadata", async () => {
  const fixture = await fs.readFile("tests/fixtures/photo-with-gps.jpg");
  const stripped = await stripExifAndNormalize(fixture);
  const meta = await exifr.parse(stripped);
  expect(meta).toBeFalsy(); // ou expect(meta.GPSLatitude).toBeUndefined();
});
```

**Anti-pattern (à bloquer)** : utiliser `sharp().keepExif()` ou `withMetadata({ exif: source.exif })` — viole RGPD si photo prise avec smartphone (GPS embarqué auto).

---

## 3. STOCKAGE — Volume Coolify

### 3.1 Layout filesystem

```
/data/knowledge-assets/
├── ab/
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.jpg                ← original (post-strip EXIF)
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.320.avif      ← variant
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.640.avif
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.1024.avif
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.1920.avif
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.3840.avif
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.avif.cover.avif    ← 1200×630 OG
│   ├── ab1c5e7f9a3d2b8f...e7f9a3d2.webp.<sizes>.webp
│   └── ab1c5e7f9a3d2b8f...e7f9a3d2.jpg.<sizes>.jpg
├── cd/
│   └── cd2d8a4f...
├── ef/
└── ...
```

**Pourquoi sharding `<hash[0:2]>`** :

- 256 sous-dossiers max (00 → ff) — ext4 commence à dégrader perf > 10k fichiers par dir.
- À 1 000 entrées KB × 5 variants × 6 tailles + cover = 30k fichiers totaux, ~120 fichiers/dir : sain.
- Permet `ls /data/knowledge-assets/ab/` rapide pour debug ops.

### 3.2 Permissions

```
chown -R nextjs:nextjs /data/knowledge-assets   # uid:gid du conteneur app
chmod 750 /data/knowledge-assets                # rwx propriétaire, r-x groupe, --- autres
```

Caddy doit pouvoir lire (joindre le groupe `nextjs` ou monter en read-only).

### 3.3 Volume Coolify — **STOP & ASK Will impératif**

**État actuel constaté** : `docker/docker-compose.production.yml:210-214` déclare uniquement 4 volumes nommés (`postgres_data_prod`, `redis_data_prod`, `caddy_data`, `caddy_config`). **Aucun volume `app_data` ou `assets_data` n'est défini ni monté sur le service `app`** (vérifié lignes 77-187).

**Implications** :

1. **Si on déploie Sprint KB-11 tel quel** : les assets uploadés s'écrivent dans le filesystem éphémère du conteneur `axion-ia-app-prod` → **perte totale au prochain `coolify deploy`** (rebuild image = nouveau FS).
2. **Mémoire `axionia_session_2026-05-08_first_deploy`** : aucune mention de volume persistant pour fichiers user — seul le DB volume est documenté.

**Questions ouvertes pour Will** :

- Q1 — **Configuration du volume** : ajouter dans Coolify UI → Persistent Storage → mount `/data/knowledge-assets` (host path ou named volume Docker) ?
- Q2 — **Quota** : taille max allouée ? CPX32 a 240 GB NVMe partagés avec Postgres + Redis + builds. Recommandation : 30 GB initial (~5 000 entrées × 5 MB moyen processed), monitor via cron disk alert.
- Q3 — **Backup** : inclure `/data/knowledge-assets` dans le backup Hetzner Storage Box prévu Sprint 23 (mémoire `axionia_session_2026-05-09_sprint_24` evoque backup global mais pas user-files) ? Sinon, **risque perte sur disk failure même avec DB OK** (les `processedPaths` pointeront vers fichiers inexistants).
- Q4 — **Backup retention** : 30 jours quotidien rolling + mensuel 12 mois ? Aligné avec retention DB ?

**Recommandation Phase A** : configurer **named volume Docker** `assets_data_prod` monté sur `/data/knowledge-assets` côté `app` ET côté `caddy` (read-only Caddy), avec backup rsync nocturne vers Storage Box (script `scripts/backup-assets.sh` à créer Sprint KB-11). Coût additionnel : ~€2/mois Storage Box (déjà commandée mémoire Sprint 23).

---

## 4. WORKER BULLMQ — `knowledge-image-process.ts`

### 4.1 Position dans la pile existante

Reality-check §4.2 confirme : `src/server/queue/worker.ts` orchestre 4 workers existants (email, option-expiration, option-reminder, retention-purge). On ajoute :

- `src/server/queue/workers/knowledge-image-process-worker.ts` (cible Sprint KB-11)
- `src/server/queue/workers/knowledge-asset-gc-worker.ts` (cible Sprint KB-11, cron mensuel)
- Update `src/server/queue/queues.ts` → ajout `knowledgeImageProcessQueue` + `knowledgeAssetGcQueue`
- Update `src/server/queue/types.ts` → ajout `KnowledgeImageProcessJobData` + `KnowledgeAssetGcJobData`
- Update `src/server/queue/worker.ts` → import + start dans `main()`
- Update `bootRepeatableJobs()` → add cron mensuel GC

### 4.2 Job data shape

```ts
// src/server/queue/types.ts (extension)
export interface KnowledgeImageProcessJobData {
  assetId: string; // KnowledgeAsset.id
  hash: string; // SHA-256 (sanity check)
  mimeType: string;
  originalPath: string; // /data/knowledge-assets/ab/abc...jpg
}

export interface KnowledgeAssetGcJobData {
  tick: string; // ISO timestamp, traceabilité
  dryRun?: boolean; // mode preview admin UI
}
```

### 4.3 Worker logic — image processing

```ts
// src/server/queue/workers/knowledge-image-process-worker.ts
import { Worker } from "bullmq";
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getBullConnectionOrThrow } from "../connection";
import { prisma } from "@/lib/prisma";
import type { KnowledgeImageProcessJobData } from "../types";

const RESPONSIVE_WIDTHS = [320, 640, 1024, 1920, 3840] as const;
const COVER_W = 1200,
  COVER_H = 630; // OpenGraph standard
const FORMATS = [
  { fmt: "avif" as const, quality: 50, effort: 4 }, // CPX32 : effort=4 sweet spot (qualité vs CPU)
  { fmt: "webp" as const, quality: 75 },
  { fmt: "jpeg" as const, quality: 80, mozjpeg: true }, // fallback Safari < 16, mozjpeg meilleure compression
];

export function startKnowledgeImageProcessWorker(): Worker<KnowledgeImageProcessJobData> {
  return new Worker<KnowledgeImageProcessJobData>(
    "knowledge-image-process",
    async (job) => {
      const { assetId, hash, mimeType, originalPath } = job.data;
      if (mimeType === "image/svg+xml" || mimeType.startsWith("application/")) {
        // SVG : pas de pipeline raster (déjà responsive). Docs : pas de variants.
        // On set processedPaths = { original: originalPath } et retour.
        await prisma.knowledgeAsset.update({
          where: { id: assetId },
          data: { processedPaths: { original: originalPath } },
        });
        return;
      }

      const inputBuf = await fs.readFile(originalPath);
      const meta = await sharp(inputBuf).metadata();
      const dir = path.dirname(originalPath);
      const stem = hash;

      const processed: Record<
        string,
        Record<string, { path: string; bytes: number; width: number; height: number }>
      > = {};

      // Variants responsive
      for (const { fmt, ...opts } of FORMATS) {
        processed[fmt] = {};
        for (const w of RESPONSIVE_WIDTHS) {
          // Pas d'upscale : si source < w, on skip
          if (meta.width && meta.width < w) continue;
          const outPath = path.join(dir, `${stem}.${fmt}.${w}.${fmt}`);
          const outInfo = await sharp(inputBuf)
            .resize({ width: w, withoutEnlargement: true })
            [fmt](opts as never)
            .toFile(outPath);
          processed[fmt][String(w)] = {
            path: outPath,
            bytes: outInfo.size,
            width: outInfo.width,
            height: outInfo.height,
          };
        }

        // Cover OG 1200×630 (crop center, smart attention)
        const coverPath = path.join(dir, `${stem}.${fmt}.cover.${fmt}`);
        const coverInfo = await sharp(inputBuf)
          .resize({ width: COVER_W, height: COVER_H, fit: "cover", position: "attention" })
          [fmt](opts as never)
          .toFile(coverPath);
        processed[fmt].cover = {
          path: coverPath,
          bytes: coverInfo.size,
          width: coverInfo.width,
          height: coverInfo.height,
        };
      }

      await prisma.knowledgeAsset.update({
        where: { id: assetId },
        data: {
          processedPaths: processed,
          width: meta.width ?? null,
          height: meta.height ?? null,
        },
      });
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 2, // CPX32 8 vCPU partagé app+postgres+worker — 2 jobs // sweet spot
      lockDuration: 60_000, // 1 min max par image (3840 AVIF effort=4 = ~20s pire cas)
    },
  );
}
```

### 4.4 Concurrence et budget CPU

| Param          | Valeur          | Justification                                                                                         |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `concurrency`  | 2               | CPX32 8 vCPU AMD Milan : Postgres réserve 2, app 3-4, worker 2 pour image proc sans noyer le système. |
| AVIF `effort`  | 4 (sur 0-9)     | 9 = qualité max mais 5× plus lent. 4 = qualité ~95 % du max pour 1/5 du CPU. Idéal CPX32.             |
| `lockDuration` | 60 s            | Image 3840×2160 → AVIF effort=4 ≈ 15-20 s. 60 s = marge.                                              |
| `attempts`     | 3               | Hérite de `defaultJobOptions` global. Si fail 3× → DLQ via `removeOnFail.age=30j`.                    |
| Backoff        | exponentiel 5 s | Hérité.                                                                                               |

### 4.5 Échec gracieux

- Si `sharp` throw (corrupted image, format inattendu) → job fail → entry `KnowledgeAsset.processedPaths` reste `{}` → admin UI affiche badge "Processing failed, re-upload required".
- Sentry custom event `kb.asset.process.failed` (mémoire `axionia_session_2026-05-09_sprints_15-23_audits` confirme Sentry intégré).

---

## 5. SERVICE STATIQUE — Caddy direct (pas Next API route)

### 5.1 Caddyfile (extension proposée)

```caddyfile
# Caddyfile (extension Sprint KB-11)
# Service direct assets KB sans passer par Next.js (évite SSR cost, cache CF natif).

axion-ia.com {
    encode zstd gzip

    # Knowledge assets : path /assets/knowledge/<hash[0:2]>/<hash>.<ext>
    # Map vers volume /data/knowledge-assets/<hash[0:2]>/<hash>.<ext>
    handle_path /assets/knowledge/* {
        root * /data/knowledge-assets
        file_server {
            precompressed br gzip
        }
        # Cache immutable (hash dans URL = cache-bust natif)
        header {
            Cache-Control "public, max-age=31536000, immutable, stale-while-revalidate=86400"
            X-Content-Type-Options "nosniff"
            # CORS si CDN cross-origin futur (V2)
            Access-Control-Allow-Origin "https://axion-ia.com"
        }
    }

    # Reste : reverse_proxy app:3000 (inchangé)
    reverse_proxy app:3000
}
```

### 5.2 Cloudflare Cache Rules (réutilisation existante)

Mémoire `axionia_session_2026-05-09_cloudflare_phase5` confirme : 5 Cache Rules déjà en place. **Ajouter Rule #6 dédiée KB assets** :

```
Name: Knowledge Assets — Immutable 1y
Match: (http.request.uri.path matches "^/assets/knowledge/")
Action:
  - Cache Eligibility: Eligible
  - Edge TTL: 1 year (31 536 000 s)
  - Browser TTL: respect origin (1 year via Cache-Control immutable)
  - Cache Key: Default + ignore query string (hash dans path = unique)
```

### 5.3 URLs publiques générées (helper)

```ts
// src/lib/knowledge/assets/urls.ts
export function assetUrl(
  asset: { hash: string; processedPaths: any },
  variant: { format: "avif" | "webp" | "jpeg"; size: 320 | 640 | 1024 | 1920 | 3840 | "cover" },
): string {
  const base = `/assets/knowledge/${asset.hash.slice(0, 2)}/${asset.hash}`;
  const sizeStr = variant.size === "cover" ? "cover" : String(variant.size);
  const ext = variant.format === "jpeg" ? "jpg" : variant.format;
  return `${base}.${variant.format}.${sizeStr}.${ext}`;
}

// Helper React responsive
export function assetSrcSet(asset, format: "avif" | "webp" | "jpeg") {
  return RESPONSIVE_WIDTHS.filter((w) => asset.processedPaths[format]?.[String(w)])
    .map((w) => `${assetUrl(asset, { format, size: w })} ${w}w`)
    .join(", ");
}
```

### 5.4 Composant React (Server Component, Sprint KB-11)

```tsx
// src/components/knowledge/shared/KnowledgeImage.tsx
// Server Component — pas de JS client, lazy par défaut, priority opt-in.
export function KnowledgeImage({
  asset,
  alt,
  priority = false,
  sizes = "(min-width: 1024px) 1024px, 100vw",
}: {
  asset: KnowledgeAsset;
  alt: string; // bloqué publish si vide (Agent 12)
  priority?: boolean;
  sizes?: string;
}) {
  if (!asset.processedPaths || Object.keys(asset.processedPaths).length === 0) {
    return <div className="aspect-video bg-stone-100" aria-label="Image en traitement…" />;
  }
  return (
    <picture>
      <source type="image/avif" srcSet={assetSrcSet(asset, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={assetSrcSet(asset, "webp")} sizes={sizes} />
      <img
        src={assetUrl(asset, { format: "jpeg", size: 1024 })}
        srcSet={assetSrcSet(asset, "jpeg")}
        sizes={sizes}
        alt={alt}
        width={asset.width ?? undefined}
        height={asset.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
      />
    </picture>
  );
}
```

**Pourquoi `<picture>` natif et pas `<Image>` Next** : (a) on contourne `/_next/image` qui forcerait re-processing à chaque request (gaspillage CPU), (b) Caddy + CF Cache Rules immutable = LCP optimal sans JS Next, (c) bundle gain ~5 KB gz (Next Image client).

---

## 6. COVER IMAGE + HERO LAYOUT

### 6.1 Modèle Prisma (extension `KnowledgeEntry`)

```prisma
model KnowledgeEntry {
  // ... champs existants ...

  coverImageId    String?
  coverImage      KnowledgeAsset?     @relation("KnowledgeEntryCover", fields: [coverImageId], references: [id], onDelete: SetNull)

  heroLayout      KbHeroLayout        @default(none)

  @@index([coverImageId])
}

enum KbHeroLayout {
  none           // pas de hero visuel (FAQ, glossary_term)
  schema         // composant React SVG existant (HeroSchema*, cf. mémoire axionia_hero_schema_v3_2)
  photo          // KnowledgeAsset image (asset.mimeType image/*)
  illustration   // KnowledgeAsset SVG illustration (mémoire axionia_visual_rhythm_sprint_AB_2026-05-07)
}
```

### 6.2 Règles de validation publish

| `heroLayout`   | Constraints publish                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `none`         | OK toujours.                                                                                                                       |
| `schema`       | `coverImageId` doit être NULL. Composant React SVG choisi via SSOT `heroSchemaForType(type)` (mémoire `axionia_hero_schema_v3_2`). |
| `photo`        | `coverImageId` NOT NULL ET `coverImage.mimeType.startsWith("image/")` ET `coverImage.altText` NOT NULL.                            |
| `illustration` | `coverImageId` NOT NULL ET `coverImage.mimeType === "image/svg+xml"` ET `coverImage.altText` NOT NULL.                             |

Validation Zod côté `publishEntry.ts` server action (Sprint KB-8). Bloquant.

### 6.3 OG image (auto-pickup)

- Si `heroLayout = 'photo'` ou `'illustration'` → `opengraph-image.tsx` réutilise `coverImage.processedPaths.avif.cover` (1200×630 déjà généré au pipeline).
- Si `heroLayout = 'schema'` → `opengraph-image.tsx` génère un OG dynamique via `@vercel/og` à partir du composant HeroSchema (déjà en deps `@vercel/og@0.11.1`).
- Si `heroLayout = 'none'` → fallback `opengraph-image.tsx` site-level (Axion-IA brand default).

---

## 7. ASSET LIBRARY ADMIN — `/connaissances/medias`

### 7.1 Maquette UI (Sprint KB-11)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Bibliothèque médias                            [Téléverser un fichier] │
├─────────────────────────────────────────────────────────────────────────┤
│  Filtres :                                                              │
│  [Type ▼] [Auteur ▼] [Taille ▼] [Usage ▼] [Date ▼]   [Recherche alt…]  │
│                                                                         │
│  ☐ Sélectionner tout (24)              [Supprimer (3)] [Réassigner alt] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │ ☑    │ │ ☐    │ │ ☐    │ │ ☑    │ │ ☐    │ │ ☐    │                  │
│  │ IMG  │ │ IMG  │ │ PDF  │ │ SVG  │ │ IMG  │ │ IMG  │                  │
│  │ 12 × │ │ 0 ⚠ │ │ 3 ×  │ │ 8 ×  │ │ 1 ×  │ │ 5 ×  │   ⚠ = orphan      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
│  alt: "…" alt: ⚠   alt: …   alt: …   alt: …   alt: …                    │
│                                                                         │
│         Charger plus (84 restants)…                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Filtres disponibles

| Filtre       | Source DB                                                             |
| ------------ | --------------------------------------------------------------------- |
| Type         | `mimeType` : "Images", "PDF", "SVG", "Tous".                          |
| Auteur       | `uploadedById` JOIN AdminUser.                                        |
| Taille       | `bytes` ranges : "< 100 KB", "100 KB - 1 MB", "1 - 10 MB", "> 10 MB". |
| Usage        | `usageCount` : "Utilisé (≥1)", "Orphelin (= 0)".                      |
| Date         | `createdAt` : 7j, 30j, 90j, tout.                                     |
| Recherche    | Full-text sur `altText` + `caption` (pg_trgm GIN).                    |
| Soft-deleted | `deletedAt IS NOT NULL` (toggle "Corbeille").                         |

### 7.3 Bulk operations

- **Supprimer (soft)** : set `deletedAt = NOW()`. Si `usageCount > 0`, dialog warning "X entrées utilisent cet asset, retirer d'abord les références".
- **Restaurer** : set `deletedAt = NULL` (depuis corbeille T+0 → T+30j).
- **Réassigner alt** : ouvre modal bulk-edit alt text (suggestion IA Claude Vision V1.5, cf. mémoire `axionia_prompt_knowledge_base` Agent 12).
- **Export CSV** : id + hash + altText + usageCount + createdAt (audit).

### 7.4 Drag-into-editor (Tiptap extension)

Pattern : extension custom `KnowledgeAssetExtension` qui ajoute un node `knowledge-image` :

```ts
// src/components/knowledge/admin/editor/extensions/knowledge-image.ts
export const KnowledgeImageExtension = Node.create({
  name: "knowledgeImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      assetId: { default: null }, // référence KnowledgeAsset.id
      alt: { default: null }, // override alt (sinon prend asset.altText)
      caption: { default: null },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: "knowledge-image" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["knowledge-image", mergeAttributes(HTMLAttributes)];
  },
  // ... NodeView React qui render <KnowledgeImage> en preview
});
```

**Sur insertion** : server action `incrementAssetUsageAction(assetId)` → `usageCount++` + `lastUsedAt = NOW()`.
**Sur suppression** : server action `decrementAssetUsageAction(assetId)` (rebuild count via scan Tiptap JSON au save, plus fiable que hooks fragiles).

**Anti-pattern bloqué** : stocker `data:image/jpeg;base64,…` dans le JSON. L'extension force le format `{ type: "knowledgeImage", attrs: { assetId } }` uniquement. Validation Zod côté `upsertEntry.ts` rejette tout node `image` avec `src` data-URI.

---

## 8. GARBAGE COLLECT — Worker `knowledge-asset-gc.ts`

### 8.1 Cron mensuel (1er du mois 04:00 UTC)

```ts
// Extension bootRepeatableJobs() dans src/server/queue/queues.ts
await knowledgeAssetGcQueue.removeRepeatable(
  "tick",
  { pattern: "0 4 1 * *" },
  "knowledge-asset-gc-cron",
);
await knowledgeAssetGcQueue.add(
  "tick",
  { tick: new Date().toISOString() },
  { repeat: { pattern: "0 4 1 * *" }, jobId: "knowledge-asset-gc-cron" },
);
```

### 8.2 Logique GC en 2 phases

**Phase 1 — Soft delete des orphelins (T+0)** :

```sql
UPDATE knowledge_assets
SET deleted_at = NOW()
WHERE usage_count = 0
  AND deleted_at IS NULL
  AND created_at < NOW() - INTERVAL '30 days'   -- grâce 30j après upload pour brouillon
RETURNING id, hash;
```

**Phase 2 — Hard delete (T+30j after soft)** :

```sql
SELECT id, hash, original_path, processed_paths
FROM knowledge_assets
WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
```

Pour chaque ligne :

1. `rm` original + tous les `processedPaths.*.* .path` sur disk.
2. `DELETE FROM knowledge_assets WHERE id = ?`.
3. Log ActivityLog `kb.asset.gc.purged`.

### 8.3 Safety guards

- `dryRun = true` mode preview (admin UI bouton "Aperçu prochain GC" → liste les futurs supprimés sans toucher).
- Refus si `process.env.KB_ASSET_GC_ENABLED !== "true"` (kill-switch).
- Refus si nombre de fichiers à purger > 1 000 (sanity, alerte Telegram redactée — mémoire ADR 0010).
- Sentry event `kb.asset.gc.executed` avec stats (soft, hard, skipped).

### 8.4 Restauration (avant T+30j)

Admin UI "Corbeille" → bouton "Restaurer" → `UPDATE SET deleted_at = NULL`. Aucune action filesystem (fichiers toujours présents).

---

## 9. DÉPENDANCES À AJOUTER (Sprint KB-11)

```bash
pnpm add sharp
```

**État `package.json` actuel** :

- `sharp` **absent** des `dependencies` (lignes 65-114, vérifié).
- `sharp` **déjà whitelisté** dans `pnpm.onlyBuiltDependencies` (ligne 179) → pnpm autorisera la build native quand on l'ajoutera. **Préparation antérieure favorable.**
- `@vercel/og` ^0.11.1 (ligne 91) — réutilisable pour OG image générée depuis HeroSchema.
- `bullmq` ^5.76.5 (ligne 93) — pile en place.
- `@tiptap/*` ^3.22.5 (lignes 88-90) — extension `KnowledgeImage` greffable.

**Dev dependency optionnelle (tests EXIF strip)** :

```bash
pnpm add -D exifr
```

(Lecture EXIF pour assertions de test uniquement. Pas en prod.)

---

## 10. ANTI-PATTERNS (interdits — bloquer en review)

| Anti-pattern                                           | Pourquoi bloqué                                                | Mitigation                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Base64 image inline dans Tiptap JSON                   | Gonfle 33 % la taille DB, pas de cache CF possible, casse FTS  | Extension `KnowledgeImage` force `{ assetId }` uniquement ; Zod reject `data:image/...` dans node.attrs.src. |
| Servir via `/api/knowledge/asset/[hash]` Next route    | SSR cost à chaque request, drain CPU, ruine LCP                | Caddy `handle_path /assets/knowledge/*` direct (§5.1).                                                       |
| Skip strip EXIF/GPS                                    | Viole RGPD art. 5.1.c minimisation + révèle géoloc photographe | `stripExifAndNormalize()` obligatoire en pipeline upload (§2.4) + test bloquant CI.                          |
| Conserver originaux ad vitam aeternam                  | Disk explose (240 GB CPX32 partagé)                            | GC mensuel (§8) + politique 30j orphelin → soft → 30j → hard.                                                |
| `sharp().resize(w, h)` sans `withoutEnlargement: true` | Upscale = artefacts + bandwidth waste                          | Helper interne force `withoutEnlargement: true` (§4.3).                                                      |
| Upload sans rate-limit                                 | DoS disk (admin malveillant ou compromis)                      | Redis bucket 30 uploads / 5 min / admin user (§2.1 étape 2).                                                 |
| Stocker chemin dans URL au lieu de hash                | Cache-bust impossible, redirects en chaîne                     | URL hash-based (§5.3) immutable.                                                                             |
| Trust mime-type from `file.type`                       | Spoofable (renomme `.exe` en `.jpg`)                           | Magic bytes check (§2.3) + refus si sniffed ≠ declared.                                                      |
| `sharp().toFormat("png")` sans quality cap             | PNG = uncompressed massif → 10× WebP                           | Whitelist formats output = avif/webp/jpeg uniquement (§4.3).                                                 |
| Worker image dans le process app                       | Bloque thread Node main → INP > 1000ms                         | Worker process séparé Coolify (§4.1) — pattern Sprint 15 confirmé.                                           |
| Cron GC sans kill-switch                               | Bug = perte de tous les médias                                 | `KB_ASSET_GC_ENABLED` env var + dryRun mode (§8.3).                                                          |
| Hash avec MD5 ou SHA-1                                 | Collision possible (SHA-1 broken 2017) + non-FIPS              | SHA-256 obligatoire (§1.1 schema).                                                                           |
| Heros layout = `schema` qui pointe vers un asset       | Confusion entre composant SVG React et asset uploadé           | Validation Zod §6.2 : `heroLayout='schema'` ⇒ `coverImageId IS NULL`.                                        |

---

## 11. INTÉGRATIONS CROSS-AGENTS

| Agent                            | Touche-points                                                                                                                                   | Action                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Agent 1 (Data model)             | `KnowledgeAsset` schema, `coverImageId` + `heroLayout` enum sur `KnowledgeEntry`                                                                | Aligner migration KB-1 pour créer les 2 tables + enum dans la même migration expand.                               |
| Agent 3 (Admin UI)               | Asset library `/connaissances/medias`, drag-into-editor                                                                                         | Wrapper Tiptap doit charger l'extension `KnowledgeImageExtension`.                                                 |
| Agent 4 (Server actions)         | `uploadAssetAction`, `softDeleteAssetAction`, `restoreAssetAction`, `incrementAssetUsageAction`, `decrementAssetUsageAction`, `previewGcAction` | 6 actions à scaffold dans `src/server/actions/knowledge/assets/*.ts`.                                              |
| Agent 6 (Public surface)         | Render `<KnowledgeImage>` SSR en pages publiques                                                                                                | Composant `src/components/knowledge/shared/KnowledgeImage.tsx` exporté à partager.                                 |
| Agent 9 (Gouvernance / RGPD)     | Strip EXIF/GPS = obligation RGPD, intégrer dans pii-redaction pipeline                                                                          | Référer à §2.4 ; ajouter ligne register sous-processeurs si CDN futur.                                             |
| Agent 11 (Perf / Vitals)         | Préchargement LCP cover image, `priority` flag                                                                                                  | KnowledgeImage avec `priority` boolean prop (§5.4). Budget bundle gain via `<picture>` natif (pas `<Image>` Next). |
| Agent 12 (A11y / E-E-A-T)        | Alt text obligatoire publish, suggestion IA V1.5                                                                                                | Validation Zod publish (§6.2) ; bloquant.                                                                          |
| Agent 14 (Editorial pipeline)    | Quality score check : cover présente ? alt présent ?                                                                                            | 2 critères dans la formule /100.                                                                                   |
| Agent 15 (Multi-format)          | OG image générée auto depuis `coverImage.processedPaths.avif.cover`                                                                             | Helper `opengraph-image.tsx` réutilise variant cover déjà généré.                                                  |
| Agent 17 (Slug / sécurité / DR)  | Backup `/data/knowledge-assets` dans plan DR                                                                                                    | STOP & ASK Q3 §3.3 à trancher Sprint KB-11.                                                                        |
| Agent 18 (Tests / observabilité) | Tests strip EXIF, magic bytes, hash dedup, GC dryRun                                                                                            | ≥ 8 tests Vitest dédiés assets dans plan tests.                                                                    |

---

## 12. STOP & ASK — DÉCISIONS OUVERTES (sortie Phase A)

### Bloquants Sprint KB-11

| #   | Question                                                                                                  | Recommandation                                                                            | Statut |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| 1   | **Volume Coolify** : path host ou named volume Docker pour `/data/knowledge-assets/` ?                    | Named volume Docker `assets_data_prod` monté côté `app` (rw) et `caddy` (ro).             | OUVERT |
| 2   | **Quota volume** : taille initiale ? Monitoring alerte ?                                                  | 30 GB initial, alerte Telegram redactée à 80 % usage.                                     | OUVERT |
| 3   | **Backup assets** : inclus dans Hetzner Storage Box (Sprint 23) ? Rétention ?                             | OUI — rsync nocturne incrémental, retention 30j daily + 12 mois monthly.                  | OUVERT |
| 4   | **Format AVIF mode anim** : V1 accepte GIF en input mais convert WebP, on accepte aussi GIF anim source ? | OUI input GIF → output WebP anim ; AVIF anim skip (CPX32 trop coûteux).                   | OUVERT |
| 5   | **Docs PDF V1** : accepter ou différer V1.5 ?                                                             | V1 PDF only (factures, CGV, etc.), V1.5 DOCX/ODT/MD.                                      | OUVERT |
| 6   | **Sharp version pin** : laisser flottant `^X` ou pin exact ?                                              | Pin minor (libvips embarqué = source de bugs cross-platform), MAJ contrôlée via Renovate. | OUVERT |
| 7   | **SVG sanitization** : `dompurify` server-side ou whitelist tags manuel ?                                 | `isomorphic-dompurify` server-side avant write disk — `<script>`, event handlers stripés. | OUVERT |
| 8   | **Suggest alt IA** : V1 (Claude Vision Haiku) ou V1.5 ?                                                   | V1.5 — V1 force la saisie manuelle (qualité contrôlée).                                   | OUVERT |

### Non-bloquants (V2+)

- CDN externe (Bunny, R2) si charge > capacité Caddy local : V2 décision data-driven.
- Watermark automatique sur images partageables : pas de roadmap.
- IPTC metadata pour crédits photographe : V1.5 si on commence à publier des photos sourcées externes (Unsplash).

---

## 13. ESTIMATION SPRINT KB-11

| Tâche                                                                                   | Effort (j) |
| --------------------------------------------------------------------------------------- | ---------- |
| Migration Prisma `KnowledgeAsset` + enum `KbHeroLayout` + relation `coverImage`         | 0,5        |
| Server actions × 6 + Zod schemas + tests Vitest                                         | 1,5        |
| Pipeline upload (server action + magic bytes + strip EXIF + persist) + tests            | 1          |
| Worker `knowledge-image-process-worker.ts` + intégration queues.ts/worker.ts + types.ts | 1          |
| Worker GC `knowledge-asset-gc-worker.ts` + cron + kill-switch + tests dryRun            | 0,75       |
| Asset library admin UI (`/connaissances/medias`) — grille + filtres + bulk              | 2          |
| Extension Tiptap `KnowledgeImage` + drag-into-editor + usageCount hooks                 | 1          |
| Composant SSR `KnowledgeImage` + helper `assetUrl` / `assetSrcSet`                      | 0,75       |
| Config Caddy `/assets/knowledge/*` + Cloudflare Rule #6 + smoke test cache              | 0,5        |
| Documentation `docs/ops/knowledge-assets.md` + runbook GC + restauration                | 0,5        |
| **Total Sprint KB-11**                                                                  | **~9,5 j** |

Cohérent avec l'enveloppe V1 81 j (mémoire `axionia_prompt_knowledge_base` V3 18 sprints).

---

**Fin Agent 13 — AUDIT-ONLY.** Aucune ligne de code écrite. Sprint KB-11 prêt à instruire dès validation STOP & ASK Will (§12 questions 1-3 minimum).
