/**
 * COUPE-CIRCUIT DU GUIDE (lot L2, 2026-09-24).
 *
 * Le formulaire envoie le guide à des adresses que personne n'a vérifiées. Une
 * série de rebonds DURS — robot qui invente des adresses, liste de fautes de
 * frappe, attaque — abîmerait la réputation du compte d'envoi qui porte AUSSI
 * les factures, les convocations et les liens de connexion.
 *
 * Au-delà de `SEUIL_REBONDS_DURS_PAR_HEURE` rebonds durs du guide en une heure :
 *   · l'envoi du guide est SUSPENDU (formulaire ET rattrapage) ;
 *   · Telegram est prévenu ;
 *   · les demandes continuent d'être ENREGISTRÉES — rien n'est perdu, elles
 *     partiront au ré-armement, au rythme du plafond horaire.
 *
 * 🔑 L'état vit dans la table `settings` (clé `guide-ia.coupe-circuit`), pas en
 * mémoire ni dans Redis : il survit à un redémarrage, se lit depuis l'app ET le
 * worker, et se ré-arme depuis la console (Réglages → supprimer la clé), une
 * fois la cause comprise. Il ne se ré-arme JAMAIS tout seul : une suspension
 * qui s'effacerait d'elle-même au bout d'une heure relancerait la rafale.
 * La sentinelle quotidienne alerte si la suspension dure plus de 24 h.
 */

import { prisma } from "@/lib/prisma";
import { CLE_COUPE_CIRCUIT, GABARIT_GUIDE, SEUIL_REBONDS_DURS_PAR_HEURE } from "./config";

export type EtatCoupeCircuit =
  { readonly declenche: false } | { readonly declenche: true; readonly depuis: Date | null };

/** Lecture seule. Une base muette est lue comme « non déclenché » (et dit). */
export async function lireCoupeCircuit(): Promise<EtatCoupeCircuit> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_COUPE_CIRCUIT },
      select: { value: true },
    });
    if (ligne === null) return { declenche: false };
    const brut = (ligne.value as { depuis?: unknown } | null)?.depuis;
    const depuis = typeof brut === "string" ? new Date(brut) : null;
    return { declenche: true, depuis: depuis && !Number.isNaN(depuis.getTime()) ? depuis : null };
  } catch (e) {
    console.error(
      "[guide-ia] lecture du coupe-circuit impossible — considéré NON déclenché :",
      e instanceof Error ? e.message : String(e),
    );
    return { declenche: false };
  }
}

/**
 * Lit l'état, et DÉCLENCHE le coupe-circuit si le seuil de rebonds est atteint.
 * @returns `true` si l'envoi du guide doit être suspendu.
 */
export async function coupeCircuitDeclenche(maintenant: Date = new Date()): Promise<boolean> {
  const etat = await lireCoupeCircuit();
  if (etat.declenche) return true;

  let rebonds = 0;
  try {
    rebonds = await prisma.emailLog.count({
      where: {
        template: GABARIT_GUIDE,
        status: "bounced",
        bounceType: "hard",
        bouncedAt: { gte: new Date(maintenant.getTime() - 3_600_000) },
      },
    });
  } catch (e) {
    console.error(
      "[guide-ia] décompte des rebonds impossible — envoi maintenu :",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
  if (rebonds < SEUIL_REBONDS_DURS_PAR_HEURE) return false;

  try {
    await prisma.setting.upsert({
      where: { key: CLE_COUPE_CIRCUIT },
      // `update: {}` : la date de déclenchement ne bouge plus une fois posée.
      update: {},
      create: {
        key: CLE_COUPE_CIRCUIT,
        value: { depuis: maintenant.toISOString(), rebondsDursUneHeure: rebonds },
        description:
          "Envoi du guide IA SUSPENDU (trop de rebonds durs). Supprimer ce réglage pour ré-armer, une fois la cause comprise.",
      },
    });
  } catch (e) {
    console.error(
      "[guide-ia] écriture du coupe-circuit impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }

  // Import PARESSEUX : le hub de notifications tire le formateur Telegram et ses
  // canaux — inutile sur le chemin nominal, où le seuil n'est pas atteint.
  const { notify } = await import("@/server/notifications");
  await notify({
    category: "MONITORING_ALERT",
    payload: {
      kind: "guide-ia-coupe-circuit",
      details: {
        message:
          "Envoi du guide IA SUSPENDU : trop de rebonds durs en une heure. Les demandes restent enregistrées. Ré-armer depuis la console (Réglages, clé guide-ia.coupe-circuit) une fois la cause comprise.",
        rebondsDursUneHeure: rebonds,
        seuil: SEUIL_REBONDS_DURS_PAR_HEURE,
      },
    },
    dedupKey: `guide-ia-coupe-circuit-${maintenant.toISOString().slice(0, 13)}`,
  }).catch(() => undefined);
  return true;
}
