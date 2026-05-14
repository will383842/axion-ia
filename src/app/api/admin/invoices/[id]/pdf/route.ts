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

  const interventionDate = invoice.booking.bookingDate.toISOString().slice(0, 10);
  const description = `${invoice.booking.interventionType} — ${interventionDate}`;

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
    legalSnapshot: invoice.legalSnapshot as unknown as LegalSnapshot,
    locale: invoice.locale === "en" ? "en" : "fr",
  });

  // Persist hash si pas encore stocké (idempotent — hash stable byte-for-byte)
  if (!invoice.hashSha256 || invoice.hashSha256 !== result.hashSha256) {
    await prisma.invoice
      .update({
        where: { id: invoice.id },
        data: { hashSha256: result.hashSha256 },
      })
      .catch((err) => {
        console.warn("[invoice-pdf] update hashSha256 failed", err);
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
    },
  });
}
