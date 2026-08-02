/**
 * Admin — Qualiopi · Formateurs (R9 audit E2E 2026-06-06).
 *
 * Liste des formateurs (salariés / sous-traitants) avec habilitations, statut
 * de vérification sous-traitant et état actif. Server Component force-dynamic.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Handshake, Hash, Users } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { GenererListeFormateursButton } from "@/components/admin/qualiopi/GenererListeFormateursButton";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Formateurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  salarie: "Salarié",
  sous_traitant: "Sous-traitant",
  dirigeant: "Dirigeant-formateur",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiFormateursPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const trainers = await listTrainers();

  // « Internes » = salariés + dirigeant-formateur (l'OF anime lui-même).
  const salaries = trainers.filter(
    (t) => t.statut === "salarie" || t.statut === "dirigeant",
  ).length;
  const sousTraitants = trainers.filter((t) => t.statut === "sous_traitant").length;
  const sousTraitantsAVerifier = trainers.filter(
    (t) => t.statut === "sous_traitant" && !t.sousTraitantVerifieAt,
  ).length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Formateurs"
        description="Salariés, dirigeant-formateur et sous-traitants, habilitations par formation, vérification data.gouv.fr (off.6/19)."
        actions={<GenererListeFormateursButton />}
      />

      <div className="mb-[var(--space-admin-6)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <Link href={`${base}/new`} className="admin-button">
          + Nouveau formateur
        </Link>
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={trainers.length} icon={Hash} />
        <AdminStatCard label="Internes (salariés/dirigeant)" value={salaries} icon={Users} />
        <AdminStatCard label="Sous-traitants" value={sousTraitants} icon={Handshake} />
        <AdminStatCard
          label="Sous-traitants à vérifier"
          value={sousTraitantsAVerifier}
          tone={sousTraitantsAVerifier > 0 ? "warning" : "success"}
          icon={AlertTriangle}
        />
      </div>

      {trainers.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun formateur enregistré. Créez le premier avec « Nouveau formateur ».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>Email</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Habilitations</th>
                <th className={headCls}>Vérifié</th>
                <th className={headCls}>Actif</th>
                <th className={headCls}></th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
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
                  <td className={cellCls}>{STATUT_LABELS[t.statut] ?? t.statut}</td>
                  {/* Nombre RÉEL d'habilitations (table TrainerHabilitation), pas la
                      longueur de la colonne legacy : celle-ci contenait des slugs d'un
                      catalogue archivé et affichait un compte que la garde d'assignation
                      contredisait. Cf. audit certification 2026-07-25 (F11). */}
                  <td className={cellCls}>{t.nbHabilitations}</td>
                  <td className={cellCls}>
                    {t.statut !== "sous_traitant" ? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    ) : t.sousTraitantVerifieAt ? (
                      <span className="text-[color:var(--color-admin-success)]">● oui</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-warning)]">○ non</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {t.actif ? (
                      <span className="text-[color:var(--color-admin-success)]">● actif</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">○ inactif</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <Link href={`${base}/${t.id}`} className="admin-button-ghost">
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
