/**
 * Téléchargements du rapport d'analyse d'un client (2026-11-02) — SUPER-ADMINISTRATEUR seul.
 *
 *   ?r=<rapport>&f=synthese-html | automatisations-html | schema-html | base-json
 *
 * Toujours en PIÈCE JOINTE, jamais en cache (`private, no-store`). Les trois documents HTML sont
 * INTERNES (jamais transmis au client) ; les deux derniers n'existent que pour une base
 * `base-audit/2` (409 sinon). Un HTML part avec une `Content-Security-Policy` qui interdit tout
 * script et toute ressource externe. Rien n'est jamais envoyé au client d'ici.
 * La décision est dans `decisionTelechargement` (pur, testé). LA TRACE EST ÉCRITE D'ABORD (qui,
 * quand, quel rapport, quel format — jamais le contenu) : sans trace, rien n'est rendu.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { accesRapports } from "@/features/rapport-avant-audit/ecran/brancher";
import { decisionTelechargement } from "@/features/rapport-avant-audit/ecran/logique";
import { POLITIQUE_SECURITE } from "@/features/rapport-avant-audit/sorties/html/echapper";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  if (user.role !== "super_admin") return refus(403, "Réservé au super-administrateur.");

  const { id } = await params;
  const clientId = id.toLowerCase();
  const sp = new URL(req.url).searchParams;
  const rapportId = (sp.get("r") ?? "").trim().toLowerCase();
  const format = sp.get("f");
  if (!UUID.test(clientId) || !UUID.test(rapportId)) return refus(400, "Demande invalide.");

  const acces = accesRapports();
  const rapport = (await acces.listerRapports(clientId)).find((r) => r.id === rapportId) ?? null;
  const d = decisionTelechargement({ role: user.role, format, rapport });
  if (!d.ok) return refus(d.statut, d.texte);
  // `decisionTelechargement` a vérifié le format.
  const fichier = await acces.telecharger(
    clientId,
    rapportId,
    format as Parameters<typeof acces.telecharger>[2],
  );
  if (fichier === null) return refus(404, "Introuvable.");

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: user.id,
        action: "rapport-avant-audit.telechargement",
        targetType: "Client",
        targetId: clientId,
        changes: { rapportId, version: rapport?.version ?? null, format },
      },
    });
  } catch {
    return refus(
      503,
      "Le téléchargement n'a pas pu être tracé : rien n'est rendu. Réessayez plus tard.",
    );
  }

  const nom = fichier.nom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const corps =
    typeof fichier.contenu === "string" ? fichier.contenu : Buffer.from(fichier.contenu);
  const entetesHtml: Record<string, string> = fichier.type.startsWith("text/html")
    ? { "Content-Security-Policy": POLITIQUE_SECURITE }
    : {};
  return new NextResponse(corps, {
    status: 200,
    headers: {
      ...entetesHtml,
      "Content-Type": fichier.type,
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
