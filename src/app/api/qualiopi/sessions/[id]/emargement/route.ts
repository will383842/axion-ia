/**
 * GET /api/qualiopi/sessions/[id]/emargement
 *
 * Feuille d'émargement de la session, RENDUE À L'INSTANT DU CLIC — avec les
 * signatures effectivement recueillies.
 *
 * 🔴 Le pourquoi. La feuille du registre est un instantané : émise avant la
 * session (l'usage même — on l'imprime pour la faire signer), elle porte pour
 * toujours « Signatures enregistrées au tirage : 0 » et la mention « feuille
 * incomplète ». Sur la première session réelle, la base portait 100 % de
 * présence signée et la pièce du registre montrait une feuille vierge : le
 * document qu'un auditeur Qualiopi ouvre en premier CONTREDISAIT la preuve.
 *
 * 🔴 Ce n'est PAS la pièce du registre, et il ne faut pas les confondre. Ce
 * tirage n'est jamais persisté, jamais numéroté, jamais estampillé. Régénérer
 * la pièce aurait au contraire produit un document neuf — nouveau numéro, et
 * filigrane « COPIE » dès le deuxième du même type — soit deux feuilles
 * concurrentes pour une seule session, dont la plus juste serait marquée copie.
 * Même doctrine que `/api/qualiopi/pieces/[id]/exemplaire-signe`.
 *
 * Le numéro imprimé est celui de la feuille DÉJÀ au registre quand elle existe :
 * le tirage se présente comme une réimpression à jour de cette pièce-là, pas
 * comme une pièce de plus. Sans feuille au registre, on l'indique en clair.
 *
 * ⚠️ Logée sous `api/qualiopi/` et NON `api/admin/qualiopi/` : seul le premier
 * est whitelisté par `qualiopi:isolation-check`. La garde est dans le corps de
 * la route, pas dans le chemin.
 *
 * Auth : admin / super_admin. La feuille est nominative et porte les horaires de
 * signature de chaque stagiaire.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { construireTirageEmargement } from "@/server/qualiopi/documents/emargement-tirage";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const tirage = await construireTirageEmargement(id);
  if (!tirage.ok) {
    // « Journées non déclarées » n'est pas une panne, c'est un ÉTAT : le dire
    // évite de partir chercher une erreur qui n'existe pas.
    const statut = tirage.message === "Session introuvable" ? 404 : 409;
    return NextResponse.json({ error: tirage.message }, { status: statut });
  }

  // Numéro de la feuille au registre, s'il y en a une. On prend la plus RÉCENTE
  // qui fasse ENCORE FOI : c'est celle que l'admin a sous les yeux dans
  // « Documents générés ».
  //
  // 🔴 `annuleeAt: null` n'est pas un raffinement. Ce tirage se présente comme la
  // réimpression de la pièce dont il emprunte le numéro — jusque dans le nom du
  // fichier, « <numero>-a-jour.pdf ». Emprunter celui d'une feuille que le
  // registre déclare sans valeur produit un document qui se réclame d'une pièce
  // annulée, et rien sur le PDF ne le dit : il n'existe aucun filigrane
  // « ANNULÉ » dans le dépôt.
  //
  // Même filtre, et pour la même raison, que `documents-service.ts:313` : « la
  // chaîne de remplacement doit désigner la dernière qui faisait foi ».
  const officielle = await prisma.documentGenere.findFirst({
    where: { type: "emargement", sessionId: id, annuleeAt: null },
    orderBy: { createdAt: "desc" },
    select: { numero: true },
  });
  const numero = officielle?.numero ?? "— non émise au registre —";

  const rendu = await renderPdfToBuffer(tirage.element(numero));

  const nomFichier =
    officielle?.numero != null ? `${officielle.numero}-a-jour.pdf` : `emargement-${id}.pdf`;

  return new NextResponse(new Uint8Array(rendu.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // 🔴 La pièce s'OUVRE par défaut ; `?dl=1` demande l'enregistrement.
      // Constat de l'audit blanc : « aucune pièce du critère 1 n'a pu être
      // ouverte ». Chaque clic déposait un PDF de plus dans les
      // téléchargements de l'auditrice au lieu de l'afficher — et une preuve
      // qu'on ne peut pas lire à l'écran n'est pas une preuve consultable.
      "Content-Disposition": enTeteContentDisposition(dispositionDemandee(req.url), nomFichier),
      // Pièce nominative : jamais de cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}
