/**
 * Admin — Qualiopi · Registre des réclamations (T12 / off.31).
 *
 * Liste les réclamations et expose le formulaire de création + réponse.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { Hash, Bell, Hourglass, CheckCircle2 } from "lucide-react";
import { listReclamations } from "@/server/qualiopi/registres/reclamations-service";
import {
  creerReclamationAction,
  repondreReclamationAction,
  setStatutReclamationAction,
} from "@/server/actions/qualiopi/reclamations";
import {
  ReclamationForm,
  ReclamationReponseForm,
} from "@/components/admin/qualiopi/ReclamationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Réclamations | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const SOURCE_LABELS: Record<string, string> = {
  stagiaire: "Stagiaire",
  client: "Client",
  financeur: "Financeur",
  autre: "Autre",
};

const STATUT_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  resolue: "Résolue",
  cloturee: "Clôturée",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiReclamationsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const reclamations = await listReclamations({ take: 100 });
  const nouvelles = reclamations.filter((r) => r.statut === "nouvelle").length;
  const enCours = reclamations.filter((r) => r.statut === "en_cours").length;
  const resolues = reclamations.filter(
    (r) => r.statut === "resolue" || r.statut === "cloturee",
  ).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Réclamations"
        description="Registre des réclamations (off.31 — indicateur 31). Alerte si sans réponse > J+15. Toute réclamation doit être enregistrée et traitée."
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={reclamations.length} icon={Hash} />
        <AdminStatCard
          label="Nouvelles"
          value={nouvelles}
          tone={nouvelles > 0 ? "warning" : "default"}
          icon={Bell}
        />
        <AdminStatCard
          label="En cours"
          value={enCours}
          tone={enCours > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
        <AdminStatCard label="Résolues / clôturées" value={resolues} tone="success" icon={CheckCircle2} />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <ReclamationForm creerAction={creerReclamationAction} />
      </div>

      {/* Liste */}
      {reclamations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune réclamation enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Réclamant</th>
                <th className={headCls}>Origine</th>
                <th className={headCls}>Objet</th>
                <th className={headCls}>Reçue le</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Répondu le</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reclamations.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{r.numero}</span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">{r.reclamantNom}</div>
                    {r.reclamantEmail && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {r.reclamantEmail}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className={cellCls}>
                    <div className="max-w-xs">{r.objet}</div>
                    {r.gravite && (
                      <span
                        className={
                          r.gravite === "critique"
                            ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
                            : r.gravite === "majeure"
                              ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]"
                              : "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                        }
                      >
                        {r.gravite}
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>{r.dateReception.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>
                    <span
                      className={
                        r.statut === "resolue" || r.statut === "cloturee"
                          ? "text-[color:var(--color-admin-success)]"
                          : r.statut === "nouvelle" || r.statut === "en_cours"
                            ? "text-[color:var(--color-admin-warning)]"
                            : "text-[color:var(--color-admin-fg-muted)]"
                      }
                    >
                      {STATUT_LABELS[r.statut] ?? r.statut}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {r.dateReponse != null ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        {r.dateReponse.toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {r.statut !== "cloturee" && (
                      <ReclamationReponseForm
                        reclamationId={r.id}
                        statutActuel={r.statut}
                        repondreAction={repondreReclamationAction}
                        setStatutAction={setStatutReclamationAction}
                      />
                    )}
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
