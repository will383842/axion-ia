// Route handler GET /api/admin/newsletter/suppression — liste de suppression (lot L3).
//
// Empreintes SHA-256 des adresses à ne jamais importer dans l'outil de lettres
// (désabonnés, rejetés, rebonds durs, effacés). Aucune adresse dans le fichier.
// Réservé admin / super_admin, chaque export journalisé.

import { NextResponse } from "next/server";
import { exportSuppressionCsvAction } from "@/features/admin-newsletter/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { filename, csv, tronque } = await exportSuppressionCsvAction();
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
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
