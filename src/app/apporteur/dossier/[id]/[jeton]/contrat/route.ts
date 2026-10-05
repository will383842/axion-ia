// Le contrat rempli, en PDF, AVANT signature : `/apporteur/dossier/<id>/<jeton>/contrat`.
//
// Même lien que la page, mêmes règles : un jeton faux ou révoqué, un dossier inconnu,
// déjà envoyé à la vérification, signé, refusé ou résilié → 404 neutre. Le PDF est rendu
// sans signature (`apporteur: null`, `societe: null`) ; le contrat contresigné part par
// e-mail. Rendu à la demande, jamais au build (`lireDossierParLien` refuse la base factice).

import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { rendreContratPdf, texteDuContrat } from "@/features/apporteurs-reseau/contrat-pdf";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { etatDeLaPage, valeursDuContrat } from "@/features/apporteurs-reseau/signature";

export const dynamic = "force-dynamic";

const ENTETES_COMMUNS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
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
  const debit = await checkRateLimit(`apporteur-dossier:pdf:${ip ?? "sans-ip"}`, {
    limit: 20,
    windowSec: 900,
    surPanne: "laisser-passer",
  });
  if (!debit.allowed) {
    return new NextResponse("Trop de demandes", { status: 429, headers: ENTETES_COMMUNS });
  }

  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier || etatDeLaPage(dossier.statut) !== "modifiable") return introuvable();

  const pdf = await rendreContratPdf({
    texte: texteDuContrat(valeursDuContrat(dossier, new Date())),
    apporteur: null,
    societe: null,
  });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...ENTETES_COMMUNS,
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        dispositionDemandee(req.url),
        "contrat-apporteur-axion-ia.pdf",
      ),
    },
  });
}
