/**
 * Le contrat d'un apporteur, en PDF, depuis la console : `?quel=apporteur` (signé par
 * l'apporteur, en attente de contresignature) ou `?quel=signe` (signé des deux parties).
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { lireContratPdf } from "@/features/apporteurs-reseau/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!session?.user?.id) return refus(401, "Session expirée : reconnectez-vous.");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "super_admin" && role !== "admin") return refus(403, "Réservé aux administrateurs.");
  const { id } = await params;
  if (!UUID.test(id)) return refus(404, "Contrat introuvable.");
  const quel = new URL(req.url).searchParams.get("quel") === "signe" ? "signe" : "apporteur";
  const pdf = await lireContratPdf(id.toLowerCase(), quel);
  if (!pdf) return refus(404, "Contrat introuvable.");
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrat-apporteur-${quel}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
