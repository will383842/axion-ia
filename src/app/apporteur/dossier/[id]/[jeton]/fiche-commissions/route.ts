// La FICHE DES COMMISSIONS en PDF : `/apporteur/dossier/<id>/<jeton>/fiche-commissions` (`?dl=1` : enregistrer).
//
// Réservé à l'apporteur qui arrive par SON lien personnel (`lireDossierParLien` : identifiant ET
// jeton, version du lien), AVANT comme APRÈS la signature (dossier modifiable, à vérifier ou
// signé). Lien faux ou d'un autre apporteur, dossier refusé, résilié, fiche retirée, lien
// d'exemple, fichier absent : le même 404 neutre. Le fichier vit sous `private/`, jamais sous
// `public/`. Aucun suivi : ni lecture, ni compteur.

import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import {
  documentsOuvertsPour,
  NOM_FICHIER_FICHE_COMMISSIONS,
  lireFicheCommissions,
} from "@/features/apporteurs-reseau/documents-prives";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES_COMMUNS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
} as const;

function introuvable(): NextResponse {
  return new NextResponse("Introuvable", { status: 404, headers: ENTETES_COMMUNS });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jeton: string }> },
): Promise<NextResponse> {
  const { id, jeton } = await ctx.params;
  let ip: string | null = null;
  try {
    ip = hashIp(await getClientIp());
  } catch {
    ip = null;
  }
  const debit = await checkRateLimit(`apporteur-dossier:fiche-commissions:${ip ?? "sans-ip"}`, {
    limit: 20,
    windowSec: 900,
    surPanne: "laisser-passer",
  });
  if (!debit.allowed) {
    return new NextResponse("Trop de demandes", { status: 429, headers: ENTETES_COMMUNS });
  }

  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || !documentsOuvertsPour(etatDeLaPage(dossier.statut))) {
    return introuvable();
  }

  const pdf = await lireFicheCommissions();
  if (!pdf) return introuvable();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...ENTETES_COMMUNS,
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": enTeteContentDisposition(
        dispositionDemandee(req.url),
        NOM_FICHIER_FICHE_COMMISSIONS,
      ),
    },
  });
}
