/**
 * Qualiopi — Server Action export CSV du cockpit financier (Lot 6.3).
 *
 * genererMargeCsvAction : retourne { csv, filename } pour CsvExportButton.
 * Lecture seule — aucune mutation, mais accès RESTREINT.
 *
 * 🔴 Audit certification 2026-07-26 (F46) : l'export des marges était ouvert à
 * `requireAdminRead`, qui accepte le rôle `reader`. Une marge commerciale n'est
 * pas une donnée de consultation courante.
 */

"use server";

import { z } from "zod";
import { requireAdminRead, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { getMargeParSession, margeSessionsToCsv } from "@/server/qualiopi/remuneration/marge";
import { periodeKey, type PilotagePeriode } from "@/server/qualiopi/conformite/periode";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({
  annee: z.number().int().min(2000).max(2100),
  periode: z
    .object({
      type: z.enum(["annee", "trimestre", "mois"]),
      trimestre: z.number().int().min(1).max(4).optional(),
      mois: z.number().int().min(1).max(12).optional(),
    })
    .optional(),
});

export async function genererMargeCsvAction(input: {
  annee: number;
  periode?: PilotagePeriode;
}): Promise<ActionResult<{ csv: string; filename: string }>> {
  // F46 — l'EXPORT est restreint, la simple consultation reste ouverte.
  await requireAdminWrite();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { annee } = parsed.data;
  const raw = parsed.data.periode;
  const periode: PilotagePeriode = raw
    ? {
        type: raw.type,
        ...(raw.trimestre !== undefined ? { trimestre: raw.trimestre } : {}),
        ...(raw.mois !== undefined ? { mois: raw.mois } : {}),
      }
    : { type: "annee" };

  try {
    const rows = await getMargeParSession({ annee, periode });
    const csv = margeSessionsToCsv(rows, annee, periode);
    const filename = `cockpit-financier-marge-${annee}-${periodeKey(periode)}.csv`;
    return { data: { csv, filename } };
  } catch {
    return { error: "Erreur lors de l'export du cockpit financier" };
  }
}
