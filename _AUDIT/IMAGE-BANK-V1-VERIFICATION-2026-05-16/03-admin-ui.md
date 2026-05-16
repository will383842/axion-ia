# 03 — Admin UI

> **Pondération** : 100 pts | **Score** : **89/100** (89%) 🟡

---

## 3.1 Inventaire — ✅ 15/15

15 sub-pages présentes dans `src/app/[locale]/(admin)/[adminPrefix]/image-bank/` :

- `page.tsx` (overview) — livré ✅
- `library/page.tsx` + `library/[id]/page.tsx` ✅
- `upload/page.tsx` ✅
- `quality/page.tsx` ✅
- 10 stubs (`AdminStubPage`) : `bulk-import`, `analytics`, `categories`, `tags`, `settings`, `taxonomy`, `usage-logs`, `seo-audit`, `sitemap-status`, `licensing` ✅

## 3.2 Cohérence pattern content-gen — ✅ 20/20

### `page.tsx` (overview) — 100% conforme

- `params: Promise<{ locale, adminPrefix }>` + `await params` ✅ (L24)
- `auth()` + role check `=== "admin"` + redirect login ✅ (L25-28)
- `export const dynamic = "force-dynamic"` ✅ (L13)
- `metadata.robots: { index: false, follow: false }` ✅ (L16)
- `prisma.imageAsset.findMany/count` avec `deletedAt: null` partout ✅ (L31-52)

### `library/page.tsx` + `quality/page.tsx` — 100% conforme

Même pattern appliqué systématiquement. Files :

- `src/app/[locale]/(admin)/[adminPrefix]/image-bank/library/page.tsx:1-60`
- `src/app/[locale]/(admin)/[adminPrefix]/image-bank/quality/page.tsx:1-75`

### 10 stubs — Acceptable V1

Composant `AdminStubPage` réutilisé partout (`src/components/admin/image-bank/AdminStubPage.tsx:1-34`). Contenu hardcodé FR (pas de `getTranslations()` next-intl) — acceptable pour placeholders Sprint 2.x.

## 3.3 AdminCommandPalette — ✅ 9/9

`grep -c "Image bank" 'src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx'` → **9 occurrences** :

1. Overview (L198)
2. Library (L204)
3. Upload (L210)
4. Bulk import CSV (L216)
5. Quality queue (L222)
6. Analytics (L228)
7. Categories (L234)
8. Tags (L240)
9. Settings (L246)

## 3.4 AdminSidebar 9e groupe — ❌ 0/10 (P0/P1)

**ABSENT** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:40-75` `buildNav()` ne contient AUCUNE entrée image-bank.

Groupes existants (5) :

- `main` (9 items) : Dashboard, Calendrier, Réservations, Devis, Factures, Paiements, Échéanciers, Options, Soumissions
- `content` (8 items) : Connaissances, Générateur, Blog, Catégories, Cas concrets, Témoignages, FAQ, Centre d'aide
- `engagement` (1 item) : Newsletter
- `ops` (4 items) : Analytics, Web Vitals, Infra, Alertes
- `system` (4 items) : Users, Activity logs, Settings, 2FA

**Manque** : groupe image-bank avec 9 sous-routes.

**Impact** : UX friction. Utilisateur ne peut naviguer vers image-bank que via :

1. AdminCommandPalette Cmd+K ✅
2. URL directe

La sidebar nav persistante ignore image-bank. Classé **P1** (cf. point d'attention Will #5).

**Patch proposé** : voir `PATCHES-PROPOSES.md` §P1-3.

## 3.5 ImageUploadDropzone — ✅ 10/10

`src/components/admin/image-bank/ImageUploadDropzone.tsx:1-80` :

- `"use client"` + comment `// use-client: useFormStatus + useRef + useState (interactive)` ✅
- Imports `useFormStatus`, `useRef`, `useState` ✅
- Pas d'import server (`@/lib/prisma`) ✅
- Wired `uploadImageAction` from `@/server/actions/image-bank/upload.action` ✅
- WCAG 2.2 AA : focus-visible ring, drop-target `label + htmlFor`, aria-label ✅
- Pas de hex hardcodé : Design tokens v3 (`border-border-strong`, `bg-paper`, `text-fg-muted`) ✅

## 3.6 Server Actions — ✅ 15/15

### upload.action.ts

- `"use server"` ✅ (L1)
- `auth()` + role check `=== "admin"` → `redirect()` ✅ (L46-49)
- Zod schema `UploadSchema` + `safeParse()` + fieldErrors ✅ (L26-59)
- `revalidateTag("image-bank", "image-bank:fr", "default")` ✅ (L121-122) — Next 16 accepte multi-arg, signature acceptable
- Try/catch + `console.error("[uploadImageAction]", err)` ✅ (L125-131)
- Conditional spread `...(condition ? { prop } : {})` ✅ (exactOptionalPropertyTypes)

### publish.action.ts + translate.action.ts

Même pattern. Files :

- `src/server/actions/image-bank/publish.action.ts` (1881 bytes)
- `src/server/actions/image-bank/translate.action.ts` (1546 bytes)

## 3.7 i18n stubs — ✅ 20/20 (acceptable)

Tous les 10 stubs utilisent :

```tsx
<AdminStubPage
  title="bulk import"
  description="Section bulk import (image-bank V1)."
  back={...}
  sprint="Sprint 2.x"
/>
```

Pas de `getTranslations()` next-intl — admin only en FR, acceptable.

---

## 📋 Issues identifiées

### P1 (1)

- **P1-3** : AdminSidebar groupe image-bank absent (`layout.tsx:40-75`). Effort 15min (1 navItem 9 routes).

### P2 (2)

- **P2-A** : Stubs admin pas de `getTranslations()` (acceptable V1 mais à migrer V1.5 si EN admin requis)
- **P2-B** : Stubs hardcodés FR `Sprint 2.x` (devrait être configurable)

---

## 🎯 Sous-pondération

| Check                             |     Pts |  Score |
| --------------------------------- | ------: | -----: |
| 3.1 Inventaire 15 pages           |      15 |     15 |
| 3.2 Pattern content-gen           |      20 |     20 |
| 3.3 AdminCommandPalette 9 entrées |       9 |      9 |
| 3.4 AdminSidebar 9e groupe        |      10 |      0 |
| 3.5 ImageUploadDropzone           |      10 |     10 |
| 3.6 Server Actions 3/3            |      15 |     15 |
| 3.7 i18n stubs (acceptable)       |      20 |     20 |
| **TOTAL**                         | **100** | **89** |

---

## ✅ Verdict Phase 3

**🟡 PASS 89/100 (89%)** — Pattern content-gen respecté, AdminCommandPalette complet, ImageUploadDropzone WCAG conforme, Server Actions auth-gated.

1 P1 bloquant UX (mais pas merge) : AdminSidebar groupe image-bank. Fix 15min.
