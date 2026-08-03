/**
 * Admin — Qualiopi · Missions d'audit IA.
 *
 * Liste les audits + formulaire de création. Un audit est le 3ᵉ type de
 * prestation (à côté des formations et des coachings) : affectable à un
 * formateur, visible au calendrier, rémunéré par le run mensuel.
 *
 * Server Component : auth + lecture DB. Création via composant client.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AuditCreatePanel } from "@/components/admin/qualiopi/AuditCreatePanel";
import {
  listAuditMissions,
  listClientOptions,
} from "@/server/qualiopi/audits/audit-missions-queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Audits IA | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABEL: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiAuditsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const [audits, clients] = await Promise.all([listAuditMissions(), listClientOptions()]);
  const base = `/${locale}/${adminPrefix}/qualiopi/audits`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Audits IA"
        description="Missions d'audit vendues aux clients. Affectables à un formateur et rémunérées comme les formations."
      />

      <AuditCreatePanel clients={clients} />

      <AdminCard>
        <h2 className="admin-h2">Audits ({audits.length})</h2>
        {audits.length === 0 ? (
          <AdminEmptyState
            title="Aucun audit"
            description="Créez le premier avec le formulaire ci-dessus."
          />
        ) : (
          <table className="admin-table mt-[var(--space-admin-3)]">
            <thead>
              <tr>
                <th scope="col">Numéro</th>
                <th scope="col">Titre</th>
                <th scope="col">Client</th>
                <th scope="col">Formateur</th>
                <th scope="col">Dates</th>
                <th scope="col" className="text-right">
                  Montant HT
                </th>
                <th scope="col">Statut</th>
                <th scope="col">Acompte</th>
                <th scope="col">
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td className="tabular-nums">{a.numero}</td>
                  <td>{a.titre}</td>
                  <td>{a.clientNom ?? "—"}</td>
                  <td>{a.formateurNom ?? "— non affecté —"}</td>
                  <td className="tabular-nums">
                    {a.dateDebut.toLocaleDateString("fr-FR")}
                    {a.dateFin.getTime() !== a.dateDebut.getTime() &&
                      ` → ${a.dateFin.toLocaleDateString("fr-FR")}`}
                  </td>
                  <td className="text-right tabular-nums">{euros(a.montantHtCents)}</td>
                  <td>
                    <AdminBadge tone="neutral">{STATUT_LABEL[a.statut] ?? a.statut}</AdminBadge>
                  </td>
                  <td>{a.acompteRecu ? "Reçu" : "Non reçu"}</td>
                  <td>
                    <Link href={`${base}/${a.id}`} className="admin-button-ghost">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
