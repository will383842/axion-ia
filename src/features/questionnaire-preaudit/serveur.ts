/**
 * Lecture et écriture du questionnaire de pré-audit (2026-10-24).
 *
 * Écrivains des tables (verrouillés par le cliquet nominatif) : `deposerQuestionnaire`,
 * `reserverEnvoi`, `annulerEnvoi`, `enregistrerReponse`, `marquerLu`, `clore`,
 * `purgerReponsesAnciennes`. Aucun n'envoie d'e-mail : seul `envoyer.ts` le fait, sur clic de Will.
 */

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { SITE_URL } from "@/lib/site-url";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { jetonPreaudit, jetonPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";

import {
  ENVOIS_MAX_PAR_QUESTIONNAIRE,
  lignesDeLaCharge,
  type ChargeValide,
  type ReponseLisible,
} from "./donnees";
import { validerHtml } from "./html";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Le lien reçoit des réponses 45 jours après l'envoi, sauf clôture plus tôt par Will. */
export const VALIDITE_JOURS = 45;
/** Deux envois du même questionnaire à moins de 60 s : le second est un double clic. */
export const DELAI_ANTI_DOUBLE_CLIC_MS = 60_000;

/** Le chemin public d'un questionnaire (page à jeton), ou `null` sans secret de production. */
export function cheminPreaudit(id: string): string | null {
  const jeton = jetonPreaudit(id);
  return jeton === null ? null : `/questionnaire/preaudit/${id.toLowerCase()}/${jeton}`;
}

export function urlPreaudit(id: string): string | null {
  const chemin = cheminPreaudit(id);
  return chemin === null ? null : `${SITE_URL}${chemin}`;
}

/** Le questionnaire de ce lien, ou `null` si le jeton est faux ou le questionnaire inconnu. */
export async function lireParJeton(id: string, jeton: string) {
  if (!UUID.test(id.toLowerCase()) || !jetonPreauditValide(id, jeton)) return null;
  return prisma.questionnaireAvantAudit.findUnique({ where: { id: id.toLowerCase() } });
}

/** Le lien accepte-t-il encore des réponses réelles ? (envoyé, ni clos, ni expiré) */
export function accepteDesReponses(
  q: { envoyeLe: Date | null; closLe: Date | null; expireLe: Date | null },
  maintenant: Date = new Date(),
): boolean {
  if (q.envoyeLe === null || q.closLe !== null) return false;
  return q.expireLe === null || q.expireLe.getTime() > maintenant.getTime();
}

export async function lireDeLaRencontre(rencontreId: string) {
  return prisma.questionnaireAvantAudit.findUnique({
    where: { rencontreId },
    select: {
      id: true,
      ref: true,
      creeLe: true,
      envoyeLe: true,
      luLe: true,
      closLe: true,
      expireLe: true,
    },
  });
}

export interface ResultatDepot {
  readonly id: string;
  /** Un questionnaire déjà envoyé (sans réponse) a été recréé : l'ancien lien ne marche plus. */
  readonly ancienLienMort: boolean;
  /** E-mails encore en attente avec l'ancien lien, REJETÉS (jamais supprimés). */
  readonly emailsRejetes: number;
}

/**
 * Dépôt du HTML adapté par Will.
 *   · rien d'envoyé : remplacement sur place ;
 *   · déjà envoyé SANS aucune réponse (adresse fausse, e-mail seulement retenu en corbeille) :
 *     la ligne est recréée — nouvel identifiant, donc nouveau jeton : l'ancien lien meurt (404) ;
 *   · déjà envoyé AVEC au moins une réponse : refusé.
 *
 * Tout se passe dans UNE transaction qui verrouille la ligne (`FOR UPDATE`) ; `enregistrerReponse`
 * prend le même verrou. Une réponse validée pendant le redépôt attend la fin de la transaction,
 * trouve alors la ligne disparue et est REFUSÉE : elle n'est jamais effacée en silence par la
 * cascade. La suppression est de plus conditionnée à l'absence de réponse (`envois: { none }`).
 */
export async function deposerQuestionnaire(
  rencontreId: string,
  html: string,
): Promise<ResultatDepot> {
  const v = validerHtml(html);
  if (!v.ok) throw new MessagePourWill(v.motif);
  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    const existant = await tx.questionnaireAvantAudit.findUnique({
      where: { rencontreId },
      select: { id: true, envoyeLe: true },
    });
    let ancienLienMort = false;
    let emailsRejetes = 0;
    if (existant !== null) {
      await tx.$queryRaw`SELECT id FROM questionnaires_avant_audit WHERE id = ${existant.id}::uuid FOR UPDATE`;
      if (existant.envoyeLe === null) {
        await tx.questionnaireAvantAudit.update({ where: { id: existant.id }, data: { html } });
        return { id: existant.id, ancienLienMort: false, emailsRejetes: 0 };
      }
      const refus = new MessagePourWill(
        "Ce questionnaire a déjà reçu des réponses : il ne peut plus être remplacé. Pour écrire à " +
          "quelqu'un d'autre, déposez un questionnaire sur la rencontre de cette personne.",
      );
      const reponses = await tx.questionnaireAvantAuditEnvoi.count({
        where: { questionnaireId: existant.id },
      });
      if (reponses > 0) throw refus;
      const supprime = await tx.questionnaireAvantAudit.deleteMany({
        where: { id: existant.id, envois: { none: {} } },
      });
      if (supprime.count === 0) throw refus;
      // Les e-mails encore en attente portent l'ancien lien (mort) : REJETÉS, pas supprimés.
      const rejetes = await tx.emailOutbox.updateMany({
        where: {
          entityType: "QuestionnaireAvantAudit",
          entityId: existant.id,
          statut: { in: ["a_valider", "approuve"] },
        },
        data: {
          statut: "refuse",
          refuseAt: new Date(),
          refuseMotif: "Questionnaire redéposé : l'ancien lien n'existe plus.",
        },
      });
      emailsRejetes = rejetes.count;
      ancienLienMort = true;
    }
    const cree = await tx.questionnaireAvantAudit.create({
      data: { rencontreId, html, ref: randomBytes(6).toString("hex") },
      select: { id: true },
    });
    return { id: cree.id, ancienLienMort, emailsRejetes };
  });
}

/** L'état d'avant un envoi, à rétablir tel quel si la mise en file échoue. */
export interface EtatAvantEnvoi {
  envoyeLe: Date | null;
  expireLe: Date | null;
  closLe: Date | null;
  destinataire: string | null;
  destinataireHash: string | null;
}

/**
 * Réserve l'envoi AVANT la mise en file (anti double clic) : n'aboutit que si rien n'est parti
 * depuis moins de 60 s. Garde l'adresse (chiffrée + empreinte) pour l'export et l'effacement.
 * Rend l'état d'avant (pour `annulerEnvoi`), ou `null` si un envoi vient d'avoir lieu.
 *
 * ⛔ Dès qu'un envoi est RÉSERVÉ (`envoyeLe` posé, même si l'e-mail est seulement retenu dans la
 * corbeille), l'adresse est figée : un autre destinataire est refusé. Le lien ne dépend pas de
 * l'adresse, donc l'ancien destinataire pourrait encore répondre ; et l'export/l'effacement
 * retrouvent les réponses du dirigeant par cette adresse OU par la réservation Calendly (risque
 * voisin : une réservation Calendly prise par un TIERS rattache le questionnaire à son adresse).
 * Issue en cas d'adresse fausse : `deposerQuestionnaire` recrée le questionnaire (nouveau lien)
 * tant qu'aucune réponse n'est arrivée.
 */
export async function reserverEnvoi(
  id: string,
  destinataire: string,
  maintenant: Date = new Date(),
): Promise<EtatAvantEnvoi | null> {
  const avant = await prisma.questionnaireAvantAudit.findUnique({
    where: { id },
    select: {
      envoyeLe: true,
      expireLe: true,
      closLe: true,
      destinataire: true,
      destinataireHash: true,
    },
  });
  if (avant === null) return null;
  const hash = hashEmailForLookup(destinataire);
  // Dès qu'un envoi a abouti, l'adresse est FIGÉE (même sans réponse, même si l'effacement du
  // dirigeant a remis l'empreinte à NULL) : le lien ne dépend pas de l'adresse, donc l'ancien
  // destinataire pourrait encore répondre par l'ancien lien et ses réponses se mêleraient à
  // celles du nouveau.
  if (avant.envoyeLe !== null && avant.destinataireHash !== hash) {
    throw new MessagePourWill(
      "Ce questionnaire a déjà été envoyé à une autre adresse. Si l'adresse était fausse et que " +
        "personne n'a encore répondu, déposez-le de nouveau : l'ancien lien cessera de marcher. " +
        "Pour écrire à quelqu'un d'autre, déposez un questionnaire sur la rencontre de cette " +
        "personne.",
    );
  }
  const limite = new Date(maintenant.getTime() - DELAI_ANTI_DOUBLE_CLIC_MS);
  const r = await prisma.questionnaireAvantAudit.updateMany({
    where: { id, OR: [{ envoyeLe: null }, { envoyeLe: { lt: limite } }] },
    data: {
      envoyeLe: maintenant,
      expireLe: new Date(maintenant.getTime() + VALIDITE_JOURS * 86_400_000),
      closLe: null,
      destinataire: chiffrerParole(destinataire),
      destinataireHash: hash,
    },
  });
  return r.count === 1 ? avant : null;
}

/** La mise en file a échoué : on rétablit TOUT l'état d'avant (clôture et adresse comprises). */
export async function annulerEnvoi(id: string, avant: EtatAvantEnvoi): Promise<void> {
  await prisma.questionnaireAvantAudit.update({
    where: { id },
    data: {
      envoyeLe: avant.envoyeLe,
      expireLe: avant.expireLe,
      closLe: avant.closLe,
      destinataire: avant.destinataire,
      destinataireHash: avant.destinataireHash,
    },
  });
}

/**
 * Une réponse d'une personne, chiffrée. Refus tant que le lien n'accepte pas de réponses.
 * Même verrou que `deposerQuestionnaire` : si un redépôt est en cours, on attend sa fin, on trouve
 * la ligne disparue, et la réponse est refusée au lieu d'être effacée par la cascade.
 */
export async function enregistrerReponse(
  q: { id: string },
  charge: ChargeValide,
  maintenant: Date = new Date(),
): Promise<"ok" | "ferme" | "trop"> {
  return prisma.$transaction(async (tx): Promise<"ok" | "ferme" | "trop"> => {
    const verrou = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM questionnaires_avant_audit WHERE id = ${q.id}::uuid FOR UPDATE`;
    if (verrou.length === 0) return "ferme";
    const frais = await tx.questionnaireAvantAudit.findUnique({
      where: { id: q.id },
      select: { envoyeLe: true, closLe: true, expireLe: true },
    });
    if (frais === null || !accepteDesReponses(frais, maintenant)) return "ferme";
    const n = await tx.questionnaireAvantAuditEnvoi.count({ where: { questionnaireId: q.id } });
    if (n >= ENVOIS_MAX_PAR_QUESTIONNAIRE) return "trop";
    await tx.questionnaireAvantAuditEnvoi.create({
      data: {
        questionnaireId: q.id,
        mode: charge.mode,
        membre: charge.membre,
        donnees: chiffrerParole(charge.json),
      },
    });
    // Une nouvelle réponse repasse la fiche « à traiter » : la lecture précédente est périmée.
    await tx.questionnaireAvantAudit.update({ where: { id: q.id }, data: { luLe: null } });
    return "ok";
  });
}

export async function marquerLu(id: string, userId: string): Promise<void> {
  await prisma.questionnaireAvantAudit.update({
    where: { id },
    data: { luLe: new Date(), luParId: userId },
  });
}

/** « Clore » : le lien ne reçoit plus de réponses (les réponses déjà reçues restent). */
export async function clore(id: string): Promise<void> {
  await prisma.questionnaireAvantAudit.update({ where: { id }, data: { closLe: new Date() } });
}

/**
 * Purge de rétention : supprime les réponses reçues avant `avant`. Branchée sur une tâche
 * planifiée par la PR qui passera `PURGE_PLANIFIEE` à `true` (voir `config.ts`).
 */
export async function purgerReponsesAnciennes(avant: Date): Promise<number> {
  const r = await prisma.questionnaireAvantAuditEnvoi.deleteMany({
    where: { recuLe: { lt: avant } },
  });
  return r.count;
}

/** Les réponses, une par personne, déchiffrées pour la console. */
export async function lireReponses(questionnaireId: string): Promise<ReponseLisible[]> {
  const lignes = await prisma.questionnaireAvantAuditEnvoi.findMany({
    where: { questionnaireId },
    orderBy: { recuLe: "asc" },
  });
  return lignes.map((e) => {
    let json = "{}";
    try {
      json = dechiffrerParole(e.donnees);
    } catch {
      // clé absente ou réponse illisible : la ligne reste listée, sans contenu
    }
    return {
      id: e.id,
      mode: e.mode as ReponseLisible["mode"],
      membre: e.membre,
      recuLe: e.recuLe,
      lignes: lignesDeLaCharge(json),
    };
  });
}
