/**
 * Console éditoriale — l'achat média (lot 6).
 *
 * ## Ce que le lot 6 est, et ce qu'il n'est pas
 *
 * Le §1 ter classe l'achat média en « crochets dans le modèle, rien à
 * l'écran » : `EdCompteType.publicitaire`, `EdAssetUsage.payant`, et surtout
 * `EdPublication.coutCentimes`, dont le commentaire du schéma dit le but
 * exact — « rend comparable un post gratuit et une campagne payante ».
 *
 * 🔴 Ces trois crochets existaient depuis le lot 0, et **rien ne les
 * écrivait**. `coutCentimes` valait 0 pour les 74 publications, `usage`
 * valait `organique` pour les 31 assets, et le module `cout.ts` — 21 tests
 * verts — n'était appelé par aucun écran.
 *
 * Le calcul était juste et n'avait aucune donnée à calculer. C'est la même
 * classe de défaut que les recettes vides : une fonctionnalité correcte dont
 * la donnée manque est inutilisable, et plus trompeuse qu'une fonctionnalité
 * absente parce que le code laisse croire qu'elle marche.
 *
 * ## ⚠️ Les centimes
 *
 * Tout est en CENTIMES en base, et la saisie se fait en EUROS. La conversion
 * vit dans `cout.ts`, le module PUR — pas ici : un module `"use server"` ne
 * peut exporter QUE des fonctions asynchrones, et `eurosVersCentimes` est
 * synchrone. Je l'avais d'abord écrite ici, et le BUILD l'a refusée :
 *
 *     Error: x Server Actions must be async functions.
 *
 * ⚠️ Ni `tsc` ni Vitest ne voient cette contrainte — seul le compilateur de
 * Next. Typecheck vert et 23 tests verts n'ont rien signalé.
 */

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import type { ActionResult } from "@/server/actions/editorial/publications";
// 🔴 La conversion vit dans le module PUR : un module `"use server"` ne
// peut exporter que des fonctions asynchrones. Voir `eurosVersCentimes`.
import { eurosVersCentimes } from "@/server/editorial/cout";

const USAGES = ["organique", "payant", "mixte"] as const;

const coutSchema = z.object({
  publicationId: z.string().uuid(),
  coutCentimes: z.number().int().min(0).max(100_000_000),
});

/**
 * Saisit le budget engagé sur une publication — le crochet du §1 ter.
 *
 * ⚠️ `metrique.saisir` et non `publication.ecrire` : saisir un budget est du
 * même ordre que saisir un relevé — une mesure a posteriori, pas une
 * modification du contenu. Le rôle `production` doit pouvoir le faire sans
 * pouvoir réécrire un post.
 */
export async function saisirCoutAction(
  input: z.input<typeof coutSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("metrique.saisir");
    const parsed = coutSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { publicationId, coutCentimes } = parsed.data;

    const avant = await prisma.edPublication.findUnique({
      where: { id: publicationId },
      select: { coutCentimes: true, titreInterne: true },
    });
    if (!avant) return { error: "Publication introuvable." };

    await prisma.edPublication.update({
      where: { id: publicationId },
      data: { coutCentimes },
    });

    // Le budget est une donnée qui se discute : qui l'a saisi, et quand,
    // compte autant que le chiffre.
    await journaliser({
      entite: "EdPublication",
      entiteId: publicationId,
      action: "cout",
      membreId: membre.membreId,
      avant: { coutCentimes: avant.coutCentimes },
      apres: { coutCentimes },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "layout");
    return { data: { id: publicationId } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

const usageSchema = z.object({
  assetId: z.string().uuid(),
  usage: z.enum(USAGES),
});

/**
 * Déclare comment un asset est diffusé — organique, payant, ou les deux.
 *
 * C'est cette valeur qui range une publication d'un côté ou de l'autre de la
 * comparaison. Un asset `mixte` — poussé ET repris organiquement — n'est pas
 * une commodité : c'est le cas le plus fréquent d'une campagne réussie, et le
 * confondre avec `payant` fausserait le coût par résultat dans les deux
 * groupes à la fois.
 */
export async function changerUsageAssetAction(
  input: z.input<typeof usageSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = usageSchema.safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { assetId, usage } = parsed.data;

    const avant = await prisma.edAsset.findUnique({
      where: { id: assetId },
      select: { usage: true, libelle: true },
    });
    if (!avant) return { error: "Asset introuvable." };

    await prisma.edAsset.update({ where: { id: assetId }, data: { usage } });

    await journaliser({
      entite: "EdAsset",
      entiteId: assetId,
      action: "usage",
      membreId: membre.membreId,
      avant: { usage: avant.usage },
      apres: { usage },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "layout");
    return { data: { id: assetId } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

// ── Les adaptateurs de formulaire ─────────────────────────────────────────

export async function saisirCoutFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const publicationId = champ(donnees, "publicationId");
  if (!publicationId) redirect(avecErreur(retour, "Publication introuvable."));

  // ⚠️ Un champ VIDE remet le budget à zéro : c'est le geste qui corrige une
  // saisie erronée. `champ()` rendrait `undefined` et on ne saurait pas
  // distinguer « effacer » de « ne pas toucher ».
  const brut = (donnees.get("euros") as string | null) ?? "";
  const montant = eurosVersCentimes(brut);
  if (!montant.ok) redirect(avecErreur(retour, montant.erreur));

  const resultat = await saisirCoutAction({ publicationId, coutCentimes: montant.centimes });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "cout"));
}

export async function changerUsageAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  const usage = champ(donnees, "usage");
  if (!assetId || !usage) redirect(avecErreur(retour, "Asset ou usage manquant."));

  const resultat = await changerUsageAssetAction({
    assetId,
    usage: usage as (typeof USAGES)[number],
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "usage"));
}
