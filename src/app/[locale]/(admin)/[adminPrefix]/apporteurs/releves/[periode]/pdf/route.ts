/**
 * Relevé mensuel : le PDF STOCKÉ d'un relevé, pour la console (lot 3e).
 *
 *   /apporteurs/releves/2026-10/pdf?numero=REL-2026-10-0001
 *
 * Lecture seule. Session ET droit de facturation, comme les autofactures. La clé R2 vient de la
 * ligne en base (`pdfR2Key`), jamais d'une saisie libre ; le couple (période, numéro) doit exister.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { periodeValide } from "@/features/apporteurs-reseau/releve-mensuel/periode";
import { refuserSiHorsConsole } from "@/server/auth/garde-route-console";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

const NUMERO = /^REL-\d{4}-\d{2}-\d{4,}(-R\d+)?$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string; adminPrefix: string; periode: string }> },
): Promise<NextResponse> {
  const horsConsole = await refuserSiHorsConsole(params);
  if (horsConsole) return horsConsole;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return new NextResponse("Accès refusé.", { status: 403 });

  const { periode } = await params;
  const numero = req.nextUrl.searchParams.get("numero") ?? "";
  if (!periodeValide(periode) || !NUMERO.test(numero)) {
    return new NextResponse("Paramètres invalides.", { status: 400 });
  }
  const releve = await prisma.releveMensuelApporteur.findFirst({
    where: { numero, periode },
    select: { numero: true, pdfR2Key: true },
  });
  if (!releve?.pdfR2Key) return new NextResponse("PDF indisponible.", { status: 404 });
  const pdf = await getObjectBufferR2(releve.pdfR2Key);
  if (!pdf) return new NextResponse("PDF indisponible.", { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${releve.numero}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
