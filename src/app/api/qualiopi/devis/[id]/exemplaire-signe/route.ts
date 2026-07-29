/**
 * GET /api/qualiopi/devis/[id]/exemplaire-signe
 *
 * Renvoie le devis AVEC les signatures apposées — le document qu'on remet au
 * client et qu'un auditeur regarde.
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
import { rendreExemplaireSigneDevis } from "@/server/qualiopi/documents/signature/devis-exemplaire-signe";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const res = await rendreExemplaireSigneDevis(id);

  if (!res.ok) {
    // Motifs distincts : « aucune signature » n'est pas une erreur, c'est un
    // état — et le dire évite de partir chercher une panne qui n'existe pas.
    const statut = res.raison === "aucune_signature" ? 409 : 404;
    const message =
      res.raison === "aucune_signature"
        ? "Ce devis ne porte aucune signature : il n'y a pas d'exemplaire signé à produire."
        : "Devis introuvable, ou aucune pièce ne lui est rattachée.";
    return NextResponse.json({ error: message }, { status: statut });
  }

  return new NextResponse(new Uint8Array(res.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${res.nomFichier}"`,
      // Une pièce contractuelle nominative ne se met jamais en cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}
