/**
 * Console éditoriale — la saisie des relevés (lot 3).
 *
 * > « Saisir un relevé crée une ligne SANS ÉCRASER la précédente. »
 *
 * Le modèle le permet déjà : `@@unique([publicationId, releveA])` autorise
 * autant de lignes qu'on veut pour une publication, tant qu'elles portent des
 * horodatages différents. L'action doit donc CRÉER, jamais mettre à jour — et
 * c'est plus subtil qu'il n'y paraît, parce que la tentation de l'`upsert`
 * est forte et qu'elle détruirait l'historique en silence.
 *
 * ⚠️ Un relevé est un INSTANTANÉ CUMULATIF, pas un incrément. « 1 200
 * impressions » le 17 septembre veut dire 1 200 depuis la parution, pas 1 200
 * de plus que le 10. C'est pour cela que l'analyse ne garde que le dernier
 * relevé de chaque publication au lieu de tous les additionner.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import type { ActionResult } from "@/server/actions/editorial/publications";

/**
 * Chaque métrique est FACULTATIVE et peut valoir zéro.
 *
 * 🔴 `.nullable().optional()` et non `.optional()` seul : il faut pouvoir
 * distinguer « je ne renseigne pas » (absent) de « j'ai vérifié, c'est zéro »
 * (`0`). Le critère 4 du lot repose entièrement sur cette distinction, et
 * elle commence ici, à la saisie.
 */
const nombreFacultatif = z.number().int().min(0).max(100_000_000).nullable().optional();

const releveSchema = z.object({
  publicationId: z.string().uuid(),
  /** Horodatage du relevé. Absent ⇒ maintenant. */
  releveA: z.string().datetime().optional(),
  impressions: nombreFacultatif,
  reactions: nombreFacultatif,
  commentaires: nombreFacultatif,
  partages: nombreFacultatif,
  clics: nombreFacultatif,
  abonnesGagnes: nombreFacultatif,
  vuesCompletes: nombreFacultatif,
  dureeMoyenneSec: nombreFacultatif,
  ouvertures: nombreFacultatif,
  rdvAttribues: nombreFacultatif,
  devisAttribues: nombreFacultatif,
  source: z.string().max(40).optional(),
});

/**
 * Enregistre un relevé — critère 1 du lot 3.
 *
 * `create`, jamais `upsert` : l'historique est la raison d'être de cette
 * table. Deux relevés au même instant sont refusés par la contrainte
 * d'unicité, et le message le dit au lieu de laisser remonter une erreur
 * Prisma incompréhensible.
 */
export async function saisirReleveAction(
  input: z.input<typeof releveSchema>,
): Promise<ActionResult<{ id: string; releveA: string }>> {
  try {
    const membre = await requirePermission("metrique.saisir");
    const parsed = releveSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { publicationId, releveA, source, ...metriques } = parsed.data;

    const publication = await prisma.edPublication.findUnique({
      where: { id: publicationId },
      select: { id: true, titreInterne: true },
    });
    if (!publication) return { error: "Publication introuvable" };

    // Au moins une métrique doit être renseignée : un relevé vide n'apporte
    // rien et polluerait l'historique d'entrées qui ne disent rien.
    const renseignees = Object.values(metriques).filter((v) => v !== null && v !== undefined);
    if (renseignees.length === 0) {
      return {
        error:
          "Aucune métrique renseignée. Un relevé vide n'apporte rien — " +
          "saisissez au moins une valeur, quitte à ce qu'elle soit zéro.",
      };
    }

    const horodatage = releveA ? new Date(releveA) : new Date();

    // Les clés valant `undefined` sont RETIRÉES : sous
    // `exactOptionalPropertyTypes`, une clé présente à `undefined` n'est pas
    // une clé absente, et Prisma refuse la première. On garde en revanche les
    // `null` explicites — « j'ai vérifié, il n'y a rien » n'est pas la même
    // information que « je n'ai pas renseigné ».
    const aEcrire = Object.fromEntries(
      Object.entries(metriques).filter(([, v]) => v !== undefined),
    ) as Record<string, number | null>;

    try {
      const releve = await prisma.edMetrique.create({
        data: {
          publicationId,
          releveA: horodatage,
          source: source ?? "manuel",
          ...aEcrire,
        },
        select: { id: true, releveA: true },
      });

      await journaliser({
        entite: "EdMetrique",
        entiteId: releve.id,
        action: "releve",
        membreId: membre.membreId,
        apres: {
          publicationId,
          releveA: releve.releveA.toISOString(),
          renseignees: renseignees.length,
        },
      });

      revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
      return { data: { id: releve.id, releveA: releve.releveA.toISOString() } };
    } catch (e) {
      // La contrainte `@@unique([publicationId, releveA])`.
      if (e instanceof Error && e.message.includes("Unique constraint")) {
        return {
          error:
            `Un relevé existe déjà pour « ${publication.titreInterne} » à cet instant précis. ` +
            `Les relevés ne s'écrasent pas : choisissez un autre horodatage.`,
        };
      }
      throw e;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/** L'historique d'une publication, du plus récent au plus ancien. */
export async function historiqueRelevesAction(input: {
  publicationId: string;
}): Promise<
  ActionResult<
    { id: string; releveA: string; impressions: number | null; rdvAttribues: number | null }[]
  >
> {
  try {
    await requirePermission("voir");
    const parsed = z.object({ publicationId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    const lignes = await prisma.edMetrique.findMany({
      where: { publicationId: parsed.data.publicationId },
      select: { id: true, releveA: true, impressions: true, rdvAttribues: true },
      orderBy: { releveA: "desc" },
      take: 50,
    });

    return {
      data: lignes.map((l) => ({
        id: l.id,
        releveA: l.releveA.toISOString(),
        impressions: l.impressions,
        rdvAttribues: l.rdvAttribues,
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/** Adaptateur de formulaire — redirige, pour garder l'écran sans JavaScript. */
export async function saisirReleveFormAction(donnees: FormData): Promise<void> {
  const { redirect } = await import("next/navigation");

  function nombre(nom: string): number | null | undefined {
    const v = donnees.get(nom);
    if (typeof v !== "string" || v.trim() === "") return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  const retour = (donnees.get("retour") as string) || "";
  const publicationId = (donnees.get("publicationId") as string) || "";

  const resultat = await saisirReleveAction({
    publicationId,
    impressions: nombre("impressions"),
    reactions: nombre("reactions"),
    commentaires: nombre("commentaires"),
    partages: nombre("partages"),
    clics: nombre("clics"),
    abonnesGagnes: nombre("abonnesGagnes"),
    vuesCompletes: nombre("vuesCompletes"),
    ouvertures: nombre("ouvertures"),
    rdvAttribues: nombre("rdvAttribues"),
    devisAttribues: nombre("devisAttribues"),
  });

  const separateur = retour.includes("?") ? "&" : "?";
  if ("error" in resultat) {
    redirect(`${retour}${separateur}erreur=${encodeURIComponent(resultat.error)}`);
  }
  redirect(`${retour}${separateur}releve=1`);
}
