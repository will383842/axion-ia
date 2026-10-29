/**
 * Trois tuiles d'argent de l'onglet « Devis et factures » (lot B7). Affichage seul, aucune écriture.
 * « Reste à encaisser » = l'encours EXISTANT (`calculerEncoursDuCents`, TTC), jamais recalculé ici.
 */

import { CircleDollarSign, FileText, Wallet } from "lucide-react";

import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { htEtTtc } from "./montants";
import {
  dateCourte,
  dejaFactureCents,
  devisEnAttente,
  montantHt,
  montantTtc,
  type FacturePourArgent,
} from "@/features/dossier-client/fiche/argent-de-la-fiche";
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";
import { formatDateFrShort } from "@/lib/format-date-fr";

type FactureAvecEcheance = FacturePourArgent & { echeanceAt: Date | null };

export function TuilesArgent({
  encoursDuCents,
  factures,
  devis,
  devisPlafonnes,
  factureHorsConsoleLe,
}: {
  encoursDuCents: number;
  factures: readonly FactureAvecEcheance[];
  devis: ReadonlyArray<{ statut: string; montantTotalHtCents: number }>;
  /** La lecture ne rapporte que les derniers devis : le dire plutôt que d'afficher un total faux. */
  devisPlafonnes: boolean;
  factureHorsConsoleLe: Date | null;
}): React.ReactElement {
  const deja = dejaFactureCents(factures);
  const attente = devisEnAttente(devis);
  const echeances = factures
    .filter((f) => f.avoirDeId === null && estFactureOuverte(f.statut) && f.echeanceAt !== null)
    .map((f) => (f.echeanceAt as Date).getTime());
  const avant = echeances.length > 0 ? dateCourte(new Date(Math.min(...echeances))) : null;

  const metaDeja = [
    deja.nbSansTtc > 0
      ? `TTC non renseigné sur ${deja.nbSansTtc} pièce${deja.nbSansTtc > 1 ? "s" : ""}`
      : `${montantTtc(deja.ttcCents)} (TVA incluse)`,
    factureHorsConsoleLe
      ? `facture établie hors console le ${formatDateFrShort(factureHorsConsoleLe)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
      <AdminStatCard
        label="Déjà facturé"
        value={montantHt(deja.htCents)}
        meta={metaDeja}
        icon={CircleDollarSign}
      />
      <AdminStatCard
        label="Reste à encaisser"
        value={montantTtc(encoursDuCents)}
        meta={
          encoursDuCents > 0
            ? `Encours dû, TVA incluse${avant ? ` · à payer avant le ${avant}` : ""}`
            : "Encours dû : rien"
        }
        tone={encoursDuCents > 0 ? "warning" : "success"}
        icon={Wallet}
      />
      <AdminStatCard
        label="Devis en attente"
        value={attente.nombre}
        meta={
          attente.nombre > 0
            ? `${htEtTtc(attente.htCents).ht} · ${htEtTtc(attente.htCents).ttc}${devisPlafonnes ? " · sur les 10 derniers devis" : ""}`
            : devisPlafonnes
              ? "Aucun parmi les 10 derniers devis"
              : "Aucun devis envoyé en attente de réponse"
        }
        tone={attente.nombre > 0 ? "info" : "default"}
        icon={FileText}
      />
    </div>
  );
}
