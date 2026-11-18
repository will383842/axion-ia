/**
 * Veille des réponses écrites à la main restées « en cours d'envoi » (W1-S2).
 *
 * Une ligne `pending` dont plus aucun job BullMQ ne s'occupe (file vidée, envoi interrompu)
 * n'aurait aucun bouton dans la console. On la passe donc en « issue inconnue » : elle devient
 * traitable (« Réessayer » relit le marqueur Redis, `dejaParti`).
 *
 * ⛔ Cette veille N'ENVOIE RIEN et ne remet RIEN en file : aucun import de `sendEmail` ni
 * d'`enqueueEmail`. Elle ne touche jamais au verrou ni au marqueur Redis. Elle n'alerte pas
 * elle-même : `health.ts` lève les alertes (une alerte sur l'e-mail ne passe pas par l'e-mail).
 *
 * Écrire « perdue » à tort est sans doublon : le job qui reviendrait sort par `dejaParti`
 * (préfixe), ou, déjà en train d'envoyer, écrit `sent`.
 */
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { emailsQueue } from "@/server/queue/queues";
import {
  MOTIF_ISSUE_INCONNUE,
  PREFIXE_ISSUE_INCONNUE,
  type GabaritReponse,
} from "@/lib/email/reponse-manuelle-etat";

/** Âge à partir duquel une réponse « en cours » est anormale. */
export const SEUIL_EN_COURS_MIN = 60;
/** Attente entre les deux parcours de la file (course avec « Réessayer »). */
export const ATTENTE_ENTRE_PARCOURS_MS = 5_000;
/** `getJobs` rendant ce nombre de jobs, la liste est peut-être tronquée. */
export const BORNE_PARCOURS = 1000;

const ETATS_FILE = ["active", "waiting", "delayed", "prioritized", "paused"] as const;
const GABARITS: readonly GabaritReponse[] = ["submission-reply", "candidature-reponse"];

export interface ConfigRedis {
  politique: string;
  aof: boolean;
}

export interface VeilleReponses {
  /** Réponses dont un job existe depuis plus d'une heure (aucune écriture). */
  enFileDepuisTrop: number;
  /** Réponses sans job passées en « issue inconnue » par cette veille. */
  perduesCloses: number;
  /** La file n'a pas pu être lue de façon sûre : aucune écriture n'a été faite. */
  mesureImpossible: boolean;
  redis: ConfigRedis | null;
}

interface LigneEnCours {
  id: string;
  repliedAt: Date;
  errorMsg: string | null;
}

const estGabarit = (t: unknown): t is GabaritReponse =>
  typeof t === "string" && (GABARITS as readonly string[]).includes(t);

/** `replyId` (par gabarit) → horodatage du job le plus récent. `null` : liste douteuse. */
async function parcourirFile(): Promise<Map<string, number> | null> {
  if (!emailsQueue) return null;
  const jobs = await emailsQueue.getJobs([...ETATS_FILE], 0, BORNE_PARCOURS - 1);
  if (jobs.length >= BORNE_PARCOURS) return null;
  const parReponse = new Map<string, number>();
  for (const j of jobs) {
    const template: unknown = j?.data?.template;
    const replyId: unknown = j?.data?.payload?.["replyId"];
    if (!estGabarit(template) || typeof replyId !== "string") continue;
    const cle = `${template}:${replyId}`;
    parReponse.set(cle, Math.max(parReponse.get(cle) ?? 0, j.timestamp ?? 0));
  }
  return parReponse;
}

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** `INFO` et non `CONFIG` (peut être désactivée). `null` si illisible ou incomplet. */
export async function lireConfigRedis(): Promise<ConfigRedis | null> {
  try {
    const [memoire, persistance] = await Promise.all([
      redis.info("memory"),
      redis.info("persistence"),
    ]);
    const politique = /^maxmemory_policy:(\S+)/m.exec(String(memoire))?.[1];
    const aof = /^aof_enabled:(\d)/m.exec(String(persistance))?.[1];
    if (politique === undefined || aof === undefined) return null;
    return { politique, aof: aof === "1" };
  } catch {
    return null;
  }
}

export async function veillerReponsesEnCours(
  maintenant: Date,
  options: { attenteMs?: number } = {},
): Promise<VeilleReponses> {
  const resultat: VeilleReponses = {
    enFileDepuisTrop: 0,
    perduesCloses: 0,
    mesureImpossible: false,
    redis: null,
  };
  const seuil = maintenant.getTime() - SEUIL_EN_COURS_MIN * 60_000;
  const lecture = { where: { deliveryStatus: "pending", sentAt: null }, select: LECTURE } as const;

  const [messages, candidatures] = await Promise.all([
    prisma.submissionReply.findMany({ ...lecture }) as Promise<LigneEnCours[]>,
    prisma.jobApplicationReply.findMany({ ...lecture }) as Promise<LigneEnCours[]>,
  ]);

  if (messages.length + candidatures.length > 0) {
    await traiter(messages, candidatures, maintenant, seuil, options.attenteMs, resultat);
  }
  resultat.redis = await lireConfigRedis();
  return resultat;
}

const LECTURE = { id: true, repliedAt: true, errorMsg: true } as const;

async function traiter(
  messages: LigneEnCours[],
  candidatures: LigneEnCours[],
  maintenant: Date,
  seuil: number,
  attenteMs: number | undefined,
  resultat: VeilleReponses,
): Promise<void> {
  const lignes = [
    ...messages.map((l) => ({ g: "submission-reply" as const, l })),
    ...candidatures.map((l) => ({ g: "candidature-reponse" as const, l })),
  ];

  let premier: Map<string, number> | null;
  try {
    premier = await parcourirFile();
  } catch {
    premier = null;
  }
  if (premier === null) {
    resultat.mesureImpossible = true;
    return;
  }

  const candidates: typeof lignes = [];
  for (const x of lignes) {
    const ts = premier.get(`${x.g}:${x.l.id}`);
    if (ts !== undefined) {
      if (ts <= seuil) resultat.enFileDepuisTrop += 1;
    } else if (x.l.repliedAt.getTime() <= seuil) {
      candidates.push(x);
    }
  }
  if (candidates.length === 0) return;

  await attendre(attenteMs ?? ATTENTE_ENTRE_PARCOURS_MS);
  let second: Map<string, number> | null;
  try {
    second = await parcourirFile();
  } catch {
    second = null;
  }
  if (second === null) {
    resultat.mesureImpossible = true;
    return;
  }

  for (const { g, l } of candidates) {
    if (second.has(`${g}:${l.id}`)) continue;
    const args = {
      where: {
        id: l.id,
        deliveryStatus: "pending" as const,
        sentAt: null,
        providerMessageId: null,
        OR: [{ errorMsg: null }, { NOT: { errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE } } }],
      },
      data: {
        deliveryStatus: "failed" as const,
        failedAt: maintenant,
        errorMsg: MOTIF_ISSUE_INCONNUE,
      },
    };
    try {
      const r =
        g === "submission-reply"
          ? await prisma.submissionReply.updateMany(args)
          : await prisma.jobApplicationReply.updateMany(args);
      if (r.count === 1) resultat.perduesCloses += 1;
    } catch (e) {
      console.error(
        "[veille-reponses] écriture impossible sur une réponse :",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
