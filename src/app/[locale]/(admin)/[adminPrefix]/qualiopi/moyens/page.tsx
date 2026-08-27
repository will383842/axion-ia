/**
 * Admin — Qualiopi · Inventaire des moyens pédagogiques (LOT 2 / off.17-19, doc A14).
 *
 * Liste les moyens par catégorie (salles, matériel, plateformes, humains) +
 * formulaire de création + édition/toggle actif + génération du PDF officiel.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 */

import type { Metadata } from "next";
import { CheckCircle2, Hash, MonitorSmartphone, Warehouse } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listMoyens } from "@/server/qualiopi/moyens/moyens-service";
import {
  creerMoyenAction,
  updateMoyenAction,
  setMoyenActifAction,
} from "@/server/actions/qualiopi/moyens";
import { MoyenForm } from "@/components/admin/qualiopi/MoyenForm";
import { MoyenRowActions } from "@/components/admin/qualiopi/MoyenRowActions";
import { GenererInventaireMoyensButton } from "@/components/admin/qualiopi/GenererInventaireMoyensButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Moyens pédagogiques | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const CATEGORIE_LABELS: Record<string, string> = {
  salle: "Salles et locaux",
  materiel: "Matériel",
  plateforme: "Plateformes et outils numériques",
  humain: "Moyens humains",
};

const CATEGORIE_ORDER = ["salle", "materiel", "plateforme", "humain"] as const;

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiMoyensPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const moyens = await listMoyens({ take: 500 });

  const actifs = moyens.filter((m) => m.actif);
  const verifies = actifs.filter((m) => m.dateVerification != null).length;
  const techniques = actifs.filter((m) => m.categorie !== "humain").length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Moyens pédagogiques"
        description="Inventaire des moyens humains, techniques et pédagogiques (off.17/18/19 — doc A14). Renseignez la date de vérification : un moyen jamais vérifié ne prouve pas l'adéquation à l'audit."
        actions={<GenererInventaireMoyensButton />}
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total inventaire" value={moyens.length} icon={Hash} />
        <AdminStatCard label="Actifs" value={actifs.length} icon={Warehouse} />
        <AdminStatCard
          label="Actifs vérifiés"
          value={verifies}
          tone={verifies < actifs.length ? "warning" : "success"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Moyens techniques actifs"
          value={techniques}
          icon={MonitorSmartphone}
        />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <MoyenForm creerAction={creerMoyenAction} />
      </div>

      {/* Liste par catégorie */}
      {moyens.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucun moyen pédagogique. Créez le premier via le formulaire ci-dessus.
        </p>
      ) : (
        CATEGORIE_ORDER.map((categorie) => {
          const moyensCategorie = moyens.filter((m) => m.categorie === categorie);
          if (moyensCategorie.length === 0) return null;
          return (
            <section key={categorie} className="mb-[var(--space-admin-8)]">
              <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                {CATEGORIE_LABELS[categorie] ?? categorie}{" "}
                <span className="text-[length:var(--text-admin-xs)] font-normal text-[color:var(--color-admin-fg-muted)]">
                  ({moyensCategorie.length})
                </span>
              </h2>
              <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
                <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
                  <thead className="border-b border-[color:var(--color-admin-border)]">
                    <tr>
                      <th className={headCls}>Libellé</th>
                      <th className={headCls}>Description</th>
                      <th className={headCls}>Localisation</th>
                      <th className={headCls}>Vérifié le</th>
                      <th className={headCls}>Statut</th>
                      <th className={headCls}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moyensCategorie.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                      >
                        <td className={cellCls}>
                          <span className="font-medium">{m.libelle}</span>
                        </td>
                        <td className={cellCls}>
                          {m.description ? (
                            <span
                              className="line-clamp-2 max-w-sm text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                              title={m.description ?? ""}
                            >
                              {m.description}
                            </span>
                          ) : (
                            <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                          )}
                        </td>
                        <td className={cellCls}>
                          {m.localisation ? (
                            <span className="text-[length:var(--text-admin-xs)]">
                              {m.localisation}
                            </span>
                          ) : (
                            <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                          )}
                        </td>
                        <td className={cellCls}>
                          {m.dateVerification != null ? (
                            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
                              {m.dateVerification.toLocaleDateString("fr-FR")}
                            </span>
                          ) : (
                            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                              Non vérifié
                            </span>
                          )}
                        </td>
                        <td className={cellCls}>
                          {m.actif ? (
                            <span className="text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-success)]">
                              Actif
                            </span>
                          ) : (
                            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                              Retiré
                            </span>
                          )}
                        </td>
                        <td className={cellCls}>
                          <MoyenRowActions
                            moyen={{
                              id: m.id,
                              categorie: m.categorie,
                              libelle: m.libelle,
                              description: m.description,
                              localisation: m.localisation,
                              actif: m.actif,
                              dateVerification: m.dateVerification,
                            }}
                            updateAction={updateMoyenAction}
                            setActifAction={setMoyenActifAction}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </AdminPageShell>
  );
}
