// GET /guide-reseau/merci — page de remerciement (lot S2), en RÉPONSE HTML DE ROUTE : aucun socle
// React, aucun JavaScript (voir `../html-statique.ts`). Même réponse que l'envoi ait créé une
// demande, rejoué un jeton ou écarté une adresse opposée : rien ne dit lequel. Éteinte → 404.
import { NextResponse, type NextRequest } from "next/server";
import { pageGuideReseauActive } from "@/server/guides-reseau/config";
import { boutonSuivrePageHtml } from "@/server/guides-reseau/page-suivre";
import { ENTETES_PAGE_GUIDE, echapper, pageStatique } from "../html-statique";
import { TEXTES_PAGE_GUIDE as T } from "../textes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req?: NextRequest): Promise<NextResponse> {
  if (!pageGuideReseauActive()) {
    return new NextResponse("Not found", { status: 404, headers: ENTETES_PAGE_GUIDE });
  }
  return pageStatique(
    T.merciTitre,
    `<p>${echapper(T.merciCorps)}</p>${boutonSuivrePageHtml(req?.nextUrl.searchParams.get("r"))}`,
    200,
  );
}
