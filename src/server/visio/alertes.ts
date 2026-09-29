/**
 * Les ALERTES du circuit visio (chantier visio, PR 4 ; plan §3.14) — sur le
 * magasin d'alertes EXISTANT (correction anti-doublon A3).
 *
 * ## Une seule table d'alertes : `AlerteSysteme`
 *
 * Aucune table ni aucun service parallèle : une panne du circuit s'écrit dans
 * `AlerteSysteme` par `creerOuDedup` (`qualiopi/alertes/alertes-service.ts`),
 * avec un code `visio.*` déclaré au catalogue (`VISIO_BALAYAGE_EN_PANNE`). Elle
 * apparaît donc dans l'écran d'alertes de la console, avec sa dé-duplication
 * (code, cible), sa résolution et son routage. La table `AlerteVisio` posée
 * par la PR 2 reste VIDE et abandonnée (aucune migration destructive : son
 * retrait, s'il vient, sera une PR `schema` à part).
 *
 * ## Pannes techniques seulement — pas de rappel de travail
 *
 * « Rendez-vous tenu sans compte rendu » (l'ancien « F1 ») n'est PAS une alerte :
 * c'est la pastille « À faire le point » qui existe déjà
 * (`admin-rendezvous/suivi-queries.ts`). Deux rappels pour le même geste après
 * un appel, c'était un doublon. Rien de ce qui est du travail de Will ne part
 * sur Telegram (décision B17 sans réponse).
 *
 * ## Une panne part une fois, et repart si l'envoi a échoué
 *
 * Une panne OUVERTE = une alerte `visio.balayage_en_panne` non résolue. Les
 * étapes en panne sont listées dans `metadata.etapes` ; l'envoi Telegram est
 * tenu pour fait SEULEMENT si `notify()` répond `sent` (`metadata.telegramLe`),
 * et chaque essai est compté (`metadata.essais`) — le seul besoin qui n'existait
 * pas. Toutes les étapes revenues au vert → l'alerte est résolue ; une rechute
 * ouvre une NOUVELLE alerte (son message porte l'instant de la panne : pour
 * `creerOuDedup`, c'est un fait nouveau) et repart.
 *
 * Aucune parole, aucun nom de personne dans une alerte (PA-12).
 *
 * Module neutre (le worker l'appelle). `notify` et la création sont INJECTÉS :
 * les tests n'envoient rien. Par défaut, `creerOuDedup` est chargé à la
 * demande (il tire le client Prisma global).
 */

import type { NotifyInput, NotifyResult } from "@/server/notifications/types";
import type { AlerteInput } from "@/server/qualiopi/alertes/alertes-service";
import type { Tx } from "@/features/dossier-client/base";

/** Le code (catalogue `ALERTE_CATALOGUE`) d'une panne du balayage du dossier client. */
export const VISIO_BALAYAGE_EN_PANNE = "visio.balayage_en_panne";

/** Tous les codes d'alerte du circuit visio : chacun est au catalogue (garde). */
export const CODES_ALERTE_VISIO = [VISIO_BALAYAGE_EN_PANNE] as const;

export type Notifier = (input: NotifyInput<"MONITORING_ALERT">) => Promise<NotifyResult>;

export type CreerAlerte = (input: AlerteInput) => Promise<unknown>;

export type ResultatSignalement = "envoyee" | "deja_envoyee" | "echec_envoi";

type TxAlertes = Pick<Tx, "alerteSysteme">;

interface MetaPanne {
  etapes: string[];
  essais: number;
  telegramLe: string | null;
  dernierEssaiLe: string | null;
}

function lireMeta(brut: unknown): MetaPanne {
  const m = brut !== null && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  return {
    etapes: Array.isArray(m["etapes"])
      ? m["etapes"].filter((e): e is string => typeof e === "string")
      : [],
    essais: typeof m["essais"] === "number" ? m["essais"] : 0,
    telegramLe: typeof m["telegramLe"] === "string" ? m["telegramLe"] : null,
    dernierEssaiLe: typeof m["dernierEssaiLe"] === "string" ? m["dernierEssaiLe"] : null,
  };
}

async function creerOuDedupParDefaut(input: AlerteInput): Promise<unknown> {
  const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
  return creerOuDedup(input);
}

async function panneOuverte(db: TxAlertes) {
  return db.alerteSysteme.findFirst({
    where: { code: VISIO_BALAYAGE_EN_PANNE, resolue: false, cibleId: null },
    select: { id: true, metadata: true },
  });
}

/**
 * Une étape du balayage échoue : l'alerte est ouverte (ou complétée) dans
 * `AlerteSysteme`, puis envoyée sur Telegram si elle n'est pas encore partie.
 */
export async function signalerPanneDuBalayage(
  db: TxAlertes,
  panne: { readonly etape: string; readonly erreur: string },
  deps: { readonly notifier: Notifier; readonly creer?: CreerAlerte; readonly maintenant?: Date },
): Promise<ResultatSignalement> {
  const maintenant = deps.maintenant ?? new Date();
  const creer = deps.creer ?? creerOuDedupParDefaut;
  const titre = "Balayage du dossier client en panne";
  await creer({
    code: VISIO_BALAYAGE_EN_PANNE,
    niveau: "important",
    titre,
    message:
      `Le balayage du dossier client échoue depuis le ${maintenant.toISOString()} ` +
      `(étape « ${panne.etape} »). Il continue de tourner ; les autres étapes passent.`,
    metadata: { etapes: [panne.etape], essais: 0, telegramLe: null, dernierEssaiLe: null },
  });

  const ouverte = await panneOuverte(db);
  if (ouverte === null) return "echec_envoi";
  const meta = lireMeta(ouverte.metadata);
  if (!meta.etapes.includes(panne.etape)) meta.etapes.push(panne.etape);
  if (meta.telegramLe !== null) {
    await db.alerteSysteme.update({
      where: { id: ouverte.id },
      data: { metadata: { ...meta } },
    });
    return "deja_envoyee";
  }

  let envoyee = false;
  try {
    const r = await deps.notifier({
      category: "MONITORING_ALERT",
      payload: {
        kind: VISIO_BALAYAGE_EN_PANNE,
        details: {
          legacyBody: `${titre}\n\nÉtape « ${panne.etape} » en échec (${panne.erreur}).`,
          etape: panne.etape,
          erreur: panne.erreur,
        },
      },
    });
    envoyee = r.channels.telegram === "sent";
  } catch {
    envoyee = false;
  }
  await db.alerteSysteme.update({
    where: { id: ouverte.id },
    data: {
      metadata: {
        ...meta,
        essais: meta.essais + 1,
        dernierEssaiLe: maintenant.toISOString(),
        telegramLe: envoyee ? maintenant.toISOString() : null,
      },
    },
  });
  return envoyee ? "envoyee" : "echec_envoi";
}

/**
 * L'étape est revenue au vert : elle sort de la panne ; plus aucune étape en
 * panne → l'alerte est résolue (une rechute en ouvrira une nouvelle).
 */
export async function leverPanneDuBalayage(
  db: TxAlertes,
  etape: string,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const ouverte = await panneOuverte(db);
  if (ouverte === null) return false;
  const meta = lireMeta(ouverte.metadata);
  if (!meta.etapes.includes(etape)) return false;
  const reste = meta.etapes.filter((e) => e !== etape);
  await db.alerteSysteme.update({
    where: { id: ouverte.id },
    data:
      reste.length === 0
        ? { resolue: true, resolueAt: maintenant, metadata: { ...meta, etapes: [] } }
        : { metadata: { ...meta, etapes: reste } },
  });
  return reste.length === 0;
}
