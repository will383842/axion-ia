/**
 * Admin — Qualiopi · Stagiaires (R10 audit E2E 2026-06-06).
 *
 * Liste des stagiaires (PII ; détail handicap chiffré jamais affiché ici).
 * Server Component force-dynamic.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listTrainees } from "@/server/qualiopi/trainees/trainees";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Stagiaires | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiStagiairesPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/stagiaires`;
  const trainees = await listTrainees();

  const handicap = trainees.filter((t) => t.situationHandicap).length;
  const consentis = trainees.filter((t) => t.consentementFormation).length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Stagiaires"
        description="PII protégées — le détail handicap est chiffré (AES-256-GCM) et n'est jamais affiché ici."
      />

      <div className="mb-[var(--space-admin-6)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <Link href={`${base}/new`} className="admin-button">
          + Nouveau stagiaire
        </Link>
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total" value={trainees.length} />
        <AdminStatCard label="Situation de handicap" value={handicap} />
        <AdminStatCard label="Consentement formation" value={consentis} tone="success" />
      </div>

      {trainees.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun stagiaire enregistré. Créez le premier avec « Nouveau stagiaire ».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>Email</th>
                <th className={headCls}>Entreprise</th>
                <th className={headCls}>Handicap</th>
                <th className={headCls}>Consent.</th>
                <th className={headCls}></th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    <div className="font-medium">
                      {t.prenom} {t.nom}
                    </div>
                  </td>
                  <td className={cellCls}>
                    <span className="text-[length:var(--text-admin-xs)]">{t.email}</span>
                  </td>
                  <td className={cellCls}>
                    {t.entreprise ?? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {t.situationHandicap ? (
                      <span className="text-[color:var(--color-admin-warning)]">● oui</span>
                    ) : (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">non</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {t.consentementFormation ? (
                      <span className="text-[color:var(--color-admin-success)]">●</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">○</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <Link
                      href={`${base}/${t.id}`}
                      className="text-[color:var(--color-admin-accent)] underline"
                    >
                      Gérer
                    </Link>
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
