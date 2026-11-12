/**
 * LECTURE « combien de demandes de guide, par mot, par réseau et par jour ? » (L5-27).
 *
 * Corps : `{ schemaVersion: 1, depuis: "AAAA-MM-JJ", jusqua: "AAAA-MM-JJ" }` (bornes incluses, jours UTC, ≤ 92 jours).
 * Réponse : `{ ok, schemaVersion, compteurs: [{ mot, reseau, jour, n }], masquees }` — DES NOMBRES : la lecture ne
 * sélectionne que `mot`, `reseau`, `occurredAt` (jamais la clé de personne), et tout effectif < 3 est ABSENT de la
 * réponse (`masquees` ne dit que combien de lignes l'ont été).
 *
 * 🔴 FERMÉ : toute erreur de lecture, ou plus de lignes que le plafond => 500, jamais de résultat partiel.
 * 🔴 AUCUNE ÉCRITURE. Journal : un événement avec des nombres, sans donnée de personne.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";

/** Seau de débit PROPRE à la route des compteurs. */
export const PREFIXE_DEBIT_COMPTEURS = "internal:compteurs-guide-reseau";
/** Corps maximal accepté : 1 Ko (le corps utile tient en une centaine d'octets). */
export const CORPS_MAX_COMPTEURS = 1024;
/** Effectif en dessous duquel une ligne est masquée. */
export const SEUIL_MASQUAGE = 3;
/** Durée maximale de la fenêtre, en jours. */
export const JOURS_MAX_COMPTEURS = 92;
/** Plafond de lignes lues par appel : au-delà, échec fermé plutôt qu'un total tronqué. */
export const LIGNES_MAX_COMPTEURS = 100_000;

const JOUR_MS = 86_400_000;
const FORME_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function dateUtc(s: string): Date | null {
  if (!FORME_JOUR.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export const SchemaCompteurs = z
  .object({
    schemaVersion: z.literal(1),
    depuis: z.string().refine((s) => dateUtc(s) !== null, { message: "date" }),
    jusqua: z.string().refine((s) => dateUtc(s) !== null, { message: "date" }),
  })
  .strict()
  .refine(
    (c) => {
      const da = dateUtc(c.depuis);
      const db = dateUtc(c.jusqua);
      if (!da || !db) return true; // déjà signalé par les contrôles de champ
      const a = da.getTime();
      const b = db.getTime();
      return b >= a && (b - a) / JOUR_MS < JOURS_MAX_COMPTEURS;
    },
    { message: "periode", path: ["jusqua"] },
  );

function champsFautifs(e: z.ZodError): string[] {
  const noms = new Set<string>();
  for (const i of e.issues) {
    if (i.code === "unrecognized_keys") i.keys.forEach((k) => noms.add(k));
    else noms.add(String(i.path[0] ?? "corps"));
  }
  return [...noms];
}

export interface Compteur {
  readonly mot: string;
  readonly reseau: string;
  readonly jour: string;
  readonly n: number;
}

/** Agrège des lignes (mot, réseau, date) et masque les effectifs < seuil. Pure : aucune E/S. */
export function agreger(lignes: ReadonlyArray<{ mot: string; reseau: string; occurredAt: Date }>): {
  compteurs: Compteur[];
  masquees: number;
} {
  const total = new Map<string, Compteur>();
  for (const l of lignes) {
    const jour = l.occurredAt.toISOString().slice(0, 10);
    const cle = JSON.stringify([l.mot, l.reseau, jour]);
    const c = total.get(cle);
    total.set(cle, { mot: l.mot, reseau: l.reseau, jour, n: (c?.n ?? 0) + 1 });
  }
  const tous = [...total.values()];
  const compteurs = tous
    .filter((c) => c.n >= SEUIL_MASQUAGE)
    .sort(
      (a, b) =>
        a.jour.localeCompare(b.jour) ||
        a.mot.localeCompare(b.mot) ||
        a.reseau.localeCompare(b.reseau),
    );
  return { compteurs, masquees: tous.length - compteurs.length };
}

export async function repondreCompteurs(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(422, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaCompteurs.safeParse(brut);
  if (!analyse.success) {
    const inconnu = analyse.error.issues.some((i) => i.code === "unrecognized_keys");
    return reponseJson(422, {
      ok: false,
      erreur: inconnu ? "unknown_field" : "schema_invalide",
      champs: champsFautifs(analyse.error),
    });
  }
  const gte = dateUtc(analyse.data.depuis)!;
  const lt = new Date(dateUtc(analyse.data.jusqua)!.getTime() + JOUR_MS);

  try {
    const lignes = await prisma.guideReseauOrigine.findMany({
      where: { occurredAt: { gte, lt } },
      select: { mot: true, reseau: true, occurredAt: true },
      take: LIGNES_MAX_COMPTEURS + 1,
    });
    if (lignes.length > LIGNES_MAX_COMPTEURS) throw new Error("plafond_de_lignes");
    const { compteurs, masquees } = agreger(lignes);
    console.warn(
      JSON.stringify({
        event: "guides_reseau_compteurs",
        lignes: compteurs.length,
        masquees,
      }),
    );
    return reponseJson(200, { ok: true, schemaVersion: 1, compteurs, masquees });
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "repondreCompteurs" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] compteurs en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }
}
