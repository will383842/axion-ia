/**
 * Les ALERTES du circuit visio (chantier visio, PR 4 ; plan §3.14).
 *
 * ## Deux familles, deux destinations
 *
 *   · les PANNES TECHNIQUES (une étape du balayage qui échoue, plus tard la
 *     clé de chiffrement, le plafond OpenAI…) partent sur Telegram, par
 *     `notify()`, UNE fois par témoin qui passe au rouge ;
 *   · les RAPPELS DE TRAVAIL (rendez-vous tenu sans compte rendu — « F1 » —,
 *     compte rendu à valider depuis 3 jours, suite échue, veille du rendez-vous
 *     suivant) restent dans la CONSOLE : panneau, badge, carte. Will a refusé
 *     le 27/09 le rappel Telegram 30 minutes après la fin ; la question lui
 *     est reposée en B17, et tant qu'il n'a pas dit oui, `F1_SUR_TELEGRAM`
 *     vaut `false`. Garde : `un-rappel-de-travail-ne-part-jamais-sur-telegram`.
 *
 * ## Une alerte part une fois, et repart si l'envoi a échoué
 *
 * Chaque alerte a une CLÉ stable (`balayage-etape:rencontres`, `f1:<id>`) et
 * une ligne dans `alertes_visio`. Elle n'est tenue pour ENVOYÉE que si
 * `notify()` répond `sent` sur Telegram : un envoi raté laisse `envoyeeLe`
 * nul, et le passage suivant réessaie. Un témoin revenu au vert efface sa
 * ligne (`leverAlerte`) : s'il repasse au rouge plus tard, il repart.
 *
 * Aucune parole, aucun nom de personne dans une alerte (PA-12) : des
 * identifiants et des nombres.
 *
 * Module neutre (le worker l'appelle). `notify` est INJECTÉ : les tests
 * n'envoient rien.
 */

import type { CategorieAlerteVisio } from "../../../prisma/generated/client";
import type { NotifyInput, NotifyResult } from "@/server/notifications/types";
import type { Tx } from "@/features/dossier-client/base";

/**
 * Décision B17 (pas encore prise) : les rappels de travail sur Telegram.
 * `false` tant que Will n'a pas répondu oui.
 */
export const F1_SUR_TELEGRAM = false;

export type CanalAlerte = "telegram" | "console";

export type Notifier = (input: NotifyInput<"MONITORING_ALERT">) => Promise<NotifyResult>;

export interface AlerteASignaler {
  /** Clé stable : un même témoin, une même ligne. ≤ 120 caractères. */
  readonly cle: string;
  readonly categorie: CategorieAlerteVisio;
  /** Où elle doit partir. Un rappel de travail : `canalDesRappels()`. */
  readonly canal: CanalAlerte;
  /** Texte technique court, SANS donnée personnelle. */
  readonly message: string;
  /** Détails techniques (identifiants, nombres). */
  readonly details?: Record<string, string | number | boolean | null>;
}

export type ResultatSignalement =
  "nouvelle" | "envoyee" | "deja_envoyee" | "echec_envoi" | "console";

/** Le canal des rappels de travail (F1…) : la console, tant que B17 n'est pas « oui ». */
export function canalDesRappels(f1SurTelegram: boolean = F1_SUR_TELEGRAM): CanalAlerte {
  return f1SurTelegram ? "telegram" : "console";
}

type TxAlertes = Pick<Tx, "alerteVisio">;

/**
 * Marque l'alerte en base et, si elle doit partir sur Telegram et n'est pas
 * encore partie, l'envoie. Voir l'en-tête.
 */
export async function signalerAlerte(
  tx: TxAlertes,
  alerte: AlerteASignaler,
  notifier: Notifier,
  maintenant: Date = new Date(),
): Promise<ResultatSignalement> {
  const cle = alerte.cle.slice(0, 120);
  const existante = await tx.alerteVisio.findUnique({ where: { cle } });
  if (existante === null) {
    await tx.alerteVisio.create({
      data: { cle, categorie: alerte.categorie, premiereLe: maintenant },
    });
  }
  if (alerte.canal === "console") return existante === null ? "nouvelle" : "console";
  if (existante?.envoyeeLe) return "deja_envoyee";

  let envoyee = false;
  try {
    const r = await notifier({
      category: "MONITORING_ALERT",
      payload: {
        kind: `visio:${alerte.categorie}`,
        details: { message: alerte.message, cle, ...(alerte.details ?? {}) },
      },
    });
    envoyee = r.channels.telegram === "sent";
  } catch {
    envoyee = false;
  }
  await tx.alerteVisio.update({
    where: { cle },
    data: {
      dernierEssaiLe: maintenant,
      essais: { increment: 1 },
      ...(envoyee ? { envoyeeLe: maintenant } : {}),
    },
  });
  return envoyee ? "envoyee" : "echec_envoi";
}

/** Le témoin est revenu au vert : sa ligne disparaît (il repartira s'il rechute). */
export async function leverAlerte(tx: TxAlertes, cle: string): Promise<boolean> {
  const r = await tx.alerteVisio.deleteMany({ where: { cle: cle.slice(0, 120) } });
  return r.count > 0;
}
