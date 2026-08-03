/**
 * Admin — Qualiopi · Entrées récentes (Lot 3 : pont appel/contact → CRM).
 *
 * Tableau unifié des derniers appels Calendly (/appel) + messages contact
 * (/contact & formulaires). Chaque ligne est annotée du client CRM existant
 * (match email citext) : badge « Client AXI-CLI-NNN » si converti/existant,
 * sinon bouton « Convertir en client » (formulaire pré-rempli 1 clic), puis
 * lien « Créer un devis » (clientId pré-sélectionné sur /qualiopi/devis/new).
 *
 * Server Component force-dynamic. Authentification admin/super_admin.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ConvertirEntreeForm } from "@/components/admin/qualiopi/ConvertirEntreeForm";
import { listEntreesRecentes } from "@/server/qualiopi/crm/entrees";
import { Inbox, PhoneCall, MailOpen, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Entrées récentes | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiEntreesPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const entrees = await listEntreesRecentes({ limit: 50 });

  const appels = entrees.filter((e) => e.source === "calendly").length;
  const messages = entrees.filter((e) => e.source === "submission").length;
  const dejaClients = entrees.filter((e) => e.clientExistant !== null).length;

  const base = `/${locale}/${adminPrefix}`;
  const devisNewPath = `${base}/qualiopi/devis/new`;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Entrées récentes"
        description="Appels Calendly et messages contact fusionnés — convertissez un lead en client CRM en 1 clic (qualification humaine conservée), puis créez le devis."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Entrées" value={entrees.length} icon={Inbox} />
        <AdminStatCard label="Appels Calendly" value={appels} icon={PhoneCall} />
        <AdminStatCard label="Messages contact" value={messages} icon={MailOpen} />
        <AdminStatCard label="Déjà clients" value={dejaClients} tone="success" icon={UserCheck} />
      </div>

      {entrees.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune entrée récente — les appels réservés sur /appel et les messages /contact
          apparaîtront ici.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Type</th>
                <th className={headCls}>Date</th>
                <th className={headCls}>Nom / Société</th>
                <th className={headCls}>Email</th>
                <th className={headCls}>Extrait</th>
                <th className={headCls}>CRM</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((entree) => (
                <tr
                  key={`${entree.source}-${entree.id}`}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    {entree.source === "calendly" ? (
                      <span className="inline-flex items-center gap-[var(--space-admin-1)] whitespace-nowrap">
                        <PhoneCall
                          size={16}
                          className="shrink-0 text-[color:var(--color-admin-accent)]"
                          aria-hidden
                        />
                        Appel Calendly
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-[var(--space-admin-1)] whitespace-nowrap">
                        <MailOpen
                          size={16}
                          className="shrink-0 text-[color:var(--color-admin-fg-muted)]"
                          aria-hidden
                        />
                        Message contact
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)] whitespace-nowrap">
                      {DATE_FMT.format(entree.date)}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">
                      {entree.nom ?? (
                        <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                      )}
                    </div>
                    {entree.societe && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {entree.societe}
                      </div>
                    )}
                    {entree.telephone && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {entree.telephone}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    {entree.email ?? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span className="block max-w-xs text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                      {entree.extrait ?? "—"}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {entree.clientExistant ? (
                      <div className="flex flex-col gap-[var(--space-admin-1)]">
                        <Link
                          href={`${base}/qualiopi/clients`}
                          className="inline-flex w-fit items-center rounded-full border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)] hover:bg-[color:var(--color-admin-bg)]"
                          title={entree.clientExistant.raisonSociale}
                        >
                          Client {entree.clientExistant.numero}
                        </Link>
                        <Link
                          href={`${devisNewPath}?clientId=${encodeURIComponent(entree.clientExistant.id)}`}
                          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
                        >
                          Créer un devis →
                        </Link>
                      </div>
                    ) : (
                      <ConvertirEntreeForm
                        source={entree.source}
                        entreeId={entree.id}
                        defaults={{
                          raisonSociale: entree.societe ?? entree.nom ?? "",
                          contactNom: entree.nom ?? "",
                          contactEmail: entree.email ?? "",
                          contactTelephone: entree.telephone ?? "",
                        }}
                        devisNewPath={devisNewPath}
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
