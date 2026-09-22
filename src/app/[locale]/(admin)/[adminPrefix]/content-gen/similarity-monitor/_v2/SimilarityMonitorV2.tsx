// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Similarity monitor V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { PaireSimilaire } from "@/server/content-gen/paires-similaires";

interface Props {
  readonly adminPrefix: string;
  readonly paires: readonly PaireSimilaire[];
  /** Date ISO du dernier passage du worker, ou null si la clé n'existe pas. */
  readonly detecteLe: string | null;
}

function pourcentage(jaccard: number): string {
  return `${Math.round(jaccard * 100)} %`;
}

function dateLisible(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function SimilarityMonitorV2({ adminPrefix, paires, detecteLe }: Props): React.ReactElement {
  const quand = dateLisible(detecteLe);

  const columns: ReadonlyArray<AdminTableColumn<PaireSimilaire>> = [
    {
      key: "a",
      header: "Premier contenu",
      cell: (p) => (
        <Link href={`/fr/${adminPrefix}/content-gen/jobs/${p.jobIdA}`} className="admin-link">
          {p.titleA}
        </Link>
      ),
    },
    {
      key: "b",
      header: "Second contenu",
      cell: (p) => (
        <Link href={`/fr/${adminPrefix}/content-gen/jobs/${p.jobIdB}`} className="admin-link">
          {p.titleB}
        </Link>
      ),
    },
    {
      key: "ville",
      header: "Villes",
      cell: (p) => [p.anchorVilleA, p.anchorVilleB].filter(Boolean).join(" · ") || "—",
    },
    { key: "proximite", header: "Proximité", cell: (p) => pourcentage(p.jaccard) },
  ];

  return (
    <AdminPageShell>
      {/* 🔴 CETTE PAGE A ANNONCÉ PENDANT QUATRE MOIS que la comparaison « n'est
          pas encore active ». Elle l'était : le worker
          `content-similarity-monitor` écrit ses paires chaque nuit à 04:30 UTC,
          et la production en portait 57, écrites le 16/09. Le texte rassurant
          était le seul obstacle entre Will et un travail déjà fait.
          La page est en LECTURE SEULE : archiver, fusionner et ignorer ne sont
          pas branchés, et on ne met pas de bouton qui ne fait rien. */}
      <AdminPageHeader
        title="Détection de doublons"
        description="Deux protections agissent déjà AVANT la génération : aucune page identique n’est relancée, et un contenu trop proche d’un existant est refusé."
      />

      <AdminCard>
        <h2 className="admin-h2">Contenus publiés les plus proches</h2>
        <p className="admin-meta-block">
          Les titres des contenus publiés dans les 30 derniers jours sont comparés chaque nuit. Une
          paire apparaît ici lorsque la moitié au moins de leurs mots sont communs.
          {quand ? ` Dernière comparaison le ${quand}.` : ""} Cette page est en lecture seule : elle
          montre, elle ne modifie rien.
        </p>
        {paires.length === 0 ? (
          <AdminEmptyState title="Aucune paire de contenus trop proches." />
        ) : (
          <AdminTable
            columns={columns}
            rows={paires}
            getRowId={(p) => `${p.jobIdA}-${p.jobIdB}`}
            caption="Paires de contenus publiés dont les titres se ressemblent"
          />
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
