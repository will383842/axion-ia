/**
 * Qualiopi — Export comptable CSV (T11 AGENT A, module PUR).
 *
 * Génère un CSV délimité par `;` au format FR standard pour l'export compta.
 * Colonnes : numero ; date_emission ; destinataire ; montant_ht_euros ;
 *            tva_exoneree ; statut ; session_id.
 * Aucun import DB/next ici : fonction pure testable sans infrastructure.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FactureCsvRow {
  numero: string;
  emiseAt: Date | null;
  destinataire: string;
  montantHtCents: number;
  tvaExoneree: boolean;
  /** Régime de TVA (assujetti / exoneration_261 / franchise_293b). */
  regimeTva?: string;
  /** Montant total de TVA (centimes). */
  montantTvaCents?: number;
  /** Montant total TTC (centimes). Null pour les anciennes factures. */
  montantTtcCents?: number | null;
  statut: string;
  sessionId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions pures
// ─────────────────────────────────────────────────────────────────────────────

/** Échappe un champ CSV (guillemets si nécessaire). */
function escapeCsvField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Génère un CSV `;` FR à partir d'un tableau de factures.
 * Montant HT en euros (2 décimales, virgule comme séparateur décimal FR).
 */
export function facturesToCsv(factures: FactureCsvRow[]): string {
  const header = [
    "Numéro",
    "Date émission",
    "Destinataire",
    "Montant HT (€)",
    "TVA exonérée",
    "Régime TVA",
    "Montant TVA (€)",
    "Montant TTC (€)",
    "Statut",
    "Session ID",
  ]
    .map(escapeCsvField)
    .join(";");

  const euros = (cents: number): string => (cents / 100).toFixed(2).replace(".", ",");

  const rows = factures.map((f) => {
    const dateStr = f.emiseAt
      ? f.emiseAt.toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "";
    const tvaCents = f.montantTvaCents ?? 0;
    const ttcCents = f.montantTtcCents ?? f.montantHtCents + tvaCents;
    return [
      f.numero,
      dateStr,
      f.destinataire,
      euros(f.montantHtCents),
      f.tvaExoneree ? "Oui" : "Non",
      f.regimeTva ?? "",
      euros(tvaCents),
      euros(ttcCents),
      f.statut,
      f.sessionId,
    ]
      .map(escapeCsvField)
      .join(";");
  });

  return [header, ...rows].join("\n");
}
