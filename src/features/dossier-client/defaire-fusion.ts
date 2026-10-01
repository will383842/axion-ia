/**
 * « Défaire la fusion » (chantier visio, PR 4 ; décision A3 de Will : la
 * fusion a été acceptée sur la promesse qu'elle est RÉVERSIBLE ; plan §3.17
 * point 6, [CF-01]).
 *
 * ## Ce qui revient, exactement
 *
 * Les éléments listés dans `ClientFusionElement` — personnes, projets,
 * rencontres —, avec les faits et les participants de ces rencontres et de
 * ces projets, et RIEN d'autre : une personne, un projet, un rendez-vous créés
 * sur la fiche qui est restée APRÈS la fusion y restent. Une transaction.
 *
 * ## Le refus motivé : rien n'est fait à moitié
 *
 * Si un élément déplacé a SERVI depuis sur l'autre fiche — la personne a
 * participé à un rendez-vous créé après la fusion, un fait d'un rendez-vous
 * rendu a été rangé dans un projet de l'autre fiche, un projet rendu a reçu un
 * rendez-vous créé après —, rendre l'élément casserait ces liens. On refuse,
 * et on liste les liens à défaire d'abord. Les contrôles couvrent aussi les
 * cinq liens que la base refuserait au COMMIT (vérification V1, V1-04) : un
 * rendez-vous rendu rangé dans un projet resté, une personne restée dans un
 * rendez-vous ou un projet rendu, un fait d'un rendez-vous resté rangé dans un
 * projet rendu, un fait rendu qui cite une personne restée. Dernier filet :
 * une violation de clé (23503) ou des triggers AXV03/AXV04 venue de la base
 * devient un refus motivé, jamais le message brut de Postgres.
 *
 * Refus aussi si la fusion a été écrite dans la file de sortie vers Axion
 * Partners (`emiseVersPartnersLe`, posé par `fusionnerFiches` ; jamais en
 * contrat v1) : le contrat n'a AUCUN événement « fusion défaite », et
 * « Défaire » n'en émet donc aucun (question ouverte pour Partners).
 *
 * ## Le journal ne s'efface pas
 *
 * La ligne `ClientFusion` reste : « Défaire » remplit `defaiteLe`, qui,
 * quand, pourquoi — et écrit `RencontreRattachementEvenement(annule)` pour
 * chaque rendez-vous rendu. Une proposition « à classer » que la fusion avait
 * redirigée vers la fiche restée est de nouveau proposée à la fiche absorbée
 * (V1-05). Si la fusion avait reporté un SIREN, l'ancien
 * (`sirenAbsorbeAvant`) est rétabli. Une fusion défaite n'émet rien vers
 * Partners : seule une fusion écrit dans la file, au moment où elle se fait.
 *
 * Deux fiches au même SIREN redeviennent vivantes : c'est un doublon choisi.
 * Il est permis, avec le motif, et laissé tracé comme un « créer quand même »
 * (`ActivityLog` `client.creation_forcee`) — la règle du verrou de la porte
 * n'est pas contournée en silence.
 */

import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";

import type { BaseTransactionnelle } from "./base";
import { LONGUEUR_MIN_MOTIF_FUSION } from "./fusionner";

export class ErreurDefaireFusion extends Error {
  constructor(
    message: string,
    readonly liens: readonly string[] = [],
  ) {
    super(message);
  }
}

/** L'action journalisée quand « Défaire » recrée deux fiches au même SIREN. */
export const ACTION_DOUBLON_PAR_DEFUSION = "client.creation_forcee";

export interface EntreeDefaireFusion {
  readonly fusionId: string;
  readonly motif: string;
  readonly parAdminId: string;
}

/**
 * Une violation de clé « même client » (23503) ou des triggers AXV03/AXV04,
 * levée par la base au COMMIT : un lien que les contrôles n'ont pas vu.
 */
function estRefusDeLaBase(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const x = e as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  if (x.code === "P2003" || x.code === "23503") return true;
  if (x.meta?.code === "23503" || x.meta?.code === "AXV03" || x.meta?.code === "AXV04") return true;
  return typeof x.message === "string" && /23503|AXV0[34]|foreign key/i.test(x.message);
}

export const MESSAGE_LIEN_REFUSE_PAR_LA_BASE =
  "Cette fusion ne peut pas être défaite : un élément à rendre a reçu depuis un lien vers la " +
  "fiche restée (projet, personne ou fait). Retirez d'abord ce lien, puis réessayez.";

export async function defaireFusion(
  db: BaseTransactionnelle,
  e: EntreeDefaireFusion,
): Promise<{ contacts: number; projets: number; rencontres: number }> {
  const motif = e.motif.trim();
  if (motif.length < LONGUEUR_MIN_MOTIF_FUSION) {
    throw new ErreurDefaireFusion(
      `Écrivez pourquoi vous défaites cette fusion (${LONGUEUR_MIN_MOTIF_FUSION} caractères au moins).`,
    );
  }
  try {
    return await defaireDansUneTransaction(db, e, motif);
  } catch (x) {
    if (x instanceof ErreurDefaireFusion || !estRefusDeLaBase(x)) throw x;
    throw new ErreurDefaireFusion(MESSAGE_LIEN_REFUSE_PAR_LA_BASE, ["lien refusé par la base"]);
  }
}

async function defaireDansUneTransaction(
  db: BaseTransactionnelle,
  e: EntreeDefaireFusion,
  motif: string,
): Promise<{ contacts: number; projets: number; rencontres: number }> {
  return db.$transaction(async (tx) => {
    const f = await tx.clientFusion.findUnique({
      where: { id: e.fusionId },
      select: {
        id: true,
        absorbeId: true,
        absorbantId: true,
        sirenReporte: true,
        sirenAbsorbeAvant: true,
        le: true,
        defaiteLe: true,
        emiseVersPartnersLe: true,
      },
    });
    if (f === null) throw new ErreurDefaireFusion("Fusion introuvable.");
    if (f.defaiteLe !== null) throw new ErreurDefaireFusion("Cette fusion est déjà défaite.");
    if (f.emiseVersPartnersLe !== null) {
      throw new ErreurDefaireFusion(
        "Cette fusion a été transmise à Axion Partners : elle ne se défait pas depuis la console.",
      );
    }

    const elements = await tx.clientFusionElement.findMany({
      where: { fusionId: f.id },
      select: { type: true, elementId: true },
    });
    const contacts = elements.filter((x) => x.type === "contact").map((x) => x.elementId);
    const projets = elements.filter((x) => x.type === "projet").map((x) => x.elementId);
    const rencontres = elements.filter((x) => x.type === "rencontre").map((x) => x.elementId);
    const rendues = new Set(rencontres);
    const projetsRendus = new Set(projets);

    // ── Ce qui a servi depuis, sur la fiche restée ──
    const liens: string[] = [];
    if (contacts.length > 0) {
      const participations = await tx.rencontreParticipant.findMany({
        where: { contactId: { in: contacts } },
        select: { rencontreId: true },
      });
      const ailleurs = [...new Set(participations.map((p) => p.rencontreId))].filter(
        (id) => !rendues.has(id),
      );
      if (ailleurs.length > 0) {
        liens.push(
          `${ailleurs.length} rendez-vous créé(s) après la fusion avec une personne à rendre`,
        );
      }
      const roles = await tx.projetContact.findMany({
        where: { contactId: { in: contacts } },
        select: { projetId: true },
      });
      if (roles.some((r) => !projetsRendus.has(r.projetId))) {
        liens.push("une personne à rendre a un rôle dans un projet de la fiche restée");
      }
    }
    const personnesRendues = new Set(contacts);
    const resteeSiPresente = (c: string | null): boolean =>
      typeof c === "string" && !personnesRendues.has(c);
    if (projets.length > 0) {
      const rdvDuProjet = await tx.rencontre.findMany({
        where: { projetId: { in: projets } },
        select: { id: true },
      });
      if (rdvDuProjet.some((r) => !rendues.has(r.id))) {
        liens.push("un projet à rendre a reçu un rendez-vous créé après la fusion");
      }
      // (c) une personne de la fiche restée a un rôle dans un projet rendu.
      const rolesDuProjet = await tx.projetContact.findMany({
        where: { projetId: { in: projets } },
        select: { contactId: true },
      });
      if (rolesDuProjet.some((r) => resteeSiPresente(r.contactId))) {
        liens.push("une personne de la fiche restée a un rôle dans un projet à rendre");
      }
      // (d) un fait d'un rendez-vous resté, rangé dans un projet rendu (AXV03).
      const faitsRanges = await tx.fait.findMany({
        where: { projetId: { in: projets }, rencontreId: { not: null } },
        select: { rencontreId: true },
      });
      if (faitsRanges.some((x) => x.rencontreId !== null && !rendues.has(x.rencontreId))) {
        liens.push(
          "un fait d'un rendez-vous de la fiche restée a été rangé dans un projet à rendre",
        );
      }
    }
    if (rencontres.length > 0) {
      const faits = await tx.fait.findMany({
        where: { rencontreId: { in: rencontres }, projetId: { not: null } },
        select: { projetId: true },
      });
      if (faits.some((x) => x.projetId !== null && !projetsRendus.has(x.projetId))) {
        liens.push(
          "un fait d'un rendez-vous à rendre a été rangé dans un projet de la fiche restée",
        );
      }
      // (a) un rendez-vous rendu, rangé depuis dans un projet resté.
      const rdvRendus = await tx.rencontre.findMany({
        where: { id: { in: rencontres }, projetId: { not: null } },
        select: { projetId: true },
      });
      if (rdvRendus.some((r) => r.projetId !== null && !projetsRendus.has(r.projetId))) {
        liens.push("un rendez-vous à rendre a été rangé dans un projet de la fiche restée");
      }
      // (b) une personne de la fiche restée ajoutée à un rendez-vous rendu.
      const presents = await tx.rencontreParticipant.findMany({
        where: { rencontreId: { in: rencontres }, contactId: { not: null } },
        select: { contactId: true },
      });
      if (presents.some((p) => resteeSiPresente(p.contactId))) {
        liens.push("une personne de la fiche restée participe à un rendez-vous à rendre");
      }
    }
    // (e) un fait rendu qui cite (sujet, locuteur) une personne de la fiche restée.
    if (rencontres.length > 0 || projets.length > 0) {
      const faitsRendus = await tx.fait.findMany({
        where: {
          clientId: f.absorbantId,
          OR: [
            ...(rencontres.length > 0 ? [{ rencontreId: { in: rencontres } }] : []),
            ...(projets.length > 0 ? [{ projetId: { in: projets } }] : []),
          ],
        },
        select: { contactSujetId: true, contactLocuteurId: true },
      });
      if (
        faitsRendus.some(
          (x) => resteeSiPresente(x.contactSujetId) || resteeSiPresente(x.contactLocuteurId),
        )
      ) {
        liens.push("un fait à rendre cite une personne de la fiche restée");
      }
    }
    if (liens.length > 0) {
      throw new ErreurDefaireFusion(
        "Cette fusion ne peut pas être défaite tant que ces liens existent : " +
          liens.join(" ; ") +
          ".",
        liens,
      );
    }

    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");

    const vers = { clientId: f.absorbeId };
    if (contacts.length > 0) {
      await tx.clientContact.updateMany({ where: { id: { in: contacts } }, data: vers });
    }
    if (projets.length > 0) {
      await tx.projet.updateMany({ where: { id: { in: projets } }, data: vers });
      await tx.projetContact.updateMany({ where: { projetId: { in: projets } }, data: vers });
      await tx.questionnaireCadrage.updateMany({
        where: { projetId: { in: projets } },
        data: vers,
      });
    }
    if (rencontres.length > 0) {
      await tx.rencontre.updateMany({ where: { id: { in: rencontres } }, data: vers });
      await tx.rencontreParticipant.updateMany({
        where: { rencontreId: { in: rencontres }, clientId: f.absorbantId },
        data: vers,
      });
      await tx.emailSuivi.updateMany({ where: { rencontreId: { in: rencontres } }, data: vers });
    }
    await tx.fait.updateMany({
      where: {
        clientId: f.absorbantId,
        OR: [
          ...(rencontres.length > 0 ? [{ rencontreId: { in: rencontres } }] : []),
          ...(projets.length > 0 ? [{ projetId: { in: projets } }] : []),
        ],
      },
      data: vers,
    });

    if (f.sirenReporte) {
      // Rendre son SIREN à l'absorbée change un champ TRANSMIS : `client.mis_a_jour` (INT-T03).
      const avant = await chargeClientAvant(tx, f.absorbeId);
      await tx.client.update({ where: { id: f.absorbeId }, data: { siren: f.sirenAbsorbeAvant } });
      await emettreFaitClient(tx, f.absorbeId, { avant });
    }

    // V1-05 : les propositions que la fusion a redirigées (journal « propose »
    // absorbée → restée, daté de la fusion) reviennent à la fiche absorbée —
    // seulement si elles attendent encore, chez la fiche restée.
    const redirigees = await tx.rencontreRattachementEvenement.findMany({
      where: {
        action: "propose",
        ancienClientId: f.absorbeId,
        nouveauClientId: f.absorbantId,
        survenuLe: { gte: f.le },
      },
      select: { rencontreId: true },
    });
    const aRendre = await tx.rencontre.findMany({
      where: {
        id: { in: [...new Set(redirigees.map((x) => x.rencontreId))] },
        clientId: null,
        clientProposeId: f.absorbantId,
      },
      select: { id: true, motifProposition: true },
    });
    for (const r of aRendre) {
      await tx.rencontre.update({ where: { id: r.id }, data: { clientProposeId: f.absorbeId } });
    }

    const le = new Date();
    await tx.clientFusion.update({
      where: { id: f.id },
      data: { defaiteLe: le, defaiteParAdminId: e.parAdminId, motifDefaite: motif.slice(0, 300) },
    });
    if (rencontres.length > 0) {
      await tx.rencontreRattachementEvenement.createMany({
        data: rencontres.map((rencontreId) => ({
          rencontreId,
          action: "annule" as const,
          ancienClientId: f.absorbantId,
          nouveauClientId: f.absorbeId,
          parAdminId: e.parAdminId,
        })),
      });
    }
    if (aRendre.length > 0) {
      await tx.rencontreRattachementEvenement.createMany({
        data: aRendre.map((r) => ({
          rencontreId: r.id,
          action: "propose" as const,
          ancienClientId: f.absorbantId,
          nouveauClientId: f.absorbeId,
          motif: r.motifProposition,
          parAdminId: e.parAdminId,
        })),
      });
    }

    // Deux fiches vivantes au même SIREN : un doublon CHOISI, tracé.
    const fiches = await tx.client.findMany({
      where: { id: { in: [f.absorbeId, f.absorbantId] } },
      select: { id: true, siren: true },
    });
    const sirens = fiches.map((x) => x.siren);
    if (sirens.length === 2 && sirens[0] !== null && sirens[0] === sirens[1]) {
      await tx.activityLog.create({
        data: {
          adminUserId: e.parAdminId,
          action: ACTION_DOUBLON_PAR_DEFUSION,
          targetType: "Client",
          targetId: f.absorbeId,
          changes: { motif, origine: "fusion_defaite", fusionId: f.id },
        },
      });
    }

    return { contacts: contacts.length, projets: projets.length, rencontres: rencontres.length };
  });
}
