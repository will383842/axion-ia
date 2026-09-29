// Téléchargement d'un imprimé INTERNE — route console, jamais publique.
//
// Pourquoi une route et pas `public/` (2026-09-28) : la trame de l'échange avec
// un candidat apporteur porte la grille de notation et les critères
// éliminatoires. Sous `public/`, n'importe quel candidat qui devine l'adresse
// la téléchargerait. Le PDF vit donc sous `private/imprimes/`, que Next ne sert
// par aucun chemin, et ne sort que par ici.
//
// Trois verrous, dans cet ordre :
//   1. la SESSION et le RÔLE — 401 hors session, 403 pour un rôle qui ne traite
//      pas les candidats (`peutOuvrirDossierCandidat`, le prédicat commun, jamais
//      une liste recopiée) ;
//   2. la LISTE BLANCHE — le couple (imprimé, fichier) doit être déclaré mot pour
//      mot dans `IMPRIMES` (`fichierInterneAutorise`). Aucun chemin n'est
//      construit à partir de l'URL avant ce contrôle : `..`, `/`, `%2e%2e` ne
//      correspondent à aucune entrée ;
//   3. le CONFINEMENT — le chemin résolu doit rester sous `private/imprimes/`,
//      ceinture et bretelles au cas où une entrée fautive passerait la revue.
//
// 401 en texte, PAS une redirection vers la connexion : le chemin de cette route
// est dans le dépôt, et un `Location:` livrerait le préfixe secret de la console
// à n'importe quel `curl -I`. Même réponse que les autres routes `api/admin/*`.
//
// ⚠️ Le fichier doit être DANS L'IMAGE : le Dockerfile copie `private/` dans le
// stage runner (le standalone ne trace pas un fichier lu par `readFile`).
// `imprimes-internes.spec.ts` rougit si cette ligne disparaît.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { DOSSIER_FICHIERS_INTERNES, fichierInterneAutorise } from "@/content/imprimes";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVE = { "Cache-Control": "private, no-store" } as const;

function texte(status: number, message: string): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { ...PRIVE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fichier: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return texte(401, "Unauthorized");
  const role = (session.user as { role?: string }).role;
  if (!peutOuvrirDossierCandidat(role)) return texte(403, "Forbidden");

  const { id, fichier } = await params;
  const entree = fichierInterneAutorise(id, fichier);
  if (!entree) return texte(404, "Not found");

  const dossier = path.resolve(process.cwd(), DOSSIER_FICHIERS_INTERNES);
  const cible = path.resolve(dossier, entree.fichier);
  if (path.dirname(cible) !== dossier) return texte(404, "Not found");

  let octets: Buffer;
  try {
    octets = await readFile(cible);
  } catch {
    // Déclaré mais absent de l'image : la console l'affiche déjà en rouge.
    return texte(404, "Not found");
  }

  return new NextResponse(new Uint8Array(octets), {
    status: 200,
    headers: {
      ...PRIVE,
      "Content-Type": "application/pdf",
      // S'ouvre dans l'onglet par défaut ; `?dl=1` l'enregistre (SSOT).
      "Content-Disposition": enTeteContentDisposition(dispositionDemandee(req.url), entree.fichier),
      "Content-Length": String(octets.byteLength),
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
