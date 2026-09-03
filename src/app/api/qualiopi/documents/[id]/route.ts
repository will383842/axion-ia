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

/**
 * Cette route est OUVERTE DANS UN ONGLET par un être humain.
 *
 * 🔴 2026-09-02 (audit certificateur). Depuis la vue manifeste, chaque numéro de
 * pièce est un lien `target="_blank"` vers cette route — c'est le geste que fait
 * l'auditrice quand elle dit « montrez-moi celle-là ». Quand le PDF n'est pas
 * restituable, elle recevait `{"error":"pdf_unavailable"}` en JSON brut, dans un
 * onglet, en plein audit. Mesuré sur la base de recette : les quatre premiers
 * liens du manifeste rendaient tous ce JSON.
 *
 * Un dossier qui répond par un objet JSON ne fait pas douter d'une pièce : il
 * fait douter de toutes. La réponse dit désormais, en français, ce qui manque et
 * où le vérifier — et reste du JSON pour un appelant qui demande du JSON
 * (`GenererFactureButton` et les tests passent par là).
 */
function reponsePieceIndisponible(
  req: NextRequest,
  motif: "document_not_found" | "pdf_unavailable",
  numero: string | null,
): NextResponse {
  const veutDuHtml = (req.headers.get("accept") ?? "").includes("text/html");
  if (!veutDuHtml) {
    return NextResponse.json({ error: motif }, { status: 404 });
  }
  const titre =
    motif === "document_not_found"
      ? "Cette pièce n'existe pas au registre"
      : "Le PDF de cette pièce n'est pas disponible";
  const explication =
    motif === "document_not_found"
      ? "Le lien désigne une pièce que le registre ne connaît pas. Elle a pu être supprimée, ou le lien être périmé."
      : "La pièce existe bien au registre, mais son fichier PDF n'a pas pu être servi : il est absent du stockage, ou le stockage n'est pas joignable. Le registre, lui, porte toujours la pièce et sa trace.";
  const corps = [
    "<!doctype html>",
    '<html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${titre}</title>`,
    // Aucune couleur en dur : cette page est servie hors de la feuille de style
    // de l'application (route handler), donc les jetons admin n'y existent pas.
    // `color-scheme` laisse le navigateur choisir un couple lisible en clair
    // comme en sombre, et `Canvas`/`CanvasText` sont les couleurs système
    // correspondantes — plus juste qu'une palette figée, et conforme au cliquet
    // anti-hex du dépôt.
    "<style>:root{color-scheme:light dark}",
    "body{margin:0;padding:2.5rem 1.5rem;font:16px/1.6 system-ui,sans-serif;",
    "color:CanvasText;background:Canvas}",
    "main{max-width:34rem;margin:0 auto}h1{font-size:1.25rem;margin:0 0 .75rem}",
    "p{margin:0 0 .75rem}code{font-family:ui-monospace,monospace}</style>",
    "</head><body><main>",
    `<h1>${titre}</h1>`,
    `<p>${explication}</p>`,
    numero === null ? "" : `<p>Pièce concernée : <code>${numero}</code></p>`,
    "<p>Refermez cet onglet et revenez au registre : la pièce y figure avec sa date, son type et son état.</p>",
    "</main></body></html>",
  ].join("");
  return new NextResponse(corps, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

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
    return reponsePieceIndisponible(req, "document_not_found", null);
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

  return reponsePieceIndisponible(req, "pdf_unavailable", doc.numero);
}
