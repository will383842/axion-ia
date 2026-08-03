/**
 * Admin — Qualiopi · Registre des partenariats (T12 / off.25).
 *
 * Liste les partenariats et expose le formulaire de création.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listPartenariats } from "@/server/qualiopi/registres/partenariats-service";
import {
  creerPartenariatAction,
  updatePartenariatAction,
} from "@/server/actions/qualiopi/partenariats";
import { PartenariatForm } from "@/components/admin/qualiopi/PartenariatForm";
import { PartenariatRowActions } from "@/components/admin/qualiopi/PartenariatRowActions";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { Hash, CheckCircle2, Handshake } from "lucide-react";
import { libellerTypePartenariat } from "@/server/qualiopi/partenariats/labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Partenariats | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiPartenariatsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const partenariats = await listPartenariats({ take: 100 });
  const actifs = partenariats.filter((p) => p.actif).length;
  const inactifs = partenariats.filter((p) => !p.actif).length;
  const handicap = partenariats.filter((p) => p.type === "reseau_handicap" && p.actif).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Partenariats"
        description="Réseau de partenaires Qualiopi (off.25 — indicateur 25), dont partenaires réseau handicap. Traçabilité des conventions de partenariat actives."
        actions={
          <PdfExportButton
            label="Exporter le registre (PDF)"
            input={{ type: "partenariats" as const }}
            action={genererRegistrePdfAction}
          />
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total" value={partenariats.length} icon={Hash} />
        <AdminStatCard
          label="Actifs"
          value={actifs}
          tone={actifs > 0 ? "success" : "default"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Réseau handicap actifs"
          value={handicap}
          tone={handicap > 0 ? "success" : "warning"}
          icon={Handshake}
        />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <PartenariatForm creerAction={creerPartenariatAction} />
      </div>

      {/* Liste */}
      {partenariats.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun partenariat enregistré. Créez le premier via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>Type</th>
                <th className={headCls}>Objet</th>
                <th className={headCls}>Début</th>
                <th className={headCls}>Fin</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partenariats.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <div className="font-medium">{p.nom}</div>
                  </td>
                  <td className={cellCls}>
                    {/* 🔴 Affichait la valeur brute — « reseau_handicap »,
                        « co_traitance » — alors que les deux formulaires de la
                        même page traduisent ces valeurs dans leurs `<option>`.
                        La table vit désormais dans un module partagé. */}
                    <span className="text-[length:var(--text-admin-xs)] font-medium">
                      {libellerTypePartenariat(p.type)}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <div
                      className="line-clamp-2 max-w-xs text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                      title={p.objet ?? ""}
                    >
                      {p.objet}
                    </div>
                  </td>
                  <td className={cellCls}>{p.dateDebut.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>
                    {p.dateFin != null ? (
                      p.dateFin.toLocaleDateString("fr-FR")
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">En cours</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {p.actif ? (
                      <span className="text-[color:var(--color-admin-success)]">Actif</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Inactif</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <PartenariatRowActions
                      partenariat={{
                        id: p.id,
                        nom: p.nom,
                        type: p.type,
                        objet: p.objet,
                        dateDebut: p.dateDebut,
                        dateFin: p.dateFin ?? null,
                        actif: p.actif,
                      }}
                      updateAction={updatePartenariatAction}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inactifs > 0 && (
            <p className="border-t border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {inactifs} partenariat{inactifs > 1 ? "s" : ""} inactif{inactifs > 1 ? "s" : ""}{" "}
              inclus dans la liste.
            </p>
          )}
        </div>
      )}
    </AdminPageShell>
  );
}
