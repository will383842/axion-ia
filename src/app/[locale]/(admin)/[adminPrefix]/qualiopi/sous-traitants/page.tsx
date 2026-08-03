/**
 * Admin — Qualiopi · Registre des sous-traitants OF (T12 / off.27).
 *
 * Liste les sous-traitants et expose le formulaire de création + vérification data.gouv.fr.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hash, CheckCircle2, ShieldCheck, FileText } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listSousTraitants } from "@/server/qualiopi/registres/sous-traitants-service";
import {
  creerSousTraitantAction,
  verifierSousTraitantOfAction,
} from "@/server/actions/qualiopi/sous-traitants";
import {
  SousTraitantForm,
  SousTraitantVerifButton,
  SousTraitantContratButton,
  ProcedureSousTraitanceButton,
} from "@/components/admin/qualiopi/SousTraitantForm";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import {
  genererContratSousTraitanceAction,
  genererProcedureSousTraitanceAction,
} from "@/server/actions/qualiopi/documents";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Sous-traitants | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiSousTraitantsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sousTraitants = await listSousTraitants({ take: 100 });
  const actifs = sousTraitants.filter((s) => s.actif).length;
  const verifiesDataGouv = sousTraitants.filter((s) => s.verifieDataGouvAt != null).length;
  const avecContrat = sousTraitants.filter((s) => s.contratSigneAt != null).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sous-traitants"
        description="Registre des sous-traitants OF (off.27 — indicateur 27). Prestataires auxquels l'OF délègue tout ou partie d'une formation. Consultation data.gouv.fr à attester par l’administrateur (le système ne vérifie pas automatiquement)."
        actions={
          <div className="flex flex-wrap items-start gap-[var(--space-admin-3)]">
            {/*
              La PROCÉDURE avant le registre : l'indicateur 27 attend une règle
              écrite ET la preuve qu'on l'applique. Le registre porte la seconde,
              cette pièce la première — et c'est elle que l'auditeur demande
              d'abord. Elle ne dépend d'aucun sous-traitant : elle vaut avant le
              premier recours.
            */}
            <ProcedureSousTraitanceButton genererAction={genererProcedureSousTraitanceAction} />
            <PdfExportButton
              label="Exporter le registre (PDF)"
              input={{ type: "sous_traitants" as const }}
              action={genererRegistrePdfAction}
            />
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={sousTraitants.length} icon={Hash} />
        <AdminStatCard
          label="Actifs"
          value={actifs}
          tone={actifs > 0 ? "success" : "default"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Consultation attestée"
          value={verifiesDataGouv}
          tone={
            actifs > 0 && verifiesDataGouv < actifs
              ? "warning"
              : verifiesDataGouv > 0
                ? "success"
                : "default"
          }
          icon={ShieldCheck}
        />
        <AdminStatCard label="Contrat signé" value={avecContrat} icon={FileText} />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <SousTraitantForm creerAction={creerSousTraitantAction} />
      </div>

      {/* Liste */}
      {sousTraitants.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun sous-traitant enregistré. Créez le premier via le formulaire ci-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>SIRET</th>
                <th className={headCls}>NDA</th>
                <th className={headCls}>Prestation</th>
                <th className={headCls}>Contrat</th>
                <th className={headCls}>Consult. data.gouv attestée</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sousTraitants.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <div className="font-medium">{s.nom}</div>
                  </td>
                  <td className={cellCls}>
                    {s.siret != null ? (
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        {s.siret}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {s.nda != null ? (
                      <span className="font-mono text-[length:var(--text-admin-xs)]">{s.nda}</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-warning)]">Manquant</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <div className="line-clamp-2 max-w-xs text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {s.objetPrestation}
                    </div>
                  </td>
                  <td className={cellCls}>
                    {s.contratSigneAt != null ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        {s.contratSigneAt.toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-warning)]">À signer</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {s.verifieDataGouvAt != null ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        {s.verifieDataGouvAt.toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-warning)]">Non vérifié</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {s.actif ? (
                      <span className="text-[color:var(--color-admin-success)]">Actif</span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Inactif</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {s.actif && (
                      <div className="flex flex-col gap-[var(--space-admin-2)]">
                        <SousTraitantVerifButton
                          sousTraitantId={s.id}
                          verifierAction={verifierSousTraitantOfAction}
                        />
                        <SousTraitantContratButton
                          sousTraitantId={s.id}
                          genererAction={genererContratSousTraitanceAction}
                        />
                      </div>
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
