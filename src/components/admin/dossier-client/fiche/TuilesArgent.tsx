/**
 * Trois tuiles d'argent de l'onglet « Devis et factures » (lot B7). Affichage seul, aucune écriture.
 * « Reste à encaisser » = l'encours EXISTANT (`calculerEncoursDuCents`, TTC), jamais recalculé ici.
 */

import { CircleDollarSign, FileText, Wallet } from "lucide-react";

import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { htEtTtc } from "./montants";
import {
  dateCourte,
  estFactureOuverte,
  dejaFactureCents,
  devisEnAttente,
  montantHt,
  montantTtc,
  montantTtcNonRenseigne,
  resteDuNetCents,
  resteMelangeHtTtc,
  type FacturePourArgent,
} from "@/features/dossier-client/fiche/argent-de-la-fiche";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { dayKeyInParis } from "@/lib/calendar-grid";

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
  const dues = factures.filter(
    (f) => f.avoirDeId === null && estFactureOuverte(f.statut) && resteDuNetCents(f) > 0,
  );
  const echeances = dues
    .filter((f) => f.echeanceAt !== null)
    .map((f) => (f.echeanceAt as Date).getTime());
  const plusAncienne = echeances.length > 0 ? new Date(Math.min(...echeances)) : null;
  const enRetard = plusAncienne !== null && dayKeyInParis(plusAncienne) < dayKeyInParis(new Date());
  const echeanceTexte = plusAncienne
    ? ` · ${enRetard ? "en retard depuis le" : "à payer avant le"} ${dateCourte(plusAncienne)}`
    : "";
  // Même périmètre que l'encours (toutes les factures ouvertes) : une facture ouverte sans TTC, même trop
  // payée, rend le total HT/TTC mêlé.
  const ouvertes = factures.filter((f) => f.avoirDeId === null && estFactureOuverte(f.statut));
  const nbMelange = ouvertes.filter(resteMelangeHtTtc).length;
  const sansTtc = nbMelange > 0;
  const pluriel = nbMelange > 1 ? "s" : "";
  const tvaTexte = sansTtc
    ? `TVA incluse sauf sur ${nbMelange} facture${pluriel} sans TTC`
    : "TVA incluse";
  // Sans TTC sur une facture ouverte, le total mêle HT et TTC : on ne l'étiquette pas TTC.
  const somme = (c: number): string => (sansTtc ? montantTtcNonRenseigne(c) : montantTtc(c));
  const encoursPositif = encoursDuCents > 0;
  const duCents = dues.reduce((acc, f) => acc + resteDuNetCents(f), 0);
  const nbDues = dues.length;
  const tropPercus = ouvertes.filter((f) => resteDuNetCents(f) < 0);
  const tropPercuCents = tropPercus.reduce((acc, f) => acc - resteDuNetCents(f), 0);
  // Les restes se compensent : un trop-perçu sur une facture ne solde pas une autre facture encore due.
  const encoreDuTexte =
    !encoursPositif && nbDues > 0
      ? `${somme(duCents)} encore dus sur ${nbDues} facture${nbDues > 1 ? "s" : ""}${
          tropPercus.length > 0
            ? ` · trop-perçu de ${somme(tropPercuCents)} sur ${tropPercus.length} autre${tropPercus.length > 1 ? "s" : ""}`
            : ""
        }`
      : null;

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
        value={
          encoursDuCents < 0 ? `Trop-perçu : ${somme(-encoursDuCents)}` : somme(encoursDuCents)
        }
        meta={
          encoursPositif
            ? `Encours dû, ${tvaTexte}${echeanceTexte}`
            : encoreDuTexte
              ? `${encoreDuTexte}${echeanceTexte}`
              : "Encours dû : rien"
        }
        tone={encoursPositif || encoreDuTexte ? "warning" : "success"}
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
