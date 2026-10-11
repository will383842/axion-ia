/**
 * Corbeille de validation des emails — accès base (audit certification 2026-07-26).
 *
 * Complète `outbox-policy.ts`, qui porte la logique pure. Ici on lit les règles
 * applicables et on gare l'email au lieu de l'envoyer.
 *
 * ⚠️ Cette couche ne doit JAMAIS faire échouer un envoi. Si la résolution de
 * politique tombe en erreur — base indisponible, table absente parce que la
 * migration n'a pas tourné — on retombe sur l'envoi direct. Bloquer un email
 * parce qu'on ne sait pas s'il faut le bloquer serait le pire des deux mondes :
 * une convocation perdue au motif d'une incertitude.
 *
 * Node runtime (Prisma). Stub-aware pour le build SSG.
 */

import { prisma } from "@/lib/prisma";
import {
  resoudreModeEnvoi,
  modeParDefaut,
  type ModeEnvoi,
  type RegleAutomatisation,
} from "./outbox-policy";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Mode d'envoi applicable à un email.
 *
 * `clientId` restreint la lecture aux règles de CE client plus les règles
 * globales : mélanger les clients produirait une résolution silencieusement
 * fausse (cf. `resoudreModeEnvoi`).
 */
export async function resoudreMode(template: string, clientId?: string | null): Promise<ModeEnvoi> {
  if (estStub()) return "auto";
  try {
    const lignes = await prisma.emailAutomationSetting.findMany({
      where: {
        OR: [{ scope: "global" }, ...(clientId ? [{ scope: "client" as const, clientId }] : [])],
      },
      select: { scope: true, template: true, mode: true },
    });
    return resoudreModeEnvoi(template, lignes as RegleAutomatisation[]);
  } catch {
    // 🔴 Lot 2 (2026-09-02) — base muette : on applique la POLITIQUE PAR DÉFAUT
    // du gabarit, pas « auto ». « auto » faisait partir devis, conventions et
    // factures sans relecture précisément quand la base était indisponible ;
    // le défaut, lui, dit « validation » pour ces trois-là et « auto » pour la
    // chaîne Qualiopi, qui doit partir seule.
    return modeParDefaut(template);
  }
}

export interface EmailAGarer {
  template: string;
  recipient: string;
  locale: "fr" | "en";
  payload: Record<string, unknown>;
  /** Sujet résolu au moment de la mise en attente — modifiable ensuite. */
  sujet: string;
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  attachments?: Array<{ filename: string; r2Key: string; contentType?: string }>;
  /** CAMP-2 — la clé d'idempotence de l'envoi, quand l'appelant en donne une. */
  jobId?: string | null;
}

/**
 * Gare un email en attente de validation. Retourne son identifiant, ou `null`
 * si la mise en attente a échoué — auquel cas l'appelant doit envoyer
 * normalement plutôt que de perdre le message.
 */
export async function garerPourValidation(input: EmailAGarer): Promise<string | null> {
  if (estStub()) return null;
  const jobId = input.jobId ? input.jobId.slice(0, 200) : null;
  if (jobId) {
    try {
      return await creerLigne(input, jobId);
    } catch (e) {
      // Fenêtre de déploiement (~50 min) : le worker neuf peut tourner sur une base
      // où la colonne `job_id` n'existe pas encore. Dans CE cas seulement, on gare
      // SANS la clé, comme avant CAMP-2, plutôt que de perdre l'e-mail. Toute autre
      // erreur suit le chemin d'avant (`null`) : regarer sans clé ouvrirait la porte
      // au doublon que la clé empêche.
      if (!colonneJobIdAbsente(e)) return null;
    }
  }
  try {
    return await creerLigne(input, null);
  } catch {
    return null;
  }
}

/** L'erreur dit-elle que la colonne `job_id` n'existe pas (encore) ? */
function colonneJobIdAbsente(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  const message = e instanceof Error ? e.message : String(e);
  return code === "P2022" || /job_id|jobId/.test(message);
}

async function creerLigne(input: EmailAGarer, jobId: string | null): Promise<string> {
  const ligne = await prisma.emailOutbox.create({
    data: {
      template: input.template,
      recipient: input.recipient,
      locale: input.locale,
      payload: input.payload as never,
      sujet: input.sujet.slice(0, 300),
      statut: "a_valider",
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.attachments && input.attachments.length > 0
        ? { attachments: input.attachments as never }
        : {}),
      ...(jobId ? { jobId } : {}),
    },
    select: { id: true },
  });
  return ligne.id;
}

/**
 * CAMP-2 — un envoi de cette clé a-t-il déjà été garé (quel que soit son statut :
 * en attente, approuvé, refusé, envoyé) ? Lu par le moteur de campagnes avec le
 * journal. `null` : on ne sait pas (base muette, colonne pas encore posée) —
 * l'appelant ne relance pas.
 */
export async function jobIdDejaGare(jobId: string): Promise<boolean | null> {
  if (estStub()) return null;
  try {
    const ligne = await prisma.emailOutbox.findFirst({
      where: { jobId: jobId.slice(0, 200) },
      select: { id: true },
    });
    return ligne !== null;
  } catch {
    return null;
  }
}

/** Nombre d'emails en attente — alimente la pastille de la console. */
export async function compterEnAttente(): Promise<number> {
  if (estStub()) return 0;
  try {
    return await prisma.emailOutbox.count({ where: { statut: "a_valider" } });
  } catch {
    return 0;
  }
}
