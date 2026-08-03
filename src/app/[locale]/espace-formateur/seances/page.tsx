/**
 * Espace formateur — accompagnements individuels (coaching 1-to-1).
 *
 * Extrait du tableau de bord le 2026-08-03. Cette liste y cohabitait avec les
 * lettres de mission et les formations de groupe, sous un titre — « Mes séances
 * 1-to-1 » — qui est un nom de PRODUIT et ne dit pas de quoi il s'agit. Elle a
 * désormais sa destination, nommée par ce qu'elle contient.
 */

import Link from "next/link";

import { requireFormateur } from "@/server/formateur/guard";
import { listMySessions } from "@/server/formateur/queries";
import { NewSessionForm } from "@/components/espace-formateur/NewSessionForm";
import { coachingInterventionLabel, sessionStatutLabel } from "@/server/formateur/coaching-options";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

import { CoquilleFormateur } from "../_coquille";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

const STATUT_CLASS: Record<string, string> = {
  planifiee: "bg-sand text-fg-muted",
  realisee: "bg-sage-soft text-success",
  annulee: "bg-error/10 text-error",
};

export default async function SeancesPage(): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const sessions = await listMySessions(trainerId);

  return (
    <CoquilleFormateur section="accompagnements">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">
            Accompagnements individuels
          </h1>
          <p className="text-fg-soft mt-2 max-w-xl text-sm leading-relaxed">
            Le suivi d&apos;une personne à la fois, séance après séance. Sans rapport avec les
            formations de groupe, qui vivent dans « Mes formations ».
          </p>
        </div>
        <NewSessionForm />
      </header>

      {sessions.length === 0 ? (
        <div className="border-border bg-paper rounded-xl border p-8 text-center">
          <p className="text-mocha font-serif text-base font-semibold">Aucun accompagnement</p>
          <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
            Si vous n&apos;animez que des formations de groupe, c&apos;est normal : tout se passe
            dans « Mes formations ».
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`${FORMATEUR_BASE_PATH}/seances/${s.id}`}
                className="border-border bg-paper hover:border-terracotta block rounded-xl border p-5 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="text-mocha font-serif text-base font-semibold">
                    {coachingInterventionLabel(s.interventionSlug)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUT_CLASS[s.statut] ?? "bg-sand text-fg-muted"}`}
                  >
                    {sessionStatutLabel(s.statut)}
                  </span>
                </div>
                <p className="text-fg-soft mt-2 text-sm">
                  {dateFmt.format(s.dateSeance)}
                  {s.beneficiaireNom ? ` · ${s.beneficiaireNom}` : ""}
                  {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
                </p>
                <p className="text-fg-muted mt-1 text-xs">
                  {s._count.optimisations} optimisation{s._count.optimisations > 1 ? "s" : ""} ·{" "}
                  {s._count.comptesRendus} compte{s._count.comptesRendus > 1 ? "s" : ""} rendu
                  {s._count.comptesRendus > 1 ? "s" : ""} · {s._count.journaux} entrée
                  {s._count.journaux > 1 ? "s" : ""} de journal
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CoquilleFormateur>
  );
}
