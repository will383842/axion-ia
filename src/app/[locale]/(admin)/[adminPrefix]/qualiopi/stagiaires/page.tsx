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
import { AdminBadge } from "@/components/admin/ui";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listTrainees } from "@/server/qualiopi/trainees/trainees";
import { Hash, Accessibility, ShieldCheck } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui";

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
        description="Les données personnelles sont protégées : la nature du handicap est chiffrée en base et n'apparaît jamais sur cet écran."
      />

      <div className="mb-[var(--space-admin-6)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <Link href={`${base}/new`} className="admin-button">
          + Nouveau stagiaire
        </Link>
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total" value={trainees.length} icon={Hash} />
        <AdminStatCard label="Situation de handicap" value={handicap} icon={Accessibility} />
        <AdminStatCard
          label="Consentement formation"
          value={consentis}
          tone="success"
          icon={ShieldCheck}
        />
      </div>

      {trainees.length === 0 ? (
        <AdminEmptyState
          title="Aucun stagiaire enregistré"
          description="Les stagiaires s'inscrivent ensuite à une session depuis le dossier de celle-ci."
          primaryAction={
            <Link href={`${base}/new`} className="admin-button">
              + Nouveau stagiaire
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>Email</th>
                <th className={headCls}>Entreprise</th>
                <th className={headCls}>Handicap</th>
                <th className={headCls}>Consentement</th>
                {/* En-tête vide sur la colonne d'actions : le tableau annonçait
                    six colonnes et n'en nommait que cinq. */}
                <th className={headCls}>Actions</th>
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
                      <AdminBadge tone="warning" dot>
                        Oui
                      </AdminBadge>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                    )}
                  </td>
                  {/* 🔴 CETTE COLONNE NE PORTAIT QUE « ● » ou « ○ » — aucun
                      texte, aucune infobulle, aucun nom accessible. Vérifié
                      dans le DOM en production : la cellule ne contenait
                      littéralement que le caractère. L'information était portée
                      par la COULEUR SEULE : illisible en vision des couleurs
                      déficiente, muette pour un lecteur d'écran, et ambiguë
                      même à l'œil — un rond vert ne dit pas si le consentement
                      est donné ou attendu. Sur une donnée qui engage
                      juridiquement, c'est le pire endroit pour deviner. */}
                  <td className={cellCls}>
                    {t.consentementFormation ? (
                      <AdminBadge tone="success" dot>
                        Donné
                      </AdminBadge>
                    ) : (
                      <AdminBadge tone="neutral" dot>
                        Non recueilli
                      </AdminBadge>
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
