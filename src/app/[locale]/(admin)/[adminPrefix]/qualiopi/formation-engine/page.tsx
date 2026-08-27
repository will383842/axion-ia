/**
 * Admin — Qualiopi · Formation Engine (T4) — Dashboard.
 *
 * Liste les formations en cours de génération avec :
 *   - statutGeneration + étape courante
 *   - coût cumulé (FormationGenerationJob agrégé)
 *   - nombre de validations en attente
 *   - lien vers la queue des validations
 *
 * Miroir du pattern qualiopi/formations/page.tsx :
 *   auth, AdminPageShell, AdminStatCard, force-dynamic, noindex.
 * Server Component pur — aucun client bundle.
 */

import type { Metadata } from "next";
import { GraduationCap, Hourglass, Coins } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { BatchGenerationButton } from "@/components/admin/qualiopi/BatchGenerationButton";
import { enqueueBatchGenerationAction } from "@/server/actions/qualiopi/engine";
import { prisma } from "@/lib/prisma";
import { ETAPE_GENERATION_LABELS } from "@/server/qualiopi/formation-engine/labels";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Formation Engine | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const GENERATION_LABELS = ETAPE_GENERATION_LABELS;

/** Couleur admin selon l'étape */
function statutColor(statut: string): string {
  if (statut === "publie") return "text-[color:var(--color-admin-success)]";
  if (statut === "archive") return "text-[color:var(--color-admin-fg-muted)]";
  if (statut === "contenu_genere" || statut === "assemble")
    return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-fg)]";
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function FormationEngineDashboardPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // Formations actives en génération (hors publiées et archivées)
  let formations: Array<{
    id: string;
    numero: string;
    titre: string;
    statutGeneration: string;
    coutCumuleUsd: number;
    nbValidationsEnAttente: number;
  }> = [];
  let lectureEchouee = false;

  try {
    const rows = await prisma.formation.findMany({
      where: { statut: { not: "archive" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        numero: true,
        titre: true,
        statutGeneration: true,
        generationJobs: {
          select: { coutUsd: true },
        },
        fileValidations: {
          where: { statut: "en_attente" },
          select: { id: true },
        },
      },
    });

    formations = rows.map((f) => ({
      id: f.id,
      numero: f.numero,
      titre: f.titre,
      statutGeneration: f.statutGeneration,
      coutCumuleUsd: f.generationJobs.reduce((acc, j) => acc + Number(j.coutUsd), 0),
      nbValidationsEnAttente: f.fileValidations.length,
    }));
  } catch {
    // Stub-aware : dégradé silencieux au build.
    //
    // 🔴 MAIS PAS SILENCIEUX À L'ÉCRAN. Ce `catch` avale aussi bien la panne de
    // lecture en production que le stub de build : dans les deux cas la page
    // affichait « Aucune formation. Créez une formation depuis le catalogue » —
    // un incident présenté comme un catalogue vide, et une invitation à
    // recréer ce qui existe déjà.
    lectureEchouee = true;
  }

  const enCours = formations.filter(
    (f) => f.statutGeneration !== "publie" && f.statutGeneration !== "archive",
  ).length;
  const validationsEnAttente = formations.reduce((acc, f) => acc + f.nbValidationsEnAttente, 0);
  const coutTotal = formations.reduce((acc, f) => acc + f.coutCumuleUsd, 0);

  // Les trois tuiles ne portent que sur les lignes chargées (take: 100) : on le
  // dit, plutôt que de laisser croire à un total.
  const plafondAtteint = formations.length === 100;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Formation Engine"
        description="Pipeline de génération IA des formations Qualiopi. Suivez le statut de chaque formation, les coûts d'inférence et les validations humaines en attente (AI Act art. 50)."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="Formations en cours"
          value={enCours}
          tone="default"
          icon={GraduationCap}
        />
        <AdminStatCard
          label="Validations en attente"
          value={validationsEnAttente}
          tone={validationsEnAttente > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
        <AdminStatCard
          label="Coût IA cumulé (USD)"
          value={`$${coutTotal.toFixed(4)}`}
          tone="default"
          icon={Coins}
        />
      </div>

      {plafondAtteint ? (
        <p className="admin-meta-small mb-[var(--space-admin-5)]">
          Ces trois chiffres portent sur les 100 formations les plus récemment modifiées.
        </p>
      ) : null}

      {/* Génération en lot — lance le catalogue relançable (ex. les 17) en un clic */}
      <div className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-4)]">
        <h2 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
          Génération en lot
        </h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Enfile la génération IA de toutes les formations relançables (intention, structure
          générée, contenu évalué). N&apos;affecte jamais les formations en attente de validation
          humaine ou déjà publiées.
        </p>
        <BatchGenerationButton limite={20} enqueueAction={enqueueBatchGenerationAction} />
      </div>

      {validationsEnAttente > 0 && (
        <div className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-subtle,theme(colors.amber.50))] px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
            {validationsEnAttente} validation{validationsEnAttente > 1 ? "s" : ""} en attente —{" "}
            <a
              href={`/${locale}/${adminPrefix}/qualiopi/formation-engine/validations`}
              className="underline hover:no-underline"
            >
              Voir la file de validation
            </a>
          </p>
        </div>
      )}

      {lectureEchouee ? (
        <p role="alert" className="admin-alert admin-alert-error">
          Les formations n&apos;ont pas pu être chargées. Ce n&apos;est pas un catalogue vide :
          réessayez dans un instant, et prévenez l&apos;équipe technique si cela persiste.
        </p>
      ) : formations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune formation. Créez une formation depuis le catalogue, puis lancez la génération.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Statut génération</th>
                <th className={headCls}>Coût IA (USD)</th>
                <th className={headCls}>Validations</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{f.numero}</span>
                  </td>
                  <td className={cellCls}>
                    {/* Le numéro métier (AXI-FORM-2026-XXX) est déjà affiché dans la
                        colonne « Numéro » — un fragment d'UUID technique en plus
                        n'apportait rien (audit UX), il est retiré plutôt que traduit. */}
                    <div className="font-medium">{f.titre}</div>
                  </td>
                  <td className={cellCls}>
                    <span className={statutColor(f.statutGeneration)}>
                      {GENERATION_LABELS[f.statutGeneration] ?? f.statutGeneration}
                    </span>
                  </td>
                  <td className={cellCls}>
                    <span className="font-mono">${f.coutCumuleUsd.toFixed(4)}</span>
                  </td>
                  <td className={cellCls}>
                    {f.nbValidationsEnAttente > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[color:var(--color-admin-warning)]">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-admin-warning)]"
                        />
                        {f.nbValidationsEnAttente} en attente
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
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
