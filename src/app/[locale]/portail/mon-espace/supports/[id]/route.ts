/**
 * Espace stagiaire — ouverture d'un support de formation (lot L08).
 *
 * Re-signe l'objet R2 à la demande (le lien signé expire en 900 s : on ne sert
 * jamais une URL stockée) puis redirige. La consultation est journalisée dans
 * `remises_retours` quand elle vient d'une PERSONNE : un aperçu automatique
 * (robot de messagerie, prévisualisation) n'est pas une consultation et ne doit
 * pas faire croire qu'un support a été lu — même règle que les documents projet.
 *
 * Éteint (`qualiopi.pedagogie.actif`), `trouverSupportDuStagiaire` ne trouve
 * rien : 404, comme si la route n'existait pas.
 */

import { NextResponse, type NextRequest } from "next/server";

import { dispositionDemandee } from "@/lib/content-disposition";
import { existsInR2, getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import { origineOuverture } from "@/features/dossier-client/documents/partage";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import {
  journaliserConsultation,
  trouverSupportDuStagiaire,
} from "@/server/qualiopi/pedagogie/mes-supports-service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const token = await getPortailToken();
  const acces = token ? await verifierToken(token) : null;
  if (acces === null) return NextResponse.json({ error: "non_autorise" }, { status: 401 });

  const trouve = await trouverSupportDuStagiaire(acces.traineeId, id);
  if (trouve === null) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  if (!isR2Configured() || !(await existsInR2(trouve.pdfKey).catch(() => false))) {
    return NextResponse.json({ error: "pdf_indisponible" }, { status: 404 });
  }
  const url = await getSignedUrlR2(trouve.pdfKey, 900, {
    fichier: { nom: trouve.nomFichier, disposition: dispositionDemandee(req.url) },
  });

  // La trace ne doit jamais empêcher le stagiaire de lire son support, mais son
  // échec ne passe pas sous silence : il est journalisé côté serveur.
  if (origineOuverture(req.headers) === "navigateur") {
    try {
      await journaliserConsultation(trouve.contexte);
    } catch (err) {
      console.error(
        "[mes-supports] consultation non journalisée :",
        err instanceof Error ? err.name : "erreur",
      );
    }
  }
  return NextResponse.redirect(url, 302);
}
