"use client";
// use-client: Next.js convention pour error boundaries (reset prop + state).
//
// Refonte admin mai 2026 — PR 3 (ADR 0028, audit Phase 0 §9 — 0/116
// error.tsx admin avant refonte).
//
// Boundary RSC global pour toutes les pages admin. Toute erreur server
// non-rattrapée par une error.tsx plus profonde remonte ici. Conserve
// la chrome admin (sidebar, header) via le layout parent.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AdminErrorState } from "@/components/admin/ui";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Sentry capture côté client — préserve l'instrumentation existante.
    Sentry.captureException(error, {
      tags: { route: "admin", boundary: "adminPrefix-root" },
      extra: { digest: error.digest },
    });
  }, [error]);

  const detailString =
    process.env.NODE_ENV !== "production"
      ? `${error.message}\n${error.stack ?? ""}\n${error.digest ? `digest: ${error.digest}` : ""}`
      : null;

  return (
    <AdminErrorState
      title="Une erreur est survenue dans la console"
      description="La page admin n'a pas pu se charger. Vous pouvez réessayer ou revenir au tableau de bord. L'incident a été automatiquement signalé."
      {...(detailString ? { detail: detailString } : {})}
      retryAction={
        <button type="button" onClick={reset} className="admin-button">
          Réessayer
        </button>
      }
      backAction={
        <a href="../" className="admin-button-ghost">
          Retour
        </a>
      }
    />
  );
}
