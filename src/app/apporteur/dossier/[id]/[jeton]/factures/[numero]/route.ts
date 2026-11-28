// Le PDF d'une autofacture ou d'un avoir DE L'APPORTEUR : `/apporteur/dossier/<id>/<jeton>/factures/<numero>`.
//
// Même lien que la page. Interrupteur éteint, lien faux ou révoqué, dossier non signé, mode
// restreint, numéro mal formé, inexistant OU appartenant à un autre apporteur → la MÊME 404
// neutre (aucune différence de statut, de corps ni d'en-têtes). Les octets sont servis par le
// site (aucune URL signée) ; la clé R2 est reconstruite côté serveur depuis l'identifiant du
// dossier et le numéro RELU EN BASE, jamais depuis l'adresse seule.

import { peutLireSesPieces } from "@/features/apporteurs-reseau/acces-pieces";
import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import { checkRateLimit } from "@/lib/rate-limit";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { hashIp } from "@/lib/security/ip-hash";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import {
  NUMERO_PIECE,
  NUMERO_PIECE_MAX,
  numeroDePieceDeLApporteur,
} from "@/features/apporteurs-reseau/espace-commissions";
import { mesCommissionsActive } from "@/features/apporteurs-reseau/interrupteur-mes-commissions";
import { signalerErreurReseau } from "@/features/apporteurs-reseau/signaler";

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
  ctx: { params: Promise<{ id: string; jeton: string; numero: string }> },
): Promise<NextResponse> {
  if (!mesCommissionsActive()) return introuvable();
  const { id, jeton, numero } = await ctx.params;

  let ip: string | null = null;
  try {
    ip = hashIp(await getClientIp());
  } catch {
    ip = null;
  }
  const debit = await checkRateLimit(`apporteur-dossier:facture:${ip ?? "sans-ip"}`, {
    limit: 20,
    windowSec: 900,
    surPanne: "laisser-passer",
  });
  if (!debit.allowed) {
    return new NextResponse("Trop de demandes", { status: 429, headers: ENTETES_COMMUNS });
  }

  // Numéro mal formé : 404 sans aucune requête.
  if (numero.length > NUMERO_PIECE_MAX || !NUMERO_PIECE.test(numero)) return introuvable();

  const dossier = await lireDossierParLien(id, jeton);
  // Mode restreint et dossier non signé : refusés (décision de la direction attendue pour l'ouvrir).
  if (!dossier || !peutLireSesPieces(dossier)) {
    return introuvable();
  }

  const connu = await numeroDePieceDeLApporteur(dossier.id, numero);
  if (!connu) return introuvable();

  let pdf: Buffer | null = null;
  try {
    pdf = await getObjectBufferR2(`apporteurs/autofactures/${dossier.id}/${connu}.pdf`);
  } catch (err) {
    signalerErreurReseau("mes-commissions:pdf", err);
    return introuvable();
  }
  if (!pdf) return introuvable();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...ENTETES_COMMUNS,
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(dispositionDemandee(req.url), `${connu}.pdf`),
    },
  });
}
