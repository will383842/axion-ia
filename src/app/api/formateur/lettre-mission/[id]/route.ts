/**
 * GET /api/formateur/lettre-mission/[id] — la lettre que le formateur signe.
 *
 * ## Le défaut que cette route ferme
 *
 * 🔴 `D4-1-A` (audit E2E 2026-08-20). Le formateur signait une lettre de mission
 * **qu'il ne pouvait ni lire ni recevoir**. L'écran de son espace lui montrait
 * un titre, un numéro et une période — aucune URL de pièce n'était transmise au
 * composant de signature. La seule route de lecture du dépôt
 * (`api/qualiopi/documents/[id]`) est réservée aux administrateurs.
 *
 * Et la mention qu'il scellait affirmait, mot pour mot :
 *
 * > « J'ai pu prendre connaissance de la pièce dans son intégralité avant de
 * > signer, et j'en recevrai un exemplaire. »
 *
 * Les deux moitiés étaient fausses. Une attestation fausse ne dégrade pas
 * seulement la pièce qui la porte : elle fragilise **toutes** les signatures
 * recueillies par le même procédé, puisque c'est le procédé qui l'affirme.
 *
 * ## Avant la signature, puis après
 *
 * La route rend la pièce **originale** tant qu'elle n'est pas intégralement
 * signée — c'est celle-là qu'il s'apprête à signer, et dont l'empreinte sera
 * scellée. Une fois la pièce `signee`, elle rend l'**exemplaire signé**, qui est
 * ce que la mention promet de remettre.
 *
 * 🔑 L'exemplaire signé est une vue DÉRIVÉE, rendue à la volée : il n'est ni
 * persisté, ni renuméroté. L'original du registre reste l'original.
 *
 * ## Habilitation
 *
 * Session formateur valide **et** mandat sur cette lettre précise —
 * `estMandataireDeLaLettre`, la MÊME fonction que la Server Action de signature.
 * Le droit de lire est exactement le droit de signer : ni plus large (une lettre
 * nomme un formateur, pas une équipe), ni plus étroit (refuser la lecture à qui
 * peut signer serait rétablir le défaut).
 *
 * ⚠️ Logée sous `api/formateur/` : l'espace formateur n'est pas l'admin, et sa
 * session n'est pas une session NextAuth. Les deux gardes sont sans rapport et
 * doivent le rester.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFormateurSession } from "@/server/formateur/guard";
import { estMandataireDeLaLettre } from "@/server/qualiopi/documents/signature/mandat-lettre-mission";
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
      sessionId: true,
      session: { select: { titreSession: true } },
    },
  });

  // ⚠️ Une pièce d'un autre type répond 404 et non 403 : le formateur n'a pas à
  // apprendre qu'un identifiant existe s'il désigne autre chose que sa lettre.
  if (piece === null || piece.type !== "lettre_mission") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const mandataire = await estMandataireDeLaLettre(
    { trainerId: piece.trainerId, sessionId: piece.sessionId },
    formateur.trainerId,
  );
  if (!mandataire) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const nomFichier = nomFichierDocument({
    type: piece.type,
    numero: piece.numero,
    contexte: piece.session?.titreSession ?? null,
    // Mêmes états que la route admin, et pour la même raison : une pièce annulée
    // est byte-identique à une pièce en vigueur (aucun filigrane « ANNULÉ »
    // n'existe dans le dépôt). Le nom du fichier est le seul endroit qui le dit,
    // et c'est vrai aussi quand c'est le formateur qui l'enregistre.
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
            // La pièce s'OUVRE par défaut ; `?dl=1` demande l'enregistrement.
            // Même arbitrage que la route admin : une preuve qu'on ne peut pas
            // lire à l'écran n'est pas une preuve consultable.
            "Content-Disposition": enTeteContentDisposition(
              dispositionDemandee(req.url),
              res.nomFichier,
            ),
            // Une pièce contractuelle nominative ne se met jamais en cache.
            "Cache-Control": "private, no-store",
          },
        });
      }
      // ⚠️ `!res.ok` n'est PAS une erreur : « aucune signature », « instantané
      // absent » sont des ÉTATS que le module sait nommer. On ne les renvoie pas
      // au formateur — on retombe sur l'original, qu'il a le droit de relire
      // dans tous les cas. Le seul cas où il ne doit RIEN recevoir est celui où
      // la pièce n'existe pas, et il est traité plus haut.
    } catch (err) {
      // Fail-soft vers l'original : mieux vaut rendre la pièce sans les
      // signatures apposées que rien du tout. Le formateur doit pouvoir la
      // relire — c'est le propos entier de cette route.
      console.warn("[formateur-lettre] exemplaire signé indisponible (fail-soft)", err);
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
      console.warn("[formateur-lettre] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Dernier recours : l'URL signée stockée, qui a pu expirer (900 s).
  if (piece.pdfUrl) {
    return NextResponse.redirect(piece.pdfUrl, 302);
  }

  // 🔑 On ne masque PAS l'échec derrière une page vide : si la pièce est
  // illisible, le formateur doit l'apprendre AVANT de signer une mention qui
  // affirme qu'il l'a lue.
  return NextResponse.json({ error: "pdf_unavailable" }, { status: 404 });
}
