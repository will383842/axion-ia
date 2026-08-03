// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Similarity monitor V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

export function SimilarityMonitorV2(): React.ReactElement {
  return (
    <AdminPageShell>
      {/* 🔴 CETTE PAGE MONTRAIT SON PLAN DE DÉVELOPPEMENT à qui l'ouvrait :
          « § 25.5 couche C v1.7 », « arrivent Sprint 4 », le nom d'une table
          Prisma, un chemin de fichier source, et des backticks Markdown rendus
          littéralement. Trois cartes pour dire qu'il n'y a rien à voir. Elle
          reste dans la navigation — la protection anti-doublon EXISTE en amont
          de la génération —, mais elle dit ce qu'elle fait, pas comment elle
          sera écrite. */}
      <AdminPageHeader
        title="Détection de doublons"
        description="Deux protections agissent déjà AVANT la génération : aucune page identique n’est relancée, et un contenu trop proche d’un existant est refusé."
      />

      <AdminCard>
        <h2 className="admin-h2">Surveillance des contenus publiés</h2>
        <p className="admin-meta-block">
          La comparaison des contenus DÉJÀ publiés entre eux n’est pas encore active. Quand elle le
          sera, les paires les plus proches apparaîtront ici, avec de quoi archiver, fusionner ou
          ignorer chaque paire.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
