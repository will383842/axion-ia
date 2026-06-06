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
    "Statut",
    "Session ID",
  ]
    .map(escapeCsvField)
    .join(";");

  const rows = factures.map((f) => {
    const dateStr = f.emiseAt
      ? f.emiseAt.toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "";
    const montantEuros = (f.montantHtCents / 100).toFixed(2).replace(".", ",");
    return [
      f.numero,
      dateStr,
      f.destinataire,
      montantEuros,
      f.tvaExoneree ? "Oui" : "Non",
      f.statut,
      f.sessionId,
    ]
      .map(escapeCsvField)
      .join(";");
  });

  return [header, ...rows].join("\n");
}
