import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { CircleCheck, ListChecks, TriangleAlert, Users, Wallet } from "lucide-react";

/** Chiffres clés de la fiche : calculés sur les données déjà chargées, aucune requête. */
export function TuilesSession({
  inscrits,
  prevus,
  etapes,
  checklistRendue,
  montantHtCents,
  nbConflits,
}: {
  inscrits: number;
  prevus: number;
  etapes: { fait: number; total: number } | null;
  /** Même variable que la checklist : masquée (annulée, reportée) = pas de tuile. */
  checklistRendue: boolean;
  montantHtCents: number;
  nbConflits: number;
}) {
  return (
    <div
      data-testid="tuiles-session"
      className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
    >
      <AdminStatCard
        label="Stagiaires inscrits"
        value={`${inscrits} / ${prevus}`}
        meta="inscrits sur prévus"
        icon={Users}
        tone={inscrits === 0 ? "warning" : inscrits >= prevus ? "success" : "info"}
      />
      {checklistRendue && etapes !== null ? (
        <AdminStatCard
          label="Étapes faites"
          value={`${etapes.fait} / ${etapes.total}`}
          meta="avancement du dossier"
          icon={ListChecks}
          tone={etapes.fait >= etapes.total ? "success" : "info"}
        />
      ) : null}
      <AdminStatCard
        label="Montant HT"
        value={(montantHtCents / 100).toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
        })}
        icon={Wallet}
      />
      <AdminStatCard
        label="Conflits formateur"
        value={nbConflits}
        meta={nbConflits === 0 ? "aucun chevauchement" : "à résoudre"}
        icon={nbConflits === 0 ? CircleCheck : TriangleAlert}
        tone={nbConflits === 0 ? "success" : "destructive"}
      />
    </div>
  );
}
