/**
 * Qualiopi — Server Action de configuration (valeurs légales & métier).
 *
 * setQualiopiConfigAction : écrit une clé du registre `qualiopi` (SiteSetting),
 * pour la page admin /qualiopi/config (saisie NDA, SIREN, n° Qualiopi, barèmes
 * OPCO, RAC CPF, référent handicap, etc.). Comble l'absence d'UI relevée à
 * l'audit E2E 2026-06-06.
 *
 * Coercition : les clés dont le défaut est un number sont converties (et validées
 * par le schéma Zod du registre via setQualiopiConfig). Guards write + audit.
 */

"use server";

import { z } from "zod";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  setQualiopiConfig,
  QUALIOPI_CONFIG_REGISTRY,
  type QualiopiConfigKey,
} from "@/server/qualiopi/config/site-settings";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({
  key: z.string().min(1),
  /** Valeur brute saisie (le formulaire envoie une string ; coercition ci-dessous). */
  value: z.string(),
});

function isQualiopiConfigKey(k: string): k is QualiopiConfigKey {
  return Object.prototype.hasOwnProperty.call(QUALIOPI_CONFIG_REGISTRY, k);
}

/**
 * Écrit une clé de configuration Qualiopi. Number si le défaut du registre est
 * un number (sinon string). La validation Zod stricte se fait dans setQualiopiConfig.
 */
export async function setQualiopiConfigAction(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ key: string }>> {
  const session = await requireAdminWrite();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { key, value } = parsed.data;

  if (!isQualiopiConfigKey(key)) return { error: "Clé de configuration inconnue" };

  const entry = QUALIOPI_CONFIG_REGISTRY[key];
  let coerced: string | number;
  if (typeof entry.default === "number") {
    const n = Number(value.replace(",", ".").trim());
    if (Number.isNaN(n)) return { error: `Valeur numérique attendue pour « ${key} »` };
    coerced = n;
  } else {
    coerced = value;
  }

  try {
    await setQualiopiConfig(key, coerced as never, session);
  } catch (e) {
    // 🔴 Le message du registre est RELAYÉ, pas avalé.
    //
    // Ce `catch` retournait « format invalide » quelle que soit la cause. Les
    // schémas savent pourtant dire « SIRET : 14 chiffres attendus » ou « clé de
    // contrôle invalide — vérifier la saisie ». Sans le relais, l'admin voit
    // son enregistrement refusé sans savoir ce qu'on attend de lui : il
    // ressaisit à l'identique, échoue encore, et finit par croire l'écran
    // cassé. Une validation qui refuse sans expliquer coûte plus qu'elle
    // n'apporte.
    const motif = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    return { error: motif ?? `Valeur refusée pour « ${key} » (format invalide)` };
  }

  return { data: { key } };
}
