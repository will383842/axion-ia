/**
 * Réseau d'apporteurs — lot 6 de la « validation par rendez-vous » : la VALIDATION par le dirigeant.
 *
 * L'outil PROPOSE (lot 5), le dirigeant VALIDE : rien ici ne se déclenche seul. Ce module n'est
 * appelé que par les actions de la console, réservées aux administrateurs.
 *
 *   · `validerParRendezVous` : « il a eu lieu ». Une seule transaction sérialisable ; les écritures
 *     sont conditionnelles (`valideeAt` vide), donc un double clic = une validation, une annonce.
 *   · `ecarterProposition` : écarte une proposition du rapprochement. NE SUPPRIME JAMAIS : la ligne
 *     reste (`ecarteeAt`), et le rapprochement ne la recrée pas (`skipDuplicates`).
 *
 * Gardes (toutes refaites DANS la transaction) : interrupteur allumé, présentation « réservée » avec
 * une réservation « rendez_vous » ouverte, apporteur au contrat `signe` à la version ≥ 2.8, rendez-vous
 * recevable (règle du lot 2 : pris dans les 60 jours après la saisie, tenu après sa prise, pas dans
 * le futur), et AUCUNE autre déclaration, d'un autre apporteur, qui occupe encore le même périmètre
 * (plus ancienne, ou déjà validée). Jamais deux apporteurs pour une même entreprise.
 *
 *   · apporteur RÉSILIÉ entre la saisie et le rendez-vous : refus ;
 *   · apporteur RETIRÉ du réseau : permis, avec un avertissement (le retrait ne résilie rien) ;
 *   · apporteur en PRÉAVIS (contrat toujours `signe`) : permis.
 *
 * Aucun texte n'est écrit ici à l'extérieur : l'e-mail à l'apporteur est celui, existant, de
 * `annoncerAttribution` (une fois par `jobId`).
 *
 * ⚠️ Atteint aussi par les tests sans `server-only` ; aucune donnée personnelle journalisée.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

import {
  MESSAGE_CONFLIT_RATTRAPAGE,
  alerterConflitRattrapage,
  rattrapageEnConflit,
} from "./conflit-rattrapage";
import { annoncerAttribution } from "./attribution-annonce";
import { finDuNiemeJourParis } from "./regles";
import { lireEtablissements, memePerimetre } from "./etablissement-presentation";
import { validationParRendezVousActive } from "./interrupteur-rendez-vous";
import { versReservationProvisoire } from "./regle-attribution";
import {
  type MotifRendezVousRefuse,
  finDeProtectionRendezVous,
  presentationOccupe,
  regleDe,
  rendezVousRecevable,
} from "./regle-attribution";
import { lireIdsEnGrace, tableAbsente } from "./reservation-presentation";
import { heureConsole, lireSourceRendezVous, rendezVousNonTenu } from "./statut-rendez-vous";

export type SourceValidation = "calendly" | "rencontre" | "saisie" | "commande";

interface SaisieCommune {
  presentationId: string;
  /** Quand il a EU LIEU (pour une proposition : relu à la source, qui l'emporte). */
  tenuAt: Date;
  source: SourceValidation;
  /** Canal d'une saisie manuelle ; inscrit au journal. */
  canal?: "telephone" | "sur_place" | "annule_par_axion";
  /** L'administrateur qui valide (identifiant seul). */
  acteurId: string;
  /** Motif d'une saisie manuelle (texte court), écrit dans `validationMotif`. */
  motif?: string;
}

/**
 * Deux formes, jamais mélangées :
 *   · une PROPOSITION de l'outil : `rendezVousCle` + `propositionId`. La date de PRISE est celle de
 *     la proposition, relue DANS la transaction (jamais `capturedAt`, jamais le client) ;
 *   · une SAISIE manuelle : pas de clé, la date de prise est obligatoire.
 */
export type SaisieValidation = SaisieCommune &
  (
    | {
        rendezVousCle: string;
        propositionId: string;
        /**
         * Ignorée sauf pour la source « rencontre » (une rencontre n'a pas de date de prise
         * fiable : le dirigeant la saisit). Pour toute autre source, la date de prise est celle de
         * la proposition.
         */
        prisAt?: Date;
      }
    | { rendezVousCle: null; prisAt: Date; propositionId?: undefined }
  );

export type ResultatValidation =
  { ok: true; message: string; avertissements: string[] } | { ok: false; message: string };

export const MESSAGE_INTERRUPTEUR_ETEINT =
  "La validation par rendez-vous n'est pas active : rien ne peut être validé ici.";

const MESSAGES_MOTIF: Readonly<Record<MotifRendezVousRefuse, string>> = {
  pris_avant_saisie:
    "Ce rendez-vous a été pris AVANT la saisie de l'entreprise : il ne la valide pas (contrat 2.8).",
  pris_apres_reservation:
    "Ce rendez-vous a été pris plus de 60 jours après la saisie : la réservation était terminée.",
  pas_encore_tenu: "Ce rendez-vous n'a pas encore eu lieu : on ne valide qu'un rendez-vous tenu.",
  tenu_avant_prise: "La date du rendez-vous tenu précède sa prise : saisie incohérente.",
};

export function messageMotifRefuse(motif: MotifRendezVousRefuse): string {
  return MESSAGES_MOTIF[motif];
}

export const MESSAGE_AUTRE_APPORTEUR =
  "Une autre déclaration, d'un autre apporteur, occupe encore cette entreprise (plus ancienne ou déjà validée) : une entreprise n'a jamais deux apporteurs. Rien n'est validé.";

export const MESSAGE_RDV_NON_TENU =
  "Ce rendez-vous a été annulé, reporté, ou le client ne s'est pas présenté : il n'a pas eu lieu et ne valide pas l'entreprise. S'il a été annulé par Axion IA, il est réputé tenu : saisissez-le à la main, type « Annulé par Axion IA ».";

export const MESSAGE_RDV_INTROUVABLE =
  "Le rendez-vous désigné est introuvable à la source : rien n'est validé.";

export const MESSAGE_PREMIER_RDV =
  "Un rendez-vous plus ancien, déjà tenu, est proposé pour cette présentation : c'est le PREMIER rendez-vous tenu qui valide (il fixe le départ des 6 mois). Validez celui-là. S'il n'est pas recevable (pris avant la saisie de cette entreprise, par exemple), écartez-le d'abord, puis validez celui-ci.";

/**
 * Une déclaration plus ancienne, d'un autre apporteur, a un rendez-vous pris pendant sa réservation
 * puis annulé, reporté ou manqué : elle passe en premier et attend la décision du dirigeant. Le
 * message NOMME cette déclaration (date de saisie, telle que la console l'affiche) : la proposition
 * sur laquelle on a cliqué n'est pas en cause et ne doit pas être écartée à sa place.
 */
export function messageAncienRdvAnnule(saisies: Date[]): string {
  const dates = [...saisies]
    .sort((x, y) => x.getTime() - y.getTime())
    .map((d) => `saisie le ${heureConsole(d)}`)
    .join(" ; ");
  return `Rien n'est validé. Une déclaration plus ancienne de cette entreprise, faite par un autre apporteur (${dates}), a un rendez-vous pris pendant sa réservation puis annulé, reporté ou manqué : elle passe en premier et attend votre décision. Décidez d'abord pour CETTE déclaration-là (ligne marquée annulée, plus haut) : si Axion IA a annulé ce rendez-vous, saisissez-le pour elle (« Annulé par Axion IA »). La proposition sur laquelle vous venez de cliquer n'est pas en cause.`;
}

/**
 * Art. 3.2 / 3.5 : pendant les 30 jours qui suivent le terme de la réservation provisoire, personne
 * d'autre ne peut déclarer l'entreprise. Une déclaration plus récente, saisie dans cette fenêtre,
 * ne prive donc jamais la plus ancienne (encore « en attente ») de son entreprise.
 */
export const JOURS_APRES_RESERVATION = 30;

export function messageAncienneEnGrace(saisies: Date[]): string {
  const dates = [...saisies]
    .sort((x, y) => x.getTime() - y.getTime())
    .map((d) => `saisie le ${heureConsole(d)}`)
    .join(" ; ");
  return `Rien n'est validé. Une déclaration plus ancienne de cette entreprise, faite par un autre apporteur (${dates}), est encore en attente : pendant les ${JOURS_APRES_RESERVATION} jours qui suivent la fin de sa réservation, personne d'autre ne peut déclarer cette entreprise. Elle passe en premier ; décidez d'abord pour elle.`;
}

const MESSAGE_SANS_PROPOSITION = "Rendez-vous sans proposition : rien n'est validé.";

const MESSAGE_CONCURRENCE =
  "Une autre validation est en cours sur cette entreprise : réessayez dans un instant.";

const MESSAGE_DEJA_VALIDEE = "Cette entreprise est déjà validée : rien de plus à faire.";

/** Sortie anticipée de la transaction : le refus voyage comme valeur, la transaction s'annule. */
class Refus extends Error {
  constructor(
    readonly refus: string,
    /** Rattrapage refusé parce qu'une AUTRE déclaration occupe l'entreprise : Williams tranche. */
    readonly conflit: boolean = false,
  ) {
    super(refus);
  }
}

function dateValide(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * « Il a eu lieu » : valide la présentation au rendez-vous indiqué. Voir l'en-tête du fichier.
 * `maintenant` sert aux comparaisons (un rendez-vous dans le futur n'est jamais « tenu »).
 */
export async function validerParRendezVous(
  e: SaisieValidation,
  maintenant: Date = new Date(),
): Promise<ResultatValidation> {
  if (!validationParRendezVousActive()) return { ok: false, message: MESSAGE_INTERRUPTEUR_ETEINT };
  // Dates illisibles : refus net (elles ne doivent jamais ouvrir six mois de protection).
  if (!dateValide(e.tenuAt) || !dateValide(maintenant))
    return { ok: false, message: "Date du rendez-vous illisible." };
  if (e.rendezVousCle) {
    // Une clé de rendez-vous sans proposition : on ne sait pas de quelle date de prise il s'agit.
    if (!e.propositionId) return { ok: false, message: MESSAGE_SANS_PROPOSITION };
  } else if (!dateValide(e.prisAt)) {
    return { ok: false, message: "Date de prise du rendez-vous illisible." };
  }

  const avertissements: string[] = [];
  let retire = false;
  let rattrapage = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        const p = await tx.presentationEntreprise.findUnique({
          where: { id: e.presentationId },
          select: {
            id: true,
            apporteurId: true,
            siren: true,
            statut: true,
            recueAt: true,
            confirmeeAt: true,
            apporteur: { select: { statut: true, signatureApporteur: true } },
          },
        });
        if (!p) throw new Refus("Présentation introuvable.");
        if (p.statut === "confirmee") throw new Refus(MESSAGE_DEJA_VALIDEE);
        const MESSAGE_SEULE_EN_ATTENTE = "Seule une présentation « en attente » peut être validée.";
        if (p.statut !== "reservee" && p.statut !== "terminee")
          throw new Refus(MESSAGE_SEULE_EN_ATTENTE);

        const reservation = await tx.presentationReservation.findUnique({
          where: { presentationId: p.id },
          select: { regle: true, reserveeJusquAt: true, echueAt: true, valideeAt: true },
        });
        if (!reservation || reservation.regle !== "rendez_vous")
          throw new Refus(
            "Cette présentation est d'avant la règle par rendez-vous : elle suit la confirmation habituelle.",
          );
        if (reservation.valideeAt) throw new Refus(MESSAGE_DEJA_VALIDEE);
        // Rattrapage : une réservation ÉCHUE sans validation (présentation `terminee`, jamais
        // confirmée) se valide encore si le rendez-vous a été PRIS avant le terme. Une `terminee`
        // sans échéance (résiliation) ou déjà confirmée une fois ne se rattrape jamais.
        rattrapage = p.statut === "terminee";
        if (rattrapage && (!reservation.echueAt || p.confirmeeAt))
          throw new Refus(MESSAGE_SEULE_EN_ATTENTE);
        if (!rattrapage && reservation.echueAt)
          throw new Refus("La réservation de cette entreprise est terminée : rien à valider.");

        // Apporteur : contrat « signé » (le préavis en fait toujours partie) ET à la version 2.8.
        if (p.apporteur.statut === "resilie")
          throw new Refus(
            "Le contrat de cet apporteur est terminé : l'entreprise ne peut plus lui être attribuée.",
          );
        if (p.apporteur.statut !== "signe")
          throw new Refus(
            "Cet apporteur n'a pas de contrat signé : rien ne peut lui être attribué.",
          );
        if (regleDe(p.apporteur.signatureApporteur, true) !== "rendez_vous")
          throw new Refus(
            "Le contrat signé de cet apporteur est antérieur à la version 2.8 : il suit la confirmation habituelle.",
          );
        // Retiré du réseau : permis (le retrait ne résilie rien), mais le dirigeant le sait.
        try {
          const retrait = await tx.apporteurReseauRetrait.findUnique({
            where: { apporteurId: p.apporteurId },
            select: { apporteurId: true },
          });
          if (retrait) {
            retire = true;
            avertissements.push(
              "Cet apporteur est retiré du réseau (son contrat n'est pas résilié) : la validation est permise.",
            );
          }
        } catch (err) {
          if (!tableAbsente(err)) throw err;
        }

        // 🔑 La PROPOSITION est relue ici : écartée, retenue, ou d'une autre présentation, on ne
        // valide pas. La date de PRISE est la sienne (lot 5 : `invitee.created_at`), jamais celle
        // de la source (`capturedAt` = création de NOTRE ligne, sans rapport avec la prise).
        // Seuls le statut et la date de TENUE sont relus à la source : un rendez-vous affiché « à
        // traiter » peut avoir été annulé, reporté ou marqué absent depuis.
        let prisAt: Date;
        let prisAtSaisi = false;
        let tenuAt = e.tenuAt;
        if (e.rendezVousCle) {
          const pr = await tx.propositionRendezVousPresentation.findUnique({
            where: { id: e.propositionId },
            select: {
              presentationId: true,
              rendezVousCle: true,
              prisAt: true,
              ecarteeAt: true,
              retenueAt: true,
            },
          });
          if (!pr || pr.ecarteeAt || pr.retenueAt)
            throw new Refus("Cette proposition a déjà été traitée.");
          if (pr.presentationId !== p.id || pr.rendezVousCle !== e.rendezVousCle)
            throw new Refus(MESSAGE_SANS_PROPOSITION);
          if (!dateValide(pr.prisAt)) throw new Refus("Date de prise du rendez-vous illisible.");
          prisAt = pr.prisAt;
          // Rencontre : la date de prise saisie par le dirigeant remplace celle de la proposition,
          // puis passe par `rendezVousRecevable` comme toute autre (pris_avant_saisie / pris_apres_reservation).
          if (e.source === "rencontre" && e.rendezVousCle.startsWith("rencontre:")) {
            if (e.prisAt !== undefined) {
              if (!dateValide(e.prisAt)) throw new Refus("Date de prise du rendez-vous illisible.");
              prisAt = e.prisAt;
              prisAtSaisi = true;
            }
          }
          const src = await lireSourceRendezVous(tx, e.rendezVousCle);
          if (!src) throw new Refus(MESSAGE_RDV_INTROUVABLE);
          if (rendezVousNonTenu(src)) throw new Refus(MESSAGE_RDV_NON_TENU);
          if (src.tenuAt) tenuAt = src.tenuAt;
        } else {
          prisAt = e.prisAt as Date; // lisibilité vérifiée en tête de fonction
        }

        // Recevabilité du rendez-vous (règle du lot 2).
        const recevable = rendezVousRecevable({
          recueAt: p.recueAt,
          reserveeJusquAt: reservation.reserveeJusquAt,
          prisAt,
          tenuAt,
          maintenant,
        });
        if (!recevable.ok) throw new Refus(MESSAGES_MOTIF[recevable.motif]);

        // « Premier rendez-vous tenu » : un rendez-vous plus ancien, réellement tenu, proposé pour
        // la même présentation passe avant (valider le plus tardif repousserait le départ des
        // 6 mois). Les propositions écartées, ou dont le rendez-vous n'a pas eu lieu, ne comptent pas.
        const proposees = await tx.propositionRendezVousPresentation.findMany({
          where: {
            presentationId: p.id,
            ecarteeAt: null,
            ...(e.rendezVousCle ? { rendezVousCle: { not: e.rendezVousCle } } : {}),
          },
          select: { rendezVousCle: true },
        });
        for (const autre of proposees) {
          const src = await lireSourceRendezVous(tx, autre.rendezVousCle);
          if (!src?.tenuAt || rendezVousNonTenu(src)) continue;
          if (
            src.tenuAt.getTime() <= maintenant.getTime() &&
            src.tenuAt.getTime() < tenuAt.getTime()
          )
            throw new Refus(MESSAGE_PREMIER_RDV);
        }

        // E1 : une réservation terminée sans validation occupe encore l'entreprise 30 jours.
        const enGrace = await lireIdsEnGrace(maintenant, tx);
        const occupantes: Prisma.PresentationEntrepriseWhereInput[] = [
          { statut: { in: ["reservee", "confirmee"] } },
          { statut: "terminee", id: { in: enGrace } },
        ];

        // Rattrapage : AUCUNE autre déclaration de la même entreprise ne doit l'occuper aujourd'hui.
        // Sinon on ne tranche pas ici : Williams est alerté (hors transaction, ci-dessous).
        if (rattrapage && (await rattrapageEnConflit(tx, p, maintenant)))
          throw new Refus(MESSAGE_CONFLIT_RATTRAPAGE, true);

        // Jamais deux apporteurs : aucune autre déclaration du même périmètre ne doit occuper
        // l'entreprise (une plus ancienne qui court encore, ou une déjà validée).
        const autres = await tx.presentationEntreprise.findMany({
          where: {
            siren: p.siren,
            id: { not: p.id },
            apporteurId: { not: p.apporteurId },
            OR: occupantes,
          },
          select: { id: true, statut: true, recueAt: true, protegeeJusquAt: true },
        });
        if (autres.length > 0) {
          const ids = [p.id, ...autres.map((a) => a.id)];
          const [etabs, lignes, propositionsAutres] = await Promise.all([
            lireEtablissements(ids, tx),
            tx.presentationReservation.findMany({
              where: { presentationId: { in: autres.map((a) => a.id) } },
              select: {
                presentationId: true,
                reserveeJusquAt: true,
                echueAt: true,
                rendezVousPrisAt: true,
                valideeAt: true,
              },
            }),
            // Un rendez-vous PRIS pendant la réservation d'une déclaration plus ancienne, pas
            // encore tenu, la retient au-delà du terme : il n'est écrit nulle part ailleurs que
            // dans ses propositions (`rendezVousPrisAt` ne l'est qu'à la validation).
            tx.propositionRendezVousPresentation.findMany({
              where: {
                presentationId: { in: autres.map((a) => a.id) },
                ecarteeAt: null,
              },
              select: { presentationId: true, rendezVousCle: true, prisAt: true },
            }),
          ]);
          const reservees = new Map(lignes.map((l) => [l.presentationId, l]));
          const prisEnAttente = new Map<string, Date>();
          const parId = new Map(autres.map((a) => [a.id, a]));
          // Présentations dont AU MOINS UNE proposition annulée a été prise dans la fenêtre de
          // réservation (un ensemble : l'ordre de lecture ne change rien).
          const annuleesDansFenetre = new Set<string>();
          for (const pa of propositionsAutres) {
            const src = await lireSourceRendezVous(tx, pa.rendezVousCle);
            const pris = pa.prisAt; // jamais la date de la source
            if (src && rendezVousNonTenu(src)) {
              const a = parId.get(pa.presentationId);
              const r = reservees.get(pa.presentationId);
              if (
                a &&
                r &&
                pris.getTime() >= a.recueAt.getTime() &&
                pris.getTime() <= r.reserveeJusquAt.getTime()
              )
                annuleesDansFenetre.add(pa.presentationId);
              continue;
            }
            // Source introuvable : comme une date illisible, la proposition continue de retenir.
            const deja = prisEnAttente.get(pa.presentationId);
            if (!deja || pris.getTime() < deja.getTime())
              prisEnAttente.set(pa.presentationId, pris);
          }
          const miennePerimetre = etabs.get(p.id)!;
          const bloquant = autres.some((a) => {
            if (!memePerimetre(miennePerimetre, etabs.get(a.id)!)) return false;
            // Une déclaration plus récente et encore en attente ne bloque pas : la plus ancienne
            // passe en premier (art. 3.5). Une déjà validée, elle, bloque toujours.
            if (a.statut === "reservee" && a.recueAt.getTime() >= p.recueAt.getTime()) return false;
            const r = reservees.get(a.id);
            return presentationOccupe(
              { statut: a.statut, protegeeJusquAt: a.protegeeJusquAt },
              maintenant,
              versReservationProvisoire(
                a.recueAt,
                r
                  ? {
                      ...r,
                      rendezVousPrisAt: r.rendezVousPrisAt ?? prisEnAttente.get(a.id) ?? null,
                    }
                  : null,
              ),
            );
          });
          if (bloquant) throw new Refus(MESSAGE_AUTRE_APPORTEUR);
          // Plus ancienne, encore « réservée », même périmètre, avec un rendez-vous PRIS dans sa
          // fenêtre puis annulé : elle attend la décision du dirigeant (réputé tenu, ou écarté).
          const anciennesAnnulees = autres.filter(
            (a) =>
              a.statut === "reservee" &&
              annuleesDansFenetre.has(a.id) &&
              a.recueAt.getTime() < p.recueAt.getTime() &&
              memePerimetre(miennePerimetre, etabs.get(a.id)!),
          );
          if (anciennesAnnulees.length > 0)
            throw new Refus(messageAncienRdvAnnule(anciennesAnnulees.map((a) => a.recueAt)));
          // Plus ancienne, encore « réservée », même périmètre : la déclaration en cours (p) est
          // saisie dans les 30 jours qui suivent son terme, fenêtre où personne d'autre ne peut
          // déclarer l'entreprise : l'ancienne passe en premier. Écarter une proposition ne lève
          // que la retenue liée à CE rendez-vous, jamais ces 30 jours (art. 3.2 / 3.5).
          const anciennesEnGrace = autres.filter((a) => {
            if (a.statut !== "reservee" || a.recueAt.getTime() >= p.recueAt.getTime()) return false;
            if (!memePerimetre(miennePerimetre, etabs.get(a.id)!)) return false;
            const r = reservees.get(a.id);
            if (!r || r.valideeAt) return false;
            // Fin du 30e jour (heure de Paris) après le terme : le terme est le dernier instant du
            // 60e jour ; le jour suivant est le jour 1 des 30 jours.
            const finGrace = finDuNiemeJourParis(
              new Date(r.reserveeJusquAt.getTime() + 1),
              JOURS_APRES_RESERVATION,
            );
            return p.recueAt.getTime() <= finGrace.getTime();
          });
          if (anciennesEnGrace.length > 0)
            throw new Refus(messageAncienneEnGrace(anciennesEnGrace.map((a) => a.recueAt)));
          // Une déclaration plus récente et encore en attente ne bloque pas, mais elle attend :
          // on le dit, et on n'écrit à personne (aucun e-mail ne part seul).
          for (const a of autres)
            if (
              a.statut === "reservee" &&
              a.recueAt.getTime() >= p.recueAt.getTime() &&
              memePerimetre(miennePerimetre, etabs.get(a.id)!)
            )
              avertissements.push(
                `Une déclaration plus récente de cette entreprise, par un autre apporteur (saisie le ${heureConsole(a.recueAt)}), reste en attente : répondez-lui à la main (aucun e-mail ne part seul).`,
              );
        }

        // Proposition retenue : écrite DANS la transaction, sous condition. Écarter et valider la
        // même proposition ne réussissent jamais toutes les deux.
        if (e.rendezVousCle) {
          const retenue = await tx.propositionRendezVousPresentation.updateMany({
            where: { id: e.propositionId, presentationId: p.id, ecarteeAt: null, retenueAt: null },
            data: { retenueAt: maintenant },
          });
          if (retenue.count !== 1) throw new Refus("Cette proposition a déjà été traitée.");
        }

        // 🔑 Écritures CONDITIONNELLES : la première prend la réservation (`valideeAt` vide) ;
        // un double clic, ou un second onglet, n'en passe jamais deux.
        const prise = await tx.presentationReservation.updateMany({
          where: { presentationId: p.id, valideeAt: null },
          data: {
            rendezVousPrisAt: prisAt,
            rendezVousAt: tenuAt,
            rendezVousCle: e.rendezVousCle,
            validationMotif: e.motif?.trim() || null,
            validationSource: e.source,
            valideeAt: maintenant,
            valideeParId: e.acteurId,
          },
        });
        if (prise.count !== 1) throw new Refus(MESSAGE_DEJA_VALIDEE);
        const confirmee = await tx.presentationEntreprise.updateMany({
          where: { id: p.id, statut: { in: ["reservee", "terminee"] }, confirmeeAt: null },
          data: {
            statut: "confirmee",
            confirmeeAt: tenuAt,
            confirmationTacite: false,
            protegeeJusquAt: finDeProtectionRendezVous(tenuAt),
          },
        });
        if (confirmee.count !== 1) throw new Refus(MESSAGE_DEJA_VALIDEE);
        await tx.activityLog.create({
          data: {
            adminUserId: e.acteurId,
            action: "presentation.validee_par_rendez_vous",
            targetType: "presentation_entreprise",
            targetId: p.id,
            changes: {
              statut: "confirmee",
              source: e.source,
              rendezVousCle: e.rendezVousCle,
              canal: e.canal ?? null,
              prisAt: prisAt.toISOString(),
              prisAtSaisi,
              tenuAt: tenuAt.toISOString(),
              apporteurRetire: retire,
              rattrapage,
            },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
  } catch (err) {
    if (err instanceof Refus) {
      if (err.conflit) await alerterConflitRattrapage(e.presentationId, maintenant);
      return { ok: false, message: err.refus };
    }
    if ((err as { code?: unknown } | null)?.code === "P2034")
      return { ok: false, message: MESSAGE_CONCURRENCE };
    throw err;
  }

  // Apporteur RETIRÉ : l'annonce d'attribution n'est pas un e-mail « argent » : `envoyer` la
  // refuserait (« fiche-retiree »). On ne la tente pas et on le dit.
  if (retire)
    return {
      ok: true,
      message:
        "Entreprise validée : protection de 6 mois à compter du rendez-vous. Cet apporteur est retiré du réseau : l'annonce d'attribution ne lui est pas envoyée (seuls les e-mails liés à l'argent lui parviennent).",
      avertissements,
    };
  // Une seule annonce : `annoncerAttribution` se garde par `jobId` (aucun envoi si déjà parti).
  const annonce = await annoncerAttribution(e.presentationId, "confirmee");
  return {
    ok: true,
    message: annonce
      ? "Entreprise validée : protection de 6 mois à compter du rendez-vous ; l'apporteur est prévenu."
      : "Entreprise validée : protection de 6 mois à compter du rendez-vous. L'annonce à l'apporteur n'est pas partie (déjà envoyée, ou à refaire à la main).",
    avertissements,
  };
}

/**
 * Écarte une proposition du rapprochement. NE SUPPRIME JAMAIS : la ligne reste, datée et signée,
 * et le rapprochement ne la recrée pas. Écriture conditionnelle : un second clic ne change rien.
 */
export async function ecarterProposition(
  id: string,
  acteurId: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    // Valider et écarter écrivent la MÊME ligne sous condition (`ecarteeAt`/`retenueAt` vides),
    // chacune dans une transaction Serializable : l'une des deux échoue (count 0 ou P2034).
    const r = await prisma.$transaction(
      async (tx) => {
        const ecartee = await tx.propositionRendezVousPresentation.updateMany({
          where: { id, ecarteeAt: null, retenueAt: null },
          data: { ecarteeAt: maintenant, ecarteeParId: acteurId },
        });
        // Trace du geste (identifiants seuls) : écarter peut libérer l'entreprise.
        if (ecartee.count === 1)
          await tx.activityLog.create({
            data: {
              adminUserId: acteurId,
              action: "presentation.proposition_ecartee",
              targetType: "proposition_rendez_vous_presentation",
              targetId: id,
              changes: { ecarteeAt: maintenant.toISOString() },
            },
          });
        return ecartee;
      },
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
    return r.count === 1
      ? { ok: true }
      : { ok: false, message: "Cette proposition a déjà été traitée." };
  } catch (err) {
    if (tableAbsente(err)) return { ok: false, message: "Proposition introuvable." };
    if ((err as { code?: unknown } | null)?.code === "P2034")
      return { ok: false, message: MESSAGE_CONCURRENCE };
    throw err;
  }
}
