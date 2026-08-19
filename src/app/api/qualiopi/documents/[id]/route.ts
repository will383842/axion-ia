/**
 * Téléchargement d'un document Qualiopi généré (DocumentGenere) — admin only.
 *
 * Le `pdfUrl` stocké sur DocumentGenere est une URL R2 signée 900 s qui EXPIRE.
 * Cette route re-signe l'URL À LA DEMANDE (durabilité) et redirige : le registre
 * documentaire reste téléchargeable indéfiniment, et le bouton « Télécharger le
 * PDF » de GenererFactureButton (qui pointe ici) fonctionne.
 *
 * Flow :
 *   1. Auth admin (auth() + role admin/super_admin).
 *   2. Charge DocumentGenere (type, numero, createdAt, pdfUrl).
 *   3. Si R2 configuré : reconstruit la clé `documents/{année}/{type}/{numero}.pdf`
 *      (identique à `generateDocument`), vérifie l'existence, re-signe, redirige.
 *   4. Fallback : `pdfUrl` stocké (peut être expiré) → redirect. Sinon 404.
 *
 * ⚠️ Une pièce ANNULÉE reste TÉLÉCHARGEABLE, et doit le rester : un auditeur doit
 * pouvoir lire la pièce qu'on lui dit annulée. Seul le NOM du fichier le dit —
 * c'est le seul marquage disponible, faute de filigrane « ANNULÉ » dans le
 * dépôt.
 *
 * Stub-aware indirectement : route runtime only (auth), jamais appelée au build.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isR2Configured, existsInR2, getSignedUrlR2, documentPdfKey } from "@/lib/r2-storage";
import { nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";
import { dispositionDemandee } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";

export async function GET(
  // 🔴 La requête SERT désormais : elle porte `?dl=1`, qui distingue
  // « consulter » de « enregistrer ». Elle s'appelait `_req` parce que rien
  // ne la lisait — et c'est précisément ce qui rendait le comportement fixe.
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
      // 🔴 Le sort de la pièce entre dans le NOM du fichier. Le PDF, lui, ne le
      // dit pas : il n'existe aucun filigrane « ANNULÉ » dans le dépôt
      // (`base-layout.tsx` ne connaît que COPIE et SPÉCIMEN), donc le fichier
      // d'une pièce annulée est byte-identique à celui d'une pièce en vigueur.
      // Rangé dans un dossier client, il s'y confond définitivement avec elle.
      annuleeAt: true,
      // Contexte du NOM DE FICHIER téléchargé : « AXI-DOC-2026-012.pdf » ne dit
      // rien à qui range la pièce dans un dossier ; la raison sociale du client
      // (ou à défaut l'intitulé de session) dit tout.
      client: { select: { raisonSociale: true } },
      session: { select: { titreSession: true } },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  // ⚠️ Les deux états se CUMULENT et sont indépendants : une copie d'une pièce
  // annulée est les deux à la fois, et n'en dire qu'un reviendrait à taire
  // l'autre. « ANNULEE » vient en tête parce que c'est l'information qui décide
  // de la valeur du document ; « COPIE » ne décide que de son exemplaire.
  //
  // ⚠️ Le suffixe entre dans le LIBELLÉ, pas dans le contexte : il échappe donc
  // à la troncature à 60 caractères qui pourrait le manger.
  const etats = [doc.annuleeAt !== null ? "ANNULEE" : null, doc.estCopie ? "COPIE" : null]
    .filter((e): e is string => e !== null)
    .join(" ");

  const nomFichier = nomFichierDocument({
    type: doc.type,
    numero: doc.numero,
    contexte: doc.client?.raisonSociale ?? doc.session?.titreSession ?? null,
    ...(etats === "" ? {} : { suffixe: etats }),
  });

  // Re-signature R2 à la demande (clé identique à generateDocument).
  if (isR2Configured()) {
    const key = documentPdfKey(doc);
    try {
      if (await existsInR2(key).catch(() => false)) {
        // `downloadFilename` force l'attachement : sans lui le PDF s'ouvrait
        // dans l'onglet sur l'URL R2 signée, et « Enregistrer » proposait le
        // numéro interne en guise de nom.
        const signed = await getSignedUrlR2(key, 900, {
          fichier: { nom: nomFichier, disposition: dispositionDemandee(req.url) },
        });
        return NextResponse.redirect(signed, 302);
      }
    } catch (err) {
      console.warn("[qualiopi-doc] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Fallback : URL signée stockée (potentiellement expirée).
  if (doc.pdfUrl) {
    return NextResponse.redirect(doc.pdfUrl, 302);
  }

  return NextResponse.json({ error: "pdf_unavailable" }, { status: 404 });
}
