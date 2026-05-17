# PATTERNS — Templates standardisés pages admin v2

> Sortie Phase 2 (conception). Mini-templates pour les 5 patterns canoniques + spec primitives.
> Référence : ADR 0028 + SYNTHESE-PHASE-1.md.

## 1. Page liste (`/<resource>/page.tsx`)

**Structure cible** :

```tsx
// src/app/[locale]/(admin)/[adminPrefix]/<resource>/page.tsx
import { Suspense } from "react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminEmptyState,
  AdminLoadingState,
  AdminPagination,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic"; // PRÉSERVÉ

export default async function ResourceListPage({ searchParams }) {
  const filters = parseFilters(await searchParams);
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Réservations"
        description="Toutes les réservations actives + archivées."
        breadcrumbs={
          <AdminBreadcrumbs
            items={[{ label: "Activité", href: ".." }, { label: "Réservations" }]}
          />
        }
        actions={
          <Button asChild>
            <Link href="reservations/new">+ Nouvelle</Link>
          </Button>
        }
      />
      <AdminToolbar
        filters={<ReservationFilters current={filters} />}
        search={<AdminSearchInput name="q" defaultValue={filters.q} />}
        sort={<AdminSortSelect column={filters.sort} options={SORT_OPTIONS} />}
      />
      <Suspense fallback={<AdminLoadingState variant="table" rows={10} cols={7} />}>
        <ReservationTable filters={filters} />
      </Suspense>
    </AdminPageShell>
  );
}

async function ReservationTable({ filters }) {
  const { rows, total } = await listReservations(filters);
  if (rows.length === 0) {
    return (
      <AdminEmptyState
        title="Aucune réservation"
        description="..."
        cta={<Button>+ Créer</Button>}
      />
    );
  }
  return (
    <>
      <AdminTable
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.id}
        rowAction={(r) => <Link href={`reservations/${r.id}`}>→ Détail</Link>}
      />
      <AdminPagination
        page={filters.page}
        totalPages={Math.ceil(total / 20)}
        baseHref="reservations"
      />
    </>
  );
}
```

- **Server Component ratio** : 100 % serveur (table = serveur, toolbar = serveur, filters = lien `<Link>`). Pas de `'use client'` sauf si bulk actions sélection (alors `<AdminBulkActions>` est client).
- **Suspense** : seulement autour de la table (donnée DB lente). Header + toolbar rendus immédiatement.
- **Skeleton** : `<AdminLoadingState variant="table" rows={10} cols={7} />` avec dimensions exactes (élimine CLS).
- **Empty** : `<AdminEmptyState>` avec icon lucide + heading + body + CTA.
- **A11y** : sort headers cliquables ont `aria-sort`, `<AdminPagination>` a `aria-label="Pagination"`, `<AdminBulkActions>` toolbar = `role="toolbar" aria-label="Actions sur la sélection"`.

## 2. Page détail (`/<resource>/[id]/page.tsx`)

```tsx
import { AdminDetailShell, AdminDetailHeader, AdminTabs, AdminBadge } from "@/components/admin/ui";

export default async function ReservationDetail({ params }) {
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();
  return (
    <AdminDetailShell>
      <AdminDetailHeader
        backHref="/reservations"
        backLabel="Toutes les réservations"
        title={`#${reservation.id}`}
        subtitle={reservation.companyName}
        meta={<AdminStatusBadge type="booking" status={reservation.status} />}
        updatedAt={reservation.updatedAt}
        actions={<ReservationActions reservation={reservation} />}
      />
      <AdminTabs
        items={[
          { value: "overview", label: "Vue d'ensemble", count: undefined },
          { value: "messages", label: "Messages", count: reservation.messagesCount },
          { value: "documents", label: "Documents", count: reservation.documentsCount },
        ]}
      />
      <Suspense fallback={<AdminLoadingState variant="card" />}>{/* contenu tab */}</Suspense>
    </AdminDetailShell>
  );
}
```

- **Header sticky** : `position: sticky; top: 0` avec backdrop-blur léger.
- **Back smart** : `backHref` peut inclure `?` querystring pour préserver les filtres précédents (sera câblé en PR 12).
- **Multi-tab conflict** (§3.7) : si Publication / Reservation / Devis / Facture, `<AdminDetailHeader>` lit `reservation.updatedAt` et l'envoie au form. Le form Server Action compare avant write → `<AdminConflictDialog>` si conflit.

## 3. Page formulaire (`/<resource>/new/page.tsx` + `edit`)

```tsx
import { AdminPageShell, AdminPageHeader, AdminFormSection, AdminFormField, AdminSubmitButton } from "@/components/admin/ui";

export default function NewReservationPage() {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader title="Nouvelle réservation" breadcrumbs={...} />
      <form action={createReservation}>
        <AdminFormSection title="Informations principales">
          <AdminFormField label="Entreprise" name="companyName" required type="text" />
          <AdminFormField label="Email contact" name="email" required type="email" />
          <AdminFormField label="Téléphone" name="phone" type="tel" />
        </AdminFormSection>
        <AdminFormSection title="Détails intervention" collapsible defaultOpen={false}>
          ...
        </AdminFormSection>
        <div className="flex justify-end gap-3 mt-8">
          <Button variant="ghost" asChild><Link href="reservations">Annuler</Link></Button>
          <AdminSubmitButton>Créer la réservation</AdminSubmitButton>
        </div>
      </form>
    </AdminPageShell>
  );
}
```

- **React 19** : `useActionState` côté wrapper si feedback inline nécessaire ; `useFormStatus` pour `<AdminSubmitButton>` (disabled pendant pending).
- **Autosave Tiptap** (publications/edit) : `useOptimistic` + debounce 2s + `localStorage.setItem("admin-draft:publication:" + id, ...)`. Recovery au load (`localStorage.getItem`).
- **Validation Zod** : Server Action retourne `{ ok: false, errors: Record<field, message> }` → `<AdminFormField error={errors[field]}>` rend `aria-invalid="true"` + message.
- **Progressive enhancement** : forms doivent fonctionner sans JS (pas de `event.preventDefault()` côté client sauf raison forte).

## 4. Page dashboard (`/page.tsx` racine + sous-dashboards)

```tsx
import { AdminPageShell, AdminPageHeader, AdminStatCard, AdminCard } from "@/components/admin/ui";

export default async function AdminDashboard() {
  return (
    <AdminPageShell>
      <AdminPageHeader title="Tableau de bord" description="..." />
      <section className="grid grid-cols-4 gap-4">
        <Suspense fallback={<AdminLoadingState variant="stat-grid" count={4} />}>
          <KpiCards />
        </Suspense>
      </section>
      <div className="mt-8 grid grid-cols-3 gap-6">
        <Suspense fallback={<AdminLoadingState variant="card" />}>
          <RecentReservations />
        </Suspense>
        <Suspense fallback={<AdminLoadingState variant="card" />}>
          <PendingReviews />
        </Suspense>
        <Suspense fallback={<AdminLoadingState variant="card" />}>
          <UpcomingDeadlines />
        </Suspense>
      </div>
    </AdminPageShell>
  );
}

async function KpiCards() {
  const stats = await getStats();
  return (
    <>
      <AdminStatCard label="Réservations actives" value={stats.activeReservations} tone="default" />
      <AdminStatCard label="Devis en attente" value={stats.pendingQuotes} tone="warn" delta="+2" />
      <AdminStatCard label="Factures payées (30j)" value={stats.paidInvoicesMonth} tone="success" />
      <AdminStatCard
        label="Échéances < 7j"
        value={stats.upcomingDeadlines}
        tone="default"
        href="echeanciers"
      />
    </>
  );
}
```

- **Suspense par section** : KpiCards / RecentReservations / PendingReviews / UpcomingDeadlines rendus indépendamment. LCP amélioré.
- **Skeleton dédié** : `<AdminLoadingState variant="stat-grid">` avec exact 4 × (100×60px). `variant="card"` = 300×200px.

## 5. Page settings (`/settings/page.tsx`)

```tsx
import {
  AdminPageShell,
  AdminPageHeader,
  AdminFormSection,
  AdminFormField,
  AdminInlineEdit,
} from "@/components/admin/ui";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader title="Paramètres" />
      <AdminFormSection title="Identité du cabinet">
        <AdminInlineEdit label="Nom" value={settings.name} action={updateName} />
        <AdminInlineEdit label="SIRET" value={settings.siret} action={updateSiret} />
      </AdminFormSection>
      <AdminFormSection title="Notifications" collapsible defaultOpen={false}>
        ...
      </AdminFormSection>
    </AdminPageShell>
  );
}
```

- **`<AdminInlineEdit>`** : double-click ou clic icône pen → input in-place → Enter ou blur sauve (avec `useOptimistic`).
- **`<AdminFormSection collapsible>`** : `<details>` sémantique, accessible clavier.

---

## Spec primitives admin (résumé pour PR 2-4)

### `<AdminPageHeader>` (canonique master §8.2)

```tsx
interface AdminPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}
```

Render : `<header>` border-b + flex layout (title + actions). Tokens : `--text-admin-xl` h1, `--text-admin-md` description, `--space-admin-6` padding-bottom, `--color-admin-border` border.

### `<AdminTable<T>>`

```tsx
interface AdminTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
}

interface AdminTableProps<T> {
  columns: ReadonlyArray<AdminTableColumn<T>>;
  rows: ReadonlyArray<T>;
  getRowId: (row: T) => string;
  rowAction?: (row: T) => React.ReactNode;
  onSort?: (column: string, direction: "asc" | "desc") => void;
  currentSort?: { column: string; direction: "asc" | "desc" };
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  emptyState?: React.ReactNode;
}
```

Render : `<table>` semantic. Header `<th>` sortable avec chevron lucide. Row hover `bg-[var(--color-admin-surface-hover)]`. Row click → focus + Enter = `rowAction`. Bulk selection si `selectable` ON → première colonne checkbox + sticky bottom `<AdminBulkActions>`.

### `<AdminFormField>`

```tsx
interface AdminFormFieldProps {
  label: string;
  name: string;
  type: "text" | "email" | "tel" | "number" | "url" | "textarea" | "select" | "date";
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  options?: ReadonlyArray<{ value: string; label: string }>; // si select
  rows?: number; // si textarea
}
```

Render : `<label>` + `<input>` ou `<textarea>` ou `<select>` + `<small>` hint + `<p role="alert">` error si présent. Tous les `<input>` portent `aria-invalid={!!error}` + `aria-errormessage={errorId}` + `aria-describedby={hintId}`. Required → marker visuel + `aria-required="true"`.

### `<AdminStatusBadge>`

```tsx
type BookingStatus = "draft" | "confirmed" | "in_progress" | "completed" | "cancelled" | ...;
// idem InvoiceStatus, QuoteStatus, JobStatus, etc.

interface AdminStatusBadgeProps<T extends string> {
  status: T;
  type: "booking" | "invoice" | "quote" | "job" | "publication" | "user-role";
  labelMap?: Partial<Record<T, string>>;
}
```

Render : `<span>` compact 11px uppercase tracking-wide, couleur par status mappée vers `--color-admin-success-soft / --color-admin-warning-soft / --color-admin-destructive-soft / --color-admin-info-soft` (background) + version `*-fg` pour texte. Icône lucide optionnelle (checkmark / clock / x / etc.).

### `<AdminConfirmDialog>`

```tsx
interface AdminConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  requireTypeToConfirm?: string; // pour 2-step destructive
}
```

Render : Radix Dialog. Si `destructive` ET `requireTypeToConfirm`, l'utilisateur doit taper la string exacte (ex. "SUPPRIMER") pour activer le bouton. ESC ferme. Return focus to trigger.

### `<AdminSessionExpiryWarning>` (§3.6)

```tsx
// 'use client'
// use-client: heartbeat fetch + listener storage event + modal interactive (browser-only)
"use client";

export function AdminSessionExpiryWarning() {
  // Toutes les 5 min, fetch('/api/admin/session-ping')
  // Si 401 ou expiresAt < now + 2min → setOpen(true)
  // Modal non-bloquante : "Se reconnecter" (popup) ou "Sauvegarder en draft local"
}
```

### `<AdminConflictDialog>` (§3.7)

```tsx
// 'use client'
// use-client: dialog interactif avec diff visual

interface AdminConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverVersion: { updatedAt: Date; data: unknown };
  localVersion: { updatedAt: Date; data: unknown };
  onOverride: () => void;
  onCancel: () => void;
  onMerge?: (merged: unknown) => void;
}
```

---

## Comportement loading / error / empty

- **Loading** : skeleton avec dimensions exactes (CLS = 0). Variants : `table`, `card`, `stat-grid`, `detail-header`, `form`.
- **Error** : `error.tsx` du dossier le plus proche est utilisé. `<AdminErrorState>` affiche message + bouton "Réessayer" qui appelle `reset()` (Next 16 convention). Sentry capture la `Error` propagée.
- **Empty** : `<AdminEmptyState>` icon lucide + heading + body + CTA (`primary` + `secondary` optionnel).

## A11y notes

- Tous les composants interactifs ont `:focus-visible` style avec `outline: 2px solid var(--color-primary)` + `outline-offset: 2px`.
- Tous les `<button>` ont `aria-label` si pas de texte visible (icon-only).
- Tous les modals ont focus-trap + ESC close + return focus to trigger.
- Tous les forms ont association `<label htmlFor>` + `<input id>`.
- Tous les `<input>` ont `aria-invalid` + `aria-errormessage` + `aria-describedby`.
- Target size desktop ≥ 24×24px, mobile ≥ 44×44px.
- Reduced motion : transitions > 0 ms passées à 0 ms via `@media (prefers-reduced-motion: reduce)`.
- Print mode : header/sidebar/actions cachés via `@media print`.
