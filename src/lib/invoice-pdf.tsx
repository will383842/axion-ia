// PDF facture (Sprint X.10b — Booking V1).
//
// Génère un PDF facture via @react-pdf/renderer côté serveur. Le rendu est
// idempotent : même input → même PDF byte-for-byte. Le hash SHA-256 est
// calculé sur le buffer généré et stocké dans `Invoice.hashSha256` pour
// preuve d'intégrité (audit RGPD + comptable).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.10 + X.10b
//   - 03-ARCHITECTURE-CIBLE §5.1.6 (Invoice + pdfUrl + hashSha256)
//   - Agent 11 P0-1/2/6/7 (numérotation immuable + archivage 10 ans)
//
// Layout V1 minimal :
//   - Header : logo Axion-IA texte + numéro facture + date émission
//   - Bloc émetteur : Axion-IA (depuis legalSnapshot)
//   - Bloc client : payerName / payerAddress / payerEmail / vatNumber
//   - Tableau : Description / Quantité / PU HT / Total HT
//   - Récap : HT / TVA / TTC + mention TVA (reverse charge si applicable)
//   - Footer : conditions paiement + clause CGV + archivage légal

import { createHash } from "node:crypto";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { LegalSnapshot } from "@/lib/legal-snapshot";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1c1917",
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#c24a1b", // terracotta
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: "#c24a1b",
  },
  brandSub: {
    fontSize: 9,
    color: "#78716c",
    marginTop: 2,
  },
  invoiceMeta: {
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 700,
  },
  invoiceDate: {
    fontSize: 10,
    color: "#78716c",
    marginTop: 4,
  },
  twoColumns: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 24,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#78716c",
    marginBottom: 6,
  },
  columnLine: {
    fontSize: 10,
    marginBottom: 2,
  },
  table: {
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e5e4",
    paddingVertical: 8,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1c1917",
    paddingVertical: 8,
    fontWeight: 700,
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totals: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1c1917",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 24,
    marginBottom: 4,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    color: "#78716c",
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontWeight: 700,
  },
  totalTtc: {
    fontSize: 12,
    color: "#c24a1b",
  },
  vatMention: {
    fontSize: 9,
    color: "#78716c",
    marginTop: 12,
    fontStyle: "italic",
  },
  ribBlock: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#78716c",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingTop: 8,
  },
});

export interface InvoicePdfInput {
  number: string;
  type: "deposit" | "balance" | "installment" | "full" | "credit_note";
  issuedAt: Date;
  dueAt: Date | null;
  /** Ligne unique en V1 : description = type + bookingDate + intervention. */
  description: string;
  basePriceHtCents: number;
  travelFeeCents: number;
  accommodationFeeCents: number;
  mealFeeCents: number;
  additionalFeesCents: number;
  additionalFeesNotes: string | null;
  amountHtCents: number;
  amountTtcCents: number;
  vatRate: number;
  vatReverseCharge: boolean;
  vatMention: string | null;
  payerName: string | null;
  payerAddress: string | null;
  payerEmail: string | null;
  payerVatNumber: string | null;
  /** SIRET de l'acheteur (routage annuaire e-invoicing — EN 16931 BT-47). */
  payerSiret: string | null;
  /** Référence client / n° de bon de commande (BT-13). */
  refClient: string | null;
  /**
   * Coordonnées bancaires du vendeur (règlement par virement). Null tant que
   * l'IBAN n'est pas renseigné dans `legal_overrides` → bloc omis.
   */
  rib: { iban: string; bic: string; titulaire: string; banque?: string } | null;
  legalSnapshot: LegalSnapshot;
  locale: "fr" | "en";
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(d: Date, locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

const I18N = {
  fr: {
    invoiceTitle: {
      deposit: "Facture d'acompte",
      balance: "Facture de solde",
      installment: "Facture d'échéance",
      full: "Facture",
      credit_note: "Avoir",
    },
    issuer: "Émetteur",
    customer: "Client",
    issuedAt: "Émise le",
    dueAt: "Échéance",
    description: "Description",
    qty: "Qté",
    unitPrice: "PU HT",
    total: "Total HT",
    subtotal: "Sous-total HT",
    feesTravel: "Frais déplacement",
    feesAccom: "Hébergement",
    feesMeal: "Repas",
    feesAdditional: "Frais additionnels",
    vat: "TVA",
    ht: "Total HT",
    ttc: "Total TTC",
    siret: "SIRET",
    refClient: "Référence client / commande",
    payment: "Règlement par virement bancaire",
    accountHolder: "Titulaire",
    bank: "Banque",
    archivedUntil: "Archivage légal jusqu'au",
    footerCgv: "Conditions générales de vente disponibles sur axion-ia.com/cgv",
  },
  en: {
    invoiceTitle: {
      deposit: "Deposit invoice",
      balance: "Balance invoice",
      installment: "Installment invoice",
      full: "Invoice",
      credit_note: "Credit note",
    },
    issuer: "Issuer",
    customer: "Customer",
    issuedAt: "Issued on",
    dueAt: "Due date",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit price (ex VAT)",
    total: "Total ex VAT",
    subtotal: "Subtotal ex VAT",
    feesTravel: "Travel fees",
    feesAccom: "Accommodation",
    feesMeal: "Meal",
    feesAdditional: "Additional fees",
    vat: "VAT",
    ht: "Total ex VAT",
    ttc: "Total incl. VAT",
    siret: "SIRET",
    refClient: "Customer reference / PO",
    payment: "Payment by bank transfer",
    accountHolder: "Account holder",
    bank: "Bank",
    archivedUntil: "Legal archival until",
    footerCgv: "Terms & conditions available at axion-ia.com/cgv",
  },
} as const;

function InvoiceDocument({ data }: { data: InvoicePdfInput }) {
  const t = I18N[data.locale];
  const title = t.invoiceTitle[data.type];
  const hasFees =
    data.travelFeeCents > 0 ||
    data.accommodationFeeCents > 0 ||
    data.mealFeeCents > 0 ||
    data.additionalFeesCents > 0;
  const vatAmount = data.amountTtcCents - data.amountHtCents;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Axion-IA</Text>
            <Text style={styles.brandSub}>
              {data.legalSnapshot.companyLegalForm} · axion-ia.com
            </Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceNumber}>{title}</Text>
            <Text style={styles.invoiceNumber}>{data.number}</Text>
            <Text style={styles.invoiceDate}>
              {t.issuedAt} {formatDate(data.issuedAt, data.locale)}
            </Text>
            {data.dueAt && (
              <Text style={styles.invoiceDate}>
                {t.dueAt} {formatDate(data.dueAt, data.locale)}
              </Text>
            )}
          </View>
        </View>

        {/* Issuer + Customer */}
        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>{t.issuer}</Text>
            <Text style={styles.columnLine}>Axion-IA {data.legalSnapshot.companyLegalForm}</Text>
            <Text style={styles.columnLine}>{data.legalSnapshot.companyRegistrationNumber}</Text>
            {data.legalSnapshot.companyVatNumber && (
              <Text style={styles.columnLine}>TVA : {data.legalSnapshot.companyVatNumber}</Text>
            )}
            <Text style={styles.columnLine}>contact@axion-ia.com</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>{t.customer}</Text>
            {data.payerName && <Text style={styles.columnLine}>{data.payerName}</Text>}
            {data.payerAddress && <Text style={styles.columnLine}>{data.payerAddress}</Text>}
            {data.payerSiret && (
              <Text style={styles.columnLine}>
                {t.siret} : {data.payerSiret}
              </Text>
            )}
            {data.payerEmail && <Text style={styles.columnLine}>{data.payerEmail}</Text>}
            {data.payerVatNumber && (
              <Text style={styles.columnLine}>TVA : {data.payerVatNumber}</Text>
            )}
            {data.refClient && (
              <Text style={styles.columnLine}>
                {t.refClient} : {data.refClient}
              </Text>
            )}
          </View>
        </View>

        {/* Table lignes */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.colDesc}>{t.description}</Text>
            <Text style={styles.colQty}>{t.qty}</Text>
            <Text style={styles.colPrice}>{t.unitPrice}</Text>
            <Text style={styles.colTotal}>{t.total}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>{data.description}</Text>
            <Text style={styles.colQty}>1</Text>
            <Text style={styles.colPrice}>{formatEur(data.basePriceHtCents)}</Text>
            <Text style={styles.colTotal}>{formatEur(data.basePriceHtCents)}</Text>
          </View>
          {data.travelFeeCents > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>{t.feesTravel}</Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colPrice}>{formatEur(data.travelFeeCents)}</Text>
              <Text style={styles.colTotal}>{formatEur(data.travelFeeCents)}</Text>
            </View>
          )}
          {data.accommodationFeeCents > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>{t.feesAccom}</Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colPrice}>{formatEur(data.accommodationFeeCents)}</Text>
              <Text style={styles.colTotal}>{formatEur(data.accommodationFeeCents)}</Text>
            </View>
          )}
          {data.mealFeeCents > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>{t.feesMeal}</Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colPrice}>{formatEur(data.mealFeeCents)}</Text>
              <Text style={styles.colTotal}>{formatEur(data.mealFeeCents)}</Text>
            </View>
          )}
          {data.additionalFeesCents > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>
                {t.feesAdditional}
                {data.additionalFeesNotes ? ` (${data.additionalFeesNotes})` : ""}
              </Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colPrice}>{formatEur(data.additionalFeesCents)}</Text>
              <Text style={styles.colTotal}>{formatEur(data.additionalFeesCents)}</Text>
            </View>
          )}
        </View>

        {/* Totaux */}
        <View style={styles.totals}>
          {hasFees && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.subtotal}</Text>
              <Text style={styles.totalValue}>{formatEur(data.amountHtCents)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.ht}</Text>
            <Text style={styles.totalValue}>{formatEur(data.amountHtCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {t.vat} {data.vatRate.toFixed(2)} %
            </Text>
            <Text style={styles.totalValue}>{formatEur(vatAmount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalTtc]}>
            <Text style={[styles.totalLabel, styles.totalTtc]}>{t.ttc}</Text>
            <Text style={[styles.totalValue, styles.totalTtc]}>
              {formatEur(data.amountTtcCents)}
            </Text>
          </View>
          {data.vatMention && <Text style={styles.vatMention}>{data.vatMention}</Text>}
        </View>

        {/* RIB — règlement par virement (omis tant que l'IBAN n'est pas saisi) */}
        {data.rib && (
          <View style={styles.ribBlock}>
            <Text style={styles.columnTitle}>{t.payment}</Text>
            <Text style={styles.columnLine}>IBAN : {data.rib.iban}</Text>
            <Text style={styles.columnLine}>BIC : {data.rib.bic}</Text>
            <Text style={styles.columnLine}>
              {t.accountHolder} : {data.rib.titulaire}
            </Text>
            {data.rib.banque && (
              <Text style={styles.columnLine}>
                {t.bank} : {data.rib.banque}
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{t.footerCgv}</Text>
          <Text>
            {data.legalSnapshot.loiApplicable} · {data.legalSnapshot.juridiction}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export interface InvoicePdfResult {
  buffer: Buffer;
  hashSha256: string;
  sizeBytes: number;
}

/**
 * Génère le PDF facture + retourne buffer + hash SHA-256 + taille.
 *
 * Le hash est calculé sur le buffer brut — sert de preuve d'intégrité
 * (audit RGPD + comptable) et permet de détecter une modification après
 * archivage. À stocker dans `Invoice.hashSha256`.
 *
 * Le buffer doit ensuite être uploadé vers Hetzner Storage Box (ou R2)
 * + URL signée 90j stockée dans `Invoice.pdfUrl`.
 */
export async function generateInvoicePdfBuffer(data: InvoicePdfInput): Promise<InvoicePdfResult> {
  const blob = await pdf(<InvoiceDocument data={data} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  return {
    buffer,
    hashSha256: hash,
    sizeBytes: buffer.byteLength,
  };
}
