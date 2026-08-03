/**
 * Admin — Qualiopi · Demandes RGPD (T19 / off. RGPD portail).
 *
 * Liste les demandes RGPD (modèle `RgpdDemande`) créées depuis le portail
 * stagiaire via demanderExportRgpdAction / demanderSuppressionRgpdAction
 * (cf. src/server/actions/qualiopi/portail.ts). Les demandes « demandee »
 * (en attente) sont traitables par l'admin via traiterDemandeRgpdAction :
 *   - export      → JSON complet des données du stagiaire (téléchargé côté client) ;
 *   - suppression → soft-delete + anonymisation PII (art.17§3b CGI/RGPD).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Hourglass, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { traiterDemandeRgpdAction } from "@/server/actions/qualiopi/appreciations";
import { RgpdDemandeActions } from "@/components/admin/qualiopi/RgpdDemandeActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Demandes RGPD | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TYPE_LABELS: Record<string, string> = {
  export: "Export des données",
  suppression: "Suppression / anonymisation",
};

const STATUT_LABELS: Record<string, string> = {
  demandee: "En attente",
  traitee: "Traitée",
  refusee: "Refusée",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiRgpdPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // Lecture stub-safe : au build (stub.invalid) la requête renvoie [].
  let demandes: Array<{
    id: string;
    type: "export" | "suppression";
    statut: "demandee" | "traitee" | "refusee";
    demandeAt: Date;
    traiteeAt: Date | null;
    note: string | null;
    trainee: { nom: string; prenom: string; email: string } | null;
  }> = [];
  try {
    demandes = await prisma.rgpdDemande.findMany({
      orderBy: [{ statut: "asc" }, { demandeAt: "desc" }],
      take: 200,
      select: {
        id: true,
        type: true,
        statut: true,
        demandeAt: true,
        traiteeAt: true,
        note: true,
        trainee: { select: { nom: true, prenom: true, email: true } },
      },
    });
  } catch {
    demandes = [];
  }

  const enAttente = demandes.filter((d) => d.statut === "demandee").length;
  const traitees = demandes.filter((d) => d.statut === "traitee").length;
  const suppressions = demandes.filter(
    (d) => d.type === "suppression" && d.statut === "demandee",
  ).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  function fmtDate(d: Date): string {
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Demandes RGPD"
        description="Demandes d'export et de suppression émises par les stagiaires depuis leur portail. Le traitement effectif génère l'export JSON (téléchargé) ou anonymise les données (soft-delete, jamais de suppression physique)."
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="En attente"
          value={enAttente}
          tone={enAttente > 0 ? "warning" : "success"}
          icon={Hourglass}
        />
        <AdminStatCard label="Traitées" value={traitees} tone="success" icon={CheckCircle2} />
        <AdminStatCard
          label="Suppressions à traiter"
          value={suppressions}
          tone={suppressions > 0 ? "warning" : "default"}
          icon={Trash2}
        />
      </div>

      {demandes.length === 0 ? (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-6)] py-[var(--space-admin-8)] text-center">
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
            Aucune demande RGPD. Les demandes apparaissent ici lorsqu&apos;un stagiaire en émet une
            depuis son portail.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Stagiaire</th>
                <th className={headCls}>Type</th>
                <th className={headCls}>Demandée le</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    {d.trainee != null ? (
                      <>
                        <div className="font-medium">
                          {d.trainee.prenom} {d.trainee.nom}
                        </div>
                        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          {d.trainee.email}
                        </div>
                      </>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        Stagiaire supprimé
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span
                      className={
                        d.type === "suppression"
                          ? "text-[color:var(--color-admin-error)]"
                          : "text-[color:var(--color-admin-fg)]"
                      }
                    >
                      {TYPE_LABELS[d.type] ?? d.type}
                    </span>
                  </td>
                  <td className={cellCls}>{fmtDate(d.demandeAt)}</td>
                  <td className={cellCls}>
                    <span
                      className={
                        d.statut === "demandee"
                          ? "text-[color:var(--color-admin-warning)]"
                          : d.statut === "traitee"
                            ? "text-[color:var(--color-admin-success)]"
                            : "text-[color:var(--color-admin-fg-muted)]"
                      }
                    >
                      {STATUT_LABELS[d.statut] ?? d.statut}
                    </span>
                    {d.statut === "traitee" && d.traiteeAt != null && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {fmtDate(d.traiteeAt)}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    {d.statut === "demandee" ? (
                      <RgpdDemandeActions
                        demandeId={d.id}
                        type={d.type}
                        traiterAction={traiterDemandeRgpdAction}
                      />
                    ) : (
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        —
                      </span>
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
