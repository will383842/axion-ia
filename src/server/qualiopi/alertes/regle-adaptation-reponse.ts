/**
 * Règle d'alerte — BESOIN D'ADAPTATION DÉCLARÉ, RÉPONSE NON CONSIGNÉE (ind. 10).
 *
 * ## Pourquoi une règle BALAYÉE, à côté de l'alerte née du geste
 *
 * `besoin_adaptation_declare` naît du geste du bénéficiaire (portail) et ne se
 * relit jamais. Deux trous en sortaient :
 *
 *   1. **fermée à la main, rien n'était consigné** — c'est le cas réel qui a
 *      motivé ce module : l'alerte close, `adaptationsRealisees` vide, et plus
 *      aucun signal nulle part ;
 *   2. **un besoin posé en CONSOLE** (fiche stagiaire, `situationHandicap`) ne
 *      levait aucune alerte du tout.
 *
 * Cette règle relit l'ÉTAT chaque nuit : tant qu'une inscription porte un besoin
 * déclaré sans réponse consignée, elle crie ; dès que la réponse l'est, elle se
 * tait et `synchroniserAlertes` referme l'alerte (`resolutionAuto: true`). L'action
 * de consignation la referme aussi sur-le-champ, sans attendre la nuit.
 *
 * 🔑 UNE alerte par besoin, jamais deux : tant que l'alerte du geste est OUVERTE
 * pour la personne, elle porte le signal et cette règle s'abstient. Elle prend le
 * relais le jour où l'alerte du geste est fermée sans que rien ne soit consigné.
 *
 * 🔴 Le message ne porte AUCUN contenu de santé : ni le détail déclaré (que la
 * requête ne charge même pas), ni la réponse consignée. Il nomme la personne, la
 * session, et dit où agir.
 *
 * Module séparé de `evaluateur.ts` pour être testé sans monter ses trente
 * dépendances ; il est inscrit dans `REGLES` comme les autres.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";
import {
  CODE_ALERTE_BESOIN_DECLARE,
  CODE_ALERTE_REPONSE_NON_CONSIGNEE,
  FENETRE_REPONSE_ADAPTATION_APRES_FIN_JOURS,
  HORODATAGE_CIRCUIT_VIDE,
  besoinAdaptationDeclare,
  etatReponseAdaptation,
  reponseAnterieureALaDerniereDeclaration,
  whereBesoinAdaptationDeclare,
  type HorodatageCircuitAdaptation,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import { lireCircuitAdaptation } from "@/server/qualiopi/adaptation/journal-consignation";
import type { AlerteNiveau } from "../../../../prisma/generated/client";

/** Même forme que `AlerteCandidate` d'`evaluateur.ts` — sans l'importer (cycle). */
export interface CandidateReponseAdaptation {
  code: string;
  niveau: AlerteNiveau;
  titre: string;
  message: string;
  cibleType: "Enrollment";
  cibleId: string;
}

export const TITRE_ALERTE_REPONSE_NON_CONSIGNEE =
  "Besoin d'adaptation déclaré : réponse de l'organisme non consignée (ind. 10)";

const jourParis = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export async function regleAdaptationReponseNonConsignee(
  now: Date,
): Promise<CandidateReponseAdaptation[]> {
  const borne = new Date(
    now.getTime() - FENETRE_REPONSE_ADAPTATION_APRES_FIN_JOURS * 24 * 60 * 60 * 1000,
  );

  // 🔴 2026-09-15 (relecture #1095) — la requête ne retenait que les inscriptions
  // à colonne VIDE (`adaptationsRealisees: null`). Une réponse consignée AVANT
  // une nouvelle déclaration du besoin la faisait donc sortir du balayage pour
  // toujours. Toutes les inscriptions à besoin déclaré sont lues ; c'est
  // `etatReponseAdaptation`, avec les dates du circuit, qui dit laquelle attend
  // encore sa réponse — le même prédicat que l'écran et l'indicateur.
  const inscriptions = await prisma.enrollment.findMany({
    where: {
      ...inscriptionsActives(),
      session: { statut: { notIn: STATUTS_SESSION_SANS_PREUVE }, dateFin: { gte: borne } },
      ...whereBesoinAdaptationDeclare(),
    },
    select: {
      id: true,
      adaptationsRealisees: true,
      trainee: { select: { id: true, prenom: true, nom: true, situationHandicap: true } },
      session: { select: { numero: true, dateDebut: true, dateFin: true } },
      // Seul le booléen de la réponse est lu ; le détail chiffré n'est pas dans
      // ce JSON (retiré à l'écriture par `portail.ts`) et n'est jamais déchiffré.
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true, reponduAt: true },
      },
    },
  });

  // Confirmation en mémoire : le filtre JSON de la requête ne sait pas écarter
  // une saisie par l'organisme — `lirePositionnement` le sait.
  //
  // ⚠️ Lecture défensive (`?.`, `?? []`) : le typage Prisma garantit ces champs,
  // mais une règle qui lève est AVALÉE par le fail-soft de l'évaluateur, et
  // suspend la résolution automatique de TOUTES les alertes ce tour-là. Une
  // ligne incomplète doit être écartée, pas faire tomber le balayage.
  const aBesoin = inscriptions.filter(
    (e) =>
      e.trainee !== undefined &&
      e.session !== undefined &&
      besoinAdaptationDeclare({
        situationHandicap: e.trainee?.situationHandicap === true,
        reponsesPositionnements: (e.questionnaires ?? []).map((q) => q.reponses),
      }),
  );
  if (aBesoin.length === 0) return [];

  const circuit = await lireCircuitAdaptation(
    aBesoin.map((e) => ({
      id: e.id,
      traineeId: e.trainee.id,
      finSession: e.session.dateFin ?? null,
      positionnements: (e.questionnaires ?? []).map((q) => ({
        reponses: q.reponses,
        reponduAt: q.reponduAt ?? null,
      })),
    })),
  );
  const horodatageDe = (id: string): HorodatageCircuitAdaptation =>
    circuit.get(id) ?? HORODATAGE_CIRCUIT_VIDE;
  const retenues = aBesoin.filter(
    (e) =>
      etatReponseAdaptation(true, e.adaptationsRealisees ?? null, horodatageDe(e.id)) ===
      "a_consigner",
  );
  if (retenues.length === 0) return [];

  const ouvertes = await prisma.alerteSysteme.findMany({
    where: {
      code: CODE_ALERTE_BESOIN_DECLARE,
      resolue: false,
      cibleId: { in: [...new Set(retenues.map((e) => e.trainee.id))] },
    },
    select: { cibleId: true },
  });
  const couvertesParLeGeste = new Set(ouvertes.map((a) => a.cibleId));

  return retenues
    .filter((e) => !couvertesParLeGeste.has(e.trainee.id))
    .map((e) => {
      const identite = `${e.trainee.prenom} ${e.trainee.nom}`.trim();
      const debut = jourParis.format(e.session.dateDebut);
      const commencee = e.session.dateDebut.getTime() <= now.getTime();
      const h = horodatageDe(e.id);
      const constat = reponseAnterieureALaDerniereDeclaration(e.adaptationsRealisees ?? null, h)
        ? `a déclaré un besoin d'adaptation${
            h.derniereDeclarationLe !== null
              ? ` le ${jourParis.format(h.derniereDeclarationLe)}`
              : ""
          }, APRÈS la dernière réponse consignée sur son inscription : cette réponse est ` +
          `conservée, mais elle ne couvre pas la nouvelle déclaration.`
        : `a un besoin d'adaptation déclaré, et aucune réponse de l'organisme n'est consignée ` +
          `sur son inscription.`;
      return {
        // Littéral, et non la constante : `routage.spec.ts` reconnaît un code
        // balayé à sa position syntaxique `code: "…"`.
        code: "adaptation_reponse_non_consignee" satisfies typeof CODE_ALERTE_REPONSE_NON_CONSIGNEE,
        niveau: "important" as AlerteNiveau,
        titre: TITRE_ALERTE_REPONSE_NON_CONSIGNEE,
        message:
          `${identite} (session ${e.session.numero}, ${commencee ? "commencée" : "début"} le ${debut}) ` +
          `${constat} Consignez l'adaptation prévue — ou « aucune adaptation ` +
          `nécessaire » après échange avec la personne — dans la colonne « Adaptations ` +
          `(ind. 10) » de la fiche session : cette alerte se fermera d'elle-même.`,
        cibleType: "Enrollment" as const,
        cibleId: e.id,
      };
    });
}
