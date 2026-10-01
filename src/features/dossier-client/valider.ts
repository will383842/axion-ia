/**
 * « Valider et préparer le devis » — LE bouton de l'écran « Après l'appel »
 * (chantier visio, PR 4 ; plan §3.13 point 5).
 *
 * Un seul clic, une seule transaction, qui écrit :
 *   1. le PROJET de la rencontre — un projet existant, ou un projet créé à
 *      l'instant (`creer-projet.ts`) — et y RANGE les faits « à ranger »
 *      cochés ;
 *   2. la VALIDATION des faits cochés ;
 *   3. la NOTE MANUELLE, si Will en a tapé une (`note-manuelle.ts`) : ses
 *      faits et un compte rendu `manuel` validé ;
 *   4. le SUIVI (issue, suite, échéance) par la fonction unique
 *      `enregistrerSuivi()` — et, si le lien Calendly vit, sa recopie dans
 *      l'onglet « Rendez-vous ».
 * Une erreur n'importe où annule TOUT : aucun projet vide, aucun fait validé
 * sans son suivi.
 *
 * ## Ce que « Valider tous » ne valide JAMAIS
 *
 * `faitsValidablesEnLot()` décide quelles cases sont cochées d'avance. Elle
 * écarte :
 *   · un fait « à ranger » (portée non choisie) — la base le refuserait
 *     d'ailleurs (CHECK `faits_valide_range`) ; le code le dit d'abord ;
 *   · un fait de confiance FAIBLE ;
 *   · un fait « en attente » (passage sensible) ;
 *   · les types validés UN PAR UN (`TYPES_VALIDES_UN_PAR_UN` : budget,
 *     décideur, mise en relation) ;
 *   · un budget seulement « confirmé sur reformulation » (c'est Williams qui a
 *     dit le chiffre, le client a dit « oui »).
 * Ces faits restent validables un par un, en cochant leur case.
 *
 * Module neutre (aucune session lue ici : l'action la vérifie).
 */

import type {
  FaitCertitude,
  FaitType,
  RendezVousIssue,
  RendezVousSuite,
} from "../../../prisma/generated/client";
import { exigerValidationPossible } from "@/server/visio/gestes-compte-rendu";
import { TYPES_VALIDES_UN_PAR_UN } from "@/server/visio/types-de-faits";
import { dansLaTransaction, type BaseTransactionnelle, type Tx } from "./base";
import { compteRenduEnregistre } from "./compte-rendu-en-preparation";
import { creerProjet } from "./creer-projet";
import { enregistrerNoteManuelle, noteVide, type SaisieNote } from "./note-manuelle";
import { enregistrerSuiviDansLaTransaction } from "./suivi";

/** Ce que la validation en lot regarde d'un fait. */
export interface FaitAValider {
  readonly id: string;
  readonly type: FaitType;
  readonly portee: "entreprise" | "projet" | "a_ranger";
  readonly statut: string;
  readonly confiance: "haute" | "moyenne" | "faible";
  readonly certitude: FaitCertitude;
}

/** Ce fait peut-il être coché d'avance par « Valider tous » ? PUR. */
export function validableEnLot(f: FaitAValider): boolean {
  if (f.statut !== "propose") return false;
  if (f.portee === "a_ranger") return false;
  if (f.confiance === "faible") return false;
  if (TYPES_VALIDES_UN_PAR_UN.includes(f.type)) return false;
  if (f.type === "budget" && f.certitude === "confirme_sur_reformulation") return false;
  return true;
}

/** Les faits cochés d'avance par « Valider tous ». PUR. */
export function faitsValidablesEnLot<F extends FaitAValider>(faits: readonly F[]): F[] {
  return faits.filter(validableEnLot);
}

export class ErreurValidation extends Error {}

export type ChoixProjet =
  | { readonly mode: "existant"; readonly projetId: string }
  | { readonly mode: "nouveau"; readonly titre: string }
  | { readonly mode: "aucun" };

export interface EntreeValiderApresLAppel {
  readonly rencontreId: string;
  readonly parAdminId: string;
  readonly projet: ChoixProjet;
  /**
   * V1-03 : les AUTRES projets évoqués du rendez-vous, chacun avec son choix
   * (« principal » : le projet ci-dessus). Leurs faits « à ranger » cochés vont
   * dans le projet du groupe, jamais dans celui du rendez-vous.
   */
  readonly groupes?: ReadonlyArray<{
    readonly projet: ChoixProjet | { readonly mode: "principal" };
    readonly faitIds: readonly string[];
  }>;
  /** Faits cochés (à valider). Les « à ranger » cochés vont au projet. */
  readonly faitsCoches: readonly string[];
  readonly note: SaisieNote | null;
  readonly suivi: {
    readonly issue: RendezVousIssue;
    readonly suite: RendezVousSuite | null;
    readonly suiteLe: Date | null;
  };
  readonly renseignePar?: string | null;
  readonly maintenant?: Date;
}

export interface ResultatValider {
  readonly clientId: string;
  readonly projetId: string | null;
  readonly compteRenduId: string | null;
  readonly faitsValides: number;
}

async function rangerDansLeProjet(
  tx: Tx,
  faitIds: readonly string[],
  clientId: string,
  projetId: string,
  parAdminId: string,
): Promise<void> {
  for (const id of faitIds) {
    const f = await tx.fait.findUnique({
      where: { id },
      select: { id: true, clientId: true, portee: true },
    });
    if (f === null || f.clientId !== clientId || f.portee !== "a_ranger") continue;
    await tx.fait.update({ where: { id }, data: { portee: "projet", projetId } });
    await tx.faitEvenement.create({
      data: {
        faitId: id,
        action: "deplace",
        ancienClientId: clientId,
        nouveauClientId: clientId,
        ancienPortee: "a_ranger",
        nouveauPortee: "projet",
        nouveauProjetId: projetId,
        parAdminId,
      },
    });
  }
}

async function exigerProjetDuClient(tx: Tx, projetId: string, clientId: string): Promise<void> {
  const p = await tx.projet.findUnique({ where: { id: projetId }, select: { clientId: true } });
  if (p === null || p.clientId !== clientId) {
    throw new ErreurValidation("Ce projet n'appartient pas à ce client.");
  }
}

/** Le bouton unique. Voir l'en-tête. */
export async function validerApresLAppel(
  db: BaseTransactionnelle,
  e: EntreeValiderApresLAppel,
): Promise<ResultatValider> {
  const maintenant = e.maintenant ?? new Date();
  return db.$transaction(async (tx): Promise<ResultatValider> => {
    const r = await tx.rencontre.findUnique({
      where: { id: e.rencontreId },
      select: {
        id: true,
        clientId: true,
        projetId: true,
        rattachementStatut: true,
        debutPrevu: true,
        debutReel: true,
      },
    });
    if (r === null) throw new ErreurValidation("Rendez-vous introuvable.");
    if (r.clientId === null || r.rattachementStatut !== "valide") {
      throw new ErreurValidation(
        "Rangez d'abord ce rendez-vous chez un client (« Confirmer le client proposé » ou « Créer la fiche prospect »).",
      );
    }
    const clientId = r.clientId;
    const coches = [...new Set(e.faitsCoches)];
    // ⛔ Plusieurs voix côté client : « Valider tous » attend que Will ait dit
    // qui est qui (fiche PR 6) — sinon un fait serait attribué à la mauvaise
    // personne. Sans enregistrement, ou avec une seule voix, rien n'est exigé.
    // ⛔ G16 : et si l'accord d'une personne n'a pas été retrouvé, Will doit
    // l'avoir confirmé à la main avant que rien de ce rendez-vous ne soit validé.
    if (coches.length > 0) await exigerValidationPossible(tx, e.rencontreId);

    // 0. Les autres projets évoqués (V1-03) : chaque groupe dans SON projet,
    // avant le projet du rendez-vous, qui ne reçoit que le reste.
    const dejaRanges = new Set<string>();
    for (const g of e.groupes ?? []) {
      if (g.projet.mode === "principal") continue;
      const siens = coches.filter((id) => g.faitIds.includes(id) && !dejaRanges.has(id));
      for (const id of siens) dejaRanges.add(id);
      if (g.projet.mode === "aucun" || siens.length === 0) continue;
      if (g.projet.mode === "nouveau") {
        const aRanger = (
          await tx.fait.findMany({
            where: { id: { in: siens }, clientId, portee: "a_ranger" },
            select: { id: true },
          })
        ).map((f) => f.id);
        await creerProjet(dansLaTransaction(tx), {
          clientId,
          titre: g.projet.titre,
          faitsARangerIds: aRanger,
          parAdminId: e.parAdminId,
          maintenant,
        });
      } else {
        await exigerProjetDuClient(tx, g.projet.projetId, clientId);
        await rangerDansLeProjet(tx, siens, clientId, g.projet.projetId, e.parAdminId);
      }
    }
    const pourLeRendezVous = coches.filter((id) => !dejaRanges.has(id));

    // 1. Le projet.
    let projetId: string | null = r.projetId;
    if (e.projet.mode === "nouveau") {
      const aRanger = (
        await tx.fait.findMany({
          where: { id: { in: pourLeRendezVous }, clientId, portee: "a_ranger" },
          select: { id: true },
        })
      ).map((f) => f.id);
      const cree = await creerProjet(dansLaTransaction(tx), {
        clientId,
        titre: e.projet.titre,
        faitsARangerIds: aRanger,
        parAdminId: e.parAdminId,
        maintenant,
      });
      projetId = cree.id;
    } else if (e.projet.mode === "existant") {
      await exigerProjetDuClient(tx, e.projet.projetId, clientId);
      projetId = e.projet.projetId;
      await rangerDansLeProjet(tx, pourLeRendezVous, clientId, projetId, e.parAdminId);
    }
    if (projetId !== null && r.projetId === null) {
      await tx.rencontre.update({ where: { id: r.id }, data: { projetId } });
    }

    // 2. Les faits cochés.
    let faitsValides = 0;
    for (const id of coches) {
      const f = await tx.fait.findUnique({
        where: { id },
        select: { id: true, clientId: true, portee: true, projetId: true, statut: true },
      });
      if (f === null || f.clientId !== clientId) {
        throw new ErreurValidation("Un des faits cochés n'appartient pas à ce client.");
      }
      if (f.portee === "a_ranger") {
        throw new ErreurValidation(
          "Un fait coché n'est rangé ni dans l'entreprise ni dans un projet : choisissez un projet.",
        );
      }
      if (f.statut === "valide") continue;
      if (f.statut !== "propose" && f.statut !== "en_attente") {
        throw new ErreurValidation("Un des faits cochés n'est plus à valider. Rechargez la page.");
      }
      await tx.fait.update({ where: { id }, data: { statut: "valide" } });
      await tx.faitEvenement.create({
        data: {
          faitId: id,
          action: "valide",
          nouveauClientId: clientId,
          nouveauPortee: f.portee,
          nouveauProjetId: f.projetId,
          parAdminId: e.parAdminId,
        },
      });
      faitsValides += 1;
    }

    // 3. La note manuelle.
    let compteRenduId: string | null = null;
    if (e.note !== null && !noteVide(e.note)) {
      const n = await enregistrerNoteManuelle(tx, {
        rencontreId: r.id,
        clientId,
        projetId,
        saisie: e.note,
        parAdminId: e.parAdminId,
        constateLe: r.debutReel ?? r.debutPrevu ?? maintenant,
        maintenant,
      });
      compteRenduId = n.compteRenduId;
    } else if (e.suivi.issue === "eu_lieu" && faitsValides === 0) {
      // M-2 : un compte rendu d'enregistrement en préparation dispense aussi de
      // la note — il arrive quelques minutes après l'appel.
      const existe = await tx.compteRendu.count({
        where: { rencontreId: r.id, statut: { in: ["valide", "a_valider"] } },
      });
      if (existe === 0 && (await compteRenduEnregistre(tx, r.id)) === "aucun") {
        throw new ErreurValidation(
          "Le rendez-vous a eu lieu : écrivez au moins une ligne de note (le besoin, la prochaine étape…).",
        );
      }
    }

    // 4. Le suivi.
    await enregistrerSuiviDansLaTransaction(tx, {
      rencontreId: r.id,
      issue: e.suivi.issue,
      suite: e.suivi.suite,
      suiteLe: e.suivi.suiteLe,
      auteurId: e.parAdminId,
      // Absent : l'appréciation et l'auteur de l'onglet « Rendez-vous » restent.
      ...(e.renseignePar !== undefined ? { renseignePar: e.renseignePar } : {}),
      maintenant,
    });

    return { clientId, projetId, compteRenduId, faitsValides };
  });
}
