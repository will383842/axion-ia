/**
 * Réseau d'apporteurs — le PDF d'une autofacture, pour la console.
 *
 *   /apporteurs/commissions/autofacture?numero=AXI-APP-2026-0001
 *
 * Route Handler en lecture seule. Gardée : session ET rôle de facturation
 * (`peutEngager(role, "facturer")`), comme les actions sur les commissions. Le numéro doit
 * appartenir à une commission existante : on n'ouvre jamais une clé R2 construite à partir
 * d'une saisie libre.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

const NUMERO = /^AXI-APP-\d{4}-\d{4,}$/;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return new NextResponse("Accès refusé.", { status: 403 });

  const numero = req.nextUrl.searchParams.get("numero") ?? "";
  if (!NUMERO.test(numero)) return new NextResponse("Numéro invalide.", { status: 400 });
  const ligne = await prisma.commissionApporteur.findFirst({
    where: { autofactureNumero: numero },
    select: { apporteurId: true },
  });
  if (!ligne) return new NextResponse("Autofacture introuvable.", { status: 404 });
  const pdf = await getObjectBufferR2(`apporteurs/autofactures/${ligne.apporteurId}/${numero}.pdf`);
  if (!pdf) return new NextResponse("PDF indisponible.", { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${numero}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
