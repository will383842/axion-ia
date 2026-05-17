// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A6 finding CLS).
//
// Loading boundary global admin. Skeleton générique (card list, le plus
// neutre des 5 variants) à override par sous-routes denses (content-gen,
// image-bank, factures).
//
// Server Component.

import { AdminLoadingState } from "@/components/admin/ui";

export default function AdminLoading(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-[var(--space-admin-6)] py-[var(--space-admin-7)]">
      <AdminLoadingState variant="card" count={3} ariaLabel="Chargement de la page admin" />
    </div>
  );
}
