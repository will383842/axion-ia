/**
 * Dossier de session — réclamations et incidents (chantier QNC, L09).
 *
 * Server Component, lecture seule. Une réclamation appartient à la session par
 * son INSCRIPTION (`reclamations.enrollment_id` → `enrollments.session_id`),
 * comme dans `appreciations/rattachements.ts` — jamais par une seconde clé. Un
 * incident y appartient par `sessionId`.
 *
 * Rendu seulement quand l'interrupteur `qualiopi.reclamations.actif` couvre la
 * session (actif, ou essai sur une session du banc d'essai) : éteint, la fiche
 * de session est inchangée.
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { CLASSE_ANCRE_SECTION } from "@/features/admin-qualiopi/session-hub/ancres";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";
import { LIBELLE_ETAPE } from "@/server/qualiopi/reclamations/cycle";
import {
  LIBELLE_NATURE,
  LIBELLE_STATUT_INCIDENT,
  type NatureIncident,
  type StatutIncident,
} from "@/server/qualiopi/registres/incident-complement";

const DATE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
});

const STATUT_RECLAMATION: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  resolue: "Répondue",
  cloturee: "Clôturée",
};

export async function ReclamationsIncidentsSession({
  sessionId,
  locale,
}: {
  sessionId: string;
  locale: "fr" | "en";
}) {
  const etat = await lireInterrupteurReclamations();
  if (etat === "eteint") return null;
  const session = await prisma.trainingSession
    .findUnique({ where: { id: sessionId }, select: { estTestInterne: true } })
    .catch(() => null);
  if (session === null || !estActifPour(etat, session)) return null;

  const inscriptions = await inscriptionsDe(sessionId);
  const [reclamations, incidents] = await Promise.all([
    prisma.reclamation
      .findMany({
        where: { enrollmentId: { in: inscriptions } },
        select: {
          id: true,
          numero: true,
          objet: true,
          statut: true,
          dateReception: true,
          etapes: { select: { etape: true, creeLe: true }, orderBy: { creeLe: "desc" }, take: 1 },
        },
        orderBy: { dateReception: "desc" },
      })
      .catch(() => []),
    prisma.incident
      .findMany({
        where: { sessionId },
        select: { id: true, titre: true, nature: true, statut: true, dateIncident: true },
        orderBy: { dateIncident: "desc" },
      })
      .catch(() => []),
  ]);

  const titreCls =
    "mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";
  const ligneCls =
    "border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] last:border-b-0";
  const discretCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  return (
    <section
      id="reclamations-incidents"
      className={`mb-[var(--space-admin-8)] ${CLASSE_ANCRE_SECTION}`}
    >
      <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className={titreCls}>Réclamations et incidents</h2>

        <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
          Réclamations rattachées par l&apos;inscription ({reclamations.length})
        </h3>
        {reclamations.length === 0 ? (
          <p className={discretCls}>Aucune réclamation rattachée à cette session.</p>
        ) : (
          <ul className="mb-[var(--space-admin-4)]">
            {reclamations.map((r) => {
              const derniere = r.etapes[0];
              return (
                <li key={r.id} className={ligneCls}>
                  <span className="font-mono text-[length:var(--text-admin-xs)]">{r.numero}</span> —{" "}
                  {r.objet}{" "}
                  <span className={discretCls}>
                    (reçue le {DATE_PARIS.format(r.dateReception)} ·{" "}
                    {STATUT_RECLAMATION[r.statut] ?? r.statut}
                    {derniere
                      ? ` · dernière étape : ${LIBELLE_ETAPE[derniere.etape]} le ${DATE_PARIS.format(derniere.creeLe)}`
                      : ""}
                    )
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
          Incidents de la session ({incidents.length})
        </h3>
        {incidents.length === 0 ? (
          <p className={discretCls}>Aucun incident consigné pour cette session.</p>
        ) : (
          <ul>
            {incidents.map((i) => (
              <li key={i.id} className={ligneCls}>
                {i.titre}{" "}
                <span className={discretCls}>
                  ({DATE_PARIS.format(i.dateIncident)} ·{" "}
                  {i.nature ? LIBELLE_NATURE[i.nature as NatureIncident] : "nature non qualifiée"} ·{" "}
                  {LIBELLE_STATUT_INCIDENT[i.statut as StatutIncident] ?? i.statut})
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className={`${discretCls} mt-[var(--space-admin-3)]`}>
          Le suivi daté se fait dans les registres :{" "}
          <Link
            href={adminPath(locale, "qualiopi/reclamations")}
            className="underline underline-offset-2"
          >
            réclamations
          </Link>{" "}
          ·{" "}
          <Link
            href={adminPath(locale, "qualiopi/incidents")}
            className="underline underline-offset-2"
          >
            incidents
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

async function inscriptionsDe(sessionId: string): Promise<string[]> {
  const lignes = await prisma.enrollment
    .findMany({ where: { sessionId }, select: { id: true } })
    .catch(() => []);
  return lignes.map((l) => l.id);
}
