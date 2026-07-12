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
//   5. Return PDF stream avec Content-Disposition attachment
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
  invoicePdfKey,
} from "@/lib/r2-storage";
import type { LegalSnapshot } from "@/lib/legal-snapshot";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      pdfStorageUrl = await getSignedUrlR2(key);
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
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Content-Length": String(result.sizeBytes),
      "Cache-Control": "private, no-store",
      "X-Invoice-Hash-Sha256": result.hashSha256,
      ...(pdfStorageUrl ? { "X-Invoice-R2-Signed-Url": pdfStorageUrl } : {}),
    },
  });
}
