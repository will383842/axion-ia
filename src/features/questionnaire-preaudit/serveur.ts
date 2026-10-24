/**
 * Lecture et écriture du questionnaire de pré-audit (2026-10-24).
 *
 * Écrivains de la table (verrouillés par le cliquet nominatif) : `deposerQuestionnaire`,
 * `marquerEnvoye`, `enregistrerReponse`, `marquerLu`. Aucun n'envoie d'e-mail : seul
 * `envoyer.ts` le fait, sur clic de Will.
 */

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import { jetonQuestionnaire, jetonValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { SITE_URL } from "@/lib/site-url";

import {
  ENVOIS_MAX_PAR_QUESTIONNAIRE,
  lignesDeLaCharge,
  type ChargeValide,
  type ReponseLisible,
} from "./donnees";
import { validerHtml } from "./html";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Le chemin public d'un questionnaire (page à jeton), ou `null` sans secret de production. */
export function cheminPreaudit(id: string): string | null {
  const jeton = jetonQuestionnaire(id);
  return jeton === null ? null : `/questionnaire/preaudit/${id.toLowerCase()}/${jeton}`;
}

export function urlPreaudit(id: string): string | null {
  const chemin = cheminPreaudit(id);
  return chemin === null ? null : `${SITE_URL}${chemin}`;
}

/** Le questionnaire de ce lien, ou `null` si le jeton est faux ou le questionnaire inconnu. */
export async function lireParJeton(id: string, jeton: string) {
  if (!UUID.test(id.toLowerCase()) || !jetonValide(id, jeton)) return null;
  return prisma.questionnaireAvantAudit.findUnique({ where: { id: id.toLowerCase() } });
}

export async function lireDeLaRencontre(rencontreId: string) {
  return prisma.questionnaireAvantAudit.findUnique({
    where: { rencontreId },
    select: { id: true, ref: true, creeLe: true, envoyeLe: true, luLe: true },
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

/** Posé par le clic « Envoyer » de Will, après la mise en file de l'e-mail. */
export async function marquerEnvoye(id: string): Promise<void> {
  await prisma.questionnaireAvantAudit.update({ where: { id }, data: { envoyeLe: new Date() } });
}

/** Une réponse d'une personne, chiffrée. Refus tant que le questionnaire n'est pas envoyé. */
export async function enregistrerReponse(
  q: { id: string; envoyeLe: Date | null },
  charge: ChargeValide,
): Promise<"ok" | "pas_envoye" | "trop"> {
  if (q.envoyeLe === null) return "pas_envoye";
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
