/**
 * Réseau d'apporteurs — SURVEILLANCE des passages d'argent (critique #2464, point 5).
 *
 * Un passage qui ne trouve rien se tait (doctrine du worker) : une panne était donc
 * indiscernable d'une journée calme. On horodate le dernier passage RÉUSSI (aucune étape en
 * erreur) dans Redis, sans migration, et un contrôle alerte quand il est trop ancien :
 *   · `reseau-quotidien`   : au-delà de 26 h (un passage par jour + 2 h de marge) ;
 *   · `reseau-facturation` : au-delà de 3 h (un passage par heure).
 * Clé absente (Redis vidé, premier jour) = alerte aussi : on ne peut pas prouver que ça tourne.
 *
 * Alerte INTERNE seulement (e-mail à Williams + Telegram si configuré), dédoublonnée par jour.
 * Jamais d'e-mail à un apporteur. Aucun `server-only` : tourne dans le WORKER. Fail-soft.
 *
 * Limite assumée : le contrôle tourne dans le worker ; un worker entièrement arrêté ne peut pas
 * s'alerter lui-même (relève de la supervision Coolify).
 */

import { redis } from "@/lib/redis";

import { alerteInterne } from "./alerte-interne";
import { jourParis } from "./autofacture-donnees";
import { signalerErreurReseau } from "./signaler";

export type PassageSurveille = "reseau-quotidien" | "reseau-facturation";

export const SEUIL_HEURES: Record<PassageSurveille, number> = {
  "reseau-quotidien": 26,
  "reseau-facturation": 3,
};

const PREFIXE = "apporteurs:dernier-passage-reussi:";
const TTL_SEC = 30 * 86_400;

const LIBELLE: Record<PassageSurveille, string> = {
  "reseau-quotidien": "passage quotidien du réseau (commissions, vigilance, réservations)",
  "reseau-facturation": "passage horaire de la facturation (autofactures)",
};

function stub(): boolean {
  return process.env.REDIS_URL?.includes("stub.invalid") === true;
}

/** Note le passage réussi. Ne lève jamais. */
export async function noterPassageReussi(
  nom: PassageSurveille,
  maintenant: Date = new Date(),
): Promise<void> {
  if (stub()) return;
  try {
    await redis.set(`${PREFIXE}${nom}`, maintenant.toISOString(), "EX", TTL_SEC);
  } catch (err) {
    signalerErreurReseau(`surveillance : horodatage ${nom}`, err);
  }
}

/** Dernier passage réussi, ou `null` (jamais vu / Redis vide / Redis muet). */
export async function lireDernierPassage(nom: PassageSurveille): Promise<Date | null> {
  if (stub()) return null;
  try {
    const v = await redis.get(`${PREFIXE}${nom}`);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Pur : le passage est-il en retard ? Absent = en retard. */
export function enRetard(dernier: Date | null, nom: PassageSurveille, maintenant: Date): boolean {
  if (!dernier) return true;
  return maintenant.getTime() - dernier.getTime() > SEUIL_HEURES[nom] * 3_600_000;
}

/** Telegram, fail-soft, une fois par clé et par jour. Import paresseux : rien au chargement. */
async function telegram(cle: string, texte: string): Promise<void> {
  try {
    const [{ sendTelegramRaw }, { isDuplicate, libererDedup }, { resolveTelegramTarget }] =
      await Promise.all([
        import("@/server/notifications/channels/telegram"),
        import("@/server/notifications/dedup"),
        import("@/server/notifications/routing"),
      ]);
    const cible = resolveTelegramTarget("apporteurs");
    if (!cible) return;
    if (await isDuplicate("apporteurs-surveillance", cle, 26 * 3600)) return;
    const ok = await sendTelegramRaw({
      text: texte,
      brut: true,
      silent: false,
      sansApercuLien: true,
      chatId: cible.chatId,
      botToken: cible.botToken,
    });
    if (!ok) await libererDedup("apporteurs-surveillance", cle);
  } catch {
    // Telegram muet : l'e-mail interne reste.
  }
}

/** Alerte interne (e-mail + Telegram), une fois par jour et par code. Rend vrai si l'e-mail part. */
export async function alerteSurveillance(a: {
  code: string;
  cle: string;
  titre: string;
  message: string;
  cibleId: string;
  maintenant: Date;
  niveau?: "important" | "critique";
}): Promise<boolean> {
  const jour = jourParis(a.maintenant);
  const partie = await alerteInterne({
    jobId: `apporteur-surveillance-${a.cle}-${jour}`,
    code: a.code,
    titre: a.titre,
    message: a.message,
    cibleType: "ApporteurReseau",
    cibleId: a.cibleId,
    niveau: a.niveau ?? "critique",
    maintenant: a.maintenant,
  });
  await telegram(`${a.cle}-${jour}`, `🚨 ${a.titre}`);
  return partie;
}

/**
 * Le contrôle. Se tait si tout est à jour. Rend les passages signalés.
 * Appelé par un passage fréquent du worker (aucun état en mémoire).
 */
export async function verifierPassages(maintenant: Date = new Date()): Promise<PassageSurveille[]> {
  const signales: PassageSurveille[] = [];
  for (const nom of Object.keys(SEUIL_HEURES) as PassageSurveille[]) {
    try {
      const dernier = await lireDernierPassage(nom);
      if (!enRetard(dernier, nom, maintenant)) continue;
      signales.push(nom);
      await alerteSurveillance({
        code: "apporteur_passage_absent",
        cle: `passage-${nom}`,
        titre: `Réseau d'apporteurs : le ${LIBELLE[nom]} n'a pas réussi depuis plus de ${SEUIL_HEURES[nom]} h`,
        message: dernier
          ? `Dernier passage réussi : ${dernier.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Au-delà de ${SEUIL_HEURES[nom]} h, plus aucun apporteur n'est facturé ni payé : vérifier le worker, Redis et Sentry.`
          : `Aucun passage réussi enregistré (premier jour, Redis vidé ou worker arrêté). Vérifier le worker, Redis et Sentry : tant qu'il ne tourne pas, plus aucun apporteur n'est facturé ni payé.`,
        cibleId: nom,
        maintenant,
      });
    } catch (err) {
      signalerErreurReseau(`surveillance : contrôle ${nom}`, err);
    }
  }
  return signales;
}
