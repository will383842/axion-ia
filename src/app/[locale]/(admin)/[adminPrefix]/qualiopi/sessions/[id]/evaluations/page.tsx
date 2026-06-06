/**
 * Admin — Qualiopi · Évaluations des acquis d'une session (T9).
 *
 * Charge session + formation (objectifsPédagogiques) + enrollments +
 * évaluations existantes côté serveur. Affiche par stagiaire :
 *   - ses évaluations passées (type / score / niveau / réussite) ;
 *   - un formulaire d'ajout d'évaluation (EvaluationForm) ;
 *   - un bloc attestation avec bouton générer + lien de vérification.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { EvaluationForm } from "@/components/admin/qualiopi/EvaluationForm";
import { GenererAttestationButton } from "@/components/admin/qualiopi/GenererAttestationButton";
import {
  createEvaluationAcquisAction,
  genererAttestationAction,
} from "@/server/actions/qualiopi/evaluations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Évaluations des acquis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de libellés
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  initiale: "Initiale",
  intermediaire: "Intermédiaire",
  finale: "Finale",
};

const NIVEAU_LABELS: Record<string, string> = {
  non_acquis: "Non acquis",
  partiellement_acquis: "Partiellement acquis",
  acquis: "Acquis",
};

const ATTESTATION_LABELS: Record<string, string> = {
  complete: "Complète",
  partielle: "Partielle",
  aucune: "Aucune",
};

function niveauCouleur(niveau: string): string {
  if (niveau === "acquis") return "text-[color:var(--color-admin-success)]";
  if (niveau === "partiellement_acquis") return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-error)]";
}

function attestationCouleur(resultat: string | null): string {
  if (resultat === "complete") return "text-[color:var(--color-admin-success)]";
  if (resultat === "partielle") return "text-[color:var(--color-admin-warning)]";
  if (resultat === "aucune") return "text-[color:var(--color-admin-error)]";
  return "text-[color:var(--color-admin-fg-muted)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function EvaluationsPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // ── Chargement session + formation + enrollments + évaluations ──────────────
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: {
      formation: {
        select: {
          titre: true,
          dureeHeures: true,
          objectifsPedagogiques: true,
        },
      },
      enrollments: {
        where: { statut: { notIn: ["abandon", "exclu"] } },
        include: {
          trainee: { select: { nom: true, prenom: true, email: true } },
          evaluations: {
            orderBy: { dateEvaluation: "asc" },
          },
          attestationDocument: {
            select: { id: true, qrToken: true },
          },
        },
        orderBy: [{ trainee: { nom: "asc" } }, { trainee: { prenom: "asc" } }],
      },
    },
  });

  if (!session) notFound();

  // Extraire les objectifs pédagogiques de la formation (Json array)
  // Format attendu : string[] ou { libelle: string }[] — on normalise en string[]
  const rawObjectifs = session.formation?.objectifsPedagogiques;
  const objectifsPedagogiques: string[] = Array.isArray(rawObjectifs)
    ? rawObjectifs.map((o: unknown) => {
        if (typeof o === "string") return o;
        if (o !== null && typeof o === "object" && "libelle" in o) {
          return String((o as { libelle: unknown }).libelle);
        }
        return String(o);
      })
    : [];

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const headCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
  const cellCls = "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Évaluations des acquis — ${session.titreSession ?? session.numero}`}
        description={`Session ${session.numero} · Formation : ${session.formation?.titre ?? "—"} · ${session.enrollments.length} stagiaire(s)`}
      />

      {/* Lien retour vers l'émargement */}
      <div className="mb-[var(--space-admin-5)]">
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/sessions/${id}/emargement`}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Retour à l&apos;émargement
        </Link>
      </div>

      {session.enrollments.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun stagiaire actif inscrit à cette session.
        </p>
      ) : (
        <div className="space-y-[var(--space-admin-8)]">
          {session.enrollments.map((enrollment) => {
            const evalFinale = [...enrollment.evaluations]
              .filter((e) => e.type === "finale")
              .sort((a, b) => b.dateEvaluation.getTime() - a.dateEvaluation.getTime())[0];

            return (
              <section
                key={enrollment.id}
                className="rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
              >
                {/* En-tête stagiaire */}
                <div className="mb-[var(--space-admin-4)] flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
                  <div>
                    <p className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                      {enrollment.trainee.prenom} {enrollment.trainee.nom}
                    </p>
                    <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {enrollment.trainee.email}
                    </p>
                  </div>

                  {/* Bloc attestation */}
                  <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
                    {enrollment.attestationResultat !== null ? (
                      <span
                        className={`text-[length:var(--text-admin-sm)] font-medium ${attestationCouleur(enrollment.attestationResultat)}`}
                      >
                        Attestation :{" "}
                        {ATTESTATION_LABELS[enrollment.attestationResultat] ??
                          enrollment.attestationResultat}
                      </span>
                    ) : (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Attestation non générée
                      </span>
                    )}

                    {/* Lien vérification si attestation existante */}
                    {enrollment.attestationDocument?.qrToken && (
                      <Link
                        href={`/${locale}/verifier-attestation/${enrollment.attestationDocument.qrToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                      >
                        Vérifier l&apos;attestation →
                      </Link>
                    )}

                    <GenererAttestationButton
                      enrollmentId={enrollment.id}
                      genererAction={genererAttestationAction}
                      dejaGeneree={enrollment.attestationResultat !== null}
                    />
                  </div>
                </div>

                {/* Tableau des évaluations existantes */}
                {enrollment.evaluations.length > 0 ? (
                  <div className="mb-[var(--space-admin-5)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
                    <table className="w-full border-collapse text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                      <thead className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
                        <tr>
                          <th className={headCls}>Type</th>
                          <th className={headCls}>Date</th>
                          <th className={headCls}>Score</th>
                          <th className={headCls}>Niveau</th>
                          <th className={headCls}>Réussite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollment.evaluations.map((ev) => (
                          <tr
                            key={ev.id}
                            className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                          >
                            <td className={cellCls}>
                              <span
                                className={
                                  ev.type === "finale"
                                    ? "font-semibold text-[color:var(--color-admin-fg)]"
                                    : "text-[color:var(--color-admin-fg-soft)]"
                                }
                              >
                                {TYPE_LABELS[ev.type] ?? ev.type}
                              </span>
                            </td>
                            <td className={cellCls}>
                              {new Date(ev.dateEvaluation).toLocaleDateString("fr-FR")}
                            </td>
                            <td className={cellCls}>
                              {ev.scorePct} % ({ev.scoreObtenu}/{ev.scoreMax})
                            </td>
                            <td className={cellCls}>
                              <span className={niveauCouleur(ev.niveauGlobal)}>
                                {NIVEAU_LABELS[ev.niveauGlobal] ?? ev.niveauGlobal}
                              </span>
                            </td>
                            <td className={cellCls}>
                              {ev.reussite ? (
                                <span className="text-[color:var(--color-admin-success)]">Oui</span>
                              ) : (
                                <span className="text-[color:var(--color-admin-error)]">Non</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Résumé évaluation finale */}
                    {evalFinale && (
                      <p className="border-t border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Évaluation finale (la plus récente) : score {evalFinale.scorePct} % —{" "}
                        {NIVEAU_LABELS[evalFinale.niveauGlobal] ?? evalFinale.niveauGlobal}
                        {evalFinale.recommandations
                          ? ` — Recommandations : ${evalFinale.recommandations}`
                          : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    Aucune évaluation enregistrée pour ce stagiaire.
                  </p>
                )}

                {/* Formulaire d'ajout d'évaluation */}
                <div>
                  <h3 className={sectionHeadCls}>Ajouter une évaluation</h3>
                  <EvaluationForm
                    enrollmentId={enrollment.id}
                    objectifsPedagogiques={objectifsPedagogiques}
                    createAction={createEvaluationAcquisAction}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
