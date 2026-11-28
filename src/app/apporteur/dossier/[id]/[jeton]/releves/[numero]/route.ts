// Le PDF d'un relevé mensuel DE L'APPORTEUR : `/apporteur/dossier/<id>/<jeton>/releves/<numero>`.
//
// Copie de `factures/[numero]/route.ts` : interrupteur éteint, lien faux ou révoqué, dossier non
// signé, mode restreint, numéro mal formé, inexistant, NON ENVOYÉ OU appartenant à un autre
// apporteur → la MÊME 404 neutre. La clé R2 vient de la ligne relue en base (statut `envoye`),
// jamais de l'adresse seule. Aucun lien public.

import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import { checkRateLimit } from "@/lib/rate-limit";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { hashIp } from "@/lib/security/ip-hash";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { mesCommissionsActive } from "@/features/apporteurs-reseau/interrupteur-mes-commissions";
import {
  NUMERO_RELEVE,
  NUMERO_RELEVE_MAX,
  cleDuReleveDeLApporteur,
} from "@/features/apporteurs-reseau/releve-mensuel/espace";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";
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
  const debit = await checkRateLimit(`apporteur-dossier:releve:${ip ?? "sans-ip"}`, {
    limit: 20,
    windowSec: 900,
    surPanne: "laisser-passer",
  });
  if (!debit.allowed) {
    return new NextResponse("Trop de demandes", { status: 429, headers: ENTETES_COMMUNS });
  }

  // Numéro mal formé : 404 sans aucune requête.
  if (numero.length > NUMERO_RELEVE_MAX || !NUMERO_RELEVE.test(numero)) return introuvable();

  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") {
    return introuvable();
  }

  const releve = await cleDuReleveDeLApporteur(dossier.id, numero);
  if (!releve) return introuvable();

  let pdf: Buffer | null = null;
  try {
    pdf = await getObjectBufferR2(releve.r2Key);
  } catch (err) {
    signalerErreurReseau("mes-releves:pdf", err);
    return introuvable();
  }
  if (!pdf) return introuvable();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...ENTETES_COMMUNS,
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        dispositionDemandee(req.url),
        `${releve.numero}.pdf`,
      ),
    },
  });
}
