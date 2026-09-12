/**
 * GET /api/formateur/contrat-travail/[id] — le contrat que le salarié signe.
 *
 * ## Pourquoi une route, et pas seulement un écran
 *
 * 🔴 `D4-1-A` a fermé le même défaut sur la lettre de mission : le formateur
 * signait une pièce **qu'il ne pouvait ni lire ni recevoir**, tout en scellant
 * une mention qui affirme « J'ai pu prendre connaissance de la pièce dans son
 * intégralité avant de signer, et j'en recevrai un exemplaire ». Les deux
 * moitiés étaient fausses.
 *
 * Sur un CONTRAT DE TRAVAIL, la même absence serait plus grave encore : la
 * remise d'un exemplaire n'est pas une courtoisie, c'est l'obligation de
 * l'employeur, et un CDD doit être transmis au salarié dans les deux jours
 * ouvrables suivant l'embauche (art. L.1242-13) sous peine de requalification.
 * Le droit de lire n'est donc pas une commodité d'écran : c'est le contenu même
 * de ce que l'employeur doit.
 *
 * ## Avant la signature, puis après
 *
 * La route rend la pièce **originale** tant qu'elle n'est pas intégralement
 * signée — c'est celle-là qu'il s'apprête à signer, et dont l'empreinte sera
 * scellée. Une fois la pièce `signee`, elle rend l'**exemplaire signé**, qui est
 * ce que la mention promet de remettre.
 *
 * ## Habilitation
 *
 * Session formateur valide **et** titularité de CETTE pièce : `trainerId` est
 * l'ancre posée par l'action d'émission, et c'est la MÊME règle que la Server
 * Action de signature. Le droit de lire est exactement le droit de signer.
 *
 * ⚠️ Une pièce d'un autre type répond **404 et non 403** : le salarié n'a pas à
 * apprendre qu'un identifiant existe s'il désigne autre chose que son contrat.
 *
 * ⚠️ Logée sous `api/formateur/` : l'espace formateur n'est pas l'admin, et sa
 * session n'est pas une session NextAuth. Les deux gardes sont sans rapport et
 * doivent le rester.
 */

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getFormateurSession } from "@/server/formateur/guard";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { isR2Configured, existsInR2, getSignedUrlR2, documentPdfKey } from "@/lib/r2-storage";
import { nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // 🔴 `getFormateurSession` et NON `requireFormateur` : le second REDIRIGE, ce
  // qui n'a pas de sens depuis une route d'API — l'appelant recevrait une page
  // HTML de connexion là où il attend un PDF.
  const formateur = await getFormateurSession();
  if (formateur === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const piece = await prisma.documentGenere.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      numero: true,
      pdfUrl: true,
      createdAt: true,
      estCopie: true,
      annuleeAt: true,
      statutSignature: true,
      trainerId: true,
    },
  });

  if (piece === null || piece.type !== "contrat_travail") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Titularité : l'ancre, et rien d'autre. `null` = la pièce n'appartient à
  // personne — elle est à régénérer, et personne ne doit la lire en attendant.
  if (piece.trainerId === null || piece.trainerId !== formateur.trainerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const nomFichier = nomFichierDocument({
    type: piece.type,
    numero: piece.numero,
    contexte: null,
    // Une pièce annulée est byte-identique à une pièce en vigueur (aucun
    // filigrane « ANNULÉ » n'existe dans le dépôt). Le nom du fichier est le
    // seul endroit qui le dit.
    ...(() => {
      const etats = [piece.annuleeAt !== null ? "ANNULEE" : null, piece.estCopie ? "COPIE" : null]
        .filter((e): e is string => e !== null)
        .join(" ");
      return etats === "" ? {} : { suffixe: etats };
    })(),
  });

  // ── Après signature : l'exemplaire, qui est ce que la mention promet ───────
  if (piece.statutSignature === "signee") {
    try {
      const res = await rendreExemplaireSigne(piece.id);
      if (res.ok) {
        return new NextResponse(new Uint8Array(res.buffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": enTeteContentDisposition(
              dispositionDemandee(req.url),
              res.nomFichier,
            ),
            // Une pièce contractuelle nominative ne se met jamais en cache.
            "Cache-Control": "private, no-store",
          },
        });
      }
      // ⚠️ `!res.ok` n'est PAS une erreur : « instantané absent », « gabarit
      // modifié » sont des ÉTATS que le module sait nommer. On retombe sur
      // l'original, que le salarié a le droit de relire dans tous les cas.
    } catch (err) {
      console.warn("[formateur-contrat] exemplaire signé indisponible (fail-soft)", err);
    }
  }

  // ── Avant signature : l'original, celui dont l'empreinte sera scellée ──────
  if (isR2Configured()) {
    const key = documentPdfKey(piece);
    try {
      if (await existsInR2(key).catch(() => false)) {
        const signed = await getSignedUrlR2(key, 900, {
          fichier: { nom: nomFichier, disposition: dispositionDemandee(req.url) },
        });
        return NextResponse.redirect(signed, 302);
      }
    } catch (err) {
      console.warn("[formateur-contrat] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Dernier recours : l'URL signée stockée, qui a pu expirer (900 s).
  if (piece.pdfUrl) {
    return NextResponse.redirect(piece.pdfUrl, 302);
  }

  // 🔑 On ne masque PAS l'échec derrière une page vide : si la pièce est
  // illisible, le salarié doit l'apprendre AVANT de signer une mention qui
  // affirme qu'il l'a lue.
  return NextResponse.json({ error: "pdf_unavailable" }, { status: 404 });
}
