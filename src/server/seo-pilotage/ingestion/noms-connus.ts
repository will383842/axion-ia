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

type BaseNoms = Pick<
  PrismaClient,
  "trainer" | "jobApplication" | "client" | "trainee" | "clientContact" | "adminUser"
>;

function complet(prenom: string | null | undefined, nom: string | null | undefined): string | null {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  return p && n ? `${p} ${n}` : null;
}

export async function chargerNomsConnus(prisma: BaseNoms): Promise<string[]> {
  const [formateurs, candidats, clients, stagiaires, contacts, equipe] = await Promise.all([
    prisma.trainer.findMany({ select: { prenom: true, nom: true }, take: LOT_MAX }),
    prisma.jobApplication.findMany({
      select: { firstName: true, lastName: true },
      take: LOT_MAX,
    }),
    prisma.client.findMany({
      select: { contactPrenom: true, contactNomFamille: true, contactNom: true },
      take: LOT_MAX,
    }),
    prisma.trainee.findMany({ select: { prenom: true, nom: true }, take: LOT_MAX }),
    prisma.clientContact.findMany({ select: { prenom: true, nom: true }, take: LOT_MAX }),
    prisma.adminUser.findMany({ select: { name: true }, take: LOT_MAX }),
  ]);
  const noms = new Set<string>();
  const ajouter = (n: string | null) => {
    if (n) noms.add(n);
  };
  /** Un nom saisi d'un bloc : retenu seulement s'il contient au moins deux mots (prénom + nom). */
  const bloc = (n: string | null | undefined) => {
    const t = (n ?? "").trim();
    if (t.split(/\s+/).length >= 2) noms.add(t);
  };
  for (const f of formateurs) ajouter(complet(f.prenom, f.nom));
  for (const c of candidats) ajouter(complet(c.firstName, c.lastName));
  for (const t of stagiaires) ajouter(complet(t.prenom, t.nom));
  for (const c of clients) {
    const n = complet(c.contactPrenom, c.contactNomFamille);
    if (n) noms.add(n);
    else bloc(c.contactNom);
  }
  for (const c of contacts) {
    const n = complet(c.prenom, c.nom);
    if (n) noms.add(n);
    else bloc(c.nom);
  }
  for (const a of equipe) bloc(a.name);
  return [...noms];
}
