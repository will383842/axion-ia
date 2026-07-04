"use client";
// use-client: boutons lancer/pause/reprendre appelant des Server Actions
// Justification "use client" : boutons d'action (lancer/pause/reprendre) qui
// appellent des Server Actions et rafraîchissent — interactivité requise.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  launchProspectionCampaign,
  pauseProspectionCampaign,
  resumeProspectionCampaign,
} from "@/server/actions/prospection/campaigns";

export function CampaignActions({ id, statut }: { id: string; statut: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: (id: string) => Promise<unknown>) =>
    startTransition(async () => {
      await fn(id);
      router.refresh();
    });

  return (
    <div className="admin-actions" style={{ display: "flex", gap: "0.5rem" }}>
      {(statut === "brouillon" || statut === "terminee") && (
        <button
          className="admin-button-cta"
          disabled={isPending}
          onClick={() => run(launchProspectionCampaign)}
        >
          Lancer
        </button>
      )}
      {statut === "active" && (
        <button
          className="admin-button"
          disabled={isPending}
          onClick={() => run(pauseProspectionCampaign)}
        >
          Mettre en pause
        </button>
      )}
      {(statut === "en_pause" || statut === "en_pause_quota") && (
        <button
          className="admin-button-cta"
          disabled={isPending}
          onClick={() => run(resumeProspectionCampaign)}
        >
          Reprendre
        </button>
      )}
    </div>
  );
}
