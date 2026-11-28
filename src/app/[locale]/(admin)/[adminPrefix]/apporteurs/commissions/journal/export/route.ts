/**
 * Réseau d'apporteurs — export du journal des autofactures pour l'expert-comptable (point 25).
 *
 *   /apporteurs/commissions/journal/export?format=csv|fec&du=AAAA-MM-JJ&au=AAAA-MM-JJ
 *
 * Lecture seule. Même garde que `commissions/export` : session ET rôle de facturation.
 * Le FEC refuse (400) si une pièce a des totaux absents : jamais d'écriture inventée.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { construireCsvJournal } from "@/features/apporteurs-reseau/journal-autofactures-csv";
import { construireFec, ErreurFec } from "@/features/apporteurs-reseau/journal-autofactures-fec";
import { lireJournal } from "@/features/apporteurs-reseau/journal-autofactures";
import { jourValide } from "@/features/apporteurs-reseau/journal-autofactures-types";
import { peutEngager } from "@/server/auth/habilitations";
import { refuserSiHorsConsole } from "@/server/auth/garde-route-console";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string; adminPrefix: string }> },
): Promise<NextResponse> {
  const horsConsole = await refuserSiHorsConsole(params);
  if (horsConsole) return horsConsole;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return new NextResponse("Accès refusé.", { status: 403 });

  const q = req.nextUrl.searchParams;
  const format = q.get("format");
  const du = q.get("du") ?? "";
  const au = q.get("au") ?? "";
  if (format !== "csv" && format !== "fec")
    return new NextResponse("Format invalide.", { status: 400 });
  if (!jourValide(du) || !jourValide(au) || du > au)
    return new NextResponse("Période invalide.", { status: 400 });

  const { lignes } = await lireJournal({ du, au });
  const entetes = { "cache-control": "no-store" };
  if (format === "csv") {
    return new NextResponse(construireCsvJournal(lignes), {
      status: 200,
      headers: {
        ...entetes,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="journal-autofactures-${du}-${au}.csv"`,
      },
    });
  }
  try {
    return new NextResponse(construireFec(lignes), {
      status: 200,
      headers: {
        ...entetes,
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="journal-autofactures-${du}-${au}-fec.txt"`,
      },
    });
  } catch (e) {
    if (e instanceof ErreurFec)
      return new NextResponse(`${e.message}\n${e.numeros.join("\n")}`, { status: 400 });
    throw e;
  }
}
