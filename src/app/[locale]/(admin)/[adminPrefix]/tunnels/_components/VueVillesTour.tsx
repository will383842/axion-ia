// Corps visuel de la page « Villes du Tour France IA » (2026-10-29).
//
// Une ligne par ville : le nom, la jauge « n sur 5 » et, à 5 demandes comptées, « Ville ouverte ».
// Page SERVEUR, aucun composant client ; lecture seule, aucun bouton de geste.

import Link from "next/link";
import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/ui";
import { SEUIL_PAR_VILLE } from "@/features/tour-de-france/comptage";
import type { LigneVilleConsole } from "@/features/tour-de-france/lectures";

export interface PropsVueVillesTour {
  readonly adminPrefix: string;
  readonly villes: ReadonlyArray<LigneVilleConsole>;
}

export function JaugeVille({ n }: { n: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-[var(--space-admin-2)]">
      <progress
        value={Math.min(n, SEUIL_PAR_VILLE)}
        max={SEUIL_PAR_VILLE}
        aria-label={`${n} sur ${SEUIL_PAR_VILLE}`}
      />
      <span>
        {n} sur {SEUIL_PAR_VILLE}
      </span>
    </div>
  );
}

export function VueVillesTour({ adminPrefix, villes }: PropsVueVillesTour): React.ReactElement {
  const base = `/fr/${adminPrefix}/tunnels/tour`;

  const colonnes: ReadonlyArray<AdminTableColumn<LigneVilleConsole>> = [
    { key: "ville", header: "Ville", cell: (v) => <strong>{v.ville}</strong> },
    { key: "jauge", header: "Demandes comptées", cell: (v) => <JaugeVille n={v.comptees} /> },
    {
      key: "recues",
      header: "Demandes reçues",
      align: "right",
      hiddenBelow: "sm",
      cell: (v) => v.demandes.toLocaleString("fr-FR"),
    },
    {
      key: "ouverte",
      header: "Statut",
      cell: (v) =>
        v.comptees >= SEUIL_PAR_VILLE ? (
          <AdminBadge tone="success">Ville ouverte</AdminBadge>
        ) : (
          <span className="admin-meta">Pas encore</span>
        ),
    },
    {
      key: "fiche",
      header: "Fiche",
      cell: (v) => (
        <Link
          href={`${base}/villes/fiche?ville=${encodeURIComponent(v.villeCle)}`}
          className="admin-link"
        >
          Voir la ville
        </Link>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Villes du Tour France IA"
        description="Une ligne par ville : combien de demandes comptent, sur les 5 qui ouvrent la ville. La fiche d'une ville montre ses demandes et les réponses données à la visio."
        actions={
          <div className="flex gap-[var(--space-admin-2)]">
            <Link href={`${base}/demandes`} className="admin-button-ghost">
              Toutes les demandes
            </Link>
            <Link href={base} className="admin-button-ghost">
              Retour au tunnel
            </Link>
          </div>
        }
      />
      <AdminTable
        columns={colonnes}
        rows={villes}
        getRowId={(v) => v.villeCle}
        caption="Villes du Tour France IA"
        emptyState={<p className="admin-meta">Aucune demande pour le moment.</p>}
      />
    </>
  );
}
