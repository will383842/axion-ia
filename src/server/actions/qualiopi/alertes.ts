/**
 * Qualiopi — Server Actions alertes système (T15 AGENT C).
 *
 * resoudreAlerteAction     : résout une alerte par son id.
 * marquerLuAction          : marque une alerte lue.
 * marquerToutLuAction      : marque toutes les alertes non-lues.
 * synchroniserAlertesAction: déclenche manuellement la synchronisation complète.
 *
 * Sécurité : requireAdminWrite (editor+ requis pour toute mutation).
 * Audit : logQualiopiActivity (best-effort, fail-silent).
 */

"use server";

import { z } from "zod";
import {
  resoudreAlerte,
  marquerLu,
  marquerToutLu,
  synchroniserAlertes,
} from "@/server/qualiopi/alertes/alertes-service";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().uuid() });

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlerteAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout une alerte (admin write requis).
 *
 * Utilisé depuis la page /alertes pour les résolutions manuelles.
 * La résolution auto (cron) passe par synchroniserAlertes sans action.
 */
export async function resoudreAlerteAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const alerte = await resoudreAlerte(id);
  if (!alerte) return { error: "Alerte introuvable ou déjà résolue" };

  await logQualiopiActivity({
    action: "qualiopi.alerte.resoudre",
    targetType: "AlerteSysteme",
    targetId: id,
    changes: { code: alerte.code },
    session,
  });

  return { data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerLuAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marque une alerte comme lue.
 */
export async function marquerLuAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const alerte = await marquerLu(id);
  if (!alerte) return { error: "Alerte introuvable" };

  await logQualiopiActivity({
    action: "qualiopi.alerte.marquer_lu",
    targetType: "AlerteSysteme",
    targetId: id,
    changes: { code: alerte.code },
    session,
  });

  return { data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerToutLuAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marque toutes les alertes non-lues comme lues.
 */
export async function marquerToutLuAction(): Promise<ActionResult<{ count: number }>> {
  const session = await requireAdminWrite();

  const result = await marquerToutLu();

  await logQualiopiActivity({
    action: "qualiopi.alerte.marquer_tout_lu",
    targetType: "AlerteSysteme",
    changes: { count: result.count },
    session,
  });

  return { data: { count: result.count } };
}

// ─────────────────────────────────────────────────────────────────────────────
// synchroniserAlertesAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déclenche manuellement la synchronisation complète des alertes
 * (équivalent du cron — utile depuis l'UI admin pour un rafraîchissement
 * immédiat sans attendre minuit).
 */
export async function synchroniserAlertesAction(): Promise<
  ActionResult<{
    crees: number;
    resolues: number;
    rafraichies: number;
    /**
     * 🔴 LES RÈGLES QUI ONT LEVÉ, PAR LEUR NOM.
     *
     * Cette action rendait `{ créées, résolues, rafraîchies }` et rien d'autre.
     * « 0 résolues » se lisait donc « rien à fermer » aussi bien que « fermeture
     * SUSPENDUE, une règle est cassée » — un compteur à zéro qui admet deux
     * explications, sur le dispositif dont la fonction entière est de rendre les
     * choses observables.
     *
     * ⚠️ Les NOMS, jamais un compte : un nom qui apparaît est un fait et permet
     * d'agir ; un nombre qui passe de 0 à 1 est une statistique qu'on survole.
     */
    reglesEnEchec: string[];
  }>
> {
  const session = await requireAdminWrite();

  const result = await synchroniserAlertes();

  await logQualiopiActivity({
    action: "qualiopi.alertes.synchroniser",
    targetType: "AlerteSysteme",
    changes: {
      crees: result.crees,
      resolues: result.resolues,
      rafraichies: result.rafraichies,
      // 🔑 Au JOURNAL aussi : c'est la seule trace qui survit à la fermeture de
      // l'onglet, et celle qu'on relira pour dater le début d'une panne.
      reglesEnEchec: result.reglesEnEchec,
    },
    session,
  });

  return { data: result };
}
