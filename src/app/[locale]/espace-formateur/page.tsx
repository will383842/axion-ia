/**
 * Espace formateur — tableau de bord (2026-06-13).
 * Liste les séances 1-to-1 du formateur + création.
 */

import Link from "next/link";
import { requireFormateur } from "@/server/formateur/guard";
import { listMySessions } from "@/server/formateur/queries";
import { NewSessionForm } from "@/components/espace-formateur/NewSessionForm";
import { coachingInterventionLabel, sessionStatutLabel } from "@/server/formateur/coaching-options";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUT_CLASS: Record<string, string> = {
  planifiee: "bg-sand text-fg-muted",
  realisee: "bg-sage-soft text-success",
  annulee: "bg-error/10 text-error",
};

export default async function DashboardPage(): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const sessions = await listMySessions(trainerId);

  return (
    <div className="space-y-6">
      <Link
        href={FORMATEUR_SESSIONS_PATH}
        className="border-border hover:border-terracotta block rounded-lg border p-4 transition-colors"
      >
        <span className="text-mocha font-serif font-semibold">Mes formations collectives</span>
        <span className="text-fg-muted mt-1 block text-sm">
          Voir les formations de groupe auxquelles vous êtes affecté
        </span>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-mocha font-serif text-2xl font-semibold">Mes séances 1-to-1</h1>
        <NewSessionForm />
      </div>

      {sessions.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Aucune séance pour l&apos;instant. Créez votre première séance ci-dessus.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/fr/espace-formateur/seances/${s.id}`}
                className="border-border bg-sand hover:border-terracotta block rounded-lg border p-4 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-mocha font-medium">
                    {coachingInterventionLabel(s.interventionSlug)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUT_CLASS[s.statut] ?? "bg-sand"}`}
                  >
                    {sessionStatutLabel(s.statut)}
                  </span>
                </div>
                <div className="text-fg-muted mt-1 text-sm">
                  {dateFmt.format(s.dateSeance)}
                  {s.beneficiaireNom ? ` · ${s.beneficiaireNom}` : ""}
                  {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
                </div>
                <div className="text-fg-muted mt-1 text-xs">
                  {s._count.optimisations} optimisation(s) · {s._count.comptesRendus} CR ·{" "}
                  {s._count.journaux} entrée(s) de journal
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
