# PROMPT MAÎTRE — Axion-IA Image Bank (v1.0 · 2026-05-15)

> **Source unique de vérité** pour la banque d'images SEO/AEO/GEO d'Axion-IA.
> Couplé au skill `.claude/skills/axionia-image-bank/SKILL.md`.
> Inspiré du système ImageBank de SOS-Expat (Blog Laravel multilingue 9 langues) — **réécrit pour la stack Axion-IA** (Next.js 16 App Router + Postgres + Prisma 5.22 + BullMQ + FR/EN bilingue avec FR canonique).

---

## 0. Pourquoi ce système

Objectif : faire d'Axion-IA **le réseau de référence en France pour les visuels « IA opérationnelle B2B »** indexés par Google Images, Bing Images et les LLMs (ChatGPT, Perplexity, Claude). Chaque image hébergée devient une **page indexable** avec ses métadonnées complètes (alt, caption, geo, license CC BY 4.0, JSON-LD `ImageObject`).

Bénéfices attendus :

1. **SEO Images** : 100 % des images du site portent metadata complètes + sont listées dans `sitemap-images.xml` Google 1.1.
2. **AEO/GEO** : metadata structurées (ImageObject + ContentLocation + License) → réutilisables par les LLMs avec attribution Axion-IA.
3. **Réseau de backlinks** : licence CC BY 4.0 → réutilisation libre avec attribution + lien retour `axion-ia.com`.
4. **Performance** : srcset + AVIF + WebP + LQIP → LCP ≤ 1 800 ms p75 (cible Axion-IA, voir `AGENTS.md`).
5. **Portabilité** : architecture documentée pour porter le système vers d'autres stacks (Laravel, Rails, Django, Astro). Voir `references/portability-other-stacks.md` du skill.

---

## 1. Périmètre — ce qui est dans le scope V1

✅ **Dans le scope V1** :

- Table `ImageAsset` + `ImageAssetTranslation` Prisma (FR + EN)
- Catégories + tags (FR + EN)
- Pages publiques : `/[locale]/galerie/` (index), `/[locale]/galerie/[slug]` (détail)
- Console admin : `/[locale]/(admin)/[adminPrefix]/image-bank/*`
- Upload Next.js Server Action → resize Sharp → variants WebP + AVIF + LQIP
- JSON-LD `ImageObject` + `BreadcrumbList` + `ImageGallery`
- Sitemap `sitemap-images.xml` (Google Image Sitemap 1.1)
- Hreflang FR/EN sur toutes les pages images (FR = x-default)
- Watermark on-the-fly via Sharp pour téléchargements
- IPTC/XMP metadata embedding (Sharp + `exiftool` optionnel)
- Auto-translation FR ↔ EN via Anthropic Claude 4.x
- Auto-tagging pays via détecteur déterministe (table `Country` existante)
- IndexNow ping (s'intègre au `scripts/indexnow-ping.ts` postbuild existant)
- Usage logs (vue, download, embed) avec IP hashée SHA-256 (RGPD)
- Worker BullMQ pour pipelines lourds (import bulk, regenerate variants)

❌ **Hors scope V1** (reportés V2) :

- 9 langues comme SOS-Expat — Axion-IA reste **FR + EN bilingue** (FR canonique)
- Hotlinks Unsplash — Axion-IA est **0 dépendance externe** (images stockées localement ou S3/R2)
- Album/collection éditoriale curée
- Modération communautaire / soumission utilisateur
- Recherche reverse-image
- API publique tierce (rate-limit, JWT, etc.)

❌ **Anti-objectifs** (jamais) :

- Stocker du contenu sous copyright tiers sans license claire
- Servir des watermarks visibles à Googlebot (LCP + indexation degradés)
- Synchroniser le `target_countries` avec le SSOT `regions.ts` (regions = villes France, target_countries = ISO monde — concepts distincts)

---

## 2. Reality-check (état au 2026-05-15)

**Source unique de vérité** : voir le skill `.claude/skills/axionia-image-bank/references/axionia-stack-validated.md` (reality-check exhaustif contre le code réel).

### 2.1 — Validé ✅ (à utiliser tel quel)

| Élément                                                                          | Citation                                             | Action                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Prisma 5.22 + extensions Postgres + enum `Locale { fr, en }`                     | `schema.prisma:18-43`                                | Réutiliser                                     |
| BullMQ 5.76.5 + ioredis + workers content-gen existants (14)                     | `package.json:104`, `src/server/queue/connection.ts` | Copier pattern email-worker.ts                 |
| Next.js 16 App Router + sitemap.ts/`generateSitemaps()`                          | `next.config.ts`, `src/app/sitemap.ts`               | Étendre pour images-\*.xml                     |
| next-intl v4.11.0 + pathnames bilingues                                          | `src/i18n/routing.ts:12-15`                          | Déclarer `/galerie`                            |
| Footer composant async + sections Services/Resources/Company/Implantations/Legal | `src/components/nav/Footer.tsx` (PAS `layout/`)      | Patcher array `resources`                      |
| Design.md v3 tokens dans `globals.css` via Tailwind v4 `@theme`                  | `Design.md:24-114`                                   | Utiliser tokens, jamais hex                    |
| Admin pattern `(admin)/[adminPrefix]/*` + NextAuth v5                            | `src/env.ts:38-57`                                   | Imiter content-gen                             |
| Hetzner Storage S3-compat (AWS SDK)                                              | `package.json:73-74`, `.env.example`                 | Réutiliser config                              |
| IndexNow postbuild (top 15 paths × 2 locales = 30 URLs)                          | `scripts/indexnow-ping.ts:1-88`                      | **Étendre, pas remplacer**                     |
| ANTHROPIC_API_KEY pour Claude vision                                             | `.env.example`                                       | Réutiliser                                     |
| tsconfig strict + path alias `@/*`                                               | `tsconfig.json`                                      | Respecter                                      |
| Lighthouse CI gates stricts                                                      | `lighthouserc.json`                                  | LCP 1800, INP 80, CLS 0.05, Perf ≥ 95, SEO 100 |

### 2.2 — À CRÉER ❌ (n'existe pas)

1. **Table `Country`** Prisma (CRITIQUE — bloquante pour geo-targeting). 249 ISO codes + noms FR/EN.
2. **8 tables image-bank** (ImageAsset, ImageAssetTranslation, ImageCategory, ImageCategoryTranslation, ImageTag, ImageTagTranslation, ImageAssetTag, ImageUsageLog).
3. **Pathnames `/galerie`** dans `src/i18n/routing.ts`.
4. **Env var `IP_HASH_SALT`** pour hashing IP RGPD.
5. **Scripts `image-bank:*`** dans `package.json`.
6. **Isolation check** `scripts/image-bank/isolation-check.ts`.
7. **ADR 0024-image-bank-architecture.md**.

### 2.3 — Découvertes (réinformer la décision)

1. **`src/server/content-gen/images/image-optimizer.ts`** existe déjà — **LIRE** avant Sprint 1 (peut faire déjà du Sharp resize, aligner au lieu de dupliquer).
2. **Site est déjà bilingue FR + EN** via `routing.ts` (la doc `.env.example:78` "FR-only v1.2" est obsolète).
3. **Tiptap éditeur** disponible pour rich-text admin (`src/components/admin/TiptapEditor.tsx`).
4. **KB readers pattern** (`src/lib/knowledge/readers.ts`) — copier pour `image-bank-client.ts` lecture seule.
5. **AdminCommandPalette** ⌘K — ajouter routes `/image-bank` pour cohérence UX.
6. **RETENTION_PURGE worker** existant — étendre pour `image_usage_logs` (env `RETENTION_IMAGE_LOGS_MONTHS=12`).

Si l'un de ces éléments a changé depuis 2026-05-15 → STOP & ASK Will avant Sprint 1.

---

## 3. Architecture cible (data model Prisma)

### 3.1 — Tables (7 nominales)

```prisma
// ============================================================
// IMAGE BANK — Sprint M? (axionia-image-bank v1)
// ============================================================
// Doctrine :
//   - FR canonique, EN miroir (pas 9 langues comme SOS-Expat)
//   - Stockage local ou S3/R2 (PAS de hotlinks Unsplash)
//   - License par défaut CC BY 4.0
//   - Geo-targeting via ISO codes (target_countries jsonb)
// ============================================================

model ImageAsset {
  id                String   @id @default(uuid()) @db.Uuid
  categoryId        String?  @map("category_id") @db.Uuid

  // File data
  filePath          String   @map("file_path") @db.VarChar(500)
  thumbnailPath     String?  @map("thumbnail_path") @db.VarChar(500)
  avifPath          String?  @map("avif_path") @db.VarChar(500)
  lqipDataUri       String?  @map("lqip_data_uri") @db.Text // base64 LQIP placeholder
  fileFormat        String   @default("webp") @map("file_format") @db.VarChar(10)
  fileSize          Int      @default(0) @map("file_size")
  width             Int
  height            Int
  orientation       String   @db.VarChar(20) // landscape | portrait | square
  aspectRatio       String?  @map("aspect_ratio") @db.VarChar(10)
  srcset            String?  @db.Text

  // SEO core
  slug              String   @unique @db.VarChar(255)
  keywordsPrimary   String?  @map("keywords_primary") @db.VarChar(255)
  keywordsSecondary Json?    @map("keywords_secondary") // string[]
  seoScore          Int      @default(0) @map("seo_score") @db.SmallInt

  // Geo targeting (monde, pas regions.ts France)
  targetCountries   Json?    @map("target_countries") // string[] ISO ex. ["FR","DE","BE"]
  targetLanguages   Json?    @map("target_languages") // ["fr","en"]
  geoRegion         String?  @map("geo_region") @db.VarChar(10)
  geoPlacename     String?  @map("geo_placename") @db.VarChar(255)
  geoPosition       String?  @map("geo_position") @db.VarChar(50) // "lat;lon"

  // License (CC BY 4.0 par défaut)
  licenseType       String   @default("cc-by-4.0") @map("license_type") @db.VarChar(50)
  licenseUrl        String?  @default("https://creativecommons.org/licenses/by/4.0/") @map("license_url") @db.VarChar(500)
  copyrightHolder   String   @default("Axion-IA OÜ") @map("copyright_holder") @db.VarChar(255)
  photographerName  String?  @map("photographer_name") @db.VarChar(255)
  photographerUrl   String?  @map("photographer_url") @db.VarChar(500)

  // Source (origin tracking)
  sourceUrl         String?  @map("source_url") @db.Text
  sourceType        String   @default("local") @map("source_type") @db.VarChar(20) // local | upload | ai_generated
  aiModel           String?  @map("ai_model") @db.VarChar(50) // gpt-image-1, sdxl, etc.

  // Tracking
  viewCount         Int      @default(0) @map("view_count")
  downloadCount     Int      @default(0) @map("download_count")
  embedCount        Int      @default(0) @map("embed_count")

  // State
  isActive          Boolean  @default(true) @map("is_active")
  isFeatured        Boolean  @default(false) @map("is_featured")
  sortOrder         Int      @default(0) @map("sort_order")
  publishedAt       DateTime? @map("published_at")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  category          ImageCategory? @relation(fields: [categoryId], references: [id])
  translations      ImageAssetTranslation[]
  tags              ImageAssetTag[]
  usageLogs         ImageUsageLog[]

  @@index([isActive, categoryId, sortOrder])
  @@index([isActive, publishedAt])
  @@index([sourceType])
  @@map("image_assets")
}

model ImageAssetTranslation {
  id              Int      @id @default(autoincrement())
  imageId         String   @map("image_id") @db.Uuid
  languageCode    String   @map("language_code") @db.VarChar(5) // fr | en

  // SEO per-language (CRITIQUE Google Images)
  title           String   @db.VarChar(255)
  slug            String   @db.VarChar(255)
  alt             String   @db.VarChar(255) // 30-125 char optimal
  caption         String?  @db.VarChar(500)
  description     String?  @db.Text

  // Meta (head HTML)
  metaTitle       String?  @map("meta_title") @db.VarChar(255)
  metaDescription String?  @map("meta_description") @db.VarChar(255)
  ogTitle         String?  @map("og_title") @db.VarChar(255)
  ogDescription   String?  @map("og_description") @db.VarChar(255)

  // AEO/GEO (pour LLMs)
  aiSummary       String?  @map("ai_summary") @db.Text

  // Embed
  embedTitle      String?  @map("embed_title") @db.VarChar(255)

  isPublished     Boolean  @default(false) @map("is_published")
  publishedAt     DateTime? @map("published_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  image           ImageAsset @relation(fields: [imageId], references: [id], onDelete: Cascade)

  @@unique([imageId, languageCode])
  @@index([languageCode, slug])
  @@index([languageCode, isPublished])
  @@map("image_asset_translations")
}

model ImageCategory {
  id             String   @id @default(uuid()) @db.Uuid
  slug           String   @unique @db.VarChar(100)
  isActive       Boolean  @default(true) @map("is_active")
  sortOrder      Int      @default(0) @map("sort_order")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  translations   ImageCategoryTranslation[]
  images         ImageAsset[]

  @@map("image_categories")
}

model ImageCategoryTranslation {
  id              Int      @id @default(autoincrement())
  categoryId      String   @map("category_id") @db.Uuid
  languageCode    String   @map("language_code") @db.VarChar(5)
  name            String   @db.VarChar(255)
  slug            String   @db.VarChar(255)
  description     String?  @db.Text
  metaTitle       String?  @map("meta_title") @db.VarChar(255)
  metaDescription String?  @map("meta_description") @db.Text

  category        ImageCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, languageCode])
  @@index([languageCode, slug])
  @@map("image_category_translations")
}

model ImageTag {
  id           Int      @id @default(autoincrement())
  slug         String   @unique @db.VarChar(100)

  translations ImageTagTranslation[]
  images       ImageAssetTag[]

  @@map("image_tags")
}

model ImageTagTranslation {
  id           Int      @id @default(autoincrement())
  tagId        Int      @map("tag_id")
  languageCode String   @map("language_code") @db.VarChar(5)
  name         String   @db.VarChar(255)
  slug         String   @db.VarChar(255)

  tag          ImageTag @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([tagId, languageCode])
  @@map("image_tag_translations")
}

model ImageAssetTag {
  imageId String   @map("image_id") @db.Uuid
  tagId   Int      @map("tag_id")

  image   ImageAsset @relation(fields: [imageId], references: [id], onDelete: Cascade)
  tag     ImageTag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([imageId, tagId])
  @@map("image_asset_tags")
}

model ImageUsageLog {
  id          BigInt   @id @default(autoincrement())
  imageId     String   @map("image_id") @db.Uuid
  action      String   @db.VarChar(20) // view | download | embed | share
  referrerUrl String?  @map("referrer_url") @db.VarChar(500)
  userAgent   String?  @map("user_agent") @db.VarChar(500)
  ipHash      String?  @map("ip_hash") @db.VarChar(64) // SHA-256, RGPD
  language    String?  @db.VarChar(5)
  countryCode String?  @map("country_code") @db.VarChar(5)
  createdAt   DateTime @default(now()) @map("created_at")

  image       ImageAsset @relation(fields: [imageId], references: [id], onDelete: Cascade)

  @@index([imageId, action])
  @@index([action, createdAt])
  @@map("image_usage_logs")
}
```

### 3.2 — Index GIN PostgreSQL (migration SQL raw)

À ajouter via migration SQL raw (Prisma ne supporte pas GIN natif sur jsonb) :

```sql
-- image_assets : index GIN sur tableaux jsonb pour requêtes contains
CREATE INDEX idx_image_assets_target_countries
  ON image_assets USING GIN (target_countries jsonb_path_ops);

CREATE INDEX idx_image_assets_target_languages
  ON image_assets USING GIN (target_languages jsonb_path_ops);

CREATE INDEX idx_image_assets_keywords_secondary
  ON image_assets USING GIN (keywords_secondary jsonb_path_ops);

-- Search FTS sur title + alt + description (consolidé par langue)
-- Pattern Axion-IA : voir `prisma/migrations_fts/`
```

---

## 4. Pipeline d'import (Server Action + BullMQ worker)

### 4.1 — Étapes du pipeline

1. **Upload** (`src/app/[locale]/(admin)/[adminPrefix]/image-bank/upload/route.ts`)
   - Server Action accepte multipart/form-data (jpg, png, webp, tiff)
   - Validation : taille ≤ 50 MB, dimensions ≥ 800×600
   - SHA-256 du buffer → dedup check (`ImageAsset.findFirst({ where: { filePath: { contains: hash }}})`)

2. **Sharp pipeline** (synchrone si < 5 MB, sinon enqueue BullMQ)
   - Lecture original → métadonnées (width, height, format, EXIF)
   - Détection orientation : `landscape | portrait | square`
   - Génération variants :
     - **sm** : `640w` WebP q=80 → `image-sm.webp`
     - **md** : `960w` WebP q=80 → `image-md.webp`
     - **lg** : `1200w` WebP q=80 → `image-lg.webp`
     - **xl** : `1920w` WebP q=80 → `image-xl.webp` (seulement si original ≥ 1920w)
     - **avif-md** : `960w` AVIF q=55 → `image-md.avif` (browser support universel 2026)
     - **avif-lg** : `1200w` AVIF q=55 → `image-lg.avif`
     - **thumbnail** : `300w` WebP q=80 → `thumb.webp`
     - **lqip** : `20w` blur jpeg base64 → stocké inline dans `lqip_data_uri`
   - Storage : `public/image-bank/{uuid}/...` en dev, S3/R2 en prod (config via `env.ts`)
   - Embed XMP/IPTC metadata via Sharp (`.withMetadata()`) + `exiftool` si dispo

3. **DB transaction**
   - Create `ImageAsset` avec defaults
   - Create translation FR (slug auto via `slugify(title)`)
   - Cache invalidate : `revalidateTag('image-bank')`

4. **Auto-enrichment (asynchrone via BullMQ worker `image-bank-enrich-worker.ts`)**
   - **Auto-country detection** : `ImageCountryDetectorService` → extract ISO codes depuis title/alt/caption/keywords + table `Country` (jointure FR/EN names)
   - **AI alt-text generation** : si alt vide → appel Claude Sonnet 4.x avec image en input (vision) → max 125 char
   - **EN translation** : Claude génère traduction EN (title/alt/caption/description/meta\_\*) → upsert translation
   - **SEO score calculation** : `ImageSeoScoreService` (0-100, voir 7.2)
   - **IndexNow ping** : enqueue URL FR + EN dans `scripts/indexnow-ping.ts` queue

### 4.2 — Idempotence

- Re-upload même fichier (même SHA-256) → retourne l'existing `ImageAsset.id` sans dupliquer
- Re-trigger enrich pipeline est safe (upsert partout, jamais insert direct sur translations)

---

## 5. Pages publiques Next.js

### 5.0 — Visibilité dans la navigation (footer obligatoire)

Le lien vers la banque d'images **DOIT** apparaître dans le **footer global** du site (pas dans le header — la galerie reste secondaire vs Interventions/Audit/Implémentation qui sont les modules commerciaux).

**Implémentation footer** (chemin réel vérifié 2026-05-15) :

- **Fichier** : `src/components/nav/Footer.tsx` (Server Component async)
- **Section** : array `resources` (lignes 34-43)
- **Label FR** : **« Banque d'images »**
- **Label EN** : **« Image bank »**
- **URL** : `/{locale}/galerie/` (FR `/fr/galerie/`, EN `/en/gallery/`)
- **Position** : à la fin de l'array `resources`, après "Centre d'aide"
- Pas de badge "Nouveau" sauf si Will le demande au lancement

**Ligne à ajouter** :

```ts
{ href: "/galerie", label: isFr ? "Banque d'images" : "Image bank" },
```

**PRÉREQUIS critique** — déclarer dans `src/i18n/routing.ts` AVANT le patch Footer.tsx (sinon TypeScript force `as never` → casse l'isolation type-safe) :

```ts
"/galerie": { fr: "/galerie", en: "/gallery" },
"/galerie/[slug]": { fr: "/galerie/[slug]", en: "/gallery/[slug]" },
"/galerie/[slug]/download": { fr: "/galerie/[slug]/telecharger", en: "/gallery/[slug]/download" },
```

**Bénéfices SEO/AEO** :

- Backlink interne sitewide → boost autorité topique pages galerie
- Découverte crawl Googlebot via tout le maillage du site
- Cohérence UX (l'utilisateur retrouve la galerie depuis n'importe quelle page)

**À NE PAS faire** :

- ❌ Ajouter au header principal (non-prioritaire commercial)
- ❌ Pop-up ou banner promotion — sobriété éditoriale doctrine Axion-IA
- ❌ Lien direct vers une catégorie (rester sur l'index pour permettre exploration)

**Si le footer a une mention "© Axion-IA OÜ"** : ne PAS la modifier ici. Le copyright global du site et le copyright des images sont 2 entités séparées.

### 5.1 — Routes

| Route                               | Fichier                                             | Description                                                                                      |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/[locale]/galerie/`                | `src/app/[locale]/galerie/page.tsx`                 | Index galerie (FR `/fr/galerie/`, EN `/en/gallery/`) avec filtres category, orientation, country |
| `/[locale]/galerie/[slug]`          | `src/app/[locale]/galerie/[slug]/page.tsx`          | Détail image + JSON-LD ImageObject + related                                                     |
| `/[locale]/galerie/[slug]/download` | `src/app/[locale]/galerie/[slug]/download/route.ts` | GET → applique watermark Sharp + tracking + serve                                                |
| `/[locale]/galerie/[slug]/embed`    | `src/app/[locale]/galerie/[slug]/embed/route.ts`    | GET → page embed minimaliste (iframe-friendly)                                                   |
| `/sitemaps/images-fr.xml`           | `src/app/sitemaps/images-fr.xml/route.ts`           | Sitemap images FR                                                                                |
| `/sitemaps/images-en.xml`           | `src/app/sitemaps/images-en.xml/route.ts`           | Sitemap images EN                                                                                |

**Localisation segment URL** : `galerie` (FR) / `gallery` (EN). Configurable via `src/i18n/route-segments.ts` (à créer si pas déjà fait).

**Default language-country pairs** :

- `fr` → page principale en `fr-FR` (canonique, x-default)
- `en` → page miroir en `en-US`

### 5.2 — Caching ISR + revalidation tags

```ts
// src/app/[locale]/galerie/[slug]/page.tsx
export const revalidate = 3600; // ISR 1h

export async function generateMetadata({ params }): Promise<Metadata> {
  // ... voir references/jsonld-imageobject.md
}

// Invalidation manuelle depuis admin : revalidateTag(`image:${slug}`)
```

### 5.3 — Hero image strategy (LCP-friendly)

- `<Image>` Next.js avec `priority` + `fetchPriority="high"` sur l'image hero
- `src` = `image-lg.webp` 1200w
- `srcSet` généré auto par Next à partir de `sizes`
- `placeholder="blur"` + `blurDataURL={lqipDataUri}` (déjà stocké en DB)
- `<picture>` fallback AVIF → WebP → JPEG (Next 16 le fait nativement avec `formats: ['image/avif','image/webp']` dans `next.config.ts`)
- Cible LCP : ≤ 1 200 ms sur 4G simulated (Lighthouse CI)

---

## 6. JSON-LD ImageObject — schéma exhaustif

Voir `references/jsonld-imageobject.md` pour le template TypeScript prêt à l'emploi.

Highlights :

- `@type: ImageObject` + `@id: {pageUrl}#image`
- `contentUrl` : URL CDN absolue de l'image (pas le path local)
- `representativeOfPage: true`
- `inLanguage` : `fr-FR` ou `en-US`
- **Dates null-safe** (bug observé sur SOS-Expat → 5xx GSC) : `dateModified ?? publishedAt ?? createdAt`
- `creator` : `{ @type: Organization, @id: '{siteUrl}/#organization', name: 'Axion-IA', url: 'https://axion-ia.com' }`
- `copyrightHolder` : `Axion-IA OÜ` (entité estonienne, voir contrainte § 9)
- `license` : `https://creativecommons.org/licenses/by/4.0/`
- `creditText` : `Axion-IA`
- `contentLocation` si `geoPlacename` présent : `{ @type: Place, name, geo: { @type: GeoCoordinates, latitude, longitude } }`
- `speakable` : `{ @type: SpeakableSpecification, cssSelector: ['h1', '.image-caption'] }`

Validation : `pnpm validate:schema-org` (à créer via `@apidevtools/json-schema` ou `schema-dts`).

---

## 7. Services TypeScript (dans `src/server/image-bank/`)

### 7.1 — Cloisonnement répertoires (§ pattern Axion-IA)

```
src/server/image-bank/
├── services/
│   ├── image-bank.service.ts         # CRUD ImageAsset
│   ├── image-seo.service.ts          # generateJsonLd, calculateSeoScore
│   ├── image-country-detector.service.ts  # auto-detect ISO codes
│   ├── image-import.service.ts       # Sharp pipeline
│   ├── image-translation.service.ts  # Claude FR ↔ EN
│   ├── image-watermark.service.ts    # On-the-fly watermark
│   └── image-sitemap.service.ts      # XML generation
├── repositories/
│   ├── image-asset.repository.ts
│   ├── image-category.repository.ts
│   └── image-tag.repository.ts
├── schemas/                          # Zod schemas
│   ├── image-upload.schema.ts
│   └── image-update.schema.ts
└── kb-client.ts                      # (si besoin) lecture KB Axion-IA

src/server/queue/workers/
├── image-bank-enrich-worker.ts       # Auto-translate + country + SEO score
└── image-bank-variants-worker.ts     # Régénération variants Sharp (admin action)

src/app/[locale]/(admin)/[adminPrefix]/image-bank/
├── page.tsx                          # Liste
├── new/page.tsx                      # Upload
├── [id]/page.tsx                     # Edit
├── categories/page.tsx
├── tags/page.tsx
└── analytics/page.tsx                # Usage logs dashboard

src/components/admin/image-bank/
├── ImageBankList.tsx
├── ImageUploadDropzone.tsx
├── ImageEditor.tsx                   # Edit metadata + translation grid FR/EN
├── ImageVariantsPreview.tsx
└── ImageSeoScoreBadge.tsx

src/app/[locale]/galerie/
├── page.tsx                          # Index public
├── [slug]/page.tsx                   # Détail public
└── [slug]/download/route.ts          # GET watermarked

src/app/sitemaps/
├── images-fr.xml/route.ts
└── images-en.xml/route.ts

scripts/image-bank/
├── isolation-check.ts                # Vérifie le cloisonnement
├── seed-categories.ts                # Seed catégories de base
└── bulk-import.ts                    # Import CSV → DB

prisma/seeds/image-bank/
└── index.ts                          # Seed catégories + 5 images démo

prisma/migrations_fts/
└── XXXX_image_bank_fts.sql           # GIN + FTS indexes

tests/image-bank/
├── unit/
│   ├── image-seo.service.spec.ts
│   ├── image-country-detector.service.spec.ts
│   └── image-import.service.spec.ts
├── integration/
│   └── upload-flow.spec.ts
└── e2e/
    └── public-gallery.spec.ts

docs/image-bank/
├── README.md
├── pipeline.md
└── faq.md
```

**Isolation check** : `scripts/image-bank/isolation-check.ts` doit échouer si un fichier hors de ces zones touche le module image-bank (pattern emprunté à `scripts/content-gen/isolation-check.ts`).

Ajouter au `package.json` :

```json
"image-bank:isolation-check": "tsx scripts/image-bank/isolation-check.ts",
"image-bank:seed": "tsx prisma/seeds/image-bank/index.ts",
"image-bank:check-variants": "tsx scripts/image-bank/check-variants.ts"
```

### 7.2 — SEO Score (0-100)

| Critère                                       | Points  | Comment                          |
| --------------------------------------------- | ------- | -------------------------------- |
| Alt text FR présent, 30-125 char              | 20      | Lecteurs d'écran + Google Images |
| Alt text EN présent, 30-125 char              | 15      |                                  |
| Caption FR présent                            | 10      |                                  |
| Description FR ≥ 50 char                      | 10      |                                  |
| Meta title FR + EN                            | 5       |                                  |
| `target_countries` ≥ 1                        | 5       | Geo signal                       |
| `geo_position` (lat;lon) présent              | 5       | KG signal                        |
| Photographer attribution                      | 5       | E-A-T                            |
| `keywords_primary` + ≥ 2 `keywords_secondary` | 10      |                                  |
| Variants AVIF + WebP + thumbnail générés      | 10      | Performance                      |
| IPTC/XMP copyright embedded                   | 5       | Google reconnaît                 |
| **Total**                                     | **100** |                                  |

Score ≥ 80 = ✅ publiable. Score 60-79 = ⚠️ alerte admin. Score < 60 = ❌ noindex (`isPublished = false`).

---

## 8. Sitemap Images Google 1.1

Voir `references/sitemap-images-spec.md` pour template XML + générateur Next.js complet.

Highlights :

- Namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
- Une `<url>` par image, avec une `<image:image>` enfant
- `<image:loc>` = URL absolue CDN de l'image
- `<image:title>` = `translation.title`
- `<image:caption>` = `translation.caption` ou `translation.alt`
- `<image:geo_location>` = `geo_placename`
- `<image:license>` = `https://creativecommons.org/licenses/by/4.0/`
- Hreflang FR/EN sur chaque `<url>` (xhtml:link)
- TTL cache : 1h (revalidatable via tag)
- Limit Google : 50 000 URLs / 50 MB par sitemap → si dépassé, split en `images-fr-1.xml`, `images-fr-2.xml`

---

## 9. Contraintes intouchables (alignées Axion-IA)

**Légales** :

- ✅ Naming **Axion-IA** partout (jamais "AxionIA" ou "Axion IA" dans le code)
- ✅ Entité : **Axion-IA OÜ** (estonienne) → 0 SIREN/SIRET/RCS dans copyright_holder
- ✅ License par défaut : **CC BY 4.0** (Creative Commons Attribution International)
- ✅ Copyright notice : `© {year} Axion-IA OÜ. Licensed under CC BY 4.0 — axion-ia.com`

**Design (palette intouchable, voir `Design.md` v3)** :

- Watermark download : couleur `--color-mocha #2a2520` (pas du noir), opacité 0.65
- Empty states galerie : illustrations terracotta `--color-terracotta #c24a1b`
- Badge SEO score : sage (vert) ≥ 80, terracotta 60-79, error 0-59

**Linguistique** :

- ✅ FR canonique partout (`hreflang="x-default" → /fr/galerie/...`)
- ✅ EN miroir (pas obligatoire au lancement V1, mais data model FR+EN prêt)
- ❌ Ne pas étendre à d'autres langues sans STOP & ASK Will

**Web Vitals (alignés `lighthouserc.json` réel — vérifié 2026-05-15)** :

- LCP ≤ 1 800 ms
- INP ≤ 80 ms (PAS 100 ms — Axion-IA est plus strict que la cible Google "Good")
- CLS ≤ 0.05 (PAS 0 strict — cible alignée Google "Good")
- TBT ≤ 150 ms
- FCP ≤ 1 500 ms
- Speed Index ≤ 2 500 ms
- Performance ≥ 95 %
- Accessibility ≥ 95 %
- Best Practices ≥ 95 %
- SEO = 100 %
- First Load JS ≤ 75 KB gz/route
- Lighthouse CI bloquant : `pnpm lhci`

**Sécurité** :

- Watermark download : Server Route Handler avec `cache: 'no-store'` + rate-limit (10/min par IP)
- IP hash SHA-256 + salt env-var, jamais l'IP brute
- Upload admin : middleware role check (`role === 'admin'`)
- File type validation : magic bytes (pas seulement extension)
- Sharp limits : `pixelLimit: 100_000_000` (100 MP max, anti-zip-bomb)

**RGPD** :

- `image_usage_logs.ip_hash` : SHA-256 avec salt rotatif (env-var `IP_HASH_SALT`)
- Pas de cookie tracking sur pages images publiques
- Pas de Google Analytics / Plausible côté image bank (utiliser les logs DB)
- Endpoint admin DELETE `/admin/image-bank/usage-logs/{ipHash}` (droit à l'effacement)

**Performance budget** :

- Pas de carrousel JS sur galerie liste (CSS grid + lazy load suffit)
- Lightbox optionnelle, chargée dynamiquement (`next/dynamic` avec `ssr: false`)
- AVIF first, WebP fallback, JPEG ultimate fallback (rare en 2026)

---

## 10. Intégration avec systèmes Axion-IA existants

### 10.1 — IndexNow (déjà câblé via `scripts/indexnow-ping.ts`)

À étendre :

- Lire les image URLs depuis `ImageAsset.findMany({ where: { publishedAt: { gte: lastBuildAt }}})` au postbuild
- Construire URLs FR + EN par image
- Ajouter au payload IndexNow batch (max 10 000 URLs / call)
- Logger dans table `IndexLog` (à créer si pas déjà fait)

### 10.2 — Sitemap index (déjà câblé)

`src/app/sitemap-index.xml/route.ts` (ou `src/app/sitemap.ts`) doit lister :

- `/sitemaps/images-fr.xml`
- `/sitemaps/images-en.xml`

### 10.3 — Content-generator (skill `axionia-content-generator`)

Quand le content-generator publie un article ou une landing, il peut **embarquer** une image de la banque :

- Lookup via `ImageAsset.findFirst({ where: { keywordsPrimary: { contains: topic }, targetCountries: { array_contains: [countryISO] }}})`
- Si pas de match → fallback IA (génération image) ou Unsplash (si autorisé par Will)
- Incrémenter `ImageAsset.embedCount` quand publié

### 10.4 — KB (skill `axionia-connaissances`)

Lecture seule : le service `image-bank.service.ts` peut requêter la KB pour enrichir les descriptions images avec faits doctrinaux (ex. "IA opérationnelle B2B — référence ADR 0001"). Pas d'écriture.

### 10.5 — `regions.ts` SSOT (villes France)

**Ne pas confondre** `target_countries` (ISO monde) avec `regions.ts` (villes France pour `villes:import`). Si on tagge une image avec une ville française, on peut :

- `geo_placename = "Lyon"` + `geo_position = "45.7640;4.8357"` + `target_countries = ["FR"]`
- **JAMAIS** modifier `regions.ts` depuis le module image-bank (SSOT verrouillé).

---

## 11. Roadmap Sprints

### Sprint 1 — Foundations (4-5 jours)

- [ ] Reality-check § 2 — confirmer fichiers cités existent toujours
- [ ] STOP & ASK § 12 (5 questions Will)
- [ ] **Step 0a (PRÉREQUIS)** — Créer table `Country` Prisma + seed depuis REST Countries API (~249 lignes, FR+EN names + slugs + ISO2/ISO3 + continent + flag emoji)
- [ ] **Step 0b** — Déclarer pathnames `/galerie`, `/galerie/[slug]`, `/galerie/[slug]/download` dans `src/i18n/routing.ts`
- [ ] **Step 0c** — Lire `src/server/content-gen/images/image-optimizer.ts` (existe déjà) — décider RÉUTILISER ou ALIGNER avec nouveau service
- [ ] Migration Prisma : 8 tables image-bank + GIN indexes via raw SQL (cf. `references/prisma-schema.md`)
- [ ] Seed : 5 catégories Axion-IA + 10 tags FR/EN
- [ ] Ajouter env var `IP_HASH_SALT` dans `src/env.ts` + `.env*.example`
- [ ] `image-bank.service.ts` CRUD basique
- [ ] `image-import.service.ts` Sharp pipeline (variants synchrones)
- [ ] Tests unitaires Vitest : ≥ 80 % couverture services
- [ ] `scripts/image-bank/isolation-check.ts` (pattern double-detection comme content-gen)
- [ ] Ajouter scripts `image-bank:*` dans `package.json` + intégrer dans `verify:all`

### Sprint 2 — Admin (3 jours)

- [ ] Upload dropzone + preview variants
- [ ] Editor metadata + translation grid FR/EN
- [ ] Liste + filtres + bulk actions
- [ ] Categories + tags admin pages
- [ ] Validation Zod tous endpoints

### Sprint 3 — Public pages (3 jours)

- [ ] `/[locale]/galerie/` index avec filtres
- [ ] `/[locale]/galerie/[slug]` détail avec JSON-LD ImageObject
- [ ] `<picture>` AVIF + WebP + Image Next.js LCP-optimized
- [ ] Hreflang FR/EN + canonical
- [ ] **Lien "Banque d'images" / "Image bank" dans le footer global** (§ 5.0)
- [ ] Tests E2E Playwright golden path (incluant assertion du lien footer présent sur 3+ pages aléatoires)

### Sprint 4 — Sitemap + IndexNow (1-2 jours)

- [ ] `/sitemaps/images-fr.xml` + `/sitemaps/images-en.xml`
- [ ] Validation Google Image Sitemap 1.1 via validator
- [ ] Extension `scripts/indexnow-ping.ts` pour image URLs
- [ ] Integration sitemap-index.xml

### Sprint 5 — Auto-enrichment (2-3 jours)

- [ ] BullMQ worker `image-bank-enrich-worker.ts`
- [ ] `image-country-detector.service.ts` (déterministe, table `Country`)
- [ ] `image-translation.service.ts` (Claude Sonnet 4.x avec vision)
- [ ] `image-seo.service.ts` calculateSeoScore (§ 7.2)
- [ ] Tests intégration : import → enrich → publish

### Sprint 6 — Performance + Watermark (2 jours)

- [ ] LCP optim : LQIP base64 + `<Image priority>` audit Lighthouse
- [ ] Watermark download Sharp on-the-fly
- [ ] Rate-limit downloads (Redis token bucket)
- [ ] LHCI bloquant : tous les targets verts

### Sprint 7 — Analytics + Exit V1 (1 jour)

- [ ] Page admin `/analytics/` : usage logs aggregations
- [ ] Export CSV usage logs (admin)
- [ ] Run checklist exit-v1 (`checklists/exit-v1.md`)
- [ ] Documentation `docs/image-bank/`

**SLO V1** :

- Upload + variants p50 ≤ 5 s, p99 ≤ 30 s (BullMQ pour > 5 MB)
- Page détail public p50 LCP ≤ 1 200 ms, p75 ≤ 1 800 ms
- Sitemap génération p50 ≤ 500 ms
- 100 % des images publiées ont SEO score ≥ 80

---

## 12. STOP & ASK Will (5 questions avant Sprint 1)

Reality-check 2026-05-15 a confirmé que Hetzner Storage S3-compat est déjà en place (`@aws-sdk/client-s3` + env vars), et que le site est déjà bilingue FR + EN via `routing.ts`. Les questions Will restantes :

1. **Storage en dev** : utiliser le bucket S3 prod Hetzner en dev aussi (cohérence URLs), ou stockage local `public/image-bank/` en dev + rsync vers S3 postbuild ? Le code prod doit toujours utiliser S3.
2. **EN miroir au lancement V1** : le site sert déjà /en/\* — donc on doit traduire les translations image-bank en EN dès V1 via Claude Sonnet 4.x vision ? Ou on lance FR-only et on backfill EN en V1.5 ? (Recommandation : EN dès V1, cohérence avec le reste du site).
3. **Watermark download** : on watermarke OUI/NON ? Si oui : opacité 0.65 + mocha `#2a2520` + position bottom-right validé ? Vérifier au passage si `src/server/content-gen/images/image-optimizer.ts` fait déjà du watermarking (à réutiliser).
4. **License enum** : CC BY 4.0 hardcodé OU enum `{ cc_by_40, cc0, proprietary }` éditable admin pour évolution future ?
5. **AI-generated images** : autorisées en V1 ? Si oui, contraintes : tag `sourceType: 'ai_generated'` + `aiModel` (gpt-image-1, sdxl, etc.) + disclaimer visible UI + JSON-LD `creator: { @type: SoftwareApplication, name: aiModel }` ?

---

## 13. Glossaire

| Terme                        | Définition                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Image bank**               | Système de gestion de visuels Axion-IA, indexable Google Images / Bing / LLMs |
| **Variants**                 | Versions redimensionnées d'une image (sm/md/lg/xl/thumbnail/avif)             |
| **LQIP**                     | Low-Quality Image Placeholder, base64 ≤ 1 KB pour blur fade-in                |
| **EXIF/IPTC/XMP**            | Metadata embedded dans le fichier image (camera, copyright, license)          |
| **ImageObject**              | Type schema.org JSON-LD pour les images                                       |
| **Google Image Sitemap 1.1** | Namespace `xmlns:image` pour décrire images dans sitemap                      |
| **IndexNow**                 | Protocole de ping Bing/Yandex pour signaler URLs nouvelles ou modifiées       |
| **AEO/GEO**                  | Answer Engine Optimization / Generative Engine Optimization (LLMs)            |
| **Hreflang**                 | Tag HTML/XML signalant les variantes linguistiques d'une URL                  |
| **LCP**                      | Largest Contentful Paint — Core Web Vital cible ≤ 1 800 ms p75 Axion-IA       |
| **OÜ**                       | Osaühing — entité juridique estonienne (SARL équivalent)                      |

---

## 14. Portabilité (résumé — voir `references/portability-other-stacks.md` pour détail)

| Stack          | Mapping principal                                                                    |
| -------------- | ------------------------------------------------------------------------------------ |
| **Laravel 12** | Eloquent + Spatie/sitemap + Intervention/Image + exiftool — voir SOS-Expat ImageBank |
| **Rails 7**    | ActiveRecord + Active Storage + ImageProcessing gem + sitemap_generator              |
| **Django 5**   | Django ORM + Pillow + django-sitemaps + django-imagekit                              |
| **Astro 5**    | Content Collections + sharp + astro-imagetools + custom sitemap-images.xml endpoint  |
| **Remix v3**   | Postgres direct + Sharp + manual sitemap action                                      |

Le **modèle de données** (7 tables) et le **JSON-LD ImageObject** sont identiques quelle que soit la stack. Ce qui change : ORM, image processor lib, sitemap generator, routing.

---

**Fin du prompt maître v1.0**

Source unique de vérité. Toute évolution → bump version + ADR justifié dans `docs/adr/`.
