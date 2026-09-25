// Route handler GET /api/admin/newsletter/export — telechargement CSV.
//
// Lot L3 (2026-09-24) : format MailWizz (confirmés éligibles), avec TOUS les
// filtres de l'écran — la recherche comprise, qui n'était pas transmise.

import { NextResponse, type NextRequest } from "next/server";
import { exportSubscribersCsvAction } from "@/features/admin-newsletter/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const { filename, csv, tronque } = await exportSubscribersCsvAction({
      status: (sp.get("status") as never) ?? undefined,
      locale: (sp.get("locale") as never) ?? undefined,
      source: sp.get("source") ?? undefined,
      search: sp.get("search") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        // Plafond atteint : le fichier est INCOMPLET, et il le dit (en-tête
        // lu par l'écran et par tout script d'import) au lieu de le taire.
        "x-export-tronque": tronque ? "1" : "0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    if (message === "unauthorized" || message === "forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "forbidden_status") {
      // Seuls les confirmés s'exportent : un autre statut est refusé, jamais
      // ignoré en silence (le fichier dirait autre chose que l'écran).
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
