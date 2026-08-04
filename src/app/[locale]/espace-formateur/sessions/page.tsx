/**
 * Espace formateur — liste des formations collectives du formateur connecté.
 * Server Component. Garde de session : `requireFormateur` redirige si non connecté.
 */

import Link from "next/link";

import { CoquilleFormateur } from "../_coquille";
import { requireFormateur } from "@/server/formateur/guard";
import { listMyTrainingSessions } from "@/server/formateur/collectif-queries";
import {
  STATUT_SESSION_LABELS,
  ROLE_FORMATEUR_LABELS,
  libelle,
  formatDateCourte,
} from "@/server/formateur/collectif-labels";

export const dynamic = "force-dynamic";

const STATUT_CLASS: Record<string, string> = {
  planifiee: "bg-sand text-fg-muted",
  en_cours: "bg-sand text-mocha",
  realisee: "bg-sage-soft text-success",
  annulee: "bg-error/10 text-error",
  reportee: "bg-sand text-fg-muted",
};

export default async function SessionsPage(): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const sessions = await listMyTrainingSessions(trainerId);

  return (
    <CoquilleFormateur section="formations">
      <div className="space-y-6">
        <h1 className="text-mocha font-serif text-2xl font-semibold">Mes formations</h1>

        {sessions.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Aucune formation collective ne vous est affectée pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/fr/espace-formateur/sessions/${s.id}`}
                  className="border-border hover:border-terracotta block rounded-lg border p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-mocha font-medium">{s.titreSession}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUT_CLASS[s.statut] ?? "bg-sand text-fg-muted"}`}
                    >
                      {libelle(STATUT_SESSION_LABELS, s.statut)}
                    </span>
                  </div>

                  <div className="text-fg-muted mt-1 text-sm">
                    {s.numero}
                    {" · "}
                    {formatDateCourte(s.dateDebut)} → {formatDateCourte(s.dateFin)}
                    {s.lieuVille ? ` · ${s.lieuVille}` : ""}
                  </div>

                  <div className="text-fg-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {s.role ? (
                      <span className="bg-sand text-mocha rounded px-2 py-0.5">
                        {libelle(ROLE_FORMATEUR_LABELS, s.role)}
                      </span>
                    ) : null}
                    <span>
                      {s.nbInscrits} inscrit{s.nbInscrits > 1 ? "s" : ""}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CoquilleFormateur>
  );
}
