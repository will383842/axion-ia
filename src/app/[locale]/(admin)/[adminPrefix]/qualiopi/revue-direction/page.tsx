/**
 * Admin — Qualiopi · Revue de direction (T12 / off.32 — indicateur 32).
 *
 * Liste les revues annuelles et expose le formulaire de création.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText, CheckCircle2, CalendarDays } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listRevues } from "@/server/qualiopi/registres/revue-direction-service";
import {
  creerRevueDirectionAction,
  updateRevueDirectionAction,
} from "@/server/actions/qualiopi/revue-direction";
import { RevueDirectionForm } from "@/components/admin/qualiopi/RevueDirectionForm";
import { RevueDirectionRowActions } from "@/components/admin/qualiopi/RevueDirectionRowActions";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Revue de direction | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
  archivee: "Archivée",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiRevueDirectionPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const revues = await listRevues();
  const validees = revues.filter((r) => r.statut === "validee").length;
  const brouillons = revues.filter((r) => r.statut === "brouillon").length;
  const anneesCouvertes = revues.map((r) => r.annee);
  const currentYear = new Date().getFullYear();
  const revueAnneeEnCours = anneesCouvertes.includes(currentYear);

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Revue de direction"
        description="Revue de direction annuelle (off.32 — indicateur 32, NC majeure). Snapshot indicateurs de l'année + décisions + plan d'actions. Une revue par année civile."
        actions={
          <PdfExportButton
            label="Exporter les revues (PDF)"
            input={{ type: "revue_direction" as const }}
            action={genererRegistrePdfAction}
          />
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total revues" value={revues.length} icon={FileText} />
        <AdminStatCard
          label="Validées"
          value={validees}
          tone={validees > 0 ? "success" : "default"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label={`Revue ${currentYear}`}
          value={revueAnneeEnCours ? "Créée" : "Manquante"}
          tone={revueAnneeEnCours ? "success" : "warning"}
          icon={CalendarDays}
        />
      </div>

      {/* Alerte revue manquante */}
      {!revueAnneeEnCours && (
        <div className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
            Aucune revue de direction pour {currentYear}. Indicateur 32 (NC majeure) non couvert.
          </p>
        </div>
      )}

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <RevueDirectionForm creerAction={creerRevueDirectionAction} />
      </div>

      {/* Liste */}
      {revues.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune revue de direction enregistrée. Créez la première via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Année</th>
                <th className={headCls}>Date de la revue</th>
                <th className={headCls}>Participants</th>
                <th className={headCls}>Décisions</th>
                <th className={headCls}>Plan d&apos;actions</th>
                <th className={headCls}>Snapshot indicateurs</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {revues.map((r) => {
                const participants = Array.isArray(r.participants) ? r.participants.length : 0;
                const decisions = Array.isArray(r.decisions) ? r.decisions.length : 0;
                const planActions = Array.isArray(r.planActions) ? r.planActions.length : 0;
                const hasSnapshot =
                  r.indicateursSnapshot != null &&
                  typeof r.indicateursSnapshot === "object" &&
                  Object.keys(r.indicateursSnapshot as object).length > 0;

                return (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    <td className={cellCls}>
                      <span className="text-[length:var(--text-admin-base)] font-semibold">
                        {r.annee}
                      </span>
                    </td>
                    <td className={cellCls}>{r.dateRevue.toLocaleDateString("fr-FR")}</td>
                    <td className={cellCls}>
                      {participants > 0 ? (
                        <span>{participants} participant(s)</span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>
                    <td className={cellCls}>
                      {decisions > 0 ? (
                        <span className="text-[color:var(--color-admin-success)]">
                          {decisions} décision(s)
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-warning)]">0 décision</span>
                      )}
                    </td>
                    <td className={cellCls}>
                      {planActions > 0 ? (
                        <span className="text-[color:var(--color-admin-success)]">
                          {planActions} action(s)
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-warning)]">0 action</span>
                      )}
                    </td>
                    <td className={cellCls}>
                      {hasSnapshot ? (
                        <span className="text-[color:var(--color-admin-success)]">Présent</span>
                      ) : (
                        <span className="text-[color:var(--color-admin-warning)]">Vide</span>
                      )}
                    </td>
                    <td className={cellCls}>
                      <span
                        className={
                          r.statut === "validee"
                            ? "text-[color:var(--color-admin-success)]"
                            : r.statut === "brouillon"
                              ? "text-[color:var(--color-admin-warning)]"
                              : "text-[color:var(--color-admin-fg-muted)]"
                        }
                      >
                        {STATUT_LABELS[r.statut] ?? r.statut}
                      </span>
                    </td>
                    <td className={cellCls}>
                      <RevueDirectionRowActions
                        revue={{
                          id: r.id,
                          dateRevue: r.dateRevue,
                          statut: r.statut,
                          decisions: Array.isArray(r.decisions) ? (r.decisions as unknown[]) : [],
                          planActions: Array.isArray(r.planActions)
                            ? (r.planActions as unknown[])
                            : [],
                        }}
                        updateAction={updateRevueDirectionAction}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {brouillons > 0 && (
            <p className="border-t border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
              {brouillons} revue(s) en brouillon — à valider pour couvrir l&apos;indicateur 32.
            </p>
          )}
        </div>
      )}
    </AdminPageShell>
  );
}
