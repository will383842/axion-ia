/**
 * Admin — Qualiopi · CRM Devis (T2).
 *
 * Liste tous les devis avec montant HT, financement, statut et validité.
 * Server Component force-dynamic. Authentification admin/super_admin.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listDevis } from "@/server/qualiopi/crm/devis";
import { listClients } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Devis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  transforme_convention: "→ Convention",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
};

/** Formate un montant en centimes vers "1 234,56 €" (FR). */
function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Formate une date en "JJ/MM/AAAA" (FR). */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiDevisPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const [devisList, clients] = await Promise.all([listDevis(), listClients()]);

  // Index clients par id pour affichage rapide
  const clientIndex = new Map(clients.map((c) => [c.id, c.raisonSociale]));

  const brouillons = devisList.filter((d) => d.statut === "brouillon").length;
  const envoyes = devisList.filter((d) => d.statut === "envoye").length;
  const acceptes = devisList.filter((d) => d.statut === "accepte").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Devis"
        description="Devis commerciaux formation — montants HT, financement OPCO estimé, statut."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={devisList.length} />
        <AdminStatCard label="Brouillons" value={brouillons} />
        <AdminStatCard label="Envoyés" value={envoyes} tone="warning" />
        <AdminStatCard label="Acceptés" value={acceptes} tone="success" />
      </div>

      {devisList.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun devis. Créez votre premier devis depuis l&apos;action CRM.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Client</th>
                <th className={headCls}>Montant HT</th>
                <th className={headCls}>Financement</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Validité</th>
              </tr>
            </thead>
            <tbody>
              {devisList.map((devis) => {
                const isExpired =
                  devis.statut === "brouillon" || devis.statut === "envoye"
                    ? devis.dateValidite < new Date()
                    : false;

                return (
                  <tr
                    key={devis.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className={cellCls}>
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        {devis.numero}
                      </span>
                    </td>
                    <td className={cellCls}>
                      {clientIndex.get(devis.clientId) ?? (
                        <em className="text-[color:var(--color-admin-fg-muted)] not-italic">
                          Client introuvable
                        </em>
                      )}
                    </td>
                    <td className={cellCls}>
                      <span className="tabular-nums">{formatEur(devis.montantTotalHtCents)}</span>
                      {devis.montantOpcoEstimeCents !== null &&
                        devis.montantOpcoEstimeCents !== undefined && (
                          <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            OPCO : {formatEur(devis.montantOpcoEstimeCents)}
                          </div>
                        )}
                    </td>
                    <td className={cellCls}>
                      {devis.financementSuggere ? (
                        (FINANCEMENT_LABELS[devis.financementSuggere] ?? devis.financementSuggere)
                      ) : (
                        <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                      )}
                    </td>
                    <td className={cellCls}>
                      {devis.statut === "accepte" ? (
                        <span className="text-[color:var(--color-admin-success)]">
                          ● {STATUT_LABELS[devis.statut] ?? devis.statut}
                        </span>
                      ) : devis.statut === "refuse" || devis.statut === "expire" ? (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          ✕ {STATUT_LABELS[devis.statut] ?? devis.statut}
                        </span>
                      ) : devis.statut === "envoye" ? (
                        <span className="text-[color:var(--color-admin-warning)]">
                          ◑ {STATUT_LABELS[devis.statut] ?? devis.statut}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          ○ {STATUT_LABELS[devis.statut] ?? devis.statut}
                        </span>
                      )}
                    </td>
                    <td className={cellCls}>
                      <span
                        className={
                          isExpired
                            ? "text-[color:var(--color-admin-warning)]"
                            : "text-[color:var(--color-admin-fg-soft)]"
                        }
                      >
                        {formatDate(devis.dateValidite)}
                        {isExpired && (
                          <span className="ml-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
                            (expiré)
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
