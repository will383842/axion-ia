# 15 — MULTI-FORMAT OUTPUT (RSS + llms.txt + PDF / ePub + OG + Newsletter) — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` § "Agent 15 — Multi-format output + RSS + llms.txt + PDF/ePub + Newsletter" (~ligne 369).
> Agent : 15 — Multi-format output (parallèle).
> Date : 2026-05-13.
> Statut : DRAFT Phase A — **AUDIT-ONLY**, **aucun code écrit**, aucune migration. Tous les chemins et libs ci-dessous sont des **recommandations** à valider en Phase B avant le sprint KB-15.
> Référence : HEAD `main` (commit `95bba36`) — reality check `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`.
> Mode : doctrine `code = SSOT` — l'audit décrit la cible KB en s'appuyant sur le code existant (`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, 3× `feed.xml/route.ts`, `src/lib/indexnow.ts`, `src/server/queue/*`, `@vercel/og` déjà installé).

---

## 0. TL;DR

- **Bus de sortie KB cible** (V1) : 5 formats publics — **RSS Atom 1.0**, **JSON Feed 1.1**, **llms.txt + llms-full.txt** enrichis depuis la DB KB, **OpenGraph image dynamique** (`@vercel/og` déjà présent), **digest newsletter** auto-pickup BullMQ → nodemailer (PowerMTA / Zoho mémoire `axionia_session_2026-05-13_seo_email_stack`).
- **PDF on-demand** : décision Phase A = **`@react-pdf/renderer`** (~200 KB cold, pas de binaire natif, suffisant pour Tiptap simple). **Puppeteer + Chromium headless rejeté** (≥ 150 MB d'image Docker + ≥ 300 MB RAM résident, incompatible CPX32 ~8 GB partagé Coolify, mémoire `axionia_hosting_hetzner`).
- **ePub** : reporté **V1.5** uniquement si Will valide le besoin marketing (livre KB Axion-IA exporté en ePub pour Apple Books / Kobo / Google Play Books). Lib candidate : `epub-gen` (~150 KB pure JS).
- **LinkedIn carrousel / X thread / Substack cross-post** : confirmé **V2+** (§ « hors V1 »). Pas de scope V1.
- **Cibles non négociables** :
  - Tous les flux RSS/JSON Feed cachés ISR `revalidate: 600` (10 min — déjà en place sur RSS legacy à 900 s, on harmonise à 600).
  - Tous les flux référencés par `<link rel="alternate" type="application/rss+xml">` + `type="application/feed+json"` dans le `<head>` de la page liste correspondante.
  - llms.txt + llms-full.txt régénérés quotidiennement par cron BullMQ + ping IndexNow après régénération (helper `pingIndexNow` existant `src/lib/indexnow.ts`).
  - PDF jamais sync : endpoint 202 + URL ready quand worker fini, cache 24 h Coolify volume.
  - Newsletter idempotente sur clé `(entryId, digestId)` via Redis SET — jamais double-poster.
- **Anti-pattern n°1 bloquant** : générer un PDF synchronement en server action → timeout Coolify (request ≥ 30 s tué par Caddy / CF). **PDF = worker async obligatoire.**

---

## 1. INVENTAIRE DU CODE EXISTANT — base de réutilisation V1

### 1.1 RSS legacy (3 routes, à conserver, étendre KB-15)

| Route legacy                                      | Cache                     | Pattern                                 | KB cible                                                             |
| ------------------------------------------------- | ------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `src/app/[locale]/blog/feed.xml/route.ts`         | `max-age=900, swr=86400`  | RSS 2.0, items depuis `BLOG_POSTS` SSOT | À refactorer pour lire `KnowledgeEntry WHERE type='article'` (KB-15) |
| `src/app/[locale]/cas-concrets/feed.xml/route.ts` | `max-age=900, swr=86400`  | RSS 2.0, items depuis `CASE_STUDIES`    | À refactorer `WHERE type='case_study'` (KB-15)                       |
| `src/app/[locale]/faq/feed.xml/route.ts`          | `max-age=3600, swr=86400` | RSS 2.0, items depuis `FAQ_GLOBAL`      | À refactorer `WHERE type='faq'` (KB-15)                              |

**Constat** : 3 routes RSS existent **edge runtime**, partagent un escapeXml local dupliqué, et un pattern XML inline. **Sprint KB-15 doit factoriser** : un helper `src/lib/feeds/rss-builder.ts` + `src/lib/feeds/json-feed-builder.ts` + `src/lib/feeds/xml-escape.ts` (dédupe).

### 1.2 llms.txt + llms-full.txt existants

- `src/app/llms.txt/route.ts` (45 lignes) — edge runtime, cache `max-age=3600, swr=86400`. Statique, ne lit que pricing.ts.
- `src/app/llms-full.txt/route.ts` (113 lignes) — edge runtime, mêmes headers. Inclut FAQ + cas concrets + pricing dérivés.

**Constat** : helper IndexNow existe (`src/lib/indexnow.ts` v1 fire-and-forget). **Ces 2 routes ne sont PAS branchées sur la KB** — elles lisent les SSOTs `pricing.ts` + `transversal.ts` + `case-studies.ts`. **Sprint KB-15 doit étendre la source DB** : `KnowledgeEntry WHERE confidentiality='public' AND status='published'`.

### 1.3 OpenGraph image — `@vercel/og` déjà installé

- `package.json` : `"@vercel/og": "^0.11.1"` confirmé présent.
- `src/app/opengraph-image.tsx` existant (default OG global).
- **Aucun OG dynamique par contenu KB n'existe**. KB-15 doit créer `src/app/[locale]/ressources/[type]/[slug]/opengraph-image.tsx`.

### 1.4 Newsletter

- Modèle Prisma `NewsletterSubscriber` (schema.prisma, vérifié) avec `status NewsletterStatus`, double opt-in (`confirmToken`, `confirmedAt`, `unsubscribedAt`, `unsubscribeToken`), `locale`, `mailwizzListUid`. **Réutilisable direct pour digest KB**.
- `src/lib/email/client.ts` + `src/lib/email/templates/` — nodemailer (`^8.0.7`). PowerMTA / Zoho Mail Free EU contact (mémoire `axionia_session_2026-05-13_seo_email_stack`).
- BullMQ + `src/server/queue/{queues.ts, worker.ts, workers/email-worker.ts}` — déjà câblé `enqueueEmail` + `bootRepeatableJobs` repeatable jobs.

### 1.5 Indexnow helper centralisé

`src/lib/indexnow.ts` (84 lignes) — `pingIndexNow(urls, context)` fire-and-forget. Validation host + Sentry/console error log. **Réutilisable direct** par le cron quotidien KB-15.

---

## 2. RSS Atom + JSON Feed — spécification KB-15

### 2.1 Périmètre — 6 familles de flux

KB-15 doit produire **6 familles** de flux (chaque famille existe en `.xml` Atom **et** `.json` JSON Feed) :

| Famille           | URL Atom                                        | URL JSON Feed                           | Source                                                   | Cache             |
| ----------------- | ----------------------------------------------- | --------------------------------------- | -------------------------------------------------------- | ----------------- |
| Par type          | `/[locale]/ressources/[type]/feed.xml`          | `/[locale]/ressources/[type]/feed.json` | `KnowledgeEntry WHERE type=:type AND status='published'` | `revalidate: 600` |
| Par domain        | `/[locale]/ressources/domain/[domain]/feed.xml` | `.json`                                 | `KnowledgeEntry WHERE domain=:domain`                    | `revalidate: 600` |
| Par tag           | `/[locale]/ressources/tag/[tag]/feed.xml`       | `.json`                                 | `KnowledgeEntry` join `KnowledgeTag`                     | `revalidate: 600` |
| Par auteur        | `/[locale]/ressources/auteur/[slug]/feed.xml`   | `.json`                                 | `KnowledgeEntry WHERE authorId=:authorId`                | `revalidate: 600` |
| Global            | `/[locale]/ressources/feed.xml`                 | `.json`                                 | `KnowledgeEntry` (tous types, publiés)                   | `revalidate: 600` |
| Featured / pinned | `/[locale]/ressources/featured/feed.xml`        | `.json`                                 | `WHERE featured=true OR pinned=true`                     | `revalidate: 600` |

**Pourquoi 6 et pas 4** : l'auteur Manon (mémoire `axionia_session_2026-05-12_interventions_hubs`) doit avoir son propre flux pour bâtir une E-E-A-T auteur (Perplexity / Bing crawl par auteur). Featured/pinned est un flux marketing pour newsletter externe (Inoreader, NetNewsWire).

### 2.2 Format Atom 1.0 (et pas RSS 2.0) — décision

**Recommandation forte** : **migrer du RSS 2.0 existant vers Atom 1.0** pour KB-15.

- Atom 1.0 = IANA standard RFC 4287, supporte nativement HTML escapé + multilangue + auteur structuré (`<author><name/><email/><uri/></author>`).
- Atom permet `xml:lang="fr-FR"` au niveau entry (mieux pour hreflang flux multi-locale).
- Atom permet `<content type="html" xml:base=".../>`.
- Quasi tous les readers modernes lisent Atom (Inoreader, NewsBlur, Feedly, Bing Copilot, Perplexity).
- W3C Feed Validator (https://validator.w3.org/feed/) gate les 6 flux en CI (KB-18 Sprint observabilité).

**Compatibilité backward** : on garde les URLs `/blog/feed.xml` + `/cas-concrets/feed.xml` + `/faq/feed.xml` qui pointent désormais sur l'output Atom (Content-Type `application/atom+xml; charset=utf-8`). Aucun 301 nécessaire (URL stable, payload évolue).

### 2.3 JSON Feed 1.1 — pour AEO/AIO

Spec : https://www.jsonfeed.org/version/1.1/ — Perplexity, ChatGPT, Claude crawlers, Bing AIO consomment JSON Feed plus naturellement que XML.

Schéma cible (extrait) :

```jsonc
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Axion-IA · Articles FR",
  "home_page_url": "https://axion-ia.com/fr/ressources/article",
  "feed_url": "https://axion-ia.com/fr/ressources/article/feed.json",
  "language": "fr-FR",
  "icon": "https://axion-ia.com/icon.png",
  "favicon": "https://axion-ia.com/favicon.ico",
  "authors": [{ "name": "Axion-IA", "url": "https://axion-ia.com/fr/equipe" }],
  "items": [
    {
      "id": "https://axion-ia.com/fr/ressources/article/<slug>",
      "url": "https://axion-ia.com/fr/ressources/article/<slug>",
      "title": "<title>",
      "summary": "<excerpt 240 chars>",
      "content_html": "<bodyHtml sanitized>",
      "content_text": "<bodyText>",
      "date_published": "<publishedAt ISO 8601>",
      "date_modified": "<lastReviewedAt ISO 8601>",
      "tags": ["tag1", "tag2"],
      "authors": [{ "name": "Manon", "url": "https://axion-ia.com/fr/auteur/manon" }],
      "image": "<coverUrl>",
      "_axionia": { "type": "article", "domain": "marketing", "audience": "pme" },
    },
  ],
}
```

Le namespace privé `_axionia` (clé préfixée `_`, OK spec JSON Feed §3) permet aux crawlers AEO de filtrer.

### 2.4 Cache ISR `revalidate: 600`

**Tous les flux** : `revalidate: 600` (10 min) **en ISR Next 16 SSG** (pas edge runtime — voir 2.5).

- Cohérent avec la doctrine Web Vitals (LCP ≤ 1800 ms) + budget infra CPX32.
- On purge le cache sur `revalidatePath('/[locale]/ressources/...', 'page')` à chaque `publish.ts` / `unpublish.ts` (Sprint KB-4).
- Cache-Control HTTP harmonisé : `public, max-age=600, stale-while-revalidate=86400`.

### 2.5 Runtime Node, pas Edge — décision Phase A

Les 3 RSS legacy sont `runtime = 'edge'`. **KB-15 doit revenir en `runtime = 'nodejs'`** parce que :

- Prisma client n'est pas edge-compatible (driver `pg` Node-only sur Axion-IA — pas de Prisma Accelerate edge).
- Les flux KB lisent la DB, donc edge impossible (sauf à passer par un proxy HTTP interne — coût + latence inacceptable).
- ISR `revalidate: 600` fonctionne mieux en runtime Node (cache filesystem `.next/cache`).

### 2.6 `<link rel="alternate">` injection dans `<head>` des pages liste

Pour chaque page liste (hub + facette type + facette domain + facette tag), le composant `KnowledgeListMetadata.tsx` (à créer KB-6 ou KB-7, hors scope ici) doit injecter via Next 16 `generateMetadata()` :

```tsx
{
  alternates: {
    canonical: hubUrl,
    languages: { 'fr-FR': frUrl, 'en-US': enUrl },
    types: {
      'application/atom+xml': `${hubUrl}/feed.xml`,
      'application/feed+json': `${hubUrl}/feed.json`,
    },
  },
}
```

Next 16 mappe `metadata.alternates.types` vers `<link rel="alternate" type="..." href="..." />` automatiquement. Pas de balise manuelle dans le JSX.

### 2.7 Validation W3C en CI

**Sprint KB-18 (test/QA)** doit ajouter au CI (`pnpm validate:feeds`) :

1. Smoke test sur les 6 familles : fetch live → parse → assert items > 0 + lastBuildDate < 24h.
2. Validateur W3C Feed (`https://validator.w3.org/feed/check.cgi`) call sur les 6 URLs en CI nightly.
3. Vitest unitaire `tests/feeds/atom-builder.test.ts` + `json-feed-builder.test.ts` (≥ 8 tests : escape XML, locale, items vides, items 100+, dateModified manquant fallback publishedAt, multi-author, image cover, dérive `_axionia` namespace JSON Feed).

### 2.8 Anti-patterns flux

- **`escapeXml` dupliqué inline** (état actuel) — refactorer en `src/lib/feeds/xml-escape.ts` partagé.
- **RSS 2.0 sans `<atom:link rel="self">`** — déjà OK dans les 3 routes legacy, à conserver Atom 1.0.
- **HTML brut dans `<description>`** — toujours wrap en `<![CDATA[...]]>` ou utiliser `<content type="html">` Atom.
- **`<pubDate>` au mauvais format** — Atom = RFC 3339 ISO 8601, **PAS** RFC 822 (RSS 2.0). Helper `formatAtomDate(date)` strict.
- **Flux non hreflang-cohérent** — chaque entry doit porter `xml:lang="fr-FR"` ou `en-US` (Atom permet entry-level lang, JSON Feed via `language` top-level + `_axionia.lang` par item si mixte).
- **Pagination RSS oubliée** — au-delà de 100 items, Atom doit utiliser `<link rel="next">` (RFC 5005). Décision Phase A : **cap V1 à 50 items les plus récents par flux** (suffisant AEO + zéro pagination XML à gérer V1).

---

## 3. llms.txt enrichi + llms-full.txt DB-managed

### 3.1 État existant à étendre

- `src/app/llms.txt/route.ts` : statique + pricing.ts. **Sprint KB-15 doit l'étendre** pour ajouter une section "Knowledge base" en fin de fichier listant toutes les `KnowledgeEntry` publiques publiées.
- `src/app/llms-full.txt/route.ts` : inclut FAQ_GLOBAL + CASE_STUDIES SSOT. **Sprint KB-15 doit basculer la source vers `KnowledgeEntry`** (DB), en gardant le bloc « positionnement » + « 3 modules » + « engagement » statique.

### 3.2 Format cible llms.txt KB (extrait)

Format spec https://llmstxt.org/ — niveau 2 markdown headings + bullets avec lien + excerpt 1 ligne.

```markdown
# Axion-IA

> Cabinet IA opérationnel B2B pour entreprises.
> ...
> (sections statiques actuelles conservées)

## Knowledge base — articles publics

- [Comment cadrer un projet IA en PME](https://axion-ia.com/fr/ressources/article/cadrer-projet-ia-pme) — Méthode de cadrage en 5 étapes pour TPE/PME. Modifié 2026-05-13.
- [...] (50 entrées max FR + 50 max EN)

## Knowledge base — cas concrets

- [...]

## Knowledge base — glossaire IA

- [...]

## Knowledge base — guides méthodologiques

- [...]

## Knowledge base — FAQ

- [...]
```

**Règles d'inclusion** :

- `confidentiality = 'public'` strict (jamais `internal` / `confidential` / `secret`).
- `status = 'published'` strict.
- Tri : `lastReviewedAt DESC NULLS LAST, publishedAt DESC`.
- Excerpt : 150 caractères max, troncature mot + ellipse (`…`).
- Cap : 50 entrées par section type (suffisant AEO V1, évite llms.txt > 100 KB).
- `lastModified` au format ISO 8601 court `YYYY-MM-DD`.

### 3.3 Format cible llms-full.txt — full body included pour AI fine-tuning

Le `-full` companion (spec llmstxt.org § "The optional companion") doit inclure **le body complet** des entrées publiées publiques. Cas d'usage :

- Crawlers Perplexity / ChatGPT / Claude / Bing AIO ingèrent le body sans crawl page par page.
- Fine-tuning externe (Will autorise sous-processeur ou pas — déjà tracé legal.ts mémoire `axionia_session_2026-05-09_sprint_24_1`).

Format :

```markdown
# Axion-IA — full knowledge for AI crawlers

(sections positionnement / modules / engagement statiques conservées)

---

## KB — Articles

### Comment cadrer un projet IA en PME

URL : https://axion-ia.com/fr/ressources/article/cadrer-projet-ia-pme
Auteur : Manon
Domain : implementation
Audience : pme
Publié : 2026-04-12
Dernière révision : 2026-05-13

<bodyText plain text complet, ~2000-5000 mots>

---

### (entrée suivante)

(...)
```

**Règles** :

- Source `KnowledgeEntry.bodyText` (plain — pattern Sprint 24 C4 mémoire) pour rester léger (pas le HTML).
- Cap V1 : **toutes** les entrées publiées publiques (pas de limite, fichier peut faire 1-5 MB texte).
- Compression côté serveur : `Content-Encoding: br` (Cloudflare auto-brotli, mémoire `axionia_session_2026-05-09_cloudflare_phase5`).
- Cache `public, max-age=600, stale-while-revalidate=86400` (10 min — synchronisé avec les flux).
- ⚠️ **Excluant** : `confidentiality != 'public'`, `status != 'published'`, et **toute entrée avec un flag explicite `excludeFromLlmsFull=true`** (par ex. content marketing payant, qui doit rester crawl-only).

### 3.4 Cron quotidien — régénération + IndexNow ping

**BullMQ repeatable job** (Sprint KB-15) :

```ts
// src/server/queue/types.ts (extension)
type LlmsTxtRegenJobData = { triggeredBy: "cron" | "manual"; requestedAt: string };

// src/server/queue/queues.ts (extension)
// repeatable cron 'llms-txt-regen-daily' { pattern: '0 4 * * *', tz: 'Europe/Paris' }
//   → daily à 04:00 Paris (creux trafic).

// src/server/queue/workers/llms-txt-worker.ts (à créer)
// 1. SELECT all KnowledgeEntry public published.
// 2. Build llms.txt body + llms-full.txt body.
// 3. Persist in Setting table (key='llms_txt_cached', key='llms_full_txt_cached')
//    OU sur volume disque Coolify /data/cache/llms/{llms.txt, llms-full.txt}.
// 4. revalidatePath('/llms.txt') + revalidatePath('/llms-full.txt').
// 5. pingIndexNow([SITE_URL+'/llms.txt', SITE_URL+'/llms-full.txt'], 'llms-cron').
```

**Décision Phase A — storage cache** :

- **Recommandation : `Setting` KV** (pattern mémoire `00-REALITY-CHECK §1.1`). Avantages : backupé avec la DB, atomique, pas de I/O disque.
- Alternative : volume Coolify `/data/cache/llms/` — plus rapide cold mais I/O et DR séparés.

**Décision Phase A — fréquence** :

- Recommandation : **daily 04:00 Paris**. Plus fréquent (toutes les 4h) = surcharge IndexNow (max 10 000 URLs/jour ; on est très loin V1).
- Trigger immédiat (hors cron) : sur chaque `publish.ts` / `unpublish.ts` server action KB-4, **enqueueLlmsTxtRegen()** est appelé avec debounce 60 s (Redis SET expirable) pour absorber les bursts.

### 3.5 IndexNow ping post-régénération

Helper `pingIndexNow` existant accepte un array d'URLs. Sprint KB-15 :

```ts
// post-régénération
pingIndexNow(
  [
    `${SITE_URL}/llms.txt`,
    `${SITE_URL}/llms-full.txt`,
    // Optionnel : URLs des entrées nouvellement publiées depuis dernier run
    ...newlyPublishedEntryUrls,
  ],
  "llms-cron",
);
```

⚠️ **Cap IndexNow** : 10 000 URLs/24h. V1 KB peut produire 10-50 nouvelles entrées/mois → très loin du cap.

---

## 4. PDF export on-demand — décision lib + architecture worker

### 4.1 Décision Phase A — lib PDF

**Recommandation ferme : `@react-pdf/renderer` ^4.x** (https://react-pdf.org/).

Comparaison :

| Critère                                          | `@react-pdf/renderer`                                       | `puppeteer` + Chromium headless                      |
| ------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| Taille `node_modules`                            | ~200 KB cold                                                | **~150 MB** (Chromium binary)                        |
| Image Docker                                     | déjà supportée par image Next standard                      | requiert image custom + libs `chrome-headless-shell` |
| RAM résident worker                              | ~50 MB                                                      | **≥ 300 MB par instance**                            |
| CPU cold start                                   | ~200 ms                                                     | ~3 s (Chromium boot)                                 |
| Fidelity rendu Tiptap rich                       | suffisant (h1-h6, lists, blockquote, code, hr, image, link) | parfait HTML/CSS                                     |
| Polices custom (terracotta + Inter + serif Will) | OK (`Font.register({ src: '...' })`)                        | OK (CSS @font-face)                                  |
| Maintenance long terme                           | active (Facebook origine)                                   | active (Google)                                      |
| **CPX32-compat** (~8 GB partagé Coolify)         | ✅                                                          | ❌ blow RAM si 2+ workers concurrents                |

**Verdict** : `@react-pdf/renderer` est **suffisant** pour le scope V1 KB (article, cas concret, guide, glossaire, FAQ) qui n'ont **pas de blocs Tiptap complexes** (`StarterKit` only, mémoire `00-REALITY-CHECK §2.2`). Quand Sprint KB-3/16 ajoutera image + tableau + callout, on évaluera s'il faut un wrapper plus rich (mais react-pdf supporte image + table custom).

**Puppeteer reste rejected V1** sur les chiffres ci-dessus. Si Will arbitre pour PDF parfaite-fidélité-print (V2+ doc commerciaux), on isolera dans un worker Node séparé sur une queue dédiée concurrency=1, ou on déportera en SaaS (ex. Browserless / PDFShift) — décision à reporter.

### 4.2 ePub V1.5

**Lib candidate : `epub-gen` ^0.1.x** (https://github.com/cyrilis/epub-gen, fork actif `@lesjoursfr/html-to-epub`).

- ~150 KB pure JS, pas de binaire natif.
- Génère ePub 3 conforme (lu par Apple Books, Kobo, Google Play Books, Calibre).
- Accepte HTML input (parfait pour `bodyHtml` Tiptap) + chapitres + cover + métadonnées.

**Scope V1.5 si besoin marketing** : compiler **un livre Axion-IA** trimestriel (top 20 entrées par domain), distribué en aimant lead magnet sur landing dédiée `/fr/ressources/livre-trimestriel`. Décision Will Phase B avant lancement Sprint KB-15.5.

**Décision Phase A** : V1 = **PAS d'ePub**. V1.5 = à valider.

### 4.3 Architecture worker async PDF

```text
[Client admin / public]
        │
        │  GET /api/internal/kb/[id]/pdf
        ▼
[Endpoint handler (server action)]
        │  1. Auth check (admin OWNER/EDITOR pour drafts, public pour published).
        │  2. Cache hit ? → 302 → /assets/kb-pdf/<id>-<hash>.pdf (Coolify volume).
        │  3. Cache miss : enqueueKbPdfJob({ entryId, locale, requestedBy }).
        │  4. Return 202 Accepted + JSON { jobId, statusUrl: '/api/internal/kb/pdf-status/<jobId>' }.
        ▼
[BullMQ queue 'kb-pdf-gen' concurrency=1]
        │  - Lock par entryId (Redis SET EX 60s) pour éviter double-build concurrent.
        │  - Worker process : render(EntryPdfDocument({ entry, locale })) → PDF Buffer.
        │  - Write to /data/kb-pdf-cache/<id>-<sha256(bodyJson)>.pdf.
        │  - Update KnowledgeEntry.pdfCachedAt + KnowledgeEntry.pdfHash.
        │  - Cache TTL 24h (cleanup cron).
        ▼
[Client polls /api/internal/kb/pdf-status/<jobId>]
        │  - 'pending' → retry +5s.
        │  - 'completed' → JSON { url: '/assets/kb-pdf/<id>-<hash>.pdf' }.
        │  - 'failed' → JSON { error } + Sentry capture.
```

### 4.4 Layout PDF — mapping Tiptap → React PDF

`src/components/knowledge/pdf/EntryPdfDocument.tsx` (Sprint KB-15) :

- **Page 1 — title page** : logo Axion-IA + `entry.title` (display serif italique cap doctrine — mémoire `axionia_design_pivot`) + `entry.subtitle` + auteur (`Manon` photo + bio courte) + date publication + dernière révision + permalink + cover image si présente.
- **Page 2..N — body** : mapping Tiptap JSON nodes → React PDF components :
  - `heading[level=1..6]` → `<Text style={styles['h'+level]}>`.
  - `paragraph` → `<Text style={styles.body}>`.
  - `bulletList`/`orderedList` → `<View>` + bullets unicode `•` / numérotation manuelle.
  - `blockquote` → `<View style={styles.quote}>`.
  - `codeBlock` → `<View style={styles.code}>` police monospace.
  - `horizontalRule` → `<View style={styles.hr}>`.
  - `image` (Sprint KB-3 wrapping) → `<Image src={url} />`.
  - `link` mark → footnote bas de page (URL en référence numérotée).
- **Footer chaque page** : `<Text fixed render={({pageNumber, totalPages}) => `Page ${pageNumber}/${totalPages} · ${permalink}`} />`.
- **Polices** : Inter + serif Will (à confirmer Phase A — typography v3.2 mémoire). `Font.register` au chargement module.
- **Cap V1** : palette monochrome (noir + terracotta) — pas d'illustrations React PDF (trop coûteux).

### 4.5 Cache PDF + invalidation

- Volume Coolify `/data/kb-pdf-cache/` (à confirmer Will Phase B — STOP & ASK §6.13 `00-REALITY-CHECK`).
- Clé cache : `<entryId>-<sha256(JSON.stringify(bodyJson) + locale)>.pdf`.
- Invalidation : sur server action `republishEntryAction` → `await unlink('/data/kb-pdf-cache/<entryId>-*.pdf')` (KB-15 helper `invalidateKbPdfCache`).
- TTL passif : cron quotidien `cleanup-kb-pdf-stale` supprime PDFs > 30 j (Sprint KB-18 observabilité).

### 4.6 Endpoint `/api/internal/kb/[id]/pdf` — réponse 202

```ts
// Réponse 202 type
{
  jobId: 'pdf:<uuid>',
  statusUrl: '/api/internal/kb/pdf-status/<jobId>',
  message: 'PDF generation queued. Poll statusUrl every 2-5s.',
}

// Headers
Retry-After: 5
Content-Type: application/json
```

Quand cache hit immédiat → **302 redirect** vers `/assets/kb-pdf/<id>-<hash>.pdf` directement (pas de 202).

### 4.7 Anti-patterns PDF

- **PDF sync dans server action** → ❌ timeout Caddy/CF 30s. **PDF = worker obligatoire.**
- **Pas de lock par entryId** → ❌ double-build concurrent si client polle vite. **Lock Redis SET EX.**
- **Cache sans hash bodyJson** → ❌ stale PDF servi après edit. **Hash obligatoire.**
- **`@react-pdf/renderer` chargé en client component** → ❌ blow First Load JS 75 KB gz budget AGENTS.md. **Strict server component / worker.**
- **Polices chargées depuis CDN** → ❌ network call à chaque génération. **Polices embedées dans `public/fonts/` + `Font.register` once.**

---

## 5. Social card OpenGraph dynamique par entrée

### 5.1 Lib

**`@vercel/og` ^0.11.1** — **déjà installé** (`package.json` confirmé). Aucun ajout dépendance.

### 5.2 Route file convention Next 16

`src/app/[locale]/ressources/[type]/[slug]/opengraph-image.tsx` (Sprint KB-15) :

- Convention Next 16 : ce fichier exporte un composant React (JSX simple, server-only) qui produit une image PNG 1200×630.
- Auto-injecté dans `<meta property="og:image">` + `<meta name="twitter:image">` par Next 16.
- Cache CDN automatique (Cloudflare cache via Cache-Rules — mémoire `axionia_session_2026-05-09_cloudflare_phase5`).

### 5.3 Templates type-spécifiques (V1 strict)

5 templates côté server :

| `entry.type`            | Template OG                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `article`               | Title (60 chars max, serif italique) + auteur Manon + date + logo Axion-IA + accent terracotta gauche |
| `case_study`            | Title + métrique principale "+47% productivité" en grand + secteur en tag                             |
| `glossary_term`         | Citation typo (Definition courte centrée + "— Glossaire IA" footer)                                   |
| `guide` / `methodology` | Schema visuel mini (icônes 1→5 étapes du guide) + title sous                                          |
| `faq`                   | Question en grand centrée + "FAQ Axion-IA" footer                                                     |
| `help_article`          | Title + breadcrumb category + icône type help                                                         |

**SSOT styles** : `src/components/knowledge/og/og-styles.ts` (constantes : couleurs terracotta `#C97149`, ivory `#FDF8F1`, serif font, dimensions 1200×630). Aucun hex hardcodé hors ce fichier (anti-hex check mémoire `axionia_doctrine_code_ssot`).

### 5.4 Cache 24h

Next 16 cache automatiquement `opengraph-image.tsx` au build time (SSG). En ISR :

- `export const revalidate = 86400;` (24h).
- Cloudflare Cache-Rules forcent edge cache si `Cache-Control: public, max-age=86400` (à confirmer config CF déjà en place).
- Invalidation immédiate : `revalidatePath` sur `republishEntryAction`.

### 5.5 A11y + LinkedIn / Twitter constraint

- Texte minimum 32 px (lisibilité tile thumbnail LinkedIn).
- Contraste AAA terracotta sur ivory (mémoire `axionia_design_pivot` valide).
- Pas d'emoji (rendering inconsistant Twitter/LinkedIn/Slack).
- Title troncature 60 chars + ellipse `…`.

### 5.6 Anti-patterns OG

- **OG image servi `localhost:3000`** — bug pré-existant pré-Phase 5 mémoire `axionia_bugs_seo_preexistants_2026-05-09`. Sprint KB-15 doit s'assurer que SITE_URL absolu est utilisé partout.
- **OG image dans client component** — ❌ `@vercel/og` est server-only par design.
- **OG image avec image PNG externe non whitelistée** — ❌ CSP `img-src` doit autoriser (mémoire `axionia_session_2026-05-09_sprint_24` CSP nonce).
- **OG image sans `alt` côté `metadata.openGraph.images[0].alt`** — KB-15 doit renseigner alt = `${entry.title} — Axion-IA`.

---

## 6. Newsletter auto-pickup digest

### 6.1 Source d'inscription

**Recommandation Phase A** : réutiliser `NewsletterSubscriber` existant (modèle Prisma double opt-in, mémoire `00-REALITY-CHECK` confirmé). Aucun nouveau modèle.

**Extension nécessaire (Sprint KB-15)** :

- Ajouter `NewsletterSubscriber.kbDomains String[]` (PostgreSQL `text[]` — domains opt-in : `marketing`, `implementation`, `audit`, `legal`, ...).
- Ajouter `NewsletterSubscriber.kbDigestFrequency` enum (`weekly` | `monthly` | `disabled`).
- Migration `prisma migrate dev --name newsletter_kb_preferences`.

### 6.2 Hook publish — enqueue digest

```ts
// src/server/actions/knowledge/publish.ts (Sprint KB-4)
async function publishEntryAction(input: PublishInput) {
  // ... transaction publish ...
  await enqueueKbDigestPickup({ entryId: result.id });
}

// src/server/queue/queues.ts (Sprint KB-15)
export async function enqueueKbDigestPickup(data: { entryId: string }) {
  await getQueue("kb-digest-pickup").add("pickup", data, {
    deduplication: { id: `kb-digest-pickup:${data.entryId}` },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
```

### 6.3 Worker pickup — agrégation digest

**Pattern** : pas un job d'envoi immédiat, mais un **collecteur**. Sprint KB-15 :

```ts
// src/server/queue/workers/kb-digest-pickup-worker.ts
// 1. Job 'pickup' reçu avec entryId.
// 2. INSERT KnowledgeDigestQueue (nouvelle table : entryId, queuedAt, sentAt nullable).
// 3. Ne pas envoyer maintenant — laisser le cron weekly/monthly trier.
```

Nouveau modèle Prisma (Sprint KB-15) :

```prisma
model KnowledgeDigestQueue {
  id            String   @id @default(uuid()) @db.Uuid
  entryId       String   @map("entry_id") @db.Uuid
  queuedAt      DateTime @default(now()) @map("queued_at")
  sentInDigests String[] @default([]) @map("sent_in_digests")  // digestId[]
  entry         KnowledgeEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([queuedAt])
  @@map("knowledge_digest_queue")
}
```

### 6.4 Cron d'envoi — weekly + monthly

**BullMQ repeatable jobs** (Sprint KB-15) :

- `kb-digest-weekly` : `pattern: '0 9 * * MON', tz: 'Europe/Paris'` (lundi 09:00 Paris).
- `kb-digest-monthly` : `pattern: '0 9 1 * *', tz: 'Europe/Paris'` (1er du mois 09:00 Paris).

**Worker `kb-digest-sender-worker`** (Sprint KB-15) :

```ts
// 1. Charger toutes entrées KnowledgeDigestQueue où sentInDigests ne contient pas digestId courant.
// 2. Grouper par domain + locale.
// 3. SELECT NewsletterSubscriber WHERE status='confirmed' AND kbDigestFrequency=:freq.
// 4. Pour chaque subscriber :
//    a. Filtrer entries par subscriber.kbDomains (intersection).
//    b. Skip si zero entry après filtrage.
//    c. Render email template DigestKb.tsx (~5-10 entrées listées).
//    d. enqueueEmail('kb-digest', subscriber.email, payload, idempotencyKey=`${digestId}:${subscriber.id}`).
// 5. Update KnowledgeDigestQueue.sentInDigests += digestId.
```

### 6.5 Idempotency

**Clé idempotence** : composite `(entryId × digestId)` enregistrée dans `KnowledgeDigestQueue.sentInDigests`.

Plus, côté `enqueueEmail`, ajouter un guard Redis :

```ts
const key = `email:idempo:kb-digest:${digestId}:${subscriberId}`;
const ok = await redis.set(key, "1", "EX", 86400 * 30, "NX"); // 30j window
if (!ok) {
  // déjà envoyé, skip
  return;
}
```

**Anti-pattern** : ne pas s'appuyer uniquement sur `sentInDigests` (race condition possible en cas de retry BullMQ avant commit transaction). **Double guard** Redis + DB.

### 6.6 Template email

`src/lib/email/templates/DigestKb.tsx` (Sprint KB-15) :

- React Email + nodemailer pattern (existant `src/lib/email/client.ts`).
- Header : logo Axion-IA + tagline + date digest.
- Body : pour chaque entrée :
  - Cover thumbnail (URL absolue depuis Coolify volume).
  - Title (lien permalink).
  - Excerpt 240 chars max.
  - Tags + auteur Manon.
  - CTA "Lire l'article →".
- Footer : lien gestion préférences (`/fr/newsletter/preferences?token=<unsubscribeToken>`) + désinscription one-click (RFC 8058 `List-Unsubscribe` header).
- Mention RGPD + adresse Axion-IA OÜ + lien politique privacy.

### 6.7 RGPD + opt-in/out

- **Opt-in granulaire** : page `/fr/newsletter/preferences` permet de cocher / décocher chaque `domain` KB (mémoire `axionia_doctrine_code_ssot` — i18n via fr.json namespace newsletter).
- **Opt-out one-click** : header `List-Unsubscribe: <https://axion-ia.com/api/newsletter/unsubscribe?token=...>, <mailto:unsub@axion-ia.com>` (RFC 8058, Gmail / Yahoo 2024+ requis).
- **Soft delete** : `unsubscribedAt` timestamp existant, `status='unsubscribed'` (PII conservée jusqu'à purge cron retention — mémoire `axionia_session_2026-05-09_sprint_24`).
- **Double opt-in** déjà en place (`confirmToken` + `confirmedAt`) — KB-15 ne touche pas.

### 6.8 Décision Phase A — fréquence par défaut

**Recommandation Phase A** :

- Default `kbDigestFrequency = 'weekly'` pour nouveaux subscribers.
- Existing subscribers (V0 → V1 migration) restent à `disabled` jusqu'à opt-in explicite (RGPD strict, mémoire `axionia_session_2026-05-09_sprint_24_1` DPA-REGISTER).
- Monthly = alternative pour réduire pression boîte mail.

**STOP & ASK Will Phase B** (§ 8 ci-dessous) : weekly vs monthly default, ou laisser disabled + opt-in explicite via UI ?

### 6.9 Anti-patterns newsletter

- **Double-poster** la même entrée 2 fois (race condition retry BullMQ) → ❌ idempotency Redis + DB obligatoire.
- **Envoyer à `status='pending'`** (double opt-in pas encore confirmé) → ❌ filtre WHERE `status='confirmed'` strict.
- **Inclure entrée `confidentiality != 'public'`** dans le digest → ❌ filtre strict.
- **PII subscriber loggué Telegram** sans redaction (mémoire ADR 0010) → ❌ utiliser `pii-redaction.ts`.
- **Pas de `List-Unsubscribe` header** → ❌ Gmail / Yahoo 2024+ marquent en spam.
- **`From:` Axion-IA sans alignement SPF/DKIM/DMARC** → ❌ vérifié OK via Zoho EU mémoire `axionia_session_2026-05-13_seo_email_stack`.

---

## 7. Hors V1 — formats V2+ (référence)

Ces formats sont **explicitement hors scope V1** mais documentés ici pour cadrer la roadmap KB :

| Format                    | V2+ ? | Lib candidate                             | Justification report                                              |
| ------------------------- | ----- | ----------------------------------------- | ----------------------------------------------------------------- |
| LinkedIn carrousel image  | V2+   | `@vercel/og` + scheduler LinkedIn API     | LinkedIn API requiert app review (~2 semaines) + token long-lived |
| X (Twitter) thread auto   | V2+   | X API v2 thread                           | Coût X API Basic $200/mois (impasse pricing Axion-IA)             |
| Substack cross-post       | V2+   | RSS pull Substack + import Substack       | Substack n'a pas d'API push officielle ; force pull               |
| Audio TTS de l'article    | V2+   | OpenAI TTS / ElevenLabs                   | Coût LLM, scope V1.5 si demande                                   |
| Slides PDF (présentation) | V2+   | `@react-pdf/renderer` orientation paysage | Demande spécifique, pas KB générique                              |
| Telegram channel push     | V2+   | Bot Telegram existant                     | À couper court : channel public ≠ digest privé subscriber         |

---

## 8. STOP & ASK Will Phase B (avant lancement Sprint KB-15)

Ordre des décisions critiques :

1. **PDF lib confirmée** : `@react-pdf/renderer` Phase A (recommandation) ou Will demande puppeteer ? → si puppeteer, surcoût RAM Hetzner à arbitrer.
2. **ePub V1.5** : oui/non ? Si oui, scope = livre trimestriel marketing ou export bouton individuel par entrée ?
3. **Fréquence newsletter par défaut** : `weekly` (recommandation) ou `monthly` ou `disabled` (opt-in explicite RGPD strict) ?
4. **Volume cache PDF Coolify** : `/data/kb-pdf-cache/` confirmé ? Sinon où ? (STOP & ASK déjà en commun avec Agent 13 médias §9.13 reality check).
5. **Storage llms.txt cache** : `Setting` KV (recommandation) ou volume disque `/data/cache/llms/` ?
6. **Cap llms-full.txt** : toutes entrées (recommandation, ~1-5 MB) ou cap 100 entrées max pour tenir <1 MB ?
7. **Featured/pinned feed** : confirmé V1 ou reporté V1.5 (intérêt marketing) ?
8. **Migration RSS legacy** : passer en Atom 1.0 (recommandation) ou rester RSS 2.0 pour zéro régression reader ?
9. **Hub URL** : `/[locale]/ressources/` confirmé (cohérent reality check §10) ?
10. **Inclusion EN dans flux + digest** : `en` parity directe (recommandation, mémoire mono-fichier i18n) ou flux séparés FR-only V1 + EN V1.5 ?

---

## 9. ANTI-PATTERNS — synthèse globale

| Anti-pattern                                                      | Risque                                                          | Mitigation                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| PDF sync dans server action                                       | Timeout Caddy/CF 30s, UX cassée                                 | Worker BullMQ async + 202 + poll                                         |
| RSS sans cache HTTP                                               | Coût DB sur chaque crawler, latence p95                         | ISR `revalidate:600` + `Cache-Control max-age=600 swr=86400`             |
| hreflang manquant sur RSS multi-locale                            | Crawler EN ingère contenu FR (mauvais SERP)                     | `xml:lang` entry-level Atom + JSON Feed `language` top + `_axionia.lang` |
| Double-poster newsletter                                          | Réputation Sender Score, plainte spam                           | Idempotency Redis 30j + DB `sentInDigests`                               |
| PDF stale après edit                                              | Client lit ancien PDF                                           | Hash bodyJson dans clé cache + `invalidateKbPdfCache`                    |
| llms.txt non régénéré                                             | Crawlers AEO ratent contenu frais                               | Cron daily + `revalidatePath` immédiat sur publish                       |
| OG image hardcoded `localhost:3000`                               | Previews sociales cassées (mémoire bug pré-existant 2026-05-09) | SITE_URL absolu enforcement + test smoke                                 |
| `@react-pdf/renderer` chargé client                               | Blow First Load JS 75 KB gz budget                              | Strict server / worker import                                            |
| RSS items sans `<atom:link rel="self">`                           | Validateur W3C fail                                             | Helper `rss-builder.ts` strict                                           |
| Inclusion `confidentiality != 'public'` dans flux/llms/newsletter | Fuite contenu interne                                           | Filtre WHERE strict + test integration                                   |
| Polices PDF depuis CDN                                            | Network call par génération                                     | Polices embedded `public/fonts/`                                         |
| Pas de lock entryId sur build PDF                                 | Double-build concurrent                                         | Redis SET EX 60s lock                                                    |
| Pagination RSS > 100 items oubliée                                | Validateur warn / readers cassés                                | Cap V1 50 items les plus récents                                         |
| Pas de `List-Unsubscribe` header                                  | Gmail/Yahoo 2024+ spam                                          | RFC 8058 strict                                                          |
| `escapeXml` dupliqué inline                                       | Maintenance / bug XML injection                                 | Helper partagé `src/lib/feeds/xml-escape.ts`                             |

---

## 10. DEPENDENCIES À AJOUTER (Sprint KB-15)

```jsonc
// package.json (production deps)
{
  "@react-pdf/renderer": "^4.x", // PDF on-demand worker
  // "@lesjoursfr/html-to-epub": "^4.x" // ePub V1.5 seulement, NON V1
}
```

⚠️ **Aucune nouvelle dépendance V1 pour OG/RSS/llms/newsletter** : `@vercel/og`, `nodemailer`, `bullmq`, `ioredis`, `next-intl` tous déjà présents.

Bundle delta gate (`size-limit`) à vérifier : `@react-pdf/renderer` est server-only et worker-only → **0 impact First Load JS**.

---

## 11. PLAN DE TEST (sprint KB-18 référencé)

| Catégorie                                                  | Cible                                                      | Volume V1                  |
| ---------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| Unit `tests/feeds/*.test.ts`                               | atom-builder, json-feed-builder, xml-escape                | ≥ 8 tests                  |
| Unit `tests/llms-txt/*.test.ts`                            | helper build + filtres confidentiality                     | ≥ 5 tests                  |
| Unit `tests/og-image/*.test.ts`                            | snapshot templates par type                                | ≥ 5 tests (1 par template) |
| Unit `tests/pdf/*.test.ts`                                 | render EntryPdfDocument + cache key hash                   | ≥ 6 tests                  |
| Unit `tests/newsletter/digest-*.test.ts`                   | idempotency, opt-in filter, sentInDigests                  | ≥ 6 tests                  |
| Integration `tests/integration/kb-15-multi-format.test.ts` | bout-en-bout publish → llms.txt regen → IndexNow ping mock | ≥ 3 tests                  |
| E2E Playwright `tests/e2e/kb-feeds.spec.ts`                | smoke 6 flux + W3C validator network                       | ≥ 2 tests                  |
| Smoke prod CI nightly                                      | `validator.w3.org/feed` + JSON parse strict                | 6 URLs                     |

---

## 12. OBSERVABILITÉ (sprint KB-18 référencé)

Sentry tags à ajouter :

- `kb.feed.type=atom|json-feed`, `kb.feed.family=type|domain|tag|author|global|featured`
- `kb.pdf.cache=hit|miss`, `kb.pdf.duration_ms`
- `kb.llms_txt.regen.trigger=cron|manual|publish-hook`, `kb.llms_txt.entries_count`
- `kb.digest.run=weekly|monthly`, `kb.digest.subscribers_count`, `kb.digest.skipped_count`, `kb.digest.sent_count`

Plausible Goals (mémoire `axionia_plausible_ce_deploy_2026-05-13`) :

- `KB Feed Subscribed` (event `kb_feed_subscribe`, props : family, type)
- `KB PDF Downloaded` (event `kb_pdf_download`, props : entryId, locale)
- `KB Digest Click` (event `kb_digest_click`, props : digestId, entryId, locale)
- `KB Unsubscribe` (event `kb_newsletter_unsubscribe`, props : reason si fourni)

---

## 13. CONFORMITÉ DOCTRINE AXION-IA

| Doctrine                                                                     | Statut KB-15                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `code = SSOT` (mémoire `axionia_doctrine_code_ssot`)                         | ✅ — l'audit s'appuie sur les 3 RSS legacy + llms.txt existant + `@vercel/og` déjà présent |
| Zéro hardcode hors SSOT (mémoire `axionia_pricing_zero_hardcode_2026-05-08`) | ✅ — couleurs OG via `og-styles.ts`, fréquences cron via `Setting` KV                      |
| Naming Axion-IA partout (mémoire `axionia_naming_brand_vs_project`)          | ✅ — title flux + footer email + title PDF                                                 |
| CPX32 + Cloudflare Free (mémoire `axionia_hosting_hetzner`)                  | ✅ — PDF `@react-pdf/renderer` ~50 MB RAM/worker, ePub V1.5, pas de SaaS payant            |
| Web Vitals AGENTS.md (LCP/INP/CLS/FLJS 75 KB gz)                             | ✅ — tout server-only / worker-only, 0 impact bundle public                                |
| Cabinet IA opérationnel (mémoire `axionia_naming_cabinet`)                   | ✅ — aucune mention agence/studio dans templates                                           |
| PII redaction Telegram (ADR 0010)                                            | ✅ — digest BullMQ jobs loggués sans PII subscriber                                        |
| Doc sync (mémoire `axionia_prompt_doc_sync`)                                 | À prévoir — Sprint KB-20 met à jour `AGENTS.md` § flux RSS + ADR 0021                      |

---

## 14. SYNTHÈSE — GO / NO-GO pour Sprint KB-15

### GO ✅ Phase B autorisée — sous réserve des 10 STOP & ASK Will § 8

L'agent 15 livre un plan multi-format complet :

- 6 familles de flux (Atom + JSON Feed), tous cachés ISR 10 min, validateur W3C en CI.
- llms.txt + llms-full.txt DB-managed, régénération daily 04:00 Paris + IndexNow ping.
- PDF on-demand `@react-pdf/renderer` worker async (CPX32-compat ferme).
- OG dynamique 5 templates type-spécifiques avec `@vercel/og` déjà installé.
- Newsletter digest weekly/monthly auto-pickup BullMQ + idempotency Redis + DB + List-Unsubscribe RFC 8058.
- ePub + LinkedIn + X + Substack confirmés V2+ (hors V1).
- 0 nouvelle dépendance V1 sauf `@react-pdf/renderer`.
- Aucun impact First Load JS public.

### NO-GO ❌ tant que

1. Will n'a pas tranché les 10 STOP & ASK § 8 (au minimum 1, 3, 4, 8).
2. Sprint KB-1 (data model) n'a pas produit `KnowledgeEntry.bodyJson` + `bodyText` + `bodyHtml` + `confidentiality` + `domain` + `tags` (M2M) — pré-requis dur.
3. Sprint KB-4 (publish.ts) n'expose pas le hook `enqueueLlmsTxtRegen` + `enqueueKbDigestPickup`.

---

**Fin Agent 15 — Multi-format output Phase A.**
