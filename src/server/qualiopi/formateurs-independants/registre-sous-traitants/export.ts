/**
 * Qualiopi ind. 27 — EXPORT du registre des sous-traitants indépendants, en CSV et en
 * PDF, avec la date d'export en pied. Même lecture que l'écran (`lecture.ts`).
 *
 * Le PDF (`export-pdf.ts`) reprend ces colonnes et ces cellules.
 */

import { csvEscape } from "@/lib/csv";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import { PIECES_REGISTRE } from "./controles.config";
import { lireRegistre, type LigneRegistreLue } from "./lecture";
import type { EtatPiece, StatutRegistre } from "./regles";

export const jour = (d: Date | null): string =>
  d === null ? "" : d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

export const LIBELLES_STATUT_REGISTRE: Readonly<Record<StatutRegistre, string>> = {
  actif: "Actif",
  suspendu: "Suspendu",
  sorti: "Sorti",
};

export function libellePiece(p: EtatPiece): string {
  switch (p.etat) {
    case "non_exigee":
      return "Non exigée";
    case "absente":
      return "Absente";
    case "expiree":
      return p.echeance === null ? "Expirée" : `Expirée le ${jour(p.echeance)}`;
    case "a_echeance":
      return `À renouveler avant le ${jour(p.echeance)}`;
    case "valide":
      return p.echeance === null ? "Valide" : `Valide jusqu'au ${jour(p.echeance)}`;
  }
}

export const COLONNES_REGISTRE = [
  "Raison sociale",
  "SIRET",
  "NDA",
  "Formations habilitées",
  "Date d'entrée",
  ...PIECES_REGISTRE.map((p) => p.libelle),
  "Dernier contrôle",
  "Prochaine échéance",
  "Statut",
  "Date de sortie",
  "Motif de sortie",
];

export function cellulesRegistre(l: LigneRegistreLue): string[] {
  return [
    l.raisonSociale,
    l.siret ?? "",
    l.nda ?? "",
    l.formationsHabilitees,
    jour(l.dateEntree),
    ...PIECES_REGISTRE.map((p) => {
      const e = l.pieces.find((x) => x.code === p.code);
      return e === undefined ? "" : libellePiece(e);
    }),
    jour(l.dernierControleAt),
    jour(l.prochaineEcheance),
    LIBELLES_STATUT_REGISTRE[l.statut],
    jour(l.dateSortie),
    l.motifSortie ?? "",
  ];
}

export function mentionExport(maintenant: Date): string {
  return `Exporté le ${jour(maintenant)} — registre des sous-traitants formateurs indépendants, tenu par l'outil (indicateur 27). Aucune ligne n'est jamais supprimée : une sortie est datée et motivée.`;
}

export async function exportRegistreCsv(maintenant: Date): Promise<string> {
  const lignes = await lireRegistre(maintenant);
  return [
    COLONNES_REGISTRE.map(csvEscape).join(";"),
    ...lignes.map((l) => cellulesRegistre(l).map(csvEscape).join(";")),
    "",
    csvEscape(mentionExport(maintenant)),
  ].join("\n");
}

export function nomFichierCsv(maintenant: Date): string {
  return `registre-sous-traitants-independants-${parisDateISO(maintenant)}.csv`;
}
