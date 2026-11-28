/**
 * Contrat 2.8, art. 3.2 — rendez-vous annulé ou non honoré pendant la réservation.
 *
 * Aucun `server-only` : tourne dans le WORKER (passage quotidien).
 *
 *   · le passage CONSTATE la ligne à la source (Calendly / rencontre) et alerte Williams en interne ;
 *   · l'AUTEUR n'est JAMAIS déduit : Calendly renvoie `canceler_type: host` quel que soit l'auteur ;
 *     un administrateur le qualifie dans la console (`actions-annulations.ts`) ;
 *   · tant que l'auteur n'est pas qualifié, l'annulation RETIENT la réservation (art. 1.3) ;
 *   · annulé par Axion IA = réputé tenu à la date où il était fixé (décision de Will) ;
 *   · aucun e-mail à l'apporteur : seules des alertes INTERNES partent, et jamais `ecarterProposition`.
 */

import { prisma } from "@/lib/prisma";

import { alerteInterne } from "./alerte-interne";
import { clesSansRetenue, echeanceQualification } from "./annulation-rendez-vous-regles";
import { tableAbsente } from "./reservation-presentation";
import {
  type EtatSourceRendezVous,
  STATUTS_CALENDLY_ECARTES,
  STATUTS_RENCONTRE_ECARTES,
  lireSourceRendezVous,
  rendezVousNonTenu,
} from "./statut-rendez-vous";
import { signalerErreurReseau } from "./signaler";
import { MESSAGE_DEJA_VALIDEE, validerParRendezVous } from "./validation-rendez-vous";

const PAGE_MAX = 5000;

export const MOTIF_ANNULE_PAR_AXION = "Rendez-vous annulé par Axion IA, réputé tenu (art. 3.2)";
export const ACTEUR_ANNULATION_AXION = "systeme:annulation-axion";

type Candidat = {
  presentationId: string;
  cle: string;
  prisAt: Date;
  prevuAt: Date | null;
};

function etatDeLaSource(s: EtatSourceRendezVous) {
  if (s.calendlyStatus && STATUTS_CALENDLY_ECARTES.includes(s.calendlyStatus))
    return s.calendlyStatus;
  if (s.rencontreStatut && STATUTS_RENCONTRE_ECARTES.includes(s.rencontreStatut))
    return s.rencontreStatut;
  return "annule";
}

/**
 * Report convenu, détecté seul : une rencontre qui REMPLACE l'invité de l'événement annulé
 * (`ancienInviteeUri`). Rend la clé du nouveau rendez-vous, ou `null`.
 */
async function reportAutomatique(cle: string): Promise<string | null> {
  if (!cle.startsWith("calendly:")) return null;
  const ev = await prisma.calendlyEvent.findUnique({
    where: { id: cle.slice("calendly:".length) },
    select: { inviteeUri: true },
  });
  if (!ev?.inviteeUri) return null;
  const r = await prisma.rencontre.findFirst({
    where: { ancienInviteeUri: ev.inviteeUri },
    select: { id: true },
  });
  return r ? `rencontre:${r.id}` : null;
}

/** Constate les rendez-vous non tenus des réservations ouvertes. Rend le nombre de lignes créées. */
export async function constaterAnnulations(maintenant: Date): Promise<number> {
  let reservations;
  try {
    reservations = await prisma.presentationReservation.findMany({
      where: { regle: "rendez_vous", echueAt: null, valideeAt: null },
      select: {
        presentationId: true,
        rendezVousCle: true,
        rendezVousPrisAt: true,
        rendezVousAt: true,
      },
      take: PAGE_MAX,
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  if (reservations.length === 0) return 0;
  const ids = reservations.map((r) => r.presentationId);
  const candidats = new Map<string, Candidat>();
  const clef = (p: string, c: string) => `${p}|${c}`;
  try {
    const propositions = await prisma.propositionRendezVousPresentation.findMany({
      where: { presentationId: { in: ids }, ecarteeAt: null, retenueAt: null },
      select: { presentationId: true, rendezVousCle: true, prisAt: true, rendezVousAt: true },
    });
    for (const p of propositions)
      candidats.set(clef(p.presentationId, p.rendezVousCle), {
        presentationId: p.presentationId,
        cle: p.rendezVousCle,
        prisAt: p.prisAt,
        prevuAt: p.rendezVousAt,
      });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  for (const r of reservations) {
    if (
      r.rendezVousCle &&
      r.rendezVousPrisAt &&
      !candidats.has(clef(r.presentationId, r.rendezVousCle))
    )
      candidats.set(clef(r.presentationId, r.rendezVousCle), {
        presentationId: r.presentationId,
        cle: r.rendezVousCle,
        prisAt: r.rendezVousPrisAt,
        prevuAt: r.rendezVousAt,
      });
  }
  if (candidats.size === 0) return 0;

  let connues;
  try {
    connues = await prisma.annulationRendezVousPresentation.findMany({
      where: { presentationId: { in: ids } },
      select: { presentationId: true, rendezVousCle: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  const dejaLa = new Set(connues.map((c) => clef(c.presentationId, c.rendezVousCle)));

  let creees = 0;
  for (const c of candidats.values()) {
    if (dejaLa.has(clef(c.presentationId, c.cle))) continue;
    const source = await lireSourceRendezVous(prisma, c.cle);
    if (!source || !rendezVousNonTenu(source)) continue;
    const r = await prisma.annulationRendezVousPresentation.createMany({
      data: [
        {
          presentationId: c.presentationId,
          rendezVousCle: c.cle,
          prisAt: c.prisAt,
          prevuAt: source.tenuAt ?? c.prevuAt,
          constateeAt: maintenant,
          etatSource: etatDeLaSource(source),
          // L'auteur n'est JAMAIS posé ici.
        },
      ],
      skipDuplicates: true,
    });
    if (r.count !== 1) continue;
    creees += 1;
    await alerteInterne({
      jobId: `apporteur-annulation-a-qualifier-${c.presentationId}-${c.cle}`,
      code: "apporteur_annulation_a_qualifier",
      titre: "Rendez-vous annulé à qualifier",
      message:
        "Un rendez-vous pris pendant une réservation a été annulé ou n'a pas eu lieu. Dites dans la console qui l'a annulé (Axion IA ou l'entreprise) : tant que ce n'est pas fait, la réservation reste retenue (Apporteurs › Entreprises › Rendez-vous annulés).",
      cibleType: "PresentationEntreprise",
      cibleId: c.presentationId,
      maintenant,
    });
  }

  // Report convenu détecté seul (rencontre qui remplace l'invité annulé).
  const sansReport = await prisma.annulationRendezVousPresentation.findMany({
    where: {
      presentationId: { in: ids },
      reportCle: null,
      OR: [{ auteur: null }, { auteur: "entreprise" }],
    },
    select: { id: true, rendezVousCle: true },
  });
  for (const l of sansReport) {
    const cle = await reportAutomatique(l.rendezVousCle);
    if (!cle) continue;
    await prisma.annulationRendezVousPresentation.updateMany({
      where: { id: l.id, reportCle: null },
      data: { reportCle: cle, reportLieAt: maintenant },
    });
  }
  return creees;
}

/** Annulations sans auteur : alerte à 5 jours ouvrés, critique à 10 (une alerte par ligne et par seuil). */
export async function alerterAnnulationsNonQualifiees(maintenant: Date): Promise<number> {
  let lignes;
  try {
    lignes = await prisma.annulationRendezVousPresentation.findMany({
      where: { auteur: null },
      select: { id: true, presentationId: true, constateeAt: true },
      take: PAGE_MAX,
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  let envoyees = 0;
  for (const l of lignes) {
    const e = echeanceQualification(l.constateeAt);
    const cible = { cibleType: "PresentationEntreprise", cibleId: l.presentationId, maintenant };
    if (maintenant.getTime() >= e.alerte.getTime()) {
      if (
        await alerteInterne({
          jobId: `apporteur-annulation-rappel-${l.id}`,
          code: "apporteur_annulation_non_qualifiee",
          titre: "Rendez-vous annulé toujours à qualifier",
          message:
            "Un rendez-vous annulé attend depuis plus de 5 jours ouvrés que vous disiez qui l'a annulé. La réservation reste retenue tant que ce n'est pas fait.",
          ...cible,
        })
      )
        envoyees += 1;
    }
    if (maintenant.getTime() >= e.critique.getTime()) {
      if (
        await alerteInterne({
          jobId: `apporteur-annulation-critique-${l.id}`,
          code: "apporteur_annulation_non_qualifiee_critique",
          titre: "Rendez-vous annulé à qualifier : plus de 10 jours ouvrés",
          message:
            "Un rendez-vous annulé attend depuis plus de 10 jours ouvrés. La réservation reste retenue, sans fin : qualifiez-le dans la console.",
          niveau: "critique",
          ...cible,
        })
      )
        envoyees += 1;
    }
  }
  return envoyees;
}

/**
 * « Annulé par Axion IA » (posé par un humain) = réputé tenu à la date où il était fixé. La
 * validation ne part JAMAIS sans `auteur = 'axion'`, et jamais avant la date fixée.
 */
export async function validerAnnulationsAxion(maintenant: Date): Promise<number> {
  let lignes;
  try {
    lignes = await prisma.annulationRendezVousPresentation.findMany({
      where: {
        auteur: "axion",
        validationFaiteAt: null,
        prevuAt: { lte: maintenant },
      },
      select: { id: true, presentationId: true, prisAt: true, prevuAt: true },
      take: PAGE_MAX,
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  let validees = 0;
  for (const l of lignes) {
    if (!l.prevuAt) continue;
    let r: Awaited<ReturnType<typeof validerParRendezVous>>;
    try {
      r = await validerParRendezVous(
        {
          presentationId: l.presentationId,
          rendezVousCle: null,
          prisAt: l.prisAt,
          tenuAt: l.prevuAt,
          source: "saisie",
          canal: "annule_par_axion",
          acteurId: ACTEUR_ANNULATION_AXION,
          motif: MOTIF_ANNULE_PAR_AXION,
        },
        maintenant,
      );
    } catch (err) {
      // Une ligne en erreur ne bloque pas les suivantes : alerte interne (identifiants seuls).
      signalerErreurReseau("annulation-axion-validation", err);
      await alerteInterne({
        jobId: `apporteur-annulation-axion-erreur-${l.id}`,
        code: "apporteur_annulation_axion_erreur",
        titre: "Rendez-vous annulé par Axion IA : erreur de validation",
        message:
          "La validation « annulé par Axion IA, réputé tenu » a échoué sur une erreur technique. Elle sera retentée au prochain passage ; si l'alerte revient, regardez les journaux.",
        cibleType: "PresentationEntreprise",
        cibleId: l.presentationId,
        maintenant,
      });
      continue;
    }
    if (r.ok || r.message === MESSAGE_DEJA_VALIDEE) {
      await prisma.annulationRendezVousPresentation.updateMany({
        where: { id: l.id, validationFaiteAt: null },
        data: { validationFaiteAt: maintenant },
      });
      if (r.ok) validees += 1;
    } else {
      await alerteInterne({
        jobId: `apporteur-annulation-axion-refus-${l.id}`,
        code: "apporteur_annulation_axion_refusee",
        titre: "Rendez-vous annulé par Axion IA : validation refusée",
        message: `La validation « annulé par Axion IA, réputé tenu » n'a pas pu se faire : ${r.message}`,
        cibleType: "PresentationEntreprise",
        cibleId: l.presentationId,
        maintenant,
      });
    }
  }
  return validees;
}

/** Les clés de rendez-vous qui ne retiennent PLUS la réservation (entreprise, sans report, 15 jours passés). */
export async function clesQuiNeRetiennentPlus(
  presentationId: string,
  maintenant: Date,
): Promise<Set<string>> {
  try {
    const lignes = await prisma.annulationRendezVousPresentation.findMany({
      where: { presentationId },
      select: { rendezVousCle: true, auteur: true, constateeAt: true, reportCle: true },
    });
    return clesSansRetenue(
      lignes.map((l) => ({
        rendezVousCle: l.rendezVousCle,
        auteur: l.auteur === "axion" || l.auteur === "entreprise" ? l.auteur : null,
        constateeAt: l.constateeAt,
        reportCle: l.reportCle,
      })),
      maintenant,
    );
  } catch (err) {
    if (!tableAbsente(err)) throw err;
    return new Set();
  }
}
