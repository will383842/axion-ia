/**
 * Télécharger un fichier de la bibliothèque depuis la console (Candidatures unifiées L4, ADR 0065).
 *
 * Mêmes rôles que les dossiers des candidats. Le fichier ne transite PAS par le
 * serveur : la route trace le geste puis redirige vers une adresse R2 signée de
 * 5 minutes, en téléchargement, au nom d'origine. Un fichier sans verdict
 * antivirus (ou infecté) ne sort jamais ; un fichier de l'équipe au-delà de
 * 200 Mo (« non analysé ») sort, décision 7 de Will. Un lien externe redirige
 * vers son adresse d'origine.
 */

import { NextResponse } from "next/server";

import { gardeBibliotheque, tracerGeste } from "@/features/bibliotheque-fichiers/garde";
import { adresseTelechargement } from "@/server/partages/depot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SANS_CACHE = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, { status: statut, headers: SANS_CACHE });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fichierId: string }> },
): Promise<NextResponse> {
  const g = await gardeBibliotheque();
  if (!g.ok) return refus(g.erreur.startsWith("Session") ? 401 : 403, g.erreur);
  const { fichierId } = await params;
  if (!UUID.test(fichierId)) return refus(404, "Fichier introuvable.");
  const id = fichierId.toLowerCase();
  const r = await adresseTelechargement(id);
  if (!r.ok) return refus(409, r.erreur);
  await tracerGeste("telecharge", id, g.auteur.id);
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: r.valeur.url,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
