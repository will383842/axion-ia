// La CHARTE DE MARQUE, RÉSERVÉE aux apporteurs sous contrat signé (2026-10-09).
//
// `/apporteur/dossier/<apporteurId>/<jeton>/charte` : la page HTML autonome (6 feuilles A4,
// enregistrable en PDF par le navigateur), seulement pour un lien personnel valide d'une fiche
// signée et dans le réseau — même contrôle que la page des outils. Sinon : 404 neutre, sans
// rien dire du cas. Jamais en cache partagé, jamais indexée.

import { CHARTE_HTML } from "@/features/apporteurs-reseau/charte-de-marque-html";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";

export const dynamic = "force-dynamic";

const ENTETES_PRIVES = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
} as const;

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string; jeton: string }> },
): Promise<Response> {
  const { id, jeton } = await params;
  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") {
    return new Response("Page introuvable.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...ENTETES_PRIVES },
    });
  }
  return new Response(CHARTE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...ENTETES_PRIVES },
  });
}
