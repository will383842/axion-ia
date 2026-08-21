/**
 * Console éditoriale — l'équipe et la revue (lot 4).
 *
 * Trois critères, dont deux reposent sur du travail déjà fait :
 *
 *   - « un `montage` ne peut pas valider une publication » — la matrice du §4
 *     le refuse déjà, et 78 tests le vérifient cellule par cellule. Il restait
 *     à l'APPLIQUER, ce que fait `requirePermission`.
 *   - « toute mutation apparaît dans le journal avec son AUTEUR » —
 *     `journaliser` porte `membreId` depuis le lot 1. Le mot qui manquait
 *     était « apparaît » : il fallait un écran.
 *
 * Le troisième est neuf : la revue en deux temps.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import { ROLES_EDITORIAUX, type RoleEditorial } from "@/server/editorial/permissions";
import type { ActionResult } from "@/server/actions/editorial/publications";

// ── La revue ──────────────────────────────────────────────────────────────

const revueSchema = z.object({
  assetId: z.string().uuid(),
  /** Le commentaire est OBLIGATOIRE au refus — voir ci-dessous. */
  commentaire: z.string().trim().max(2000).optional(),
});

/**
 * Refuse un asset en revue — critère 2 du lot 4.
 *
 * > « Un asset refusé en revue revient en `en_cours` AVEC LE COMMENTAIRE. »
 *
 * 🔴 Le commentaire est OBLIGATOIRE, et ce n'est pas une formalité. Un refus
 * sans motif oblige le monteur à deviner ce qui n'allait pas ; il refait au
 * jugé, se fait refuser une seconde fois, et la revue devient un jeu de
 * devinettes qui coûte deux montages au lieu d'un.
 *
 * Le retour se fait en `en_cours` et non en `a_produire` : le travail existe,
 * il est à REPRENDRE, pas à refaire depuis rien.
 */
export async function refuserAssetAction(
  input: z.input<typeof revueSchema>,
): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("asset.valider");
    const parsed = revueSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { assetId, commentaire } = parsed.data;

    if (!commentaire || commentaire.length < 3) {
      return {
        error:
          "Un refus sans motif oblige le monteur à deviner. Dites ce qui ne va pas — " +
          "sans cela, il refait au jugé et se fait refuser une seconde fois.",
      };
    }

    const asset = await prisma.edAsset.findUnique({
      where: { id: assetId },
      select: { statut: true, libelle: true },
    });
    if (!asset) return { error: "Asset introuvable" };

    await prisma.edAsset.update({
      where: { id: assetId },
      data: { statut: "en_cours", revueCommentaire: commentaire },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: assetId,
      action: "revue_refus",
      membreId: membre.membreId,
      avant: { statut: asset.statut },
      apres: { statut: "en_cours", commentaire },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * Soumet un asset à la revue.
 *
 * Le monteur PEUT soumettre (`asset.ecrire`), il ne peut pas valider — c'est
 * exactement le principe du protocole : « l'implémenteur d'une tâche ne peut
 * jamais en être le vérificateur ».
 */
export async function soumettreAssetRevueAction(input: {
  assetId: string;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = z.object({ assetId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    const asset = await prisma.edAsset.findUnique({
      where: { id: parsed.data.assetId },
      select: { statut: true },
    });
    if (!asset) return { error: "Asset introuvable" };

    await prisma.edAsset.update({
      where: { id: parsed.data.assetId },
      // Le commentaire de la revue précédente est effacé : il portait sur une
      // version qui n'existe plus, et le laisser ferait croire à un refus en
      // cours sur un travail déjà repris.
      data: { statut: "a_valider", revueCommentaire: null },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: parsed.data.assetId,
      action: "revue_soumission",
      membreId: membre.membreId,
      avant: { statut: asset.statut },
      apres: { statut: "a_valider" },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/** Assigne un responsable à un asset — c'est ce qui remplit « sa file ». */
export async function assignerAssetAction(input: {
  assetId: string;
  membreId: string | null;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = z
      .object({ assetId: z.string().uuid(), membreId: z.string().uuid().nullable() })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    await prisma.edAsset.update({
      where: { id: parsed.data.assetId },
      data: { responsableId: parsed.data.membreId },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: parsed.data.assetId,
      action: "assignation",
      membreId: membre.membreId,
      apres: { responsableId: parsed.data.membreId },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

// ── L'équipe ──────────────────────────────────────────────────────────────

const membreSchema = z.object({
  nom: z.string().trim().min(1, "Un nom est requis").max(160),
  email: z.string().trim().email("Adresse électronique invalide").max(255),
  role: z.enum(ROLES_EDITORIAUX as unknown as [RoleEditorial, ...RoleEditorial[]]),
  /** Rattachement à un compte d'authentification existant. */
  userId: z.string().uuid().nullable().optional(),
});

/**
 * Crée un membre de l'équipe éditoriale.
 *
 * ⚠️ Réservé à `equipe.gerer`, c'est-à-dire à l'admin seul (§4). Pouvoir
 * créer un membre, c'est pouvoir se donner des droits : la matrice est claire.
 */
export async function creerMembreAction(
  input: z.input<typeof membreSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("equipe.gerer");
    const parsed = membreSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { nom, email, role, userId } = parsed.data;

    const existant = await prisma.edMembre.findUnique({ where: { email } });
    if (existant) {
      return { error: `Un membre porte déjà l'adresse « ${email} ».` };
    }

    const cree = await prisma.edMembre.create({
      data: { nom, email, role, userId: userId ?? null },
      select: { id: true },
    });

    await journaliser({
      entite: "EdMembre",
      entiteId: cree.id,
      action: "creation",
      membreId: membre.membreId,
      apres: { nom, email, role },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id: cree.id } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * Change le rôle d'un membre.
 *
 * Le journal garde l'AVANT et l'APRÈS : un changement de droits est
 * exactement le genre de mutation qu'on veut pouvoir retracer.
 */
export async function changerRoleMembreAction(input: {
  membreId: string;
  role: RoleEditorial;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const agissant = await requirePermission("equipe.gerer");
    const parsed = z
      .object({
        membreId: z.string().uuid(),
        role: z.enum(ROLES_EDITORIAUX as unknown as [RoleEditorial, ...RoleEditorial[]]),
      })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    const cible = await prisma.edMembre.findUnique({
      where: { id: parsed.data.membreId },
      select: { role: true, nom: true, userId: true },
    });
    if (!cible) return { error: "Membre introuvable" };

    // 🔴 On ne se retire pas à soi-même le rôle d'admin : c'est le moyen le
    // plus simple de se verrouiller dehors de sa propre console, sans recours
    // depuis l'interface.
    if (
      cible.userId === agissant.userId &&
      cible.role === "admin" &&
      parsed.data.role !== "admin"
    ) {
      return {
        error:
          "Vous ne pouvez pas vous retirer vous-même le rôle d'administrateur : " +
          "personne ne pourrait plus vous le rendre depuis la console. " +
          "Nommez d'abord un autre administrateur.",
      };
    }

    await prisma.edMembre.update({
      where: { id: parsed.data.membreId },
      data: { role: parsed.data.role },
    });

    await journaliser({
      entite: "EdMembre",
      entiteId: parsed.data.membreId,
      action: "changement_role",
      membreId: agissant.membreId,
      avant: { role: cible.role },
      apres: { role: parsed.data.role },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/** Adaptateur de formulaire pour la création de membre. */
export async function creerMembreFormAction(donnees: FormData): Promise<void> {
  const { redirect } = await import("next/navigation");
  const retour = (donnees.get("retour") as string) || "";
  const separateur = retour.includes("?") ? "&" : "?";

  const resultat = await creerMembreAction({
    nom: (donnees.get("nom") as string) ?? "",
    email: (donnees.get("email") as string) ?? "",
    role: ((donnees.get("role") as string) ?? "lecture") as RoleEditorial,
  });

  if ("error" in resultat) {
    redirect(`${retour}${separateur}erreur=${encodeURIComponent(resultat.error)}`);
  }
  redirect(`${retour}${separateur}cree=1`);
}

/** Adaptateur de formulaire pour le refus en revue. */
export async function refuserAssetFormAction(donnees: FormData): Promise<void> {
  const { redirect } = await import("next/navigation");
  const retour = (donnees.get("retour") as string) || "";
  const separateur = retour.includes("?") ? "&" : "?";

  const resultat = await refuserAssetAction({
    assetId: (donnees.get("assetId") as string) ?? "",
    commentaire: (donnees.get("commentaire") as string) ?? "",
  });

  if ("error" in resultat) {
    redirect(`${retour}${separateur}erreur=${encodeURIComponent(resultat.error)}`);
  }
  redirect(`${retour}${separateur}refuse=1`);
}
