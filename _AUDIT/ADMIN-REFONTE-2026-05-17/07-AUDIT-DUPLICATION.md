# A7 — Audit Centralisation / Duplication admin

> Sous-agent Explore, poids ×1.5. Lecture seule.
> Date : 2026-05-17.

## Scoring (/100)

| #   | Pattern                      | Score /10 | # Duplications | Primitive cible                                 | Emplacement                                      |
| --- | ---------------------------- | --------- | -------------- | ----------------------------------------------- | ------------------------------------------------ |
| 1   | Page header                  | 10        | 0              | `<AdminPageHeader>` (déjà unifié via classes)   | `src/components/admin/ui/AdminPageHeader.tsx`    |
| 2   | Toolbar filtres + sort       | 4         | 6              | `<AdminFilterBar>`                              | `src/components/admin/ui/AdminFilterBar.tsx`     |
| 3   | Table pattern                | 10        | 0              | `<AdminTable>` (déjà unifié)                    | `src/components/admin/ui/AdminTable.tsx`         |
| 4   | Formulaire pattern           | 2         | 8              | `<AdminFormField>` + `<AdminFormWrapper>`       | `src/components/admin/ui/AdminForm*.tsx`         |
| 5   | Empty state                  | 5         | 5              | `<AdminEmptyState>`                             | `src/components/admin/ui/AdminEmptyState.tsx`    |
| 6   | Loading state                | 6         | 4              | `<AdminSkeleton>` / `<AdminLoadingCard>`        | `src/components/admin/ui/AdminLoading.tsx`       |
| 7   | Error state (RSC)            | 10        | 0              | Hors-scope (Next.js error.tsx natif)            | N/A                                              |
| 8   | Confirmation modal           | 3         | 7              | `<AdminConfirmDialog>`                          | `src/components/admin/ui/AdminConfirmDialog.tsx` |
| 9   | Detail header (back + title) | 7         | 3              | `<AdminDetailHeader>`                           | `src/components/admin/ui/AdminDetailHeader.tsx`  |
| 10  | Tabs (count badge, state)    | 10        | 0              | Native Next tabs (pas de UI centralisée encore) | N/A                                              |

**Total** : **67/100** (× poids 1.5 = **100.5/150 pondéré**)

---

## Top 20 duplications à éliminer (par ROI)

| #   | Pattern dupliqué                                                       | Occurrences                                                                 | Primitive cible                      | Signature TS                                                                                                           |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `formatDate()` / `formatEur()` redéfinis                               | 12 redéfinitions / 97 calls (dashboard:9, calendrier:4, reservations:5…)    | `src/lib/format.ts`                  | `export const formatDate = (d: Date \| null, opts?: FormatOpts) => string`                                             |
| 2   | `STATUS_FILTERS` arrays + static mappings                              | 6+ pages (reservations, devis, factures, invoices, paiements, publications) | `<AdminStatusBadge status type>`     | `{ status: string; type: 'booking' \| 'invoice' \| 'quote' \| ...; labelMap?: Record<string,string> }`                 |
| 3   | Empty list pattern (`colSpan=8 + "Aucun X"`)                           | 44 pages                                                                    | `<AdminTableEmpty colSpan>`          | `{ colSpan: number; message?: string }`                                                                                |
| 4   | `<label className="admin-label">` + `<input className="admin-input">`  | 311 inputs / 100+ pages                                                     | `<AdminFormField label type error>`  | `{ label: string; type: 'text' \| 'textarea' \| 'select'; name: string; error?: string; required?: boolean }`          |
| 5   | Confirmation dialog inline (`form action={deleteFn}` + double-click)   | 7 pages (BookingActions, InvoiceActions, OptionActions, ArticleActions…)    | `<AdminConfirmDialog>`               | `{ isOpen: boolean; title: string; body: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }` |
| 6   | Back button + detail title + updatedAt (header detail page)            | 6 detail pages (Reservation, Quote, Invoice, Option, Booking…)              | `<AdminDetailHeader>`                | `{ backHref: string; title: string; subtitle?: string; updatedAt?: Date; actions?: ReactNode; meta?: ReactNode }`      |
| 7   | Grid KPI cards (label + value + meta + link)                           | 19 KPIs (dashboard:8, content-gen:4, analytics:4, web-vitals:3)             | `<AdminStatCard>`                    | `{ label: string; value: string \| number; tone?: 'default' \| 'warn' \| 'success'; href?: string; meta?: string }`    |
| 8   | Loading skeleton text inline                                           | 4+ patterns (connaissances/loading.tsx + 3 ad-hoc)                          | `<AdminLoadingCard>`                 | `{ count?: number; lines?: 'table' \| 'list'; className?: string }`                                                    |
| 9   | Pagination nav (`← Précédent`, `Page X/Y`, `Suivant →`)                | 5 pages identiques                                                          | `<AdminPagination>`                  | `{ page: number; totalPages: number; baseHref: string; queryParams?: Record<string, string> }`                         |
| 10  | Status badge `<span className="admin-badge admin-badge-${status}">`    | 40+ usages, 20+ variations                                                  | `<AdminStatusBadge>`                 | (cf. #2)                                                                                                               |
| 11  | URL params build (`?status=&page=&sort=`)                              | 10+ pages hardcodent ces chaines                                            | `src/lib/admin-url.ts buildAdminUrl` | `(base: string, params: Record<string, string \| undefined>) => string`                                                |
| 12  | Sort header cliquable (chevron up/down)                                | 0 occurrence (jamais implémenté)                                            | `<AdminTableSortHeader>`             | `{ column: string; currentSort?: string; direction: 'asc' \| 'desc'; href: string }`                                   |
| 13  | Form Server Action wrapper `(prevState, formData) => action(formData)` | 8+ pages content-gen/quickGen, coverage filter, etc.                        | helper `withServerAction`            | `<TIn, TOut>(fn: (input: TIn) => Promise<TOut>) => (prev: TOut, formData: FormData) => Promise<TOut>`                  |
| 14  | KPI card local component (`function KpiCard()`)                        | 3 duplications locales (dashboard:313, content-gen:125)                     | (cf. #7 `<AdminStatCard>`)           | —                                                                                                                      |
| 15  | Filter toggle `<Link>` vs `<form>` vs `<select>` divergents            | 3 patterns différents (reservations:162, coverage:64, review-queue:67)      | `<AdminFilterTabs>`                  | `{ options: Array<{ value: string; label: string; count?: number }>; current: string; baseHref: string }`              |
| 16  | Meta-info block (created/updated/by avec icônes)                       | ~12 pages réinventent                                                       | `<AdminMetaList>`                    | `{ items: Array<{ label: string; value: ReactNode; icon?: LucideIcon }> }`                                             |
| 17  | Breadcrumb (manquant globalement → 0 occurrence)                       | 0 (anti-pattern : devrait être 1 occurrence dans layout)                    | `<AdminBreadcrumbs>`                 | `{ items: Array<{ label: string; href?: string }>; truncate?: number }`                                                |
| 18  | Tiptap toolbar buttons (B / I / U)                                     | 1 (TiptapEditor.tsx) — pas de toolbar visuelle (raw textarea)               | `<AdminRichTextField>` (wrapper)     | wrap Tiptap + toolbar icons lucide                                                                                     |
| 19  | Submit button pending state                                            | 1 (SubmitButton.tsx content-gen, à promouvoir)                              | `<AdminSubmitButton>`                | `{ children: ReactNode; pendingLabel?: string }`                                                                       |
| 20  | Auth guard inline (`if (session.user.role !== 'admin') redirect(...)`) | 3 pages (calendrier:71, users:30)                                           | helper `requireAdminRole(role[])`    | `(allowedRoles: Role[]) => Promise<Session>` (server-side)                                                             |

---

## Patterns « à exploser » (composants monolithiques)

- **`BookingActions.tsx`** (≈ 45 LOC) — combine delete + pause + resume + edit status. → split en `<AdminActionButton>` + `<AdminBulkDelete>`.
- **`NewQuoteForm.tsx`** (≈ 128 LOC) — form + validation + submit logic mélangés. → `<AdminFormWrapper>` + hook `useFormValidation()`.
- **`TemplateForm.tsx`** (content-gen) — form + rich text + metadata. → `<AdminRichTextField>` + générique `<AdminForm<T>>`.

---

## Patterns « à fusionner » (variants à converger)

| Duplication          | Variants actuels                                                                                    | Solution cible                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **StatusBadges**     | `admin-badge-pending` / `-draft` / `-published` / `-overdue` / `-success` / … (10+ variants ad-hoc) | `<AdminStatusBadge status={status} labelMap={STATUS_LABELS[domain]}>` + CSS unifié            |
| **Filter buttons**   | `admin-button-ghost + admin-button-active` (6 pages filtres)                                        | `<AdminFilterButton active href>` — variantMap unifié                                         |
| **Form labels**      | `admin-label` loose, pas d'association formelle au input                                            | `<AdminFormField>` auto-pair label/input/error                                                |
| **KPI value format** | `formatEur`, `formatDate`, custom formatters (12 redéfs)                                            | `<FormattedValue type="currency" \| "date" \| "number" value>` ou helpers `src/lib/format.ts` |

---

## Cross-leak (`components/admin` utilisé ailleurs)

✅ **AUCUN cross-leak détecté**. Les imports depuis `@/components/admin/*` restent confinés à `src/app/[locale]/(admin)/[adminPrefix]/**`.

Composants partagés acceptables :

- `TiptapEditor` : 5 imports (blog, case-studies, connaissances) — domain-specific.
- `AdminSidebar` : 1 usage (layout global).
- `GeoEventsBanner`, `JobLogStream`, `SubmitButton` : content-gen only.

**Cloisonnement futur strict confirmé** : créer `src/components/admin/ui/**` sans risque de regret — zéro dépendances externes.

---

## Notes d'implémentation

1. **Timing** : extraction 3 patterns « à exploser » + 5 patterns « à fusionner » ≈ 25-30 h (review + test + rollout séquentiel sur 10 PRs).
2. **Ordre ROI prioritaire** : `formatDate/EUR` → `StatusBadge` → `FormField` → `FilterBar` → `ConfirmDialog`.
3. **Regression risk** : **FAIBLE**. Tous patterns sont CSS-first (aucune logique métier), isolables via props.
4. **Perf impact** : +0 octets (refactoring interne). Primitives restent sous 3 KB gz chacune.
