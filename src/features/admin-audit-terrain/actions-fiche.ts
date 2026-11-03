// Audit présentiel PR3 : révocation et régénération du jeton DEPUIS la fiche d'un client.
// Chaque appel redit le clientId de la page ; la session doit lui appartenir (sinon « introuvable »,
// sans rien révéler d'une session d'un autre client). Les actions de PR2 font ensuite le travail
// (rôle super_admin revérifié, journal d'activité).

"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { regenererJetonAudit, revoquerJetonAudit, type ResultatJeton } from "./actions";

const entree = z
  .object({
    clientId: z.string().uuid(),
    sessionId: z.string().uuid(),
    joursValidite: z.union([z.literal(2), z.literal(5), z.literal(10)]).optional(),
  })
  .strict();

type Refus = { ok: false; erreur: "interdit" | "invalide" | "introuvable" };

async function sessionDeLaFiche(
  e: unknown,
): Promise<{ ok: true; sessionId: string; joursValidite: 2 | 5 | 10 | undefined } | Refus> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "super_admin") {
    return { ok: false, erreur: "interdit" };
  }
  const p = entree.safeParse(e);
  if (!p.success) return { ok: false, erreur: "invalide" };
  const ligne = await prisma.auditTerrainSession.findUnique({
    where: { id: p.data.sessionId },
    select: { clientId: true },
  });
  if (!ligne || ligne.clientId !== p.data.clientId) return { ok: false, erreur: "introuvable" };
  return { ok: true, sessionId: p.data.sessionId, joursValidite: p.data.joursValidite };
}

export async function revoquerJetonDeLaFiche(
  e: unknown,
): Promise<Awaited<ReturnType<typeof revoquerJetonAudit>>> {
  const r = await sessionDeLaFiche(e);
  if (!r.ok) return r;
  return revoquerJetonAudit(r.sessionId);
}

export async function regenererJetonDeLaFiche(e: unknown): Promise<ResultatJeton> {
  const r = await sessionDeLaFiche(e);
  if (!r.ok) return r;
  return regenererJetonAudit({
    sessionId: r.sessionId,
    ...(r.joursValidite !== undefined ? { joursValidite: r.joursValidite } : {}),
  });
}
