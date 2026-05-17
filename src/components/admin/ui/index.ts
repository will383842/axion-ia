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

export { AdminSessionExpiryWarning } from "./AdminSessionExpiryWarning";
export { AdminConflictDialog } from "./AdminConflictDialog";
export { AdminPageShell } from "./AdminPageShell";
export { AdminPageHeader } from "./AdminPageHeader";
export { AdminToolbar } from "./AdminToolbar";
export { AdminCard } from "./AdminCard";
