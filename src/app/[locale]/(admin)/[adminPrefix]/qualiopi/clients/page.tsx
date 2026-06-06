/**
 * Admin — Qualiopi · CRM Clients (T2).
 *
 * Liste les clients/prospects CRM avec statut et OPCO inféré.
 * Server Component force-dynamic. Authentification admin/super_admin.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listClients } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Clients | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  prospect: "Prospect",
  devis_envoye: "Devis envoyé",
  client_actif: "Client actif",
  client_inactif: "Client inactif",
  perdu: "Perdu",
};

const OPCO_LABELS: Record<string, string> = {
  atlas: "Atlas",
  akto: "Akto",
  opcommerce: "Opcommerce",
  opco2i: "OPCO 2i",
  constructys: "Constructys",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiClientsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const clients = await listClients();

  const prospects = clients.filter((c) => c.statut === "prospect").length;
  const actifs = clients.filter((c) => c.statut === "client_actif").length;
  const devisEnvoyes = clients.filter((c) => c.statut === "devis_envoye").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Clients / Prospects"
        description="CRM organisme de formation — suivi des clients, OPCO inféré depuis le code NAF."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={clients.length} />
        <AdminStatCard label="Prospects" value={prospects} />
        <AdminStatCard label="Devis envoyés" value={devisEnvoyes} tone="warning" />
        <AdminStatCard label="Clients actifs" value={actifs} tone="success" />
      </div>

      {clients.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun client enregistré. Créez votre premier client depuis l&apos;action CRM.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Raison sociale</th>
                <th className={headCls}>SIRET</th>
                <th className={headCls}>NAF</th>
                <th className={headCls}>OPCO inféré</th>
                <th className={headCls}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {client.numero}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">{client.raisonSociale}</div>
                    {client.contactEmail && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {client.contactEmail}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {client.siret ?? (
                        <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                      )}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {client.nafCode ?? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.opcoIdentifie ? (
                      (OPCO_LABELS[client.opcoIdentifie] ?? client.opcoIdentifie)
                    ) : (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">
                        À déterminer
                      </em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.statut === "client_actif" ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : client.statut === "prospect" ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : client.statut === "devis_envoye" ? (
                      <span className="text-[color:var(--color-admin-warning)]">
                        ◑ {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        {STATUT_LABELS[client.statut] ?? client.statut}
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
