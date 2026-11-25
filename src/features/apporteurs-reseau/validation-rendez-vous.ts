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

import { annoncerAttribution } from "./attribution-annonce";
import { lireEtablissements, memePerimetre } from "./etablissement-presentation";
import { validationParRendezVousActive } from "./interrupteur-rendez-vous";
import { presentationOccupe } from "./presentations";
import { versReservationProvisoire } from "./regle-attribution";
import {
  type MotifRendezVousRefuse,
  finDeProtectionRendezVous,
  regleDe,
  rendezVousRecevable,
} from "./regle-attribution";
import { tableAbsente } from "./reservation-presentation";
import { lireSourceRendezVous, rendezVousNonTenu } from "./statut-rendez-vous";

export type SourceValidation = "calendly" | "rencontre" | "saisie" | "commande";

export interface SaisieValidation {
  presentationId: string;
  /** « calendly:<id> » ou « rencontre:<id> » ; `null` pour une saisie manuelle du dirigeant. */
  rendezVousCle: string | null;
  /** Quand le rendez-vous a été PRIS. */
  prisAt: Date;
  /** Quand il a EU LIEU. */
  tenuAt: Date;
  source: SourceValidation;
  /** Canal d'une saisie manuelle (« telephone » / « sur_place ») ; inscrit au journal. */
  canal?: "telephone" | "sur_place" | "annule_par_axion";
  /** La proposition validée : elle est relue DANS la transaction (écartée entre-temps : refus). */
  propositionId?: string;
  /** L'administrateur qui valide (identifiant seul). */
  acteurId: string;
}

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
  "Un rendez-vous plus ancien, déjà tenu, est proposé pour cette présentation : c'est le PREMIER rendez-vous tenu qui valide (il fixe le départ des 6 mois). Validez celui-là, ou écartez-le s'il ne convient pas.";

const MESSAGE_CONCURRENCE =
  "Une autre validation est en cours sur cette entreprise : réessayez dans un instant.";

const MESSAGE_DEJA_VALIDEE = "Cette entreprise est déjà validée : rien de plus à faire.";

/** Sortie anticipée de la transaction : le refus voyage comme valeur, la transaction s'annule. */
class Refus extends Error {
  constructor(readonly refus: string) {
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
  if (!dateValide(e.prisAt) || !dateValide(e.tenuAt) || !dateValide(maintenant))
    return { ok: false, message: "Date du rendez-vous illisible." };

  const avertissements: string[] = [];
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
            apporteur: { select: { statut: true, signatureApporteur: true } },
          },
        });
        if (!p) throw new Refus("Présentation introuvable.");
        if (p.statut === "confirmee") throw new Refus(MESSAGE_DEJA_VALIDEE);
        if (p.statut !== "reservee")
          throw new Refus("Seule une présentation « en attente » peut être validée.");

        const reservation = await tx.presentationReservation.findUnique({
          where: { presentationId: p.id },
          select: { regle: true, reserveeJusquAt: true, echueAt: true, valideeAt: true },
        });
        if (!reservation || reservation.regle !== "rendez_vous")
          throw new Refus(
            "Cette présentation est d'avant la règle par rendez-vous : elle suit la confirmation habituelle.",
          );
        if (reservation.valideeAt) throw new Refus(MESSAGE_DEJA_VALIDEE);
        if (reservation.echueAt)
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
          if (retrait)
            avertissements.push(
              "Cet apporteur est retiré du réseau (son contrat n'est pas résilié) : la validation est permise.",
            );
        } catch (err) {
          if (!tableAbsente(err)) throw err;
        }

        // La proposition elle-même est relue ici : écartée ou retenue entre-temps, on ne valide pas.
        if (e.propositionId) {
          const pr = await tx.propositionRendezVousPresentation.findUnique({
            where: { id: e.propositionId },
            select: { ecarteeAt: true, retenueAt: true },
          });
          if (!pr || pr.ecarteeAt || pr.retenueAt)
            throw new Refus("Cette proposition a déjà été traitée.");
        }

        // 🔑 L'état du rendez-vous est RELU ICI, à la source, dans la transaction : une proposition
        // affichée « à traiter » peut avoir été annulée, reportée ou marquée absente depuis. Les
        // dates de la source l'emportent sur celles recopiées dans la proposition.
        let prisAt = e.prisAt;
        let tenuAt = e.tenuAt;
        if (e.rendezVousCle) {
          const src = await lireSourceRendezVous(tx, e.rendezVousCle);
          if (!src) throw new Refus(MESSAGE_RDV_INTROUVABLE);
          if (rendezVousNonTenu(src)) throw new Refus(MESSAGE_RDV_NON_TENU);
          if (src.tenuAt) tenuAt = src.tenuAt;
          if (src.prisAt) prisAt = src.prisAt;
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

        // Jamais deux apporteurs : aucune autre déclaration du même périmètre ne doit occuper
        // l'entreprise (une plus ancienne qui court encore, ou une déjà validée).
        const autres = await tx.presentationEntreprise.findMany({
          where: {
            siren: p.siren,
            id: { not: p.id },
            apporteurId: { not: p.apporteurId },
            statut: { in: ["reservee", "confirmee"] },
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
          for (const pa of propositionsAutres) {
            const src = await lireSourceRendezVous(tx, pa.rendezVousCle);
            if (!src || rendezVousNonTenu(src)) continue;
            const pris = src.prisAt ?? pa.prisAt;
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
        }

        // 🔑 Écritures CONDITIONNELLES : la première prend la réservation (`valideeAt` vide) ;
        // un double clic, ou un second onglet, n'en passe jamais deux.
        const prise = await tx.presentationReservation.updateMany({
          where: { presentationId: p.id, valideeAt: null },
          data: {
            rendezVousPrisAt: prisAt,
            rendezVousAt: tenuAt,
            rendezVousCle: e.rendezVousCle,
            validationSource: e.source,
            valideeAt: maintenant,
            valideeParId: e.acteurId,
          },
        });
        if (prise.count !== 1) throw new Refus(MESSAGE_DEJA_VALIDEE);
        const confirmee = await tx.presentationEntreprise.updateMany({
          where: { id: p.id, statut: "reservee" },
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
              tenuAt: tenuAt.toISOString(),
              apporteurRetire: avertissements.length > 0,
            },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
  } catch (err) {
    if (err instanceof Refus) return { ok: false, message: err.refus };
    if ((err as { code?: unknown } | null)?.code === "P2034")
      return { ok: false, message: MESSAGE_CONCURRENCE };
    throw err;
  }

  // La proposition retenue ne reste plus « à traiter ». Hors transaction : un échec ne défait pas
  // la validation (et une table absente — fenêtre app/worker — ne la bloque pas).
  if (e.rendezVousCle) {
    try {
      await prisma.propositionRendezVousPresentation.updateMany({
        where: {
          presentationId: e.presentationId,
          rendezVousCle: e.rendezVousCle,
          retenueAt: null,
        },
        data: { retenueAt: maintenant },
      });
    } catch (err) {
      if (!tableAbsente(err)) throw err;
    }
  }

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
    const r = await prisma.propositionRendezVousPresentation.updateMany({
      where: { id, ecarteeAt: null, retenueAt: null },
      data: { ecarteeAt: maintenant, ecarteeParId: acteurId },
    });
    return r.count === 1
      ? { ok: true }
      : { ok: false, message: "Cette proposition a déjà été traitée." };
  } catch (err) {
    if (tableAbsente(err)) return { ok: false, message: "Proposition introuvable." };
    throw err;
  }
}
