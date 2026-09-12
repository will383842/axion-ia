/**
 * Espace formateur — téléchargement d'une pièce QUI LUI APPARTIENT.
 *
 * ## Pourquoi une seconde route, et pas la réutilisation de l'existante
 *
 * `/api/qualiopi/documents/[id]` sert déjà les PDF, et elle est gardée par
 * `auth()` + un rôle `admin`/`super_admin`. Un formateur ne s'authentifie pas
 * par là : son espace fonctionne au lien magique (`getFormateurSession`), et il
 * n'a aucun rôle admin. Élargir la garde de la route existante pour l'y faire
 * entrer aurait ouvert un chemin admin à une session non-admin — exactement le
 * genre d'élargissement « pour faire passer un cas de plus » qu'on refuse
 * ailleurs dans ce dépôt.
 *
 * ## ⛔ LA GARDE EST UNE GARDE DE PROPRIÉTÉ, PAS DE RÔLE
 *
 * Être formateur connecté ne donne pas accès aux pièces des AUTRES formateurs.
 * La seule question posée ici est : **cette pièce porte-t-elle l'identifiant du
 * formateur connecté ?** Un contrôle par rôle aurait laissé n'importe quel
 * formateur lire la facture d'un confrère — son montant, son SIRET, sa
 * rémunération.
 *
 * ⚠️ La vérification est faite EN BASE, sur la pièce demandée, jamais sur un
 * paramètre de la requête. Une garde qui ferait confiance à un `trainerId` passé
 * dans l'URL ne garderait rien.
 */

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getFormateurSession } from "@/server/formateur/guard";
import { documentPdfKey, existsInR2, getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import { nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";

export const dynamic = "force-dynamic";

/**
 * Types de pièces qu'un formateur peut consulter dans son espace.
 *
 * 🔑 Liste EXPLICITE, et non « tout ce qui porte son identifiant ». Le registre
 * documentaire peut demain rattacher à un formateur une pièce interne — une
 * note, une évaluation — et un filtre par propriété seule la lui servirait sans
 * que personne l'ait décidé. Ajouter un type ici est un geste conscient.
 */
const TYPES_CONSULTABLES = new Set<string>([
  // SA facture d'honoraires, que nous avons établie en son nom.
  "autofacture_honoraires",
  // Les pièces qui le mandatent, et qu'il a signées.
  "lettre_mission",
  "contrat_sous_traitance",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const session = await getFormateurSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const doc = await prisma.documentGenere.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      numero: true,
      pdfUrl: true,
      createdAt: true,
      estCopie: true,
      annuleeAt: true,
      trainerId: true,
    },
  });

  // ⚠️ 404 et non 403 quand la pièce ne lui appartient pas : un 403 confirmerait
  // l'EXISTENCE du document à quelqu'un qui n'a pas à le savoir. On ne distingue
  // donc pas « n'existe pas » de « pas à vous ».
  if (doc === null || doc.trainerId !== session.trainerId || !TYPES_CONSULTABLES.has(doc.type)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Même composition de nom que la route admin : une pièce annulée doit le dire
  // dans son nom de fichier, le PDF ne portant aucun filigrane « ANNULÉ ».
  const etats = [doc.annuleeAt !== null ? "ANNULEE" : null, doc.estCopie ? "COPIE" : null]
    .filter((e): e is string => e !== null)
    .join(" ");
  const nomFichier = nomFichierDocument({
    type: doc.type,
    numero: doc.numero,
    contexte: null,
    ...(etats === "" ? {} : { suffixe: etats }),
  });

  if (isR2Configured()) {
    const key = documentPdfKey(doc);
    try {
      if (await existsInR2(key).catch(() => false)) {
        const signed = await getSignedUrlR2(key, 900, {
          fichier: { nom: nomFichier, disposition: "attachment" },
        });
        return NextResponse.redirect(signed, 302);
      }
    } catch (err) {
      console.warn("[espace-formateur-doc] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Repli : l'URL signée stockée, qui peut avoir expiré. Mieux vaut un lien
  // périmé — dont le message est clair — qu'un 404 sur une pièce qui existe.
  if (doc.pdfUrl !== null && doc.pdfUrl !== "") {
    return NextResponse.redirect(doc.pdfUrl, 302);
  }
  return NextResponse.json({ error: "pdf_indisponible" }, { status: 404 });
}
