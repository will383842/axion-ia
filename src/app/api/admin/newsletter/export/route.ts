// Route handler GET /api/admin/newsletter/export — telechargement CSV.

import { NextResponse, type NextRequest } from "next/server";
import { exportSubscribersCsvAction } from "@/features/admin-newsletter/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const { filename, csv } = await exportSubscribersCsvAction({
      status: (sp.get("status") as never) ?? undefined,
      locale: (sp.get("locale") as never) ?? undefined,
      source: sp.get("source") ?? undefined,
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
