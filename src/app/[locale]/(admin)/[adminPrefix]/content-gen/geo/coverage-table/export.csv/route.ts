// P5.5 — Export CSV tableau croisé villes × secteur × état
// GET /[locale]/[adminPrefix]/content-gen/geo/coverage-table/export.csv
// SP-04 P0-8 — csvEscape() + propagation filtres status/ville depuis querystring

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobsVilleSectorDetail } from "@/server/actions/content-gen/geo";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

/** Échappe une valeur CSV : wrap dans double-quotes + double les guillemets internes. */
function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params: _params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const filterStatus = url.searchParams.get("status") ?? undefined;
  const filterVille = url.searchParams.get("ville") ?? undefined;

  const rows = await getJobsVilleSectorDetail(5000, filterStatus, filterVille);

  const header = "ville,secteur,etat,articles,score_moyen\n";
  const body = rows
    .map(
      (r) =>
        [
          csvEscape(r.anchorVilleSlug),
          csvEscape(r.serviceSector),
          csvEscape(r.status),
          csvEscape(r.count),
          csvEscape(r.avgQuality != null ? r.avgQuality.toFixed(2) : null),
        ].join(","),
    )
    .join("\n");

  return new NextResponse(header + body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="coverage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
