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
import { capturerErreurDeFrontiere } from "@/lib/observability/sentry-client-lazy";
import { AdminErrorState } from "@/components/admin/ui";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Audit deploy-unstuck 2026-05-18 — verbose console pour debug admin crash
    // post-deploy. À retirer quand la cause root sera identifiée.
    console.error("[ADMIN ERROR BOUNDARY] message:", error.message);
    console.error("[ADMIN ERROR BOUNDARY] stack:", error.stack);
    console.error("[ADMIN ERROR BOUNDARY] digest:", error.digest);
    console.error("[ADMIN ERROR BOUNDARY] name:", error.name);
    console.error("[ADMIN ERROR BOUNDARY] cause:", error.cause);
    // 🔴 2026-09-09 — CETTE CAPTURE EXISTAIT DEPUIS MAI ET NE RAPPORTAIT RIEN.
    // `Sentry.captureException` sans client attaché ne lève pas : elle
    // abandonne l'événement en silence. Or le SDK ne s'initialise qu'à
    // l'inactivité du fil principal (repli 3 s, `instrumentation-client.ts`),
    // et une erreur de console admin arrive avant. L'instrumentation paraissait
    // donc en place — c'est le pire état pour un instrument.
    void capturerErreurDeFrontiere(error, "admin-error");
  }, [error]);

  // Audit deploy-unstuck 2026-05-18 — affichage détail en prod aussi
  // (temporaire). À retirer ASAP.
  const detailString = `${error.message}\n${error.stack ?? ""}\n${error.digest ? `digest: ${error.digest}` : ""}`;

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
