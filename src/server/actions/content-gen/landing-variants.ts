/**
 * Content Generator — activation/désactivation des variantes de landing ville.
 *
 * `ContentGenConfig.key = "landing_variants_active"` stocke un TABLEAU de slugs
 * actifs (défaut `["default"]`). La page admin ne faisait que LIRE cette valeur
 * (aucune écriture n'existait) : cette action câble le toggle par variante.
 *
 * « default » est la base (toutes audiences) → non désactivable.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "landing_variants_active";
const DEFAULT_ACTIVE: ReadonlyArray<string> = ["default"];

const schema = z.object({
  slug: z.string().min(1).max(64),
  active: z.boolean(),
});

export type ToggleLandingVariantState =
  | { ok: true; active: string[] }
  | { ok: false; error: string };

export async function setLandingVariantActiveAction(
  slug: string,
  active: boolean,
): Promise<ToggleLandingVariantState> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = schema.safeParse({ slug, active });
  if (!parsed.success) return { ok: false, error: "Entrée invalide." };

  if (parsed.data.slug === "default" && !parsed.data.active) {
    return { ok: false, error: "La variante « default » est la base — non désactivable." };
  }

  const current = await readContentGenConfig<string[]>(KEY, [...DEFAULT_ACTIVE]);
  const set = new Set(current);
  if (parsed.data.active) set.add(parsed.data.slug);
  else set.delete(parsed.data.slug);
  const next = Array.from(set);

  await writeContentGenConfig(
    KEY,
    next,
    session.userId,
    `Landing variant ${parsed.data.slug} → ${parsed.data.active ? "actif" : "inactif"}`,
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/landing-variants`);

  return { ok: true, active: next };
}
