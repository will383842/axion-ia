// Génération PDF facture à la volée (Sprint X.10b).
//
// Endpoint protégé admin. Génère le PDF facture à partir des données
// stockées en DB + legalSnapshot immuable. Idempotent grâce au hash
// SHA-256 — même invoice = même PDF byte-for-byte.
//
// Flow :
//   1. Auth admin (requireAdminWrite)
//   2. Read Invoice + booking (intervention type + bookingDate pour description)
//   3. generateInvoicePdfBuffer
//   4. Update Invoice.hashSha256 si pas encore set
//   5. Return PDF stream — inline par defaut, ?dl=1 pour enregistrer
//
// V1.5+ : upload Hetzner Storage Box + URL signée 90j stockée dans pdfUrl.

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdfBuffer } from "@/lib/invoice-pdf";
import { resolveRibFacture } from "@/lib/legal-identity";
import {
  isR2Configured,
  uploadToR2,
  existsInR2,
  getSignedUrlR2,
  getObjectBufferR2,
  invoicePdfKey,
} from "@/lib/r2-storage";
import type { LegalSnapshot } from "@/lib/legal-snapshot";
import { dispositionDemandee, enTeteContentDisposition } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      basePriceHtCents: true,
      travelFeeCents: true,
      accommodationFeeCents: true,
      mealFeeCents: true,
      additionalFeesCents: true,
      additionalFeesNotes: true,
      amountHtCents: true,
      amountTtcCents: true,
      vatRate: true,
      vatReverseCharge: true,
      vatMention: true,
      payerName: true,
      payerAddress: true,
      payerEmail: true,
      payerVatNumber: true,
      payerSiret: true,
      refClient: true,
      legalSnapshot: true,
      locale: true,
      hashSha256: true,
      booking: {
        select: {
          interventionType: true,
          bookingDate: true,
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  // Immutabilité (D8, Hub facturation) : une facture ÉMISE sert TOUJOURS le
  // PDF archivé sur R2 — on ne régénère jamais un document fiscal après
  // émission (le rendu pourrait diverger de l'original : identité légale
  // mise à jour, template retouché…). Régénération uniquement si l'archive
  // n'existe pas encore (premier téléchargement) ou statut brouillon.
  if (invoice.hashSha256 !== null && invoice.status !== "draft") {
    const archivedKey = isR2Configured() ? invoicePdfKey(invoice.number, invoice.issuedAt) : null;
    const archived =
      archivedKey !== null ? await getObjectBufferR2(archivedKey).catch(() => null) : null;
    if (archived !== null) {
      return new NextResponse(new Uint8Array(archived), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          // Même règle que les pièces Qualiopi : une facture se consulte
          // d'abord. `?dl=1` reste disponible pour l'enregistrer.
          "Content-Disposition": enTeteContentDisposition(
            dispositionDemandee(req.url),
            `${invoice.number}.pdf`,
          ),
          "Content-Length": String(archived.byteLength),
          "Cache-Control": "private, no-store",
          "X-Invoice-Hash-Sha256": invoice.hashSha256,
          "X-Invoice-Pdf-Source": "r2-archive",
        },
      });
    }
    // Archive absente alors qu'un hash existe (revue M5) : REFUS de régénérer —
    // un re-rendu avec l'identité/RIB du jour différerait du document facturé
    // et écraserait le hash légal. Restaurer l'archive R2, jamais re-rendre.
    return NextResponse.json(
      {
        error: "archive_missing",
        message: `Le PDF archivé de la facture ${invoice.number} est introuvable sur R2 — régénération interdite sur une facture émise (le rendu du jour différerait de l'original). Restaurer l'objet R2 depuis les sauvegardes.`,
      },
      { status: 410 },
    );
  }

  // `booking` nullable depuis le Hub facturation (facture libre sans réservation).
  const description = invoice.booking
    ? `${invoice.booking.interventionType} — ${invoice.booking.bookingDate.toISOString().slice(0, 10)}`
    : `Prestation — ${invoice.issuedAt.toISOString().slice(0, 10)}`;
  const rib = await resolveRibFacture();

  const result = await generateInvoicePdfBuffer({
    number: invoice.number,
    type: invoice.type,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    description,
    basePriceHtCents: invoice.basePriceHtCents,
    travelFeeCents: invoice.travelFeeCents,
    accommodationFeeCents: invoice.accommodationFeeCents,
    mealFeeCents: invoice.mealFeeCents,
    additionalFeesCents: invoice.additionalFeesCents,
    additionalFeesNotes: invoice.additionalFeesNotes,
    amountHtCents: invoice.amountHtCents,
    amountTtcCents: invoice.amountTtcCents,
    vatRate: Number(invoice.vatRate),
    vatReverseCharge: invoice.vatReverseCharge,
    vatMention: invoice.vatMention,
    payerName: invoice.payerName,
    payerAddress: invoice.payerAddress,
    payerEmail: invoice.payerEmail,
    payerVatNumber: invoice.payerVatNumber,
    payerSiret: invoice.payerSiret,
    refClient: invoice.refClient,
    rib,
    legalSnapshot: invoice.legalSnapshot as unknown as LegalSnapshot,
    locale: invoice.locale === "en" ? "en" : "fr",
  });

  // Upload R2 si configuré + persist URL signée 90j dans Invoice.pdfUrl.
  // Idempotent : si key déjà présente avec même hash → skip upload (économie API call).
  let pdfStorageUrl: string | null = null;
  if (isR2Configured()) {
    const key = invoicePdfKey(invoice.number, invoice.issuedAt);
    try {
      const alreadyPresent =
        invoice.hashSha256 === result.hashSha256 && (await existsInR2(key).catch(() => false));
      if (!alreadyPresent) {
        await uploadToR2(key, result.buffer, "application/pdf", {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          hashSha256: result.hashSha256,
        });
      }
      // ⚠️ 90 jours, et c'est DÉLIBÉRÉ ici — contrairement au portail stagiaire
      // (`D4-4-C`). Cette URL est persistée dans `Invoice.pdfUrl` et sert de
      // lien de facture au client pendant le trimestre qui suit l'émission.
      //
      // La durée était auparavant HÉRITÉE d'un défaut de signature, ce qui
      // revenait au même sans que personne l'ait décidé. Elle est désormais
      // écrite : une facture n'est pas une pièce nominative de stagiaire, et
      // ce choix se relit.
      pdfStorageUrl = await getSignedUrlR2(key, 90 * 24 * 3600);
    } catch (err) {
      console.warn("[invoice-pdf] R2 upload/sign failed (fail-soft)", err);
    }
  }

  // Persist hash + pdfUrl si changement (idempotent)
  const updateData: { hashSha256?: string; pdfUrl?: string } = {};
  if (!invoice.hashSha256 || invoice.hashSha256 !== result.hashSha256) {
    updateData.hashSha256 = result.hashSha256;
  }
  if (pdfStorageUrl) {
    updateData.pdfUrl = pdfStorageUrl;
  }
  if (Object.keys(updateData).length > 0) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: updateData }).catch((err) => {
      console.warn("[invoice-pdf] update Invoice failed", err);
    });
  }

  // Buffer → Uint8Array pour satisfaire BodyInit (Next 16 strict)
  const body = new Uint8Array(result.buffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // 🔴 SECOND point de sortie de cette route — le premier avait été corrigé,
      // celui-ci non. C'est exactement ce que la garde statique de
      // `lib/content-disposition.spec.ts` existe pour attraper : une route à
      // deux sorties dont une seule applique la règle.
      "Content-Disposition": enTeteContentDisposition(
        dispositionDemandee(req.url),
        `${invoice.number}.pdf`,
      ),
      "Content-Length": String(result.sizeBytes),
      "Cache-Control": "private, no-store",
      "X-Invoice-Hash-Sha256": result.hashSha256,
      ...(pdfStorageUrl ? { "X-Invoice-R2-Signed-Url": pdfStorageUrl } : {}),
    },
  });
}
