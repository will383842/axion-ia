// Refonte admin mai 2026 — PR 3 (ADR 0028, audit Phase 0 §9 — 0/116
// not-found.tsx admin avant refonte).
//
// Server Component (Next.js convention). Conserve la chrome admin
// (sidebar, header) via le layout parent.

import { AdminEmptyState } from "@/components/admin/ui";

export default function AdminNotFound(): React.ReactElement {
  return (
    <AdminEmptyState
      variant="not-found"
      title="Page introuvable"
      description="Cette ressource admin n'existe pas, a été déplacée ou supprimée. Vérifiez l'URL ou revenez au tableau de bord."
      primaryAction={
        <a href="../" className="admin-button">
          Retour au tableau de bord
        </a>
      }
    />
  );
}
