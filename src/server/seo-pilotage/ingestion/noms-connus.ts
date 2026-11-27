/**
 * Noms de personnes connues en base (formateurs, candidats, contacts clients), pour le filtre
 * de données personnelles AVANT stockage (`filtrerDonneesPersonnelles`).
 *
 * « Prénom Nom » complets seulement : un nom de famille seul (« Petit », « Blanc ») retirerait
 * des requêtes légitimes. Les erreurs de lecture REMONTENT : un filtre qui ne peut pas
 * charger ses noms ne doit pas laisser passer des requêtes (le jour est alors en échec,
 * repris au passage suivant).
 */
import type { PrismaClient } from "../../../../prisma/generated/client";

const LOT_MAX = 20_000;

type BaseNoms = Pick<PrismaClient, "trainer" | "jobApplication" | "client">;

function complet(prenom: string | null | undefined, nom: string | null | undefined): string | null {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  return p && n ? `${p} ${n}` : null;
}

export async function chargerNomsConnus(prisma: BaseNoms): Promise<string[]> {
  const [formateurs, candidats, clients] = await Promise.all([
    prisma.trainer.findMany({ select: { prenom: true, nom: true }, take: LOT_MAX }),
    prisma.jobApplication.findMany({
      select: { firstName: true, lastName: true },
      take: LOT_MAX,
    }),
    prisma.client.findMany({
      where: { contactPrenom: { not: null }, contactNomFamille: { not: null } },
      select: { contactPrenom: true, contactNomFamille: true },
      take: LOT_MAX,
    }),
  ]);
  const noms = new Set<string>();
  for (const f of formateurs) {
    const n = complet(f.prenom, f.nom);
    if (n) noms.add(n);
  }
  for (const c of candidats) {
    const n = complet(c.firstName, c.lastName);
    if (n) noms.add(n);
  }
  for (const c of clients) {
    const n = complet(c.contactPrenom, c.contactNomFamille);
    if (n) noms.add(n);
  }
  return [...noms];
}
