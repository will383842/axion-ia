/**
 * Admin — Qualiopi · Fiche d'un audit IA.
 *
 * Montre l'audit et permet de gérer formateur, statut et acompte.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AuditManagePanel } from "@/components/admin/qualiopi/AuditManagePanel";
import { getAuditMission } from "@/server/qualiopi/audits/audit-missions-queries";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { libellerStatutOpco } from "@/server/qualiopi/financements/labels";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Audit IA | Axion-IA Admin",
  robots: { index: false, follow: false },
};

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** `Date` (colonne DATE, minuit UTC) → `YYYY-MM-DD` pour un `<input type=date>`. */
function toDateInput(d: Date | null): string {
  if (d === null) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function AuditDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const [audit, trainers] = await Promise.all([
    getAuditMission(id),
    listTrainers({ actifOnly: true }),
  ]);
  if (audit === null) notFound();

  const base = `/${locale}/${adminPrefix}/qualiopi/audits`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Audit — ${audit.titre}`}
        description={`${audit.numero} · ${audit.clientNom ?? "sans client"} · ${euros(audit.montantHtCents)} HT`}
      />

      <Link href={base} className="admin-link">
        ← Retour aux audits
      </Link>

      <AdminCard>
        <h2 className="admin-h2">Détails</h2>
        <dl className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
          <div>
            <dt className="admin-muted">Dates</dt>
            <dd>
              {audit.dateDebut.toLocaleDateString("fr-FR")} →{" "}
              {audit.dateFin.toLocaleDateString("fr-FR")}
            </dd>
          </div>
          <div>
            <dt className="admin-muted">Formateur</dt>
            <dd>{audit.formateurNom ?? "— non affecté —"}</dd>
          </div>
          <div>
            <dt className="admin-muted">Montant HT</dt>
            <dd className="tabular-nums">{euros(audit.montantHtCents)}</dd>
          </div>
          <div>
            <dt className="admin-muted">Acompte</dt>
            <dd>
              {audit.acompteRecu
                ? `Reçu${audit.acompteMontantCents !== null ? ` — ${euros(audit.acompteMontantCents)}` : ""}${audit.acompteMoyen !== null ? ` (${audit.acompteMoyen})` : ""}`
                : "Aucun"}
            </dd>
          </div>
          <div>
            <dt className="admin-muted">OPCO</dt>
            <dd>{libellerStatutOpco(audit.opcoStatut)}</dd>
          </div>
          <div>
            <dt className="admin-muted">Ville</dt>
            <dd>{audit.lieuVille ?? "—"}</dd>
          </div>
        </dl>
      </AdminCard>

      <AuditManagePanel
        auditId={audit.id}
        currentFormateurId={audit.formateurId}
        currentStatut={audit.statut}
        trainers={trainers.map((t) => ({ id: t.id, label: `${t.prenom} ${t.nom}`.trim() }))}
        acompte={{
          montantCents: audit.acompteMontantCents,
          dateVersement: toDateInput(audit.acompteDateVersement),
          recu: audit.acompteRecu,
          moyen: audit.acompteMoyen ?? "",
        }}
      />
    </AdminPageShell>
  );
}
