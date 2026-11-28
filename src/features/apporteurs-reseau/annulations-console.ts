/**
 * Lecture de la console « Rendez-vous annulés à qualifier » (contrat 2.8, art. 3.2).
 * Aucun nom ni coordonnée d'une personne : la dénomination de l'entreprise seulement.
 */

import { prisma } from "@/lib/prisma";

import { annulationRetientEncore, echeanceQualification } from "./annulation-rendez-vous-regles";
import { tableAbsente } from "./reservation-presentation";
import { finDuNiemeJourParis } from "./regles";
import { JOURS_REPORT_APRES_ANNULATION } from "./annulation-rendez-vous-regles";

export interface AnnulationVue {
  id: string;
  presentationId: string;
  denomination: string;
  prevuAt: Date | null;
  constateeAt: Date;
  /** Non qualifiée : seuil d'alerte (5 j ouvrés). Entreprise : fin des 15 jours. */
  echeance: Date;
  autresRendezVous: Array<{ cle: string; libelle: string }>;
}

export async function lireAnnulationsConsole(
  maintenant: Date,
): Promise<{ aQualifier: AnnulationVue[]; enAttenteDeReport: AnnulationVue[] }> {
  let lignes;
  try {
    lignes = await prisma.annulationRendezVousPresentation.findMany({
      where: { OR: [{ auteur: null }, { auteur: "entreprise", reportCle: null }] },
      orderBy: [{ constateeAt: "asc" }],
      take: 500,
    });
  } catch (err) {
    if (tableAbsente(err)) return { aQualifier: [], enAttenteDeReport: [] };
    throw err;
  }
  if (lignes.length === 0) return { aQualifier: [], enAttenteDeReport: [] };
  const ids = [...new Set(lignes.map((l) => l.presentationId))];
  const [presentations, propositions] = await Promise.all([
    prisma.presentationEntreprise.findMany({
      where: { id: { in: ids } },
      select: { id: true, denomination: true },
    }),
    prisma.propositionRendezVousPresentation.findMany({
      where: { presentationId: { in: ids } },
      select: { presentationId: true, rendezVousCle: true, rendezVousAt: true },
    }),
  ]);
  const nom = new Map(presentations.map((p) => [p.id, p.denomination]));
  const vue = (l: (typeof lignes)[number], echeance: Date): AnnulationVue => ({
    id: l.id,
    presentationId: l.presentationId,
    denomination: nom.get(l.presentationId) ?? "Entreprise",
    prevuAt: l.prevuAt,
    constateeAt: l.constateeAt,
    echeance,
    autresRendezVous: propositions
      .filter((p) => p.presentationId === l.presentationId && p.rendezVousCle !== l.rendezVousCle)
      .map((p) => ({
        cle: p.rendezVousCle,
        libelle: p.rendezVousAt
          ? `Rendez-vous du ${p.rendezVousAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`
          : p.rendezVousCle,
      })),
  });
  const aQualifier: AnnulationVue[] = [];
  const enAttenteDeReport: AnnulationVue[] = [];
  for (const l of lignes) {
    if (l.auteur === null) aQualifier.push(vue(l, echeanceQualification(l.constateeAt).alerte));
    else if (
      annulationRetientEncore({
        auteur: "entreprise",
        constateeAt: l.constateeAt,
        reportCle: null,
        maintenant,
      })
    )
      enAttenteDeReport.push(
        vue(l, finDuNiemeJourParis(l.constateeAt, JOURS_REPORT_APRES_ANNULATION)),
      );
  }
  return { aQualifier, enAttenteDeReport };
}
