/**
 * Espace stagiaire — ouverture d'une pièce de la formation (chantier QNC, lot P11).
 *
 * Calquée sur `supports/[id]` : l'URL signée est produite à la demande (jamais
 * stockée), puis 302. La pièce doit appartenir à une inscription DU stagiaire ;
 * « elle appartient à un autre » et « elle n'existe pas » rendent le MÊME 404,
 * au même corps : rien ne révèle l'existence d'une pièce.
 *
 * La consultation est journalisée (`remises_retours`, canal `espace`) quand elle
 * vient d'une PERSONNE ; un aperçu automatique ne laisse aucune trace. Éteint
 * (`qualiopi.dossier_session.actif`), la route répond 404 comme si elle
 * n'existait pas et n'écrit rien.
 */

import { NextResponse, type NextRequest } from "next/server";

import { signedDocumentPdfUrl, TTL_LECTURE_NOMINATIVE_S } from "@/lib/r2-storage";
import { origineOuverture } from "@/features/dossier-client/documents/partage";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import {
  journaliserOuvertureDocument,
  ouverturesActivesPourStagiaire,
  trouverPieceDuStagiaire,
} from "@/server/qualiopi/portail/ouvertures-espace";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const introuvable = (): NextResponse =>
  NextResponse.json({ error: "introuvable" }, { status: 404 });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) return introuvable();

  const token = await getPortailToken();
  const acces = token ? await verifierToken(token) : null;
  if (acces === null) return NextResponse.json({ error: "non_autorise" }, { status: 401 });

  if (!(await ouverturesActivesPourStagiaire(acces.traineeId))) return introuvable();

  const piece = await trouverPieceDuStagiaire(acces.traineeId, id.toLowerCase());
  if (piece === null) return introuvable();

  const url = await signedDocumentPdfUrl(piece, TTL_LECTURE_NOMINATIVE_S).catch(() => null);
  if (url === null) return introuvable();

  // La trace ne doit jamais empêcher le stagiaire de lire sa pièce, mais son
  // échec ne passe pas sous silence : il est journalisé côté serveur.
  if (origineOuverture(req.headers) === "navigateur") {
    try {
      await journaliserOuvertureDocument(piece);
    } catch (err) {
      console.error(
        "[portail] ouverture de pièce non journalisée :",
        err instanceof Error ? err.name : "erreur",
      );
    }
  }
  return NextResponse.redirect(url, 302);
}
