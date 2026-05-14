// Route handler : export CSV paiements (Sprint X.11).
//
// Format compatible Pennylane / Indy / Tiime — encodage UTF-8 BOM,
// séparateur `;`, headers en français.
//
// Query params optionnels :
//   - status, provider, year (default = année en cours)
//
// Auth requise — redirect 302 vers /login si pas de session admin.

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  PaymentProvider,
  PaymentStatus,
} from "../../../../../../../prisma/generated/client";

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  manual_wire: "Virement",
  manual_check: "Cheque",
  manual_cash: "Especes",
};

function csvEscape(s: string | null | undefined): string {
  if (s == null) return "";
  const v = String(s);
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adminPrefix: string; locale: string }> },
) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL(`/fr/${adminPrefix}/login`, req.url));
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") as PaymentStatus | null;
  const provider = sp.get("provider") as PaymentProvider | null;
  const yearStr = sp.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const where: Prisma.PaymentWhereInput = {
    paidAt: { gte: yearStart, lt: yearEnd },
  };
  if (status) where.status = status;
  if (provider) where.provider = provider;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      provider: true,
      mode: true,
      type: true,
      status: true,
      amountCents: true,
      paidAt: true,
      receivedReference: true,
      notes: true,
      invoice: {
        select: {
          number: true,
          payerName: true,
          payerEmail: true,
          vatRate: true,
          amountHtCents: true,
          amountTtcCents: true,
        },
      },
    },
  });

  const headers = [
    "Date paiement",
    "N° facture",
    "Client (raison sociale)",
    "Email",
    "Type paiement",
    "Mode bas-niveau",
    "Provider",
    "Référence",
    "Montant HT (EUR)",
    "TVA",
    "Montant TTC (EUR)",
    "Statut",
    "Notes",
  ];

  const rows = payments.map((p) => {
    const ht = p.invoice?.amountHtCents ?? p.amountCents;
    const ttc = p.invoice?.amountTtcCents ?? p.amountCents;
    const vatRate = p.invoice ? Number(p.invoice.vatRate).toFixed(2) : "—";
    return [
      formatDate(p.paidAt),
      p.invoice?.number ?? "",
      p.invoice?.payerName ?? "",
      p.invoice?.payerEmail ?? "",
      p.type,
      p.mode ?? "",
      PROVIDER_LABELS[p.provider],
      p.receivedReference ?? "",
      formatEur(ht),
      vatRate,
      formatEur(ttc),
      p.status,
      p.notes ?? "",
    ];
  });

  const lines = [headers, ...rows].map((cols) => cols.map(csvEscape).join(";"));
  // BOM UTF-8 pour Excel + Pennylane
  const bom = "﻿";
  const csv = bom + lines.join("\r\n");

  const filename = `axionia-paiements-${year}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
