// P5.5 — Export CSV tableau croisé villes × secteur × état
// GET /[locale]/[adminPrefix]/content-gen/geo/coverage-table/export.csv

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobsVilleSectorDetail } from "@/server/actions/content-gen/geo";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ locale: string; adminPrefix: string }>;
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
        `${r.anchorVilleSlug},${r.serviceSector ?? ""},${r.status},${r.count},${r.avgQuality != null ? r.avgQuality.toFixed(2) : ""}`,
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
