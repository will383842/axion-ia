# PATCHES PROPOSÉS — Image-Bank V1 (P0 + P1 prioritaires)

> **Mode** : Diff blocs prêts à appliquer. **Application différée Will** (AUDIT-ONLY, pas de modif code dans cet audit).

---

## 🔴 P0-1 — Endpoint RGPD droit à l'oubli (art. 17 GDPR)

### Patch 1A — Server Action `forgetIpHashAction`

**Fichier nouveau** : `src/server/actions/image-bank/forget-ip-hash.action.ts`

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ForgetIpHashSchema = z.object({
  ipHash: z.string().length(64, "ipHash must be SHA-256 hex 64 chars"),
});

export interface ForgetIpHashResult {
  success: boolean;
  deleted: {
    usageLogs: number;
    downloadLogs: number;
  } | null;
  error?: string;
}

/**
 * RGPD art. 17 — Droit à l'effacement.
 * Supprime toutes les traces (ImageUsageLog + ImageDownloadLog) associées à un ipHash.
 * Auditable via ActivityLog.
 *
 * @security admin-only via auth() role check
 */
export async function forgetIpHashAction(formData: FormData): Promise<ForgetIpHashResult> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return { success: false, deleted: null, error: "forbidden" };
  }

  const parsed = ForgetIpHashSchema.safeParse({
    ipHash: formData.get("ipHash"),
  });
  if (!parsed.success) {
    return {
      success: false,
      deleted: null,
      error: parsed.error.errors[0]?.message ?? "invalid input",
    };
  }

  const { ipHash } = parsed.data;

  try {
    const [usage, download] = await prisma.$transaction([
      prisma.imageUsageLog.deleteMany({ where: { ipHash } }),
      prisma.imageDownloadLog.deleteMany({ where: { ipHash } }),
    ]);

    // Audit trail (RGPD compliance — qui a fait quoi quand)
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "rgpd.image_bank.forget_ip_hash",
        targetType: "ipHash",
        targetId: ipHash,
        metadata: {
          deleted: { usageLogs: usage.count, downloadLogs: download.count },
          art: "17",
        },
      },
    });

    return {
      success: true,
      deleted: {
        usageLogs: usage.count,
        downloadLogs: download.count,
      },
    };
  } catch (err) {
    console.error("[forgetIpHashAction] failed", err);
    return {
      success: false,
      deleted: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
```

### Patch 1B — Route handler DELETE alternatif (API)

**Fichier nouveau** : `src/app/api/admin/image-bank/usage-logs/[ipHash]/route.ts`

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ ipHash: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { ipHash } = await ctx.params;
  if (!/^[a-f0-9]{64}$/i.test(ipHash)) {
    return NextResponse.json({ error: "invalid ipHash" }, { status: 400 });
  }

  try {
    const [usage, download] = await prisma.$transaction([
      prisma.imageUsageLog.deleteMany({ where: { ipHash } }),
      prisma.imageDownloadLog.deleteMany({ where: { ipHash } }),
    ]);

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "rgpd.image_bank.forget_ip_hash",
        targetType: "ipHash",
        targetId: ipHash,
        metadata: {
          deleted: { usageLogs: usage.count, downloadLogs: download.count },
          art: "17",
        },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: { usageLogs: usage.count, downloadLogs: download.count },
    });
  } catch (err) {
    console.error("[DELETE /api/admin/image-bank/usage-logs/:ipHash]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
```

### Patch 1C — Page admin `usage-logs/page.tsx` fonctionnelle

**Fichier modifié** : `src/app/[locale]/(admin)/[adminPrefix]/image-bank/usage-logs/page.tsx`

Remplacer le `<AdminStubPage>` actuel par :

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ForgetIpHashForm } from "@/components/admin/image-bank/ForgetIpHashForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Image bank — Usage logs (RGPD)",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ ipHash?: string }>;
}

export default async function UsageLogsPage({ params, searchParams }: Props): Promise<JSX.Element> {
  const { locale, adminPrefix } = await params;
  const { ipHash } = await searchParams;

  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect(`/${locale}/login`);
  }

  const logs = ipHash
    ? await prisma.imageUsageLog.findMany({
        where: { ipHash },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, action: true, imageId: true, createdAt: true },
      })
    : [];

  return (
    <main className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Image bank — Usage logs (RGPD art. 17)</h1>
      <p className="text-fg-muted">
        Recherchez les traces associées à un ipHash (SHA-256 hex 64 chars) et appliquez le droit à
        l'effacement.
      </p>

      <ForgetIpHashForm
        adminPrefix={adminPrefix}
        locale={locale}
        initialIpHash={ipHash}
        results={logs}
      />
    </main>
  );
}
```

### Patch 1D — Composant client `ForgetIpHashForm`

**Fichier nouveau** : `src/components/admin/image-bank/ForgetIpHashForm.tsx`

```tsx
"use client";
// use-client: useFormStatus + useState (interactive form)

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { forgetIpHashAction } from "@/server/actions/image-bank/forget-ip-hash.action";

interface LogRow {
  id: bigint;
  action: string;
  imageId: string;
  createdAt: Date;
}

interface Props {
  adminPrefix: string;
  locale: string;
  initialIpHash?: string;
  results: LogRow[];
}

function ConfirmButton(): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-terracotta rounded px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Suppression…" : "Supprimer définitivement (RGPD art. 17)"}
    </button>
  );
}

export function ForgetIpHashForm({
  adminPrefix,
  locale,
  initialIpHash,
  results,
}: Props): JSX.Element {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    const result = await forgetIpHashAction(formData);
    if (result.success && result.deleted) {
      setFeedback(
        `OK — supprimé ${result.deleted.usageLogs} usage + ${result.deleted.downloadLogs} download logs.`,
      );
    } else {
      setFeedback(`Erreur : ${result.error}`);
    }
  }

  return (
    <div className="space-y-4">
      <form
        action={`/${locale}/${adminPrefix}/image-bank/usage-logs`}
        method="get"
        className="flex gap-2"
      >
        <input
          type="text"
          name="ipHash"
          defaultValue={initialIpHash}
          placeholder="ipHash (64 hex chars)"
          pattern="[a-f0-9]{64}"
          className="border-border-strong bg-paper flex-1 rounded border px-3 py-2 font-mono text-sm"
          required
        />
        <button type="submit" className="border-border-strong rounded border px-4 py-2">
          Rechercher
        </button>
      </form>

      {results.length > 0 && (
        <>
          <p className="text-sm">{results.length} logs trouvés.</p>
          <ul className="space-y-1 font-mono text-xs">
            {results.map((r) => (
              <li key={String(r.id)}>
                {r.createdAt.toISOString()} — {r.action} — {r.imageId}
              </li>
            ))}
          </ul>

          <form action={handleSubmit} className="border-t pt-4">
            <input type="hidden" name="ipHash" value={initialIpHash} />
            <ConfirmButton />
          </form>
        </>
      )}

      {feedback && <p className="text-sm">{feedback}</p>}
    </div>
  );
}
```

**Effort total P0-1** : ~1h30 (4 fichiers + 1 test minimal).

---

## 🟠 P1-3 — AdminSidebar groupe `image-bank`

**Fichier modifié** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:40-75`

Ajouter dans le `buildNav()` array (après le groupe `content`) :

```diff
       title: "Contenu",
       items: [
         { href: `/${adminPrefix}/knowledge`, label: "Connaissances" },
         { href: `/${adminPrefix}/content-gen`, label: "Générateur" },
         { href: `/${adminPrefix}/blog`, label: "Blog" },
         { href: `/${adminPrefix}/categories`, label: "Catégories" },
         { href: `/${adminPrefix}/case-studies`, label: "Cas concrets" },
         { href: `/${adminPrefix}/testimonials`, label: "Témoignages" },
         { href: `/${adminPrefix}/faq`, label: "FAQ" },
         { href: `/${adminPrefix}/help-center`, label: "Centre d'aide" },
       ],
     },
+    {
+      key: "image-bank",
+      title: "Banque d'images",
+      items: [
+        { href: `/${adminPrefix}/image-bank`, label: "Overview" },
+        { href: `/${adminPrefix}/image-bank/library`, label: "Library" },
+        { href: `/${adminPrefix}/image-bank/upload`, label: "Upload" },
+        { href: `/${adminPrefix}/image-bank/bulk-import`, label: "Bulk import CSV" },
+        { href: `/${adminPrefix}/image-bank/quality`, label: "Quality queue" },
+        { href: `/${adminPrefix}/image-bank/analytics`, label: "Analytics" },
+        { href: `/${adminPrefix}/image-bank/categories`, label: "Categories" },
+        { href: `/${adminPrefix}/image-bank/tags`, label: "Tags" },
+        { href: `/${adminPrefix}/image-bank/usage-logs`, label: "Usage logs (RGPD)" },
+        { href: `/${adminPrefix}/image-bank/settings`, label: "Settings" },
+      ],
+    },
     {
       key: "engagement",
```

**Effort** : 15min.

---

## 🟠 P1-7 — CHANGELOG.md entrée V1

**Fichier modifié** : `CHANGELOG.md` (insérer en tête après le header)

```markdown
## v1.0-image-bank — 2026-05-16

### Added — Image Bank V1 (Sprint 1-7)

**Branche** : `feat/image-bank-v1` (commits 842cd3e → 4cdfbe4)

- **Schema Prisma** (842cd3e) : 10 tables (Country + 8 image-bank core + ImageUsageLog + ImageDownloadLog + ImageImportBatch), 25 indexes (dont GIN target_countries/target_languages/keywords_secondary + tsvector FTS), seeds REST Countries (249 pays) + 5 catégories + 10 tags.
- **Services TS** (842cd3e) : 10 services + SSOT taxonomy + image-utils.ts (27 exports, 331 LOC). Type safety stricte (zéro any/as never). Imports canoniques 100% (@/lib/prisma, @/auth, getBullConnectionOrThrow).
- **Admin UI** (eb03310) : 15 sub-pages (overview + library + upload + quality + 10 stubs Sprint 2.x) + AdminCommandPalette 9 entrées + ImageUploadDropzone WCAG 2.2 + 3 Server Actions (upload, publish, translate).
- **Public pages** (b7dbd3e) : 6 routes (`/galerie` index + `[slug]` detail + `[slug]/telecharger` download + 3 hubs) + JSON-LD @graph chained 6 entités + hreflang FR/EN + download rate-limit 10/min/IP + EXIF strip RGPD.
- **Sitemap + IndexNow** (8682a57) : Sub-sitemaps `images-{fr,en}.xml` Google Image Sitemap 1.1 + namespace xmlns:image + IndexNow `collectImageBankUrls()` cap 1000 + segment FR=galerie / EN=gallery.
- **Workers BullMQ** (cc012f4) : 4 workers (enrich, import, translate, crons) — pattern email-worker. NON activés en prod (par design ADR 0027, activation après QA staging).
- **Perf gates** (f42fe98) : `/galerie` + `/gallery` ajoutés `lighthouserc.json` + size-limit bucket 75 KB gz/route.
- **Documentation** (263f9b6) : ADR 0027 (Accepted, 5 décisions STOP&ASK, Web Vitals gate, roadmap V1.5) + `docs/image-bank/README.md` (overview + pipelines + env vars + RGPD + activation workers).

### Pipeline complet

- Upload admin → Sharp pipeline (WebP/AVIF/LQIP/OG) + EXIF GPS strip + magic bytes validation + dedup `fileHash`.
- Enrich (Claude Sonnet 4.6 vision) → translation FR/EN miroir + SEO/AEO/GEO metadata + taxonomy detection + country detection.
- Watermark on-the-fly (SVG overlay mocha #2a2520 opacity 0.65) si watermarkEnabled.
- Download route handler rate-limit Redis + watermark + tracking ImageDownloadLog (ipHash SHA-256 + IP_HASH_SALT).
- IndexNow ping postbuild auto-add publishedAt URLs.

### Audit V1 Verification

- Audit complet livré `_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/` (14 fichiers) — score 909/1000 🟡 CONDITIONAL.
- P0 bloquant merge : endpoint RGPD droit à l'oubli (art. 17 GDPR) — à coder.
- P1 backlog 30j : tests Vitest ≥80%, workers activation, AdminSidebar 9e groupe, Sentry workers, retry/backoff config.

### Roadmap V1.5

pHash perceptual reverse search, JPEG XL Sharp 0.34, Cloudflare Polish + Mirage, dashboard ROI AEO/GEO Recharts, IPTC/XMP `XMP-axionia:*` exiftool, Naver Webmaster, AVIF effort 9 async worker, Plausible custom events.
```

**Effort** : 10min.

---

## 🟠 P1-2 — Activation workers `worker.ts`

**Fichier modifié** : `src/server/queue/worker.ts`

```diff
+import { startImageBankEnrichWorker } from "./workers/image-bank-enrich-worker";
+import { startImageBankImportWorker } from "./workers/image-bank-import-worker";
+import { startImageBankTranslateWorker } from "./workers/image-bank-translate-worker";
+import { startImageBankCronsWorker } from "./workers/image-bank-crons-worker";

 // ... existing imports

 const WORKERS_TO_START = [
   startEmailWorker,
   startBookingCronsWorker,
   startContentGenWorker,
   startRetentionPurgeWorker,
   startContentMonitoringWorker,
   startWebVitalsMonitorWorker,
+  startImageBankEnrichWorker,
+  startImageBankImportWorker,
+  startImageBankTranslateWorker,
+  startImageBankCronsWorker,
 ];
```

**À faire APRÈS QA staging green**. Effort : 15min.

---

## 🟠 P1-4 — Retry/backoff workers helpers

**Fichier nouveau** : `src/server/image-bank/queues.ts`

```ts
import { Queue, type JobsOptions } from "bullmq";
import { getBullConnectionOrThrow } from "@/server/queue/connection";
import {
  ENRICH_ATTEMPTS,
  ENRICH_BACKOFF_DELAY_MS,
  IMPORT_ATTEMPTS,
  IMPORT_BACKOFF_DELAY_MS,
  TRANSLATE_ATTEMPTS,
  TRANSLATE_BACKOFF_DELAY_MS,
} from "./constants";

const DEFAULT_REMOVE = { age: 24 * 3600, count: 1000 } as const;

const enrichQueue = new Queue("image-bank-enrich", {
  connection: getBullConnectionOrThrow(),
});

const importQueue = new Queue("image-bank-import", {
  connection: getBullConnectionOrThrow(),
});

const translateQueue = new Queue("image-bank-translate", {
  connection: getBullConnectionOrThrow(),
});

export async function enqueueEnrichJob(
  data: { imageId: string; locale: "fr" | "en" },
  opts?: JobsOptions,
): Promise<void> {
  await enrichQueue.add(`enrich:${data.imageId}:${data.locale}`, data, {
    attempts: ENRICH_ATTEMPTS,
    backoff: { type: "exponential", delay: ENRICH_BACKOFF_DELAY_MS },
    removeOnComplete: DEFAULT_REMOVE,
    removeOnFail: DEFAULT_REMOVE,
    ...opts,
  });
}

export async function enqueueImportJob(
  data: { batchId: string; row: number; filePath: string },
  opts?: JobsOptions,
): Promise<void> {
  await importQueue.add(`import:${data.batchId}:${data.row}`, data, {
    attempts: IMPORT_ATTEMPTS,
    backoff: { type: "exponential", delay: IMPORT_BACKOFF_DELAY_MS },
    removeOnComplete: DEFAULT_REMOVE,
    removeOnFail: DEFAULT_REMOVE,
    ...opts,
  });
}

export async function enqueueTranslateJob(
  data: { imageId: string; sourceLang: "fr" | "en"; targetLang: "fr" | "en" },
  opts?: JobsOptions,
): Promise<void> {
  await translateQueue.add(`translate:${data.imageId}:${data.targetLang}`, data, {
    attempts: TRANSLATE_ATTEMPTS,
    backoff: { type: "exponential", delay: TRANSLATE_BACKOFF_DELAY_MS },
    removeOnComplete: DEFAULT_REMOVE,
    removeOnFail: DEFAULT_REMOVE,
    ...opts,
  });
}
```

Puis remplacer ligne 96-99 dans `upload.action.ts` :

```diff
-  // TODO: imageBankEnrichQueue.add(...)
-  // (Sprint 5.x — workers BullMQ activation)
+  await enqueueEnrichJob({ imageId: created.id, locale: "fr" });
+  await enqueueTranslateJob({ imageId: created.id, sourceLang: "fr", targetLang: "en" });
```

**Effort** : 1h.

---

## 🟠 P1-6a + P1-6b — Detail page `og:image` + hreflang alternates

**Fichier modifié** : `src/app/[locale]/galerie/[slug]/page.tsx:20-43`

```diff
 export async function generateMetadata({
   params,
 }: Props): Promise<Metadata> {
   const { locale, slug } = await params;
   const image = await getImageBySlug(locale, slug);
   if (!image) return {};
   const tr = image.translations[0];
   if (!tr) return {};
   const segment = locale === "fr" ? "galerie" : "gallery";
+  const otherSegment = locale === "fr" ? "gallery" : "galerie";
+  const otherLocale = locale === "fr" ? "en" : "fr";
+  const otherTr = image.translations.find((t) => t.languageCode === otherLocale);
+
+  const ogImageUrl = `${SITE_URL}/api/image-bank/${image.id}/og.webp`;

   return {
     title: tr.metaTitle ?? tr.title,
     description: tr.metaDescription ?? tr.caption ?? tr.alt,
     alternates: {
       canonical: `${SITE_URL}/${locale}/${segment}/${tr.slug}`,
+      languages: {
+        "fr-FR": `${SITE_URL}/fr/${locale === "fr" ? "galerie" : "galerie"}/${
+          locale === "fr" ? tr.slug : (otherTr?.slug ?? tr.slug)
+        }`,
+        "en-US": `${SITE_URL}/en/gallery/${
+          locale === "en" ? tr.slug : (otherTr?.slug ?? tr.slug)
+        }`,
+        "x-default": `${SITE_URL}/fr/galerie/${
+          locale === "fr" ? tr.slug : (otherTr?.slug ?? tr.slug)
+        }`,
+      },
     },
     openGraph: {
       title: tr.ogTitle ?? tr.title,
       description: tr.ogDescription ?? tr.caption ?? tr.alt,
       type: "article",
+      images: [
+        {
+          url: ogImageUrl,
+          width: 1200,
+          height: 630,
+          alt: tr.alt,
+        },
+      ],
+      locale: locale === "fr" ? "fr_FR" : "en_US",
     },
   };
 }
```

**Effort** : 20min.

---

## 🟡 P1-8 — `ImageCategory*` + `ImageTag*` `createdAt/updatedAt`

**Migration** : `prisma/migrations/20260517000000_image_bank_lookup_temporal/migration.sql`

```sql
-- Add temporal fields to lookup tables (RGPD audit trail + maintenance)

ALTER TABLE image_categories
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE image_category_translations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE image_tags
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE image_tag_translations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

**Schema** : ajouter dans `prisma/schema.prisma` aux 4 models concernés :

```prisma
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
```

**Effort** : 30min.

---

## 🟡 P2-SITEMAP-1 — Early-exit `stub.invalid` sub-sitemaps

**Fichiers modifiés** :

- `src/app/sitemaps/images-fr.xml/route.ts`
- `src/app/sitemaps/images-en.xml/route.ts`

```diff
 export async function GET(): Promise<Response> {
+  // Early-exit cohérence doctrine AGENTS.md (pattern knowledge-rss.ts)
+  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
+    return new Response(
+      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"></urlset>`,
+      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
+    );
+  }
+
   const rows = await fetchPublishedImages();
   // ...
 }
```

**Effort** : 10min (×2 fichiers).

---

## 🟡 P1-5 — Sentry capture workers

**Fichiers modifiés** : 4 workers `image-bank-*-worker.ts`

```diff
+import * as Sentry from "@sentry/nextjs";

 worker.on("failed", (job, err) => {
   console.error(
     `[image-bank-enrich-worker] failed: ${job?.data?.imageId} (attempt ${job?.attemptsMade})`,
     err,
   );
+  Sentry.captureException(err, {
+    tags: { worker: "image-bank-enrich" },
+    extra: { jobData: job?.data, attemptsMade: job?.attemptsMade },
+  });
 });
```

**Effort** : 30min (4 workers × ~5min chacun).

---

## 📊 Synthèse patches

| ID                             | Sévérité |             Fichiers |          Effort |
| ------------------------------ | :------: | -------------------: | --------------: |
| P0-1 (RGPD oubli)              |    🔴    |           4 nouveaux |            1h30 |
| P1-3 (AdminSidebar)            |    🟠    |              1 modif |           15min |
| P1-7 (CHANGELOG)               |    🟠    |              1 modif |           10min |
| P1-2 (workers activation)      |    🟠    |              1 modif | 15min (post-QA) |
| P1-4 (retry/backoff)           |    🟠    |  1 nouveau + 1 modif |              1h |
| P1-6a/6b (detail metadata)     |    🟠    |              1 modif |           20min |
| P1-8 (lookup tables temporal)  |    🟡    | 1 migration + schema |           30min |
| P2-SITEMAP-1 (stub early-exit) |    🟡    |             2 modifs |           10min |
| P1-5 (Sentry workers)          |    🟠    |             4 modifs |           30min |
| **TOTAL P0+P1 immédiat**       |    —     |                    — |         **~5h** |

---

## 🚦 Application recommandée

1. **Immédiat (~2h)** : P0-1 + P1-3 + P1-7 → MERGE V1 autorisé
2. **Avant activation prod (~1h45)** : P1-4 + P1-6a/b + P1-2 (après QA staging) + P1-5
3. **Sprint correctif 30j (~25-30h)** : P1-1 (tests Vitest) + P1-8/9/10 + MIX-001 + GAP-25
4. **V1.5 (~10-15h)** : P2 backlog (AEO/GEO, Bing API, UI Pagination, Plausible, CF Cache Rules, etc.)
