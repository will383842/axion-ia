/**
 * Journal d'activité de l'audit présentiel : une ligne `ActivityLog`, sans requête ni session.
 * Best-effort (un journal raté n'annule jamais l'acte) mais l'échec est signalé ; jamais de contenu,
 * de jeton ni de corps dans `changes`. Module propre à l'audit (écrivain séparé de la génération de contenu).
 */
import { prisma } from "@/lib/prisma";

export interface ActeurJournal {
  readonly adminUserId: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface EntreeJournal {
  readonly action: string;
  readonly targetType?: string | undefined;
  readonly targetId?: string | null | undefined;
  readonly changes?: unknown;
}

export async function ecrireJournalActivite(
  acteur: ActeurJournal,
  entree: EntreeJournal,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteur.adminUserId,
        action: entree.action.slice(0, 120),
        targetType: entree.targetType?.slice(0, 80) ?? null,
        targetId: entree.targetId ?? null,
        changes: (entree.changes ?? null) as never,
        ipAddress: acteur.ipAddress?.slice(0, 64) ?? null,
        userAgent: acteur.userAgent?.slice(0, 2000) ?? null,
      },
    });
  } catch (err) {
    console.error(
      `[audit-terrain] journal « ${entree.action} » non écrit :`,
      err instanceof Error ? err.name : "erreur",
    );
  }
}
