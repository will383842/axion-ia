/**
 * GET /api/qualiopi/pieces/[id]/exemplaire-signe
 *
 * Renvoie une PIÈCE avec ses signatures apposées — le document qu'on remet au
 * signataire et qu'un auditeur regarde. Vaut pour les six types rendus.
 *
 * ⚠️ `[id]` est un `DocumentGenere.id`, PAS un id de devis : la route est
 * générique, comme le registre qu'elle sert.
 *
 * 🔴 Ce n'est PAS la pièce du registre, et il ne faut pas le confondre. La pièce
 * scellée reste l'original, dont l'empreinte est figée dans
 * `document_signatures.document_hash_sha256`. Cet exemplaire en est une vue
 * DÉRIVÉE, rendue à la volée, jamais persistée et jamais renumérotée — voir
 * `devis-exemplaire-signe.ts` pour le raisonnement complet.
 *
 * ⚠️ Logée sous `api/qualiopi/` et NON sous `api/admin/qualiopi/` : seul le
 * premier est whitelisté par `qualiopi:isolation-check`. On range au bon
 * endroit plutôt que d'élargir la liste d'exceptions — c'est le raisonnement
 * déjà tenu pour `src/server/portail/routes.ts`. Le préfixe d'URL est
 * cosmétique : la garde est dans le corps de la route, pas dans le chemin.
 *
 * Auth : admin / super_admin uniquement. Le lien n'est pas public : l'exemplaire
 * porte l'identité des signataires et leurs tracés.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";

export async function GET(
  // La requête SERT désormais : elle porte `?dl=1`.
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const res = await rendreExemplaireSigne(id);

  if (!res.ok) {
    // Motifs distincts : « aucune signature » ou « instantané absent » ne sont
    // pas des erreurs, ce sont des ÉTATS — et le dire évite de partir chercher
    // une panne qui n'existe pas. Le message vient du module, qui sait pourquoi.
    const statut = res.raison === "introuvable" ? 404 : 409;
    return NextResponse.json({ error: res.message }, { status: statut });
  }

  return new NextResponse(new Uint8Array(res.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // 🔴 La pièce s'OUVRE par défaut ; `?dl=1` demande l'enregistrement.
      // Constat de l'audit blanc : « aucune pièce du critère 1 n'a pu être
      // ouverte ». Chaque clic déposait un PDF de plus dans les
      // téléchargements de l'auditrice au lieu de l'afficher — et une preuve
      // qu'on ne peut pas lire à l'écran n'est pas une preuve consultable.
      "Content-Disposition": enTeteContentDisposition(dispositionDemandee(req.url), res.nomFichier),
      // Une pièce contractuelle nominative ne se met jamais en cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}
