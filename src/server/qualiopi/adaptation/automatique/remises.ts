/**
 * Chantier QNC, lot L04 — les mesures s'appliquent SEULES avant la formation.
 *
 * Pour chaque inscription à venir dont la réponse d'adaptation est consignée
 * et cite des mesures du catalogue, le passage quotidien :
 *   · transmet la FICHE D'ADAPTATION au formateur de la session — les mesures,
 *     rien d'autre ; s'il y a des mesures de supports, il lui demande de
 *     transmettre les supports adaptés avant la formation ;
 *   · envoie au stagiaire le RÉCAPITULATIF de ses aménagements.
 *
 * Chaque envoi réussi est rangé au dossier de la session (`remises_retours`,
 * date serveur). Une réponse consignée APRÈS la dernière remise (le référent a
 * répondu, une nouvelle déclaration est arrivée) déclenche une nouvelle remise :
 * le formateur travaille toujours sur la dernière version.
 *
 * 🔴 Relecture #1571 — seules les mesures du catalogue sortent
 * (`lignesDeMesures`), jamais le texte libre de la console. La PREMIÈRE remise
 * d'une inscription n'est due que si la consignation automatique y a écrit :
 * à l'allumage, les inscriptions consignées à la main avant ne reçoivent rien
 * d'un coup.
 *
 * Les consignes de la convocation, elles, sont ajoutées par `envoyerConvocation`
 * (`consignesPourConvocation`).
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import type { EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";
import { lireCircuitAdaptation } from "../journal-consignation";
import {
  lignesDeMesures,
  porteConsignationAutomatique,
  texteCiteMesureSupport,
} from "./catalogue-mesures";
import { adaptationAutomatiquePourInscription, etatAdaptation } from "./portee";
import { questionUtiliteApplicable } from "./utilite-question";

export const OBJET_FICHE_FORMATEUR = "fiche_adaptation";
export const OBJET_RECAP_STAGIAIRE = "adaptation_mesures";

/**
 * Pure : une remise est-elle due au regard de la dernière consignation ?
 * Sans consignation datée, rien. Jamais remise : seulement si la consignation
 * automatique a écrit (`consigneeAutomatiquement`) — une saisie à la main
 * antérieure à l'allumage ne déclenche pas de première remise.
 */
export function remiseDue(
  derniereConsignationLe: Date | null,
  derniereRemiseLe: Date | null,
  consigneeAutomatiquement = false,
): boolean {
  if (derniereConsignationLe === null) return false;
  if (derniereRemiseLe === null) return consigneeAutomatiquement;
  return derniereConsignationLe.getTime() > derniereRemiseLe.getTime();
}

/**
 * Pure : les lignes à ajouter à la convocation, ou `null`. Rien quand aucune
 * adaptation n'est consignée, ou que la réponse est « aucune adaptation ».
 */
export function consignesPourConvocation(adaptationsRealisees: string | null): string[] | null {
  if (!questionUtiliteApplicable(adaptationsRealisees)) return null;
  const lignes = lignesDeMesures(adaptationsRealisees ?? "");
  return lignes.length > 0 ? lignes : null;
}

/** Les consignes d'aménagement de la convocation de CETTE inscription, interrupteur compris. */
export async function consignesConvocationPourInscription(
  enrollmentId: string,
  adaptationsRealisees: string | null | undefined,
): Promise<string[] | null> {
  const lignes = consignesPourConvocation(adaptationsRealisees ?? null);
  if (lignes === null) return null;
  return (await adaptationAutomatiquePourInscription(enrollmentId)) ? lignes : null;
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

export interface BilanRemises {
  readonly formateur: number;
  readonly stagiaire: number;
  readonly ko: number;
}

export async function passerRemisesAdaptation(
  maintenant: Date,
  etat?: EtatInterrupteur,
): Promise<BilanRemises> {
  const vide = { formateur: 0, stagiaire: 0, ko: 0 };
  const e = etat ?? (await etatAdaptation());
  if (e === "eteint") return vide;

  const inscriptions = await prisma.enrollment.findMany({
    where: {
      ...inscriptionsActives(),
      adaptationsRealisees: { not: null },
      session: { statut: "planifiee", dateDebut: { gt: maintenant } },
      ...(e === "essai"
        ? { OR: [{ estTestInterne: true }, { session: { estTestInterne: true } }] }
        : {}),
    },
    select: {
      id: true,
      traineeId: true,
      adaptationsRealisees: true,
      trainee: { select: { email: true, prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          formateurPrincipal: { select: { email: true, prenom: true, nom: true } },
        },
      },
      remisesRetours: {
        where: { nature: "remise", objet: { in: [OBJET_FICHE_FORMATEUR, OBJET_RECAP_STAGIAIRE] } },
        select: { objet: true, survenuLe: true },
        orderBy: { survenuLe: "desc" },
      },
    },
  });
  const aTraiter = inscriptions.filter((i) => questionUtiliteApplicable(i.adaptationsRealisees));
  if (aTraiter.length === 0) return vide;

  const circuit = await lireCircuitAdaptation(
    aTraiter.map((i) => ({
      id: i.id,
      traineeId: i.traineeId,
      finSession: i.session.dateFin,
      positionnements: [],
    })),
  );

  // Import DIFFÉRÉ : ce module est tiré par le worker des crons, dont les suites
  // de tests simulent `bullmq` sans `Queue` — la file n'est chargée qu'au besoin.
  const { enqueueEmail } = await import("@/server/queue/queues");
  let formateur = 0;
  let stagiaire = 0;
  let ko = 0;
  for (const i of aTraiter) {
    const texte = i.adaptationsRealisees ?? "";
    const mesures = lignesDeMesures(texte);
    // Aucune mesure du catalogue : rien à transmettre (le texte libre ne sort pas).
    if (mesures.length === 0) continue;
    const automatique = porteConsignationAutomatique(texte);
    const consigneLe = circuit.get(i.id)?.derniereConsignationLe ?? null;
    const derniere = (objet: string): Date | null =>
      i.remisesRetours.find((r) => r.objet === objet)?.survenuLe ?? null;
    const commun = {
      stagiairePrenomNom: `${i.trainee.prenom} ${i.trainee.nom}`.trim(),
      titreFormation: i.session.titreSession,
      dateDebutFormation: dateCourte.format(i.session.dateDebut),
      mesures,
      supportsAvant: texteCiteMesureSupport(texte),
      numeroSession: i.session.numero,
    };

    const envois: {
      objet: string;
      destinataire: "formateur" | "stagiaire";
      template: "qualiopi-adaptation-formateur" | "qualiopi-adaptation-stagiaire";
      to: string;
      payload: Record<string, unknown>;
      libelle: string;
    }[] = [];
    const f = i.session.formateurPrincipal;
    // Sans formateur affecté, la fiche attend : le passage suivant la remettra.
    if (f !== null && remiseDue(consigneLe, derniere(OBJET_FICHE_FORMATEUR), automatique)) {
      envois.push({
        objet: OBJET_FICHE_FORMATEUR,
        destinataire: "formateur",
        template: "qualiopi-adaptation-formateur",
        to: f.email,
        payload: { ...commun, formateurPrenomNom: `${f.prenom} ${f.nom}`.trim() },
        libelle: "Fiche d'adaptation transmise au formateur (mesures seules)",
      });
    }
    if (i.trainee.email && remiseDue(consigneLe, derniere(OBJET_RECAP_STAGIAIRE), automatique)) {
      envois.push({
        objet: OBJET_RECAP_STAGIAIRE,
        destinataire: "stagiaire",
        template: "qualiopi-adaptation-stagiaire",
        to: i.trainee.email,
        payload: commun,
        libelle: "Récapitulatif des aménagements envoyé au stagiaire",
      });
    }

    // Version de la fiche = instant de la dernière consignation : le `jobId` est
    // stable d'un passage à l'autre, et un e-mail parti dont la trace au dossier
    // a échoué n'est pas renvoyé le lendemain (BullMQ écarte le doublon).
    const version = consigneLe?.getTime() ?? 0;
    for (const env of envois) {
      try {
        const envoi = await enqueueEmail(env.template, env.to, "fr", env.payload, {
          jobId: `${env.template}-${i.id}-${version}`,
          entityType: "Enrollment",
          entityId: i.id,
        });
        if (!envoi.enqueued) {
          ko++;
          continue;
        }
        await prisma.remiseRetour.create({
          data: {
            sessionId: i.session.id,
            enrollmentId: i.id,
            nature: "remise",
            destinataire: env.destinataire,
            canal: "email",
            objet: env.objet,
            libelle: env.libelle,
          },
        });
        if (env.destinataire === "formateur") formateur++;
        else stagiaire++;
      } catch (err) {
        ko++;
        console.error(
          `[adaptation] remise ${env.objet} : erreur inscription ${i.id} :`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
  return { formateur, stagiaire, ko };
}
