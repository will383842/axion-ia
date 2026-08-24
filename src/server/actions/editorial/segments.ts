/**
 * Console éditoriale — les briefs de production (segments d'asset).
 *
 * Un segment porte ce qu'il faut pour FABRIQUER un asset : le script d'une
 * vidéo, le prompt d'une image, le texte et le graphisme d'une slide. La
 * seule chose qu'on y fait depuis l'écran est de cocher « c'est produit ».
 *
 * ⚠️ Pourquoi cocher compte. Un carrousel de dix slides sans état d'avancement
 * n'a que deux états visibles : « à produire » et « prêt ». Entre les deux —
 * là où la production vit réellement — l'écran ne dit rien, et il faut
 * rouvrir le fichier pour savoir où on en est. « 7 slides sur 10 » se lit ;
 * « en cours » ne se lit pas.
 *
 * Le contenu des segments, lui, ne s'édite pas depuis ici : il vient du
 * dossier de production, importé une fois. S'il doit changer, il change dans
 * le dossier et se réimporte — sinon la base et le dossier divergent en
 * silence, et plus personne ne sait lequel fait foi.
 */

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import type { ActionResult } from "@/server/actions/editorial/publications";

const basculeSchema = z.object({
  segmentId: z.string().uuid(),
  fait: z.boolean(),
});

/**
 * Coche ou décoche un segment.
 *
 * 🔴 L'état voulu est ENVOYÉ, il n'est pas déduit de l'état courant. Deux
 * clics rapides sur la même case liraient tous deux « non fait » et
 * écriraient tous deux « fait » — l'un des deux serait perdu sans que rien
 * ne le dise. Le formulaire annonce ce qu'il veut, comme la garde optimiste
 * du formulaire de rédaction.
 */
export async function basculerSegmentFaitAction(
  input: z.input<typeof basculeSchema>,
): Promise<ActionResult<{ id: string; fait: boolean }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = basculeSchema.safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { segmentId, fait } = parsed.data;

    const avant = await prisma.edAssetSegment.findUnique({
      where: { id: segmentId },
      select: { fait: true, titre: true, assetId: true },
    });
    if (!avant) return { error: "Segment introuvable." };

    await prisma.edAssetSegment.update({ where: { id: segmentId }, data: { fait } });

    await journaliser({
      entite: "EdAssetSegment",
      entiteId: segmentId,
      action: fait ? "segment_fait" : "segment_a_refaire",
      membreId: membre.membreId,
      avant: { fait: avant.fait },
      apres: { fait, titre: avant.titre },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "layout");
    return { data: { id: segmentId, fait } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

// ── L'adaptateur de formulaire ────────────────────────────────────────────

export async function basculerSegmentFaitFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const segmentId = champ(donnees, "segmentId");
  if (!segmentId) redirect(avecErreur(retour, "Segment manquant."));

  // Le bouton envoie l'état VOULU, pas l'état courant.
  const fait = champ(donnees, "fait") === "1";

  const resultat = await basculerSegmentFaitAction({ segmentId, fait });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "segment"));
}
