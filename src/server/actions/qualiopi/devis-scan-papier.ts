/**
 * Lot I3 — verser le scan PDF d'un devis signé à la main sur papier.
 *
 * Le client a signé un devis imprimé ; un membre habilité de l'organisme verse la copie
 * numérisée, qui devient la signature de la partie « client » (porteur `reversement_papier`,
 * `physical_signed`, méthode `papier_scanne`) — sans migration.
 *
 * 🔴 Ce que cette action ne fait PAS :
 *  - elle n'accepte AUCUNE identité du formulaire : le signataire est celui de la fiche client
 *    (comme à l'émission du lien) ;
 *  - elle ne verse rien sur un devis qui n'est pas « envoyé », classique (sans formules), avec
 *    sa pièce non annulée ;
 *  - elle ne touche R2 qu'après tous ses pré-contrôles (type, en-tête, case cochée, état du
 *    devis, déjà signé, scan déjà versé).
 *
 * L'après-signature passe par `apresSignature` SANS `canal` : pas d'alerte « lien à jeton ».
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { apresSignature } from "@/server/qualiopi/documents/signature/apres-signature";
import { contexteRequete } from "@/server/qualiopi/documents/signature/contexte-requete";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { peutSignerPourOrganisme } from "@/server/qualiopi/documents/signature/garde-engagement";
import { horodaterSignature } from "@/server/qualiopi/documents/signature/horodatage-signature";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import {
  TAILLE_MAX_SCAN_OCTETS,
  controlerPdf,
} from "@/server/qualiopi/documents/signature/scan-papier-storage";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

export type ResultatVersementScan =
  | {
      ok: true;
      signatureId: string;
      statutSignature: "partielle" | "signee";
      activationRefusee?: string;
    }
  | { ok: false; message: string };

const MSG_SESSION = "Votre session a expiré ou vos droits sont insuffisants pour verser ce scan.";
const MSG_DEVIS = "Ce devis est introuvable.";
const MSG_ETAT =
  "Ce devis ne peut pas recevoir de scan signé : il doit être envoyé, classique (sans formules), avec sa pièce en vigueur.";
const MSG_FICHE = "La fiche client ne porte pas de nom de signataire : renseignez-la d'abord.";
const MSG_DEJA_SIGNE = "Ce devis est déjà signé par le client.";
const MSG_SCAN_VU = "Ce scan a déjà été versé.";
const PREFIXE_ACTIVATION_DEVIS =
  "Devis enregistré comme signé, mais la suite n'a pas pu être lancée automatiquement.";
const MSG_STOCKAGE = "Le scan n'a pas pu être enregistré. Rien n'a été versé : réessayez.";

const entreeSchema = z.object({
  devisId: z.string().uuid(),
  attestation: z.literal(true),
  fichier: z.instanceof(File),
});

function refus(message: string): ResultatVersementScan {
  return { ok: false, message };
}

async function journaliserRefus(session: AdminSession, motif: string, devisId?: string) {
  try {
    await logQualiopiActivity({
      action: "qualiopi.devis.scan_papier_refuse",
      targetType: "Devis",
      targetId: devisId ?? null,
      changes: { motif },
      session,
    });
  } catch {
    // le refus est ce qui compte
  }
}

export async function verserScanDevisSigneAction(
  formData: FormData,
): Promise<ResultatVersementScan> {
  // Jamais au build (SSG, stub) : refus net, aucune écriture.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return refus("Indisponible pendant la construction du site.");
  }

  let session: AdminSession;
  try {
    session = await requireAdminWrite();
  } catch {
    return refus(MSG_SESSION);
  }
  if (!peutSignerPourOrganisme(session.role)) return refus(MSG_SESSION);

  const attestation = formData.get("attestation");
  const parse = entreeSchema.safeParse({
    devisId: formData.get("devisId"),
    attestation: attestation === "true" || attestation === "on",
    fichier: formData.get("fichier"),
  });
  if (!parse.success) {
    await journaliserRefus(session, "requete_invalide");
    return refus("Choisissez un fichier PDF et cochez l'attestation avant de verser le scan.");
  }
  const { devisId, fichier } = parse.data;

  // ── Contrôles du FICHIER, avant toute lecture base ou R2 ──
  const nomPdf = fichier.name.toLowerCase().endsWith(".pdf");
  if (!nomPdf || fichier.type !== "application/pdf") {
    await journaliserRefus(session, "type_incorrect", devisId);
    return refus("Le fichier doit être un PDF.");
  }
  if (fichier.size > TAILLE_MAX_SCAN_OCTETS) {
    await journaliserRefus(session, "trop_lourd", devisId);
    return refus("Le fichier dépasse 10 Mo.");
  }
  const octets = Buffer.from(await fichier.arrayBuffer());
  const controle = controlerPdf(octets);
  if (!controle.ok) {
    await journaliserRefus(session, "pdf_invalide", devisId);
    return refus(controle.message);
  }

  // ── Le devis : D3 ──
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    select: {
      id: true,
      statut: true,
      offre: true,
      offreSha256: true,
      documentGenereId: true,
      client: {
        select: {
          raisonSociale: true,
          contactNom: true,
          contactFonction: true,
          contactEmail: true,
        },
      },
      documentGenere: { select: { id: true, numero: true, type: true, annuleeAt: true } },
    },
  });
  if (devis === null) {
    await journaliserRefus(session, "devis_introuvable", devisId);
    return refus(MSG_DEVIS);
  }
  const piece = devis.documentGenere;
  if (
    devis.statut !== "envoye" ||
    devis.offre !== null ||
    devis.offreSha256 !== null ||
    devis.documentGenereId === null ||
    piece === null ||
    piece.type !== "devis" ||
    piece.annuleeAt !== null
  ) {
    await journaliserRefus(session, "etat_devis", devisId);
    return refus(MSG_ETAT);
  }

  // D2 : l'identité vient de la fiche client, jamais du formulaire.
  const nom = (devis.client.contactNom ?? devis.client.raisonSociale ?? "").trim();
  if (nom === "") {
    await journaliserRefus(session, "fiche_sans_nom", devisId);
    return refus(MSG_FICHE);
  }

  // ── Pré-contrôles AVANT R2 ──
  const dejaSigne = await prisma.documentSignature.findFirst({
    where: { documentGenereId: piece.id, partie: "client", revokedAt: null },
    select: { id: true },
  });
  if (dejaSigne !== null) {
    await journaliserRefus(session, "deja_signe", devisId);
    return refus(MSG_DEJA_SIGNE);
  }
  // Contrôle « même empreinte » : confort sans garantie en base (deux versements simultanés du même
  // scan sur deux devis passeraient) ; la preuve reste protégée par l'index unique par devis.
  const scanSha256 = createHash("sha256").update(octets).digest("hex");
  const dejaVu = await prisma.documentSignature.findFirst({
    where: { signatureSha256: scanSha256, revokedAt: null },
    select: { id: true },
  });
  if (dejaVu !== null) {
    await journaliserRefus(session, "scan_deja_verse", devisId);
    return refus(MSG_SCAN_VU);
  }

  const circuit = circuitPour("devis");
  if (circuit === null) {
    await journaliserRefus(session, "circuit_absent", devisId);
    return refus(MSG_ETAT);
  }

  try {
    const res = await signerDocument({
      documentGenereId: piece.id,
      porteur: {
        type: "reversement_papier",
        adminId: session.userId,
        provider: "physical_signed",
        partie: "client",
        signataire: {
          nom,
          email: devis.client.contactEmail,
          qualite: devis.client.contactFonction,
        },
      },
      methode: "papier_scanne",
      partiesRequises: circuit.parties,
      scanPdf: { octets },
      ...(await contexteRequete()),
    });
    if (!res.ok) {
      await journaliserRefus(session, res.raison, devisId);
      return refus(res.message);
    }

    // Remise, alerte, conséquences métier : sans `canal` (pas un lien à jeton).
    const apres = await apresSignature({
      documentGenereId: piece.id,
      type: piece.type,
      numero: piece.numero,
      statutSignature: res.statutSignature,
      partie: "client",
      acteur: { type: "administrateur", session },
      sansCopiePartielle: true,
    });

    // Horodatage RFC 3161 du sceau : premier essai sans attendre, sans jamais défaire la signature.
    void Promise.resolve()
      .then(() => horodaterSignature(res.signatureId))
      .catch(() => undefined);

    // La signature est scellée : un journal en échec ne doit pas faire dire « échec » à l'écran.
    try {
      await logQualiopiActivity({
        action: "qualiopi.devis.scan_papier_verse",
        targetType: "DocumentSignature",
        targetId: res.signatureId,
        changes: {
          documentGenereId: piece.id,
          signatureId: res.signatureId,
          scanSha256,
          tailleOctets: octets.byteLength,
          statutSignature: res.statutSignature,
        },
        session,
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "verserScanDevisSigneAction.journal" } });
    }

    const activationRefusee =
      apres?.activationRefusee != null
        ? `${apres.activationRefusee.prefixe ?? PREFIXE_ACTIVATION_DEVIS} ${apres.activationRefusee.message}`
        : undefined;

    return {
      ok: true,
      signatureId: res.signatureId,
      statutSignature: res.statutSignature,
      ...(activationRefusee === undefined ? {} : { activationRefusee }),
    };
  } catch (err) {
    if (err instanceof SignatureStockageError) {
      await journaliserRefus(session, `stockage_${err.motif}`, devisId);
      return refus(err.imputableAuClient ? err.message : MSG_STOCKAGE);
    }
    Sentry.captureException(err, { tags: { action: "verserScanDevisSigneAction" } });
    throw err;
  }
}
