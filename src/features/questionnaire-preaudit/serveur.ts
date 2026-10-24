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

/** Dépôt (ou remplacement tant que rien n'est parti) du HTML adapté par Will. */
export async function deposerQuestionnaire(rencontreId: string, html: string): Promise<string> {
  const v = validerHtml(html);
  if (!v.ok) throw new MessagePourWill(v.motif);
  const existant = await prisma.questionnaireAvantAudit.findUnique({
    where: { rencontreId },
    select: { id: true, envoyeLe: true },
  });
  if (existant !== null) {
    if (existant.envoyeLe !== null) {
      throw new MessagePourWill(
        "Ce questionnaire est déjà envoyé : il ne peut plus être remplacé.",
      );
    }
    await prisma.questionnaireAvantAudit.update({ where: { id: existant.id }, data: { html } });
    return existant.id;
  }
  const cree = await prisma.questionnaireAvantAudit.create({
    data: { rencontreId, html, ref: randomBytes(6).toString("hex") },
    select: { id: true },
  });
  return cree.id;
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
 * ⛔ Une fois qu'une réponse est arrivée, l'adresse ne change plus. L'export et l'effacement
 * retrouvent les réponses du dirigeant par cette adresse OU par la réservation Calendly ; si on
 * renvoyait à une autre personne, ses réponses se mêleraient à celles de la première (export
 * livré à la mauvaise personne, effacement de la mauvaise). Risque voisin, connu : une
 * réservation Calendly prise par un TIERS (un assistant, un invité) rattache le questionnaire
 * à son adresse — d'où cette règle, et l'obligation de créer un NOUVEAU questionnaire pour un
 * autre destinataire.
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
  if (avant.destinataireHash !== null && avant.destinataireHash !== hash) {
    const recues = await prisma.questionnaireAvantAuditEnvoi.count({
      where: { questionnaireId: id },
    });
    if (recues > 0) {
      throw new MessagePourWill(
        "Des réponses sont déjà arrivées pour une autre adresse : le questionnaire ne peut plus " +
          "être renvoyé à quelqu'un d'autre. Créez un nouveau questionnaire pour ce destinataire.",
      );
    }
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

/** Une réponse d'une personne, chiffrée. Refus tant que le lien n'accepte pas de réponses. */
export async function enregistrerReponse(
  q: { id: string; envoyeLe: Date | null; closLe: Date | null; expireLe: Date | null },
  charge: ChargeValide,
  maintenant: Date = new Date(),
): Promise<"ok" | "ferme" | "trop"> {
  if (!accepteDesReponses(q, maintenant)) return "ferme";
  const n = await prisma.questionnaireAvantAuditEnvoi.count({ where: { questionnaireId: q.id } });
  if (n >= ENVOIS_MAX_PAR_QUESTIONNAIRE) return "trop";
  await prisma.questionnaireAvantAuditEnvoi.create({
    data: {
      questionnaireId: q.id,
      mode: charge.mode,
      membre: charge.membre,
      donnees: chiffrerParole(charge.json),
    },
  });
  // Une nouvelle réponse repasse la fiche « à traiter » : la lecture précédente est périmée.
  await prisma.questionnaireAvantAudit.update({ where: { id: q.id }, data: { luLe: null } });
  return "ok";
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
