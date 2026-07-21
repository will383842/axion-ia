/**
 * Admin — Qualiopi · Émargement d'une session (T8).
 *
 * Charge la session + enrollments + créneaux côté serveur, puis rend :
 * - Un bouton "Générer les créneaux" (GenererCreneauxButton client).
 * - EmargementGrid : grille créneaux × stagiaires (client).
 * - ImportReleveForm : import CSV distanciel (client).
 * - Récapitulatif taux de présence par stagiaire.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { getSessionEmargement } from "@/server/qualiopi/presence/queries";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { EmargementGrid } from "@/components/admin/qualiopi/EmargementGrid";
import { ImportReleveForm } from "@/components/admin/qualiopi/ImportReleveForm";
import { GenererCreneauxButton } from "@/components/admin/qualiopi/GenererCreneauxButton";
import { SessionJoursEditor } from "@/components/admin/qualiopi/SessionJoursEditor";
import { LiensEmargement } from "@/components/admin/qualiopi/LiensEmargement";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import {
  generateSessionCreneauxAction,
  saveEmargementAction,
  importReleveConnexionAction,
} from "@/server/actions/qualiopi/presence";
import { saveSessionJoursAction } from "@/server/actions/qualiopi/session-jours";
import {
  emettreLiensSessionAction,
  revoquerLiensSessionAction,
} from "@/server/actions/qualiopi/emargement-liens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Émargement session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const TAUX_LABELS: Record<"complete" | "partielle" | "aucune", string> = {
  complete: "Complète",
  partielle: "Partielle",
  aucune: "Aucune",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function EmargementPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const data = await getSessionEmargement(id);
  if (!data) notFound();

  const { session, enrollments, creneaux, jours } = data;

  // Prépare les props pour EmargementGrid (clés sérialisables)
  // c.date est un DateTime Prisma (Date JS) → on extrait la partie ISO date (Europe/Paris).
  const creneauxRows = creneaux.map((c) => ({
    id: c.id,
    enrollmentId: c.enrollmentId,
    date:
      c.date instanceof Date
        ? c.date.toLocaleDateString("fr-CA") // "YYYY-MM-DD" via locale fr-CA
        : String(c.date),
    demiJournee: c.demiJournee as DemiJourneeLabel,
    libelle: c.libelle,
    dureePrevueMinutes: c.dureePrevueMinutes,
    dureeRealiseeMinutes: c.dureeRealiseeMinutes,
    present: c.present,
  }));

  const enrollmentRows = enrollments.map((e) => ({
    id: e.id,
    traineeId: e.traineeId,
    nom: e.trainee.nom,
    prenom: e.trainee.prenom,
    email: e.trainee.email,
    tauxPresencePct: e.tauxPresencePct,
  }));

  const hasCreneaux = creneauxRows.length > 0;
  const isDistanciel = session.modalite === "distanciel" || session.modalite === "hybride";

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const badgeCls = (cat: "complete" | "partielle" | "aucune") => {
    if (cat === "complete") return "text-[color:var(--color-admin-success)]";
    if (cat === "partielle") return "text-[color:var(--color-admin-warning)]";
    return "text-[color:var(--color-admin-error)]";
  };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Émargement — ${session.titreSession ?? session.numero}`}
        description={`Session ${session.numero} · ${MODALITE_LABELS[session.modalite] ?? session.modalite} · ${formatDateFR(session.dateDebut)} → ${formatDateFR(session.dateFin)}`}
      />

      {/* Informations session */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
        <div>
          <p className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
            Statut
          </p>
          <p className="mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            {STATUT_LABELS[session.statut] ?? session.statut}
          </p>
        </div>
        <div>
          <p className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
            Modalité
          </p>
          <p className="mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            {MODALITE_LABELS[session.modalite] ?? session.modalite}
          </p>
        </div>
        <div>
          <p className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
            Durée réelle
          </p>
          <p className="mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            {session.dureeReelleHeures ?? "—"} h
          </p>
        </div>
        <div>
          <p className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
            Stagiaires
          </p>
          <p className="mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            {enrollments.length}
          </p>
        </div>
      </div>

      {/* Section : Journées réellement animées (D14) — AVANT la génération des
          créneaux, parce qu'elle en dépend : sans journées déclarées, les
          créneaux sont déduits de la plage de dates, ce qui est faux dès que les
          journées ne se suivent pas. */}
      <SessionJoursEditor
        sessionId={id}
        joursInitiaux={jours}
        hasCreneaux={hasCreneaux}
        saveAction={saveSessionJoursAction}
      />

      {/* Liens de signature — après les journées (dont ils dépendent) et avant
          la grille : c'est l'ordre dans lequel l'admin travaille. */}
      <LiensEmargement
        sessionId={id}
        emettreAction={emettreLiensSessionAction}
        revoquerAction={revoquerLiensSessionAction}
      />

      {/* Section : Générer les créneaux */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Créneaux de présence</h2>
        <GenererCreneauxButton
          sessionId={id}
          genererAction={generateSessionCreneauxAction}
          hasCreneaux={hasCreneaux}
        />
      </section>

      {/* Section : Grille émargement */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Feuille d&apos;émargement présentiel</h2>
        {enrollments.length === 0 ? (
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
            Aucun stagiaire inscrit à cette session.
          </p>
        ) : (
          <EmargementGrid
            sessionId={id}
            enrollments={enrollmentRows}
            creneaux={creneauxRows}
            saveAction={saveEmargementAction}
          />
        )}
      </section>

      {/* Section : Import relevé de connexion (distanciel / hybride) */}
      {isDistanciel && (
        <section className="mb-[var(--space-admin-8)]">
          <h2 className={sectionHeadCls}>Relevé de connexion distanciel</h2>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Importez le rapport d&apos;export de votre plateforme de visioconférence. Le
            rapprochement automatique est effectué par email puis par nom.
          </p>
          <ImportReleveForm sessionId={id} importAction={importReleveConnexionAction} />
        </section>
      )}

      {/* Section : Récapitulatif taux de présence */}
      {enrollments.length > 0 && (
        <section>
          <h2 className={sectionHeadCls}>Récapitulatif des taux de présence</h2>
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Stagiaire
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Taux présence
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Qualification
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Émargement signé
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => {
                  const cat = classifierPresence(e.tauxPresencePct ?? 0);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                    >
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                        <div className="font-medium">
                          {e.trainee.prenom} {e.trainee.nom}
                        </div>
                        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          {e.trainee.email}
                        </div>
                      </td>
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                        {e.tauxPresencePct !== null ? (
                          <span className={badgeCls(cat)}>{e.tauxPresencePct} %</span>
                        ) : (
                          <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                        <span className={badgeCls(cat)}>{TAUX_LABELS[cat]}</span>
                      </td>
                      <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                        {e.emargementSigneAt != null ? (
                          <span className="text-[color:var(--color-admin-success)]">
                            Oui — {new Date(e.emargementSigneAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminPageShell>
  );
}
