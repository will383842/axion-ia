/**
 * Admin — Qualiopi · Référentiel OPCO versionné (Lot 5).
 *
 * Barèmes de prise en charge OPCO centralisés et versionnés : source de
 * pré-remplissage / d'estimation quand aucune valeur n'est saisie sur le dossier
 * (le barème dossier reste prioritaire). Chaque relevé crée une NOUVELLE version ;
 * l'historique est conservé, les dossiers engagés gardent leur barème snapshoté.
 *
 * Server Component — auth + lecture DB. Mutations via composants clients.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Layers, AlertTriangle, CheckCircle2 } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { listBaremesEnVigueur } from "@/server/qualiopi/financements/bareme-opco";
import {
  OPCO_IDS,
  opcoLabel,
  estBaremePerime,
} from "@/server/qualiopi/financements/opco-referentiel";
import {
  creerVersionBaremeOpcoAction,
  supprimerBaremeOpcoAction,
} from "@/server/actions/qualiopi/baremes-opco";
import { BaremeOpcoForm } from "@/components/admin/qualiopi/BaremeOpcoForm";
import { BaremeOpcoRowActions } from "@/components/admin/qualiopi/BaremeOpcoRowActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Barèmes OPCO | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Centimes → « 12,34 € » ou « — » si null. */
function euros(cents: number | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiBaremesOpcoPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const now = new Date();
  const [enVigueur, moisValiditeRaw, historique] = await Promise.all([
    listBaremesEnVigueur(now),
    getQualiopiConfig("bareme_opco_validite_mois").catch(() => 12),
    prisma.baremeOpco
      .findMany({ orderBy: [{ opco: "asc" }, { dateEffet: "desc" }], take: 500 })
      .catch(() => []),
  ]);
  const moisValidite =
    typeof moisValiditeRaw === "number" && moisValiditeRaw > 0 ? moisValiditeRaw : 12;

  const nbOpcoCouverts = enVigueur.length;
  const nbPerimes = enVigueur.filter((b) => estBaremePerime(b.releveLe, moisValidite, now)).length;

  const opcoOptions = OPCO_IDS.map((id) => ({ id, label: opcoLabel(id) }));

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Barèmes OPCO"
        // Le seuil est réglable (bareme_opco_validite_mois) : écrit en dur,
        // la description annonçait 12 mois même quand la console disait 6.
        description={`Référentiel centralisé et versionné des plafonds de prise en charge OPCO. Sert de pré-remplissage et d'estimation quand aucun barème n'est saisi sur le dossier — le barème dossier reste prioritaire. Les valeurs sont relevées sur les portails OPCO (jamais inventées) ; un relevé de plus de ${moisValidite} mois lève une alerte.`}
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="OPCO couverts"
          value={`${nbOpcoCouverts} / ${OPCO_IDS.length}`}
          icon={Layers}
        />
        <AdminStatCard
          label="Barèmes à rafraîchir"
          value={nbPerimes}
          tone={nbPerimes > 0 ? "warning" : "success"}
          icon={nbPerimes > 0 ? AlertTriangle : CheckCircle2}
        />
        {/* 🔴 « Versions archivées » comptait `historique.length` — un findMany
            SANS FILTRE : il incluait donc les barèmes EN VIGUEUR, affichés dans
            la tuile voisine. Le même barème était compté deux fois, une fois
            comme actif et une fois comme archivé. */}
        <AdminStatCard
          label="Versions archivées"
          value={historique.filter((b) => b.effectiveTo !== null).length}
          icon={Layers}
        />
      </div>

      {/* Formulaire relevé */}
      <div className="mb-[var(--space-admin-8)]">
        <BaremeOpcoForm creerAction={creerVersionBaremeOpcoAction} opcoOptions={opcoOptions} />
      </div>

      {/* Barèmes en vigueur */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Barèmes en vigueur
      </h2>
      {enVigueur.length === 0 ? (
        <p className="mb-[var(--space-admin-8)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun barème en vigueur. Relevez un premier barème via le formulaire ci-dessus. En
          l&apos;absence de barème, l&apos;estimation OPCO utilise les plafonds Atlas par défaut.
        </p>
      ) : (
        <div className="mb-[var(--space-admin-8)] overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>OPCO</th>
                <th className={headCls}>Intra €/h</th>
                <th className={headCls}>Inter prés. €/h</th>
                <th className={headCls}>Inter dist. €/h</th>
                <th className={headCls}>Plaf. formation</th>
                <th className={headCls}>Plaf. annuel</th>
                <th className={headCls}>Relevé le</th>
                <th className={headCls}>Effet</th>
              </tr>
            </thead>
            <tbody>
              {enVigueur.map((b) => {
                const perime = estBaremePerime(b.releveLe, moisValidite, now);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    <td className={cellCls}>
                      <span className="font-medium">{opcoLabel(b.opco)}</span>
                      {b.perimetre ? (
                        <span className="mt-1 block max-w-xs text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          {b.perimetre}
                        </span>
                      ) : null}
                    </td>
                    <td className={cellCls}>{euros(b.intraHoraireCents)}</td>
                    <td className={cellCls}>{euros(b.interPresentielCents)}</td>
                    <td className={cellCls}>{euros(b.interDistancielCents)}</td>
                    <td className={cellCls}>{euros(b.plafondFormationCents)}</td>
                    <td className={cellCls}>{euros(b.plafondAnnuelCents)}</td>
                    <td className={cellCls}>
                      {b.releveLe ? (
                        <span className={perime ? "text-[color:var(--color-admin-warning)]" : ""}>
                          {b.releveLe.toLocaleDateString("fr-FR")}
                          {perime ? " (à rafraîchir)" : ""}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-warning)]">non daté</span>
                      )}
                    </td>
                    <td className={cellCls}>{b.dateEffet.toLocaleDateString("fr-FR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Historique complet */}
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        Historique des versions
      </h2>
      {historique.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune version enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>OPCO</th>
                <th className={headCls}>Effet</th>
                <th className={headCls}>Fin</th>
                <th className={headCls}>Intra €/h</th>
                <th className={headCls}>Inter prés.</th>
                <th className={headCls}>Inter dist.</th>
                <th className={headCls}>Plaf. annuel</th>
                <th className={headCls}>Relevé</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>{opcoLabel(b.opco)}</td>
                  <td className={cellCls}>{b.dateEffet.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>
                    {b.effectiveTo ? (
                      b.effectiveTo.toLocaleDateString("fr-FR")
                    ) : (
                      <span className="text-[color:var(--color-admin-success)]">en vigueur</span>
                    )}
                  </td>
                  <td className={cellCls}>{euros(b.intraHoraireCents)}</td>
                  <td className={cellCls}>{euros(b.interPresentielCents)}</td>
                  <td className={cellCls}>{euros(b.interDistancielCents)}</td>
                  <td className={cellCls}>{euros(b.plafondAnnuelCents)}</td>
                  <td className={cellCls}>
                    {b.releveLe ? b.releveLe.toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className={cellCls}>
                    <BaremeOpcoRowActions id={b.id} supprimerAction={supprimerBaremeOpcoAction} />
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
