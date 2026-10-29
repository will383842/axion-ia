/**
 * Copie complète des réponses d'un questionnaire avant audit (2026-10-27) — SUPER-ADMINISTRATEUR
 * seul, interrupteur `QUESTIONNAIRE_EXPORT_COMPLET_ENABLED` (absent = éteint).
 *
 * Une copie lisible, à garder en lieu sûr (sans elle, tout dépend de la clé de chiffrement et de
 * la sauvegarde de la base). Le code du dirigeant y est masqué. LA TRACE EST ÉCRITE D'ABORD (qui,
 * quand, quel questionnaire, combien de lignes, empreinte — jamais le contenu) : sans trace,
 * rien n'est rendu. Aucune écriture dans les tables du questionnaire.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  fichesCouvertes,
  questionnairesDesFiches,
} from "@/features/questionnaire-preaudit/de-la-fiche";
import {
  exportCompletActif,
  exporterQuestionnaireComplet,
} from "@/features/questionnaire-preaudit/export-complet";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ACTION_TRACE = "questionnaire-preaudit.export-complet";

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, {
    status: statut,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string | null } | undefined;
  if (!user?.id) return refus(401, "Session expirée : reconnectez-vous.");
  if (!exportCompletActif()) return refus(404, "Introuvable.");
  if (user.role !== "super_admin") return refus(403, "Réservé au super-administrateur.");

  const { id } = await params;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (!UUID.test(id.toLowerCase()) || !UUID.test(q)) return refus(400, "Demande invalide.");

  // Le questionnaire doit appartenir à CETTE fiche (ou à une fiche qu'elle a absorbée).
  const appartient = await prisma.questionnaireAvantAudit.findFirst({
    where: { id: q, ...questionnairesDesFiches(await fichesCouvertes(id.toLowerCase())) },
    select: { id: true },
  });
  if (appartient === null) return refus(404, "Introuvable.");

  const copie = await exporterQuestionnaireComplet(q);
  if (copie === null) return refus(404, "Introuvable.");

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: user.id,
        action: ACTION_TRACE,
        targetType: "questionnaire_avant_audit",
        targetId: q,
        changes: {
          reponses: copie.comptes.reponses,
          brouillons: copie.comptes.brouillons,
          empreinte: copie.empreinte,
        },
      },
    });
  } catch {
    return refus(503, "La copie n'a pas pu être tracée : rien n'est rendu. Réessayez plus tard.");
  }

  const nom = `reponses-${copie.questionnaire.ref}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(JSON.stringify(copie, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
