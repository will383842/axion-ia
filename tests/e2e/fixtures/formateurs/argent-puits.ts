// Banc @formateurs, équipe ARGENT — lire le TEXTE d'un message capté par le puits.
//
// `puits-smtp.ts` dit qu'un message est arrivé ; un test d'argent doit aussi lire ce
// qu'il annonce (montant, date limite, motif) : l'API Mailpit rend le corps texte.

import { messagesCaptes, URL_PUITS, type MessageCapte } from "./puits-smtp";

export interface MessageLu extends MessageCapte {
  readonly texte: string;
}

export async function messagesLus(adresse: string): Promise<MessageLu[]> {
  const captes = await messagesCaptes(adresse);
  const lus: MessageLu[] = [];
  for (const m of captes) {
    const r = await fetch(`${URL_PUITS}/api/v1/message/${m.id}`);
    if (!r.ok) throw new Error(`puits SMTP : HTTP ${r.status} sur le message ${m.id}`);
    const corps = (await r.json()) as { Text?: string; HTML?: string };
    const texte = corps.Text?.trim()
      ? corps.Text
      : (corps.HTML ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    lus.push({ ...m, texte: texte.replace(/\s+/g, " ") });
  }
  return lus;
}

/**
 * Le job F36 (autofacture) tel qu'il a été POSÉ dans la file : gabarit, destinataire,
 * valeurs. Le puits ne peut pas le recevoir — F36 joint sa pièce depuis R2, le banc n'a
 * aucun seau, et le worker REFUSE alors l'envoi (« pièces jointes demandées mais R2 non
 * configuré »), ce qui est juste. L'exécuteur en garde une copie avant de retirer le job
 * après sa première tentative (`retirerF36ApresUnRefus`) : ce qui a été demandé à la
 * file se constate au centime et à la date près.
 */
export async function jobF36(statementId: string): Promise<{
  template: string;
  to: string;
  payload: Record<string, unknown>;
  attachments?: unknown[];
} | null> {
  const { Redis } = await import("ioredis");
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  try {
    const brut = await redis.get(`banc:argent:f36:${statementId}`);
    return brut === null ? null : JSON.parse(brut);
  } finally {
    redis.disconnect();
  }
}

/**
 * Le job d'un e-mail enfilé (`bull:emails:<jobId>`), lu dans Redis : gabarit,
 * destinataire, valeurs. BullMQ garde le job sept jours après son traitement : il se lit
 * avant comme après le passage du worker.
 *
 * 🔑 Pourquoi les scénarios d'argent constatent ici plutôt qu'au puits : le worker
 * d'e-mails est BRIDÉ à 40 envois par heure (`email-worker.ts`, `limiter`), pour TOUT
 * le banc. Une exécution complète en consomme déjà une trentaine ; attendre la remise au
 * puits ferait dépendre chaque scénario du volume des autres équipes — un test instable.
 * La remise elle-même est prouvée par `envois-par-la-file.spec.ts`.
 */
export async function jobEnFile(jobId: string): Promise<{
  template: string;
  to: string;
  payload: Record<string, unknown>;
} | null> {
  const { Redis } = await import("ioredis");
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  try {
    const brut = await redis.hget(`bull:emails:${jobId}`, "data");
    return brut === null ? null : JSON.parse(brut);
  } finally {
    redis.disconnect();
  }
}
