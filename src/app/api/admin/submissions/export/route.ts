// Route handler GET /api/admin/submissions/export — telechargement CSV.
//
// La Server Action `exportSubmissionsCsvAction` retourne le CSV mais
// ne sait pas servir un fichier. On expose une route handler qui appelle
// l'action puis renvoie un Response avec les bons headers Content-Type +
// Content-Disposition (download).

import { NextResponse, type NextRequest } from "next/server";
import { exportSubmissionsCsvAction } from "@/features/admin-submissions/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const { filename, csv } = await exportSubmissionsCsvAction({
      type: (sp.get("type") as never) ?? undefined,
      // Filtre « Catégorie » (2026-07-29) + types forcés des vues filtrées :
      // l'export doit refléter exactement l'écran depuis lequel on le lance.
      unifiedType: sp.get("unifiedType") ?? undefined,
      ...(sp.getAll("unifiedTypeIn").length > 0
        ? { unifiedTypeIn: sp.getAll("unifiedTypeIn") }
        : {}),
      status: (sp.get("status") as never) ?? undefined,
      locale: (sp.get("locale") as never) ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    if (message === "unauthorized" || message === "forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
