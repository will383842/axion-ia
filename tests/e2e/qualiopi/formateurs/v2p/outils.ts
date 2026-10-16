// Banc @formateurs, vérification n° 2 (rouge « parcours et e-mails ») — les OUTILS
// communs des scénarios, côté `tsx`.
//
// Rangé sous `tests/e2e/qualiopi/` : il importe le domaine Qualiopi, que
// `pnpm qualiopi:isolation-check` cantonne à ses zones dédiées. Il s'appuie sur les
// données de l'équipe sécurité (`../securite/donnees.ts`) : formateurs fictifs,
// administrateur réel de la base du banc, ménage en fin de scénario.
//
// 🔑 Les interrupteurs se basculent PAR L'ACTION DE LA CONSOLE (préalables et
// cascade relus comme en production). Les lignes `settings` touchées sont
// photographiées AVANT (valeur ET date) et remises À L'IDENTIQUE à la fin : la date
// d'une ligne d'interrupteur est son « allumé le », que l'invitation F1 lit — une
// remise qui la rajeunirait changerait ce que les autres scénarios du groupe voient.

import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import { prisma } from "@/lib/prisma";
import * as interrupteursConsole from "@/server/actions/qualiopi/formateurs-interrupteurs";

import { aNettoyer, creerIndependant, seConnecter, type Admin } from "../securite/donnees";

export * from "../securite/donnees";

type EtatAction = { ok: true; message: string } | { ok: false; error: string };
type Bascule = (prev: EtatAction, fd: FormData) => Promise<EtatAction>;

/** `relances_auto` → `basculerFormateursRelancesAutoAction` (le nom de l'action de la console). */
function nomAction(cle: string): string {
  const camel = cle
    .split("_")
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join("");
  return `basculerFormateurs${camel}Action`;
}

interface Photo {
  readonly key: string;
  readonly value: unknown;
  readonly description: string | null;
  readonly updatedAt: Date;
}

let photo: Photo[] | null = null;

/** Photographie toutes les lignes d'interrupteurs (une fois par scénario). */
export async function photographierInterrupteurs(): Promise<void> {
  if (photo !== null) return;
  photo = await prisma.setting.findMany({
    where: { OR: [{ key: { startsWith: "formateurs." } }, { key: { startsWith: "signature." } }] },
    select: { key: true, value: true, description: true, updatedAt: true },
  });
}

/**
 * Remet les lignes d'interrupteurs dans l'état photographié : valeur, description ET
 * date. Une ligne créée depuis est effacée.
 */
export async function remettreInterrupteurs(): Promise<void> {
  if (photo === null) return;
  const avant = new Map(photo.map((p) => [p.key, p]));
  const maintenant = await prisma.setting.findMany({
    where: { OR: [{ key: { startsWith: "formateurs." } }, { key: { startsWith: "signature." } }] },
    select: { key: true, value: true, updatedAt: true },
  });
  for (const l of maintenant) {
    const p = avant.get(l.key);
    if (p === undefined) {
      await prisma.setting.delete({ where: { key: l.key } });
      continue;
    }
    if (l.updatedAt.getTime() === p.updatedAt.getTime()) continue;
    await prisma.setting.update({
      where: { key: l.key },
      data: { value: p.value as never, description: p.description },
    });
    await prisma.$executeRaw`UPDATE settings SET updated_at = ${p.updatedAt} WHERE key = ${l.key}`;
  }
  photo = null;
}

/** Bascule un interrupteur `formateurs.*` PAR SON ACTION de console, sous la session donnée. */
export async function basculer(direction: Admin, cle: string, actif: boolean): Promise<EtatAction> {
  await photographierInterrupteurs();
  seConnecter(direction);
  const action = (interrupteursConsole as unknown as Record<string, Bascule>)[nomAction(cle)];
  if (action === undefined) throw new Error(`banc : pas d'action de console pour « ${cle} »`);
  const fd = new FormData();
  fd.set("actif", actif ? "1" : "0");
  return action({ ok: true, message: "" }, fd);
}

// ── La boîte saturée ──────────────────────────────────────────────────────

/**
 * Sature la boîte d'envoi : le worker d'e-mails est bridé à 40 envois par heure
 * (`limiter` BullMQ, clé `bull:emails:limiter`). Poser le compteur à 40 avec une
 * échéance courte reproduit une boîte pleine pendant `dureeMs` : tout ce qui est
 * enfilé ATTEND, exactement comme en production quand le quota de l'heure est épuisé.
 * Le worker relit l'état au départ, à la levée du bridage.
 */
export async function saturerLaBoite(dureeMs: number): Promise<void> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  try {
    await redis.set("bull:emails:limiter", "40", "PX", dureeMs);
  } finally {
    redis.disconnect();
  }
}

// ── Le journal des envois ─────────────────────────────────────────────────

export interface LigneEnvoi {
  readonly template: string;
  readonly status: string;
  readonly error: string | null;
  readonly jobId: string | null;
}

export function lignesVers(adresse: string): Promise<LigneEnvoi[]> {
  return prisma.emailLog.findMany({
    where: { recipient: adresse },
    orderBy: { createdAt: "asc" },
    select: { template: true, status: true, error: true, jobId: true },
  });
}

/** Attend que le worker ait clos toutes les lignes d'une adresse (au moins `n`). */
export async function lignesCloses(adresse: string, n = 1, delaiMs = 120_000) {
  const limite = Date.now() + delaiMs;
  for (;;) {
    const l = await lignesVers(adresse);
    if ((l.length >= n && l.every((x) => x.status !== "pending")) || Date.now() > limite) return l;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Efface du journal (et du puits, par le spec) les envois du scénario. */
export async function oublierEnvois(adresses: readonly string[]): Promise<void> {
  await prisma.emailLog.deleteMany({ where: { recipient: { in: [...adresses] } } });
  await prisma.emailOutbox.deleteMany({ where: { recipient: { in: [...adresses] } } });
}

/** Un instant dans la fenêtre d'envoi des relances (10 h 30 à Paris), aujourd'hui. */
export function dansLaFenetre(): Date {
  const d = new Date();
  d.setUTCHours(8, 30, 0, 0);
  return d;
}

export const JOUR_MS = 86_400_000;

/** Efface l'opposition d'une adresse du banc et la ligne d'outbox CRM qu'elle a posée. */
export async function effacerOpposition(adresse: string): Promise<void> {
  const { hashEmailForLookup } = await import("@/lib/security/email-hash");
  const empreinte = hashEmailForLookup(adresse) ?? "∅";
  const lignes = await prisma.emailOpposition.findMany({
    where: { emailHash: empreinte },
    select: { id: true },
  });
  await prisma.crmSyncOutbox.deleteMany({
    where: { subjectRef: { in: lignes.map((o) => `site:email_opposition:${o.id}`) } },
  });
  await prisma.emailOpposition.deleteMany({ where: { emailHash: empreinte } });
  await prisma.consentEvent.deleteMany({ where: { personKey: empreinte } });
}

// ── Un contrat-cadre à signer ─────────────────────────────────────────────

/**
 * Un formateur indépendant avec un contrat-cadre à signer (pièce, lien de signature
 * vivant) et son envoi de départ parti il y a `jours` jours : F16 (premier contrat) ou
 * F45 (nouvelle version). Pièce et journal posés en base, comme la console les laisse.
 */
export async function formateurAvecContrat(
  depart: "formateur-contrat-a-signer" | "formateur-contrat-nouvelle-version",
  jours: number,
) {
  const t = await creerIndependant({ actif: false } as never);
  const ilYa = (j: number) => new Date(Date.now() - j * JOUR_MS);
  const doc = await prisma.documentGenere.create({
    data: {
      type: "contrat_sous_traitance",
      numero: `BANC-V2P-${randomUUID().slice(0, 12)}`,
      hashSha256: "a".repeat(64),
      suppressionPrevueAt: new Date(Date.now() + 10 * 365 * JOUR_MS),
      trainerId: t.id,
      statutSignature: "en_attente",
      createdAt: ilYa(jours + 1),
    } as never,
    select: { id: true },
  });
  await prisma.documentSignatureToken.create({
    data: {
      documentGenereId: doc.id,
      partie: "sous_traitant",
      tokenHash: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
      signataireNom: `${t.prenom} ${t.nom}`,
      signataireEmail: t.email,
      expiresAt: new Date(Date.now() + 20 * JOUR_MS),
      createdAt: ilYa(jours),
    } as never,
  });
  await prisma.emailLog.create({
    data: {
      template: depart,
      recipient: t.email,
      status: "sent",
      entityType: "Trainer",
      entityId: t.id,
      jobId: `${depart}-${doc.id}`,
      sentAt: ilYa(jours),
      createdAt: ilYa(jours),
    } as never,
  });
  aNettoyer(() => oublierEnvois([t.email]));
  return { ...t, documentId: doc.id };
}
