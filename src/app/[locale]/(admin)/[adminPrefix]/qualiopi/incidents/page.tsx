/**
 * Admin — Qualiopi · Registre des incidents (LOT 4 — pilotage réel).
 *
 * Liste des incidents (pédagogiques/administratifs/techniques) + déclaration,
 * édition inline, suppression et export PDF (6e registre). Les incidents et
 * leurs actions correctives alimentent M7/M9 du pilotage.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, CircleDot, CheckCircle2, Hash } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listIncidents } from "@/server/qualiopi/registres/incidents-service";
import {
  creerIncidentAction,
  updateIncidentAction,
  supprimerIncidentAction,
} from "@/server/actions/qualiopi/incidents";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import { IncidentForm } from "@/components/admin/qualiopi/IncidentForm";
import { IncidentRowActions } from "@/components/admin/qualiopi/IncidentRowActions";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Registre des incidents | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TYPE_LABELS: Record<string, string> = {
  pedagogique: "Pédagogique",
  administratif: "Administratif",
  technique: "Technique",
  autre: "Autre",
};

const GRAVITE_LABELS: Record<string, string> = {
  mineur: "Mineur",
  majeur: "Majeur",
  critique: "Critique",
};

const STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiIncidentsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const [incidents, sessionsRecentes] = await Promise.all([
    listIncidents({ take: 500 }),
    // Sessions récentes proposées pour rattacher un incident (12 mois glissants).
    prisma.trainingSession.findMany({
      where: {
        dateDebut: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, numero: true, titreSession: true },
      orderBy: { dateDebut: "desc" },
      take: 100,
    }),
  ]);

  const ouverts = incidents.filter((i) => i.statut !== "resolu").length;
  const critiques = incidents.filter((i) => i.gravite === "critique").length;
  const avecAction = incidents.filter((i) => i.actionCorrective.trim().length > 0).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Registre des incidents"
        description="Incidents pédagogiques, administratifs et techniques + actions correctives (amélioration continue). Alimente les métriques M7 (incidents) et M9 (actions correctives) du pilotage — remplace les proxys sessions annulées/réclamations seules."
        actions={
          <PdfExportButton
            label="Exporter le registre (PDF)"
            input={{ type: "incidents" as const }}
            action={genererRegistrePdfAction}
          />
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total incidents" value={incidents.length} icon={Hash} />
        <AdminStatCard
          label="Ouverts / en cours"
          value={ouverts}
          tone={ouverts > 0 ? "warning" : "success"}
          icon={CircleDot}
        />
        <AdminStatCard
          label="Critiques"
          value={critiques}
          tone={critiques > 0 ? "destructive" : "success"}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Avec action corrective"
          value={avecAction}
          tone={avecAction < incidents.length ? "warning" : "success"}
          icon={CheckCircle2}
        />
      </div>

      {/* Formulaire déclaration */}
      <div className="mb-[var(--space-admin-8)]">
        <IncidentForm creerAction={creerIncidentAction} sessions={sessionsRecentes} />
      </div>

      {/* Liste */}
      {incidents.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun incident enregistré. Déclarez le premier via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Date</th>
                <th className={headCls}>Type</th>
                <th className={headCls}>Gravité</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Session</th>
                <th className={headCls}>Action corrective</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>{i.dateIncident.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>{TYPE_LABELS[i.type] ?? i.type}</td>
                  <td className={cellCls}>
                    <span
                      className={
                        i.gravite === "critique"
                          ? "font-semibold text-[color:var(--color-admin-error)]"
                          : i.gravite === "majeur"
                            ? "text-[color:var(--color-admin-warning)]"
                            : "text-[color:var(--color-admin-fg-soft)]"
                      }
                    >
                      {GRAVITE_LABELS[i.gravite] ?? i.gravite}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <span className="font-medium">{i.titre}</span>
                    {i.description ? (
                      <span className="mt-1 line-clamp-2 block max-w-sm text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {i.description}
                      </span>
                    ) : null}
                  </td>
                  <td className={cellCls}>
                    {i.session ? (
                      <span className="text-[length:var(--text-admin-xs)]">{i.session.numero}</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {i.actionCorrective.trim() ? (
                      <span className="line-clamp-2 max-w-xs text-[length:var(--text-admin-xs)]">
                        {i.actionCorrective}
                      </span>
                    ) : (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                        À définir
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span
                      className={
                        i.statut === "resolu"
                          ? "text-[color:var(--color-admin-success)]"
                          : i.statut === "en_cours"
                            ? "text-[color:var(--color-admin-warning)]"
                            : "text-[color:var(--color-admin-error)]"
                      }
                    >
                      {STATUT_LABELS[i.statut] ?? i.statut}
                    </span>
                    {i.resoluAt ? (
                      <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        le {i.resoluAt.toLocaleDateString("fr-FR")}
                      </span>
                    ) : null}
                  </td>
                  <td className={cellCls}>
                    <IncidentRowActions
                      incident={{
                        id: i.id,
                        type: i.type,
                        gravite: i.gravite,
                        statut: i.statut,
                        titre: i.titre,
                        description: i.description,
                        actionCorrective: i.actionCorrective,
                        dateIncident: i.dateIncident,
                      }}
                      updateAction={updateIncidentAction}
                      supprimerAction={supprimerIncidentAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
