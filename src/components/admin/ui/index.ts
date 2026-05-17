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
// PR 1 — primitives livrées :
//   - AdminSessionExpiryWarning (§3.6 mitigation)
//   - AdminConflictDialog       (§3.7 mitigation)
//
// PRs 2-4 ajouteront ~23 primitives supplémentaires
// (AdminPageHeader, AdminTable, AdminFormField, …).

export { AdminSessionExpiryWarning } from "./AdminSessionExpiryWarning";
export { AdminConflictDialog } from "./AdminConflictDialog";
