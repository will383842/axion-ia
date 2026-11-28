/**
 * Écriture de la page d'origine d'une réservation (C12). Appelée par l'action de réservation
 * APRÈS le succès chez Calendly, jamais avant, et sans jamais la faire échouer : le rendez-vous est
 * pris, c'est le plus important ; une mesure manquée ne se rattrape pas, elle se tait.
 */
import { normaliserPageOrigine, suiviOrigineActif } from "./page-origine";

export interface PrismaOrigine {
  contenuRendezVousOrigine: {
    upsert(args: {
      where: { eventUri: string };
      create: { eventUri: string; pageOrigine: string; choix: string | null };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
}

export type IssueOrigine = "enregistree" | "eteint" | "sans_origine" | "echec";

export async function enregistrerPageOrigine(
  entree: { eventUri: string; po: unknown; choix: string | null },
  prisma?: PrismaOrigine,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<IssueOrigine> {
  if (!suiviOrigineActif(env)) return "eteint";
  const pageOrigine = normaliserPageOrigine(entree.po);
  if (!pageOrigine || !entree.eventUri) return "sans_origine";
  try {
    const client = prisma ?? ((await import("@/lib/prisma")).prisma as unknown as PrismaOrigine);
    await client.contenuRendezVousOrigine.upsert({
      where: { eventUri: entree.eventUri.slice(0, 255) },
      create: {
        eventUri: entree.eventUri.slice(0, 255),
        pageOrigine,
        choix: entree.choix?.slice(0, 20) ?? null,
      },
      update: {},
    });
    return "enregistree";
  } catch {
    // Table pas encore migrée (fenêtre app/worker), base indisponible : on se tait.
    return "echec";
  }
}
