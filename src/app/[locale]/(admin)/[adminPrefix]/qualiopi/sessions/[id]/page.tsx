/**
 * Admin — Qualiopi · Hub d&apos;une session de formation (T19 Cluster L2).
 *
 * Affiche l&apos;en-tête de la session (formation, dates, statut, client, financement)
 * + liens vers les sous-pages existantes (émargement / évaluations / financement)
 * + SessionLifecycleButtons pour piloter le cycle de vie.
 *
 * Sections de Vague 2 (E1 stagiaires, E2 documents, E3 questionnaires)
 * sont pré-câblées avec des ancres commentées — NON implémentées ici.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SessionLifecycleButtons } from "@/components/admin/qualiopi/SessionLifecycleButtons";
import { prisma } from "@/lib/prisma";
import type { TrainingSessionStatut } from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<TrainingSessionStatut, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
  mixte: "Mixte",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function statutColor(s: TrainingSessionStatut): string {
  if (s === "realisee") return "text-[color:var(--color-admin-success)]";
  if (s === "annulee" || s === "reportee") return "text-[color:var(--color-admin-error)]";
  if (s === "en_cours") return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-fg-muted)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function SessionHubPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      dureeReelleHeures: true,
      nbParticipantsPrevus: true,
      nbParticipantsReels: true,
      montantHtCents: true,
      financementType: true,
      sessionParentId: true,
      sessionReporteeId: true,
      formation: {
        select: {
          id: true,
          titre: true,
          numero: true,
          statut: true,
          statutGeneration: true,
        },
      },
      client: {
        select: {
          id: true,
          raisonSociale: true,
          numero: true,
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!trainingSession) notFound();

  const base = `/${locale}/${adminPrefix}/qualiopi/sessions`;
  const sessionBase = `${base}/${id}`;

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const subLinkCls =
    "flex items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] transition-colors hover:bg-[color:var(--color-admin-surface)]";

  return (
    <AdminPageShell width="wide">
      {/* ── Fil d&apos;Ariane ─────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={base}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Sessions
        </Link>
        {trainingSession.formation && (
          <>
            <span className="text-[color:var(--color-admin-fg-muted)]">/</span>
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/formations/${trainingSession.formation.id}`}
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              Formation {trainingSession.formation.numero}
            </Link>
          </>
        )}
      </div>

      <AdminPageHeader
        title={trainingSession.titreSession ?? trainingSession.formation.titre}
        description={`Session ${trainingSession.numero} · ${formatDateFR(trainingSession.dateDebut)} → ${formatDateFR(trainingSession.dateFin)}`}
        meta={
          <span
            className={`text-[length:var(--text-admin-sm)] font-semibold ${statutColor(trainingSession.statut as TrainingSessionStatut)}`}
          >
            {STATUT_LABELS[trainingSession.statut as TrainingSessionStatut] ??
              trainingSession.statut}
          </span>
        }
      />

      {/* ── En-tête de la session ─────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Informations générales</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          {/* Formation */}
          <div>
            <p className={infoLabelCls}>Formation</p>
            <p className={infoValueCls}>
              <Link
                href={`/${locale}/${adminPrefix}/qualiopi/formations/${trainingSession.formation.id}`}
                className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                {trainingSession.formation.numero}
              </Link>
            </p>
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {trainingSession.formation.titre}
            </p>
          </div>

          {/* Modalité */}
          <div>
            <p className={infoLabelCls}>Modalité</p>
            <p className={infoValueCls}>
              {MODALITE_LABELS[trainingSession.modalite] ?? trainingSession.modalite}
            </p>
          </div>

          {/* Participants */}
          <div>
            <p className={infoLabelCls}>Participants</p>
            <p className={infoValueCls}>
              {trainingSession._count.enrollments} inscrits / {trainingSession.nbParticipantsPrevus}{" "}
              prévus
            </p>
            {trainingSession.nbParticipantsReels !== null && (
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {trainingSession.nbParticipantsReels} réels
              </p>
            )}
          </div>

          {/* Montant HT */}
          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              {(trainingSession.montantHtCents / 100).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Exonéré TVA (261-4-4° CGI)
            </p>
          </div>

          {/* Client */}
          {trainingSession.client !== null && (
            <div>
              <p className={infoLabelCls}>Client</p>
              <p className={infoValueCls}>
                <Link
                  href={`/${locale}/${adminPrefix}/qualiopi/clients`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  {trainingSession.client.numero}
                </Link>
              </p>
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {trainingSession.client.raisonSociale}
              </p>
            </div>
          )}

          {/* Financement */}
          <div>
            <p className={infoLabelCls}>Financement</p>
            <p className={infoValueCls}>
              {trainingSession.financementType !== null
                ? (FINANCEMENT_LABELS[trainingSession.financementType] ??
                  trainingSession.financementType)
                : "Non défini"}
            </p>
          </div>

          {/* Durée réelle */}
          {trainingSession.dureeReelleHeures !== null && (
            <div>
              <p className={infoLabelCls}>Durée réelle</p>
              <p className={infoValueCls}>{trainingSession.dureeReelleHeures} h</p>
            </div>
          )}

          {/* Session parente (récurrence) */}
          {trainingSession.sessionParentId !== null && (
            <div>
              <p className={infoLabelCls}>Session parente</p>
              <p className={infoValueCls}>
                <Link
                  href={`${base}/${trainingSession.sessionParentId}`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  Voir la session parente
                </Link>
              </p>
            </div>
          )}

          {/* Session reportée */}
          {trainingSession.sessionReporteeId !== null && (
            <div>
              <p className={infoLabelCls}>Reporte la session</p>
              <p className={infoValueCls}>
                <Link
                  href={`${base}/${trainingSession.sessionReporteeId}`}
                  className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                >
                  Voir la session d&apos;origine
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Cycle de vie ─────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Cycle de vie</h2>
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
          <SessionLifecycleButtons
            sessionId={id}
            statut={trainingSession.statut as TrainingSessionStatut}
          />
        </div>
      </section>

      {/* ── Navigation vers les sous-pages ──────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Sous-pages</h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
          <Link href={`${sessionBase}/emargement`} className={subLinkCls}>
            <span aria-hidden="true">📋</span>
            <span>Émargement</span>
          </Link>
          <Link href={`${sessionBase}/evaluations`} className={subLinkCls}>
            <span aria-hidden="true">📊</span>
            <span>Évaluations</span>
          </Link>
          <Link href={`${sessionBase}/financement`} className={subLinkCls}>
            <span aria-hidden="true">💶</span>
            <span>Financement</span>
          </Link>
        </div>
      </section>

      {/* SECTION: stagiaires */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E1 : Inscriptions + accès portail stagiaires
       * Implémenter : EnrollmentsSection (lister / inscrire / changer statut)
       * + GenererPortailAccesButton (+ revoquer) par stagiaire.
       * Câble : enrollTraineeAction, setEnrollmentStatutAction,
       *         genererPortailAccesAction, revoquerPortailAccesAction.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Stagiaires</h2>
        <div className="rounded-[var(--radius-admin-md)] border border-dashed border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Section Vague 2 — Cluster E1 : gestion des inscriptions + accès portail stagiaires.
          </p>
        </div>
      </section>

      {/* SECTION: documents */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E2 : Documents (14 types)
       * Implémenter : DocumentsSection — boutons appelant generer<X>Action
       * (convention, convocation, emargement, certificat_realisation, etc.)
       * regroupés par catégorie (session / pédagogie / financeurs).
       * Affiche les DocumentGenere existants + lien de téléchargement PDF.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Documents</h2>
        <div className="rounded-[var(--radius-admin-md)] border border-dashed border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Section Vague 2 — Cluster E2 : génération des 14 types de documents Qualiopi
            (convention, convocation, certificat de réalisation, etc.).
          </p>
        </div>
      </section>

      {/* SECTION: questionnaires */}
      {/*
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * VAGUE 2 — Cluster E3 : Questionnaires de satisfaction
       * Implémenter : QuestionnairesSection — générer les questionnaires
       * (genererQuestionnairesSessionAction) + saisir les réponses
       * (saisirReponsesQuestionnaireAction) par stagiaire.
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Questionnaires de satisfaction</h2>
        <div className="rounded-[var(--radius-admin-md)] border border-dashed border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Section Vague 2 — Cluster E3 : génération et saisie des questionnaires de satisfaction
            (indicateur Qualiopi 13).
          </p>
        </div>
      </section>
    </AdminPageShell>
  );
}
