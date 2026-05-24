// Refonte admin mai 2026 — barrel export primitives admin (cloisonné).
//
// IMPORTANT (cloisonnement strict — gate isolation-check) :
//   Ce dossier `src/components/admin/ui/**` ne doit JAMAIS être importé
//   hors de :
//   - src/app/[locale]/(admin)/[adminPrefix]/**
//   - src/components/admin/**
//
//   Les primitives publiques restent dans `src/components/ui/**`
//   (extensibles uniquement, jamais modifiées).
//
// PR 1 — mitigations §3.6 + §3.7 :
//   - AdminSessionExpiryWarning, AdminConflictDialog
//
// PR 2 — primitives batch 1 (layout + présentation) :
//   - AdminPageShell, AdminPageHeader, AdminToolbar, AdminCard
//
// PR 3 — primitives batch 2 (données + états) :
//   - AdminTable + AdminTableColumn (types)
//   - AdminFormField, AdminFormSection
//   - AdminEmptyState, AdminLoadingState, AdminErrorState
//
// PR 4 — primitives batch 3 (interaction + UX) :
//   - AdminBadge + AdminStatusBadge
//   - AdminBreadcrumbs (+ AdminBreadcrumbItem)
//   - AdminTabs (+ AdminTabItem)
//   - AdminConfirmDialog (refait : 2-step destructive)
//   - AdminStatCard
//   - AdminPagination
//   - AdminSubmitButton (promu)
//   - AdminKeyboardHint
//   - AdminFilterChip
//   - AdminAutosaveIndicator (+ AdminAutosaveStatus)
//   - AdminBulkActions
//   - AdminInlineEdit

export { AdminSessionExpiryWarning } from "./AdminSessionExpiryWarning";
export { AdminConflictDialog } from "./AdminConflictDialog";
export { AdminPageShell } from "./AdminPageShell";
export { AdminPageHeader } from "./AdminPageHeader";
export { AdminToolbar } from "./AdminToolbar";
export { AdminCard } from "./AdminCard";
export { AdminTable } from "./AdminTable";
export type { AdminTableColumn } from "./AdminTable";
export { AdminFormField, AdminFormSection } from "./AdminFormField";
export { AdminEmptyState } from "./AdminEmptyState";
export { AdminLoadingState } from "./AdminLoadingState";
export { AdminErrorState } from "./AdminErrorState";
export { AdminBadge, AdminStatusBadge } from "./AdminBadge";
export { AdminBreadcrumbs } from "./AdminBreadcrumbs";
export type { AdminBreadcrumbItem } from "./AdminBreadcrumbs";
export { AdminTabs } from "./AdminTabs";
export type { AdminTabItem } from "./AdminTabs";
export { AdminConfirmDialog } from "./AdminConfirmDialog";
export { AdminStatCard } from "./AdminStatCard";
export { AdminPagination } from "./AdminPagination";
export { AdminSubmitButton } from "./AdminSubmitButton";
export { AdminKeyboardHint } from "./AdminKeyboardHint";
export { AdminFilterChip } from "./AdminFilterChip";
export { AdminAutosaveIndicator } from "./AdminAutosaveIndicator";
export type { AdminAutosaveStatus } from "./AdminAutosaveIndicator";
export { AdminBulkActions } from "./AdminBulkActions";
export { AdminInlineEdit } from "./AdminInlineEdit";

// PR 5 — sidebar v2 + topbar + user menu + notifications
export { AdminSidebarNav } from "./AdminSidebarNav";
export { AdminTopbar } from "./AdminTopbar";
export { AdminUserMenu } from "./AdminUserMenu";
export { AdminNotificationsDropdown } from "./AdminNotificationsDropdown";
export type { AdminNotificationItem } from "./AdminNotificationsDropdown";

// PR 6 — helper consumer migrations pages main
export { AdminFilterTabs } from "./AdminFilterTabs";
export type { AdminFilterTabOption } from "./AdminFilterTabs";

// PR 12 — polish UX (additive only, opt-in par les V2)
export { AdminShortcutListener } from "./AdminShortcutListener";
export type { AdminShortcut } from "./AdminShortcutListener";
export { AdminFormDirtyGuard } from "./AdminFormDirtyGuard";
export { AdminUndoToast } from "./AdminUndoToast";

// Sprint correctif SP-01 — error UI inline formulaires
export { AdminFormError } from "./AdminFormError";
