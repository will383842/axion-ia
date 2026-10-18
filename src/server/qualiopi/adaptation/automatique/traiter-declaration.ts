/**
 * Chantier QNC, lot L04 — ce que devient une déclaration de besoin faite au
 * positionnement, quand `qualiopi.adaptation.actif` s'applique à l'inscription.
 *
 * Dans l'ordre, et chaque étape datée par le SERVEUR :
 *   1. les précisions (types, mesures, commentaire) partent CHIFFRÉES sur la
 *      fiche stagiaire, par la seule porte (`chiffrerDetailSante`) — si et
 *      seulement si la personne a donné son accord ;
 *   2. la déclaration est journalisée (`journaliserDeclarationBesoin`) : c'est
 *      la date de l'indicateur 10 ;
 *   3. les mesures STANDARD confirmées sont consignées comme réponse de
 *      l'organisme (`adaptationsRealisees` + journal `qualiopi.enrollment.
 *      adaptations`, origine `automatique`) — sans personne, avant la formation ;
 *   4. un cas complexe lève `adaptation_cas_complexe` pour le référent (et un
 *      message Telegram sans identité). Un cas standard ne lève RIEN : aucun
 *      appel systématique (décision de Will).
 *
 * Remplace, quand l'interrupteur s'applique, `signalerBesoinAdaptation` du
 * portail ; éteint, ce module n'est jamais appelé.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { construireMessageTelegramAdaptation } from "@/server/qualiopi/alertes/besoin-adaptation";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";
import { chiffrerDetailSante } from "../detail-sante-chiffre";
import { journaliserDeclarationBesoin } from "../journal-declaration";
import { ACTION_JOURNAL_ADAPTATIONS } from "../reponse-organisme";
import { CODE_ALERTE_CAS_COMPLEXE, construireAlerteCasComplexe } from "./alertes-adaptation";
import {
  fusionnerConsignation,
  texteConsignationAutomatique,
  textePourReferent,
  type DeclarationAdaptation,
} from "./catalogue-mesures";

/** Action du journal : l'accord (ou le refus) de transmettre les précisions. */
export const ACTION_JOURNAL_CONSENTEMENT = "qualiopi.trainee.consentement_precision_adaptation";

export interface ResultatTraitement {
  readonly precisionChiffree: boolean;
  readonly consignee: boolean;
  readonly alerte: boolean;
}

export async function traiterDeclarationAutomatique(input: {
  readonly enrollmentId: string;
  readonly declaration: DeclarationAdaptation;
  /** Instant serveur de la soumission — le même pour le journal et l'alerte. */
  readonly declareLe: Date;
}): Promise<ResultatTraitement> {
  const { declaration: d, declareLe } = input;
  const ins = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      id: true,
      adaptationsRealisees: true,
      trainee: { select: { id: true, prenom: true, nom: true } },
      session: {
        select: { numero: true, titreSession: true, dateDebut: true, dateFin: true, statut: true },
      },
    },
  });
  if (ins === null) throw new Error("traiterDeclarationAutomatique : inscription introuvable");
  const traineeId = ins.trainee.id;

  // 1. Les précisions, chiffrées — jamais sans accord.
  let precisionChiffree = false;
  let chiffrementRefuse = false;
  if (d.consentement) {
    const detailChiffre = chiffrerDetailSante(
      textePourReferent(d, { declareLe, sessionTitre: ins.session.titreSession }),
      { service: "traiterDeclarationAutomatique", traineeId },
    );
    if (detailChiffre === null) {
      chiffrementRefuse = true;
    } else {
      await prisma.trainee.update({
        where: { id: traineeId },
        data: { handicapDetailsChiffre: detailChiffre },
        select: { id: true },
      });
      precisionChiffree = true;
    }
  }
  await prisma.activityLog.create({
    data: {
      action: ACTION_JOURNAL_CONSENTEMENT,
      targetType: "Trainee",
      targetId: traineeId,
      // Jamais le contenu : le fait, et l'inscription concernée.
      changes: { donne: d.consentement, enrollmentId: ins.id },
      createdAt: declareLe,
    },
  });

  // 2. La date de la déclaration (ind. 10).
  await journaliserDeclarationBesoin({ traineeId, origine: "portail_positionnement", declareLe });

  // 3. La consignation des mesures standard confirmées — sur une session
  //    encore à venir ou en cours, jamais sur un dossier clos.
  const sessionVivante =
    !(STATUTS_SESSION_SANS_PREUVE as readonly string[]).includes(ins.session.statut) &&
    ins.session.dateFin.getTime() >= declareLe.getTime();
  let consignee = false;
  if (d.choix === "confirme" && d.mesuresStandard.length > 0 && sessionVivante) {
    // Strictement APRÈS la déclaration : une réponse ne couvre que ce qui la précède.
    const consigneLe = new Date(Math.max(Date.now(), declareLe.getTime() + 1));
    const valeur = fusionnerConsignation(
      ins.adaptationsRealisees,
      texteConsignationAutomatique(d.mesuresStandard, declareLe),
    );
    await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: ins.id },
        data: { adaptationsRealisees: valeur },
        select: { id: true },
      }),
      prisma.activityLog.create({
        data: {
          action: ACTION_JOURNAL_ADAPTATIONS,
          targetType: "Enrollment",
          targetId: ins.id,
          changes: {
            adaptationsRenseignees: true,
            reponse: "adaptation",
            origine: "automatique",
            mesures: d.mesuresStandard.length,
          },
          createdAt: consigneLe,
        },
      }),
    ]);
    consignee = true;
  }

  // 4. Seuls les cas complexes remontent.
  let alerte = false;
  if (d.casComplexe || chiffrementRefuse) {
    const a = construireAlerteCasComplexe({
      prenom: ins.trainee.prenom,
      nom: ins.trainee.nom,
      sessionNumero: ins.session.numero,
      dateDebut: ins.session.dateDebut,
      declareLe,
    });
    await creerOuDedup({
      code: CODE_ALERTE_CAS_COMPLEXE,
      niveau: "important",
      titre: a.titre,
      message: a.message,
      cibleType: "Enrollment",
      cibleId: ins.id,
    });
    alerte = true;
    void sendTelegram({
      tag: "ADAPTATION_DECLAREE",
      body: construireMessageTelegramAdaptation(traineeId),
    }).catch(() => {});
  }

  return { precisionChiffree, consignee, alerte };
}
