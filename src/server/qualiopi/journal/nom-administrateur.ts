/**
 * Le nom d'un administrateur, FIGÉ au moment du geste dans un journal en ajout
 * seul (`auteur_nom`) : un renommage ultérieur ne réécrit pas l'histoire.
 * Même règle que la réouverture d'un dossier (ADR 0060) : à défaut de nom, le rôle.
 */

import { prisma } from "@/lib/prisma";

export async function nomAdministrateur(
  userId: string,
  repli: string,
  client: { adminUser: Pick<typeof prisma.adminUser, "findUnique"> } = prisma,
): Promise<string> {
  try {
    const a = await client.adminUser.findUnique({ where: { id: userId }, select: { name: true } });
    return typeof a?.name === "string" && a.name.trim() !== "" ? a.name.trim() : repli;
  } catch {
    return repli;
  }
}
