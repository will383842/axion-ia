"use server";

/**
 * Bibliothèque des textes du devis à formules (avantages, inconvénients, prérequis, clauses).
 *
 * ARCHIVAGE seulement (trigger SQL anti-DELETE) : « modifier » crée la version suivante et
 * archive l'ancienne dans UNE transaction, sous verrou `archiveAt IS NULL` — deux onglets qui
 * modifient la même version : un seul gagne. Tout texte est un PROJET « à valider » (Will +
 * juriste) : aucun texte juridique définitif n'est écrit ici. Aucun e-mail.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import {
  FORMULES_BIBLIOTHEQUE,
  NATURES_BIBLIOTHEQUE,
  type TexteBibliotheque,
} from "@/server/qualiopi/devis/bibliotheque-constantes";

type ActionResult<T> = { data: T } | { error: string };

const MSG_ETEINT = "Le devis à formules n'est pas activé.";
const MSG_BUILD = "Indisponible pendant le build";

/** Garde commune des écritures : build GH Actions (stub) puis interrupteur. `null` = autorisé. */
async function refusEcriture(): Promise<string | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return MSG_BUILD;
  if (!(await formulesActives())) return MSG_ETEINT;
  return null;
}

const texteSchema = z.string().trim().min(1).max(4000);
const ajoutSchema = z.object({
  formule: z.enum(FORMULES_BIBLIOTHEQUE),
  nature: z.enum(NATURES_BIBLIOTHEQUE),
  texte: texteSchema,
  actifParDefaut: z.boolean().optional(),
  ordre: z.number().int().min(0).max(10_000).optional(),
});
const idSchema = z.string().uuid();

/** Textes NON archivés (les versions actives), dans l'ordre d'affichage. */
export async function listerTextesAction(): Promise<ActionResult<TexteBibliotheque[]>> {
  await requireAdminWrite();
  const rows = await prisma.devisTexteBibliotheque.findMany({
    where: { archiveAt: null },
    orderBy: [{ formule: "asc" }, { nature: "asc" }, { ordre: "asc" }],
    select: {
      id: true,
      formule: true,
      nature: true,
      texte: true,
      actifParDefaut: true,
      ordre: true,
      version: true,
      aValider: true,
    },
  });
  return { data: rows };
}

export async function ajouterTexteAction(
  input: z.infer<typeof ajoutSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const refus = await refusEcriture();
  if (refus !== null) return { error: refus };
  const p = ajoutSchema.safeParse(input);
  if (!p.success) return { error: "Données invalides" };
  const row = await prisma.devisTexteBibliotheque.create({
    data: {
      formule: p.data.formule,
      nature: p.data.nature,
      texte: p.data.texte,
      actifParDefaut: p.data.actifParDefaut ?? false,
      ordre: p.data.ordre ?? 0,
      version: 1,
      aValider: true,
      majParAdminId: session.userId,
    },
    select: { id: true },
  });
  await logQualiopiActivity({
    action: "qualiopi.devis_bibliotheque.ajout",
    targetType: "DevisTexteBibliotheque",
    targetId: row.id,
    changes: { formule: p.data.formule, nature: p.data.nature },
    session,
  });
  return { data: { id: row.id } };
}

/** Nouvelle version du texte ; l'ancienne est archivée. Rend l'identifiant de la nouvelle. */
export async function modifierTexteAction(
  id: string,
  texte: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const refus = await refusEcriture();
  if (refus !== null) return { error: refus };
  const idP = idSchema.safeParse(id);
  const tP = texteSchema.safeParse(texte);
  if (!idP.success || !tP.success) return { error: "Données invalides" };

  const resultat = await prisma.$transaction(async (tx) => {
    const ancien = await tx.devisTexteBibliotheque.findUnique({ where: { id: idP.data } });
    if (!ancien || ancien.archiveAt !== null) return null;
    const { count } = await tx.devisTexteBibliotheque.updateMany({
      where: { id: idP.data, archiveAt: null },
      data: { archiveAt: new Date(), majParAdminId: session.userId },
    });
    if (count === 0) return null;
    return tx.devisTexteBibliotheque.create({
      data: {
        formule: ancien.formule,
        nature: ancien.nature,
        texte: tP.data,
        actifParDefaut: ancien.actifParDefaut,
        ordre: ancien.ordre,
        version: ancien.version + 1,
        aValider: true,
        majParAdminId: session.userId,
      },
      select: { id: true },
    });
  });
  if (resultat === null)
    return { error: "Texte introuvable ou déjà modifié ailleurs : rechargez." };
  await logQualiopiActivity({
    action: "qualiopi.devis_bibliotheque.version",
    targetType: "DevisTexteBibliotheque",
    targetId: resultat.id,
    changes: { remplace: idP.data },
    session,
  });
  return { data: { id: resultat.id } };
}

export async function archiverTexteAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const refus = await refusEcriture();
  if (refus !== null) return { error: refus };
  const idP = idSchema.safeParse(id);
  if (!idP.success) return { error: "Identifiant invalide" };
  const { count } = await prisma.devisTexteBibliotheque.updateMany({
    where: { id: idP.data, archiveAt: null },
    data: { archiveAt: new Date(), majParAdminId: session.userId },
  });
  if (count === 0) return { error: "Texte introuvable ou déjà archivé." };
  await logQualiopiActivity({
    action: "qualiopi.devis_bibliotheque.archive",
    targetType: "DevisTexteBibliotheque",
    targetId: idP.data,
    changes: { archive: true },
    session,
  });
  return { data: { id: idP.data } };
}

/**
 * Règle « actif par défaut » d'un texte : coché, le texte est pré-activé à la saisie d'un devis.
 * Ne touche ni au texte ni à sa version (c'est un réglage, pas une réécriture) ; ne vaut que
 * pour la version ACTIVE et n'affecte pas les offres déjà copiées.
 */
export async function definirActifParDefautAction(
  id: string,
  actif: boolean,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const refus = await refusEcriture();
  if (refus !== null) return { error: refus };
  const idP = idSchema.safeParse(id);
  const aP = z.boolean().safeParse(actif);
  if (!idP.success || !aP.success) return { error: "Données invalides" };
  const { count } = await prisma.devisTexteBibliotheque.updateMany({
    where: { id: idP.data, archiveAt: null },
    data: { actifParDefaut: aP.data, majParAdminId: session.userId },
  });
  if (count === 0) return { error: "Texte introuvable ou archivé : rechargez." };
  await logQualiopiActivity({
    action: "qualiopi.devis_bibliotheque.reglage_defaut",
    targetType: "DevisTexteBibliotheque",
    targetId: idP.data,
    changes: { actifParDefaut: aP.data },
    session,
  });
  return { data: { id: idP.data } };
}
