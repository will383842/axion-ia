/**
 * Lot OPCO A8 — téléchargement du dossier prêt à déposer par l'ENTREPRISE :
 * `/api/qualiopi/suivi-opco/<jeton>/dossier`.
 *
 * Le ZIP (kit OPCO + pièces) nomme les stagiaires : il ne part jamais en pièce
 * jointe. Le jeton de l'e-mail (valable 30 jours, même déjà utilisé pour
 * répondre — télécharger n'écrit rien) ouvre une URL R2 SIGNÉE de deux minutes,
 * par redirection. Jeton invalide → page neutre, 404.
 */

import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import {
  ENTETES_PAGE_SUIVI,
  pageNeutre,
} from "@/server/qualiopi/financements/suivi-entreprise/page-publique";
import { lireJeton } from "@/server/qualiopi/financements/suivi-entreprise/reponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_URL_SIGNEE_S = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  const { jeton } = await params;
  const lu = await lireJeton(jeton, "telechargement");
  if (lu.etat !== "valide" || lu.zipKey === null || !isR2Configured()) {
    return new Response(pageNeutre(), { status: 404, headers: ENTETES_PAGE_SUIVI });
  }
  // Nom ASCII seulement : il part tel quel dans un en-tête HTTP.
  const nom = (lu.zipNom ?? "dossier-opco.zip").normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  const url = await getSignedUrlR2(lu.zipKey, TTL_URL_SIGNEE_S, {
    fichier: { nom, disposition: "attachment" },
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
