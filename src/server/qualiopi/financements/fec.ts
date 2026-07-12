/**
 * Export FEC (Phase 7) — Fichier des Écritures Comptables, arrêté du
 * 29 juillet 2013 (art. A.47 A-1 LPF). Format officiel : 18 colonnes
 * séparées par TAB (ou |), une ligne par écriture, montants avec virgule.
 *
 * Exigible en contrôle fiscal et demandé par tout expert-comptable —
 * complète l'export CSV existant (compta-export.ts).
 *
 * Schéma d'écritures (plan comptable général, comptes paramétrables à terme) :
 *   Facture émise : débit 411 (client, TTC) / crédit 706 (prestations, HT)
 *                   / crédit 44571 (TVA collectée) si TVA.
 *   Avoir         : écritures inverses (montants négatifs → sens inversé).
 *   Encaissement  : débit 512 (banque) / crédit 411 (client).
 *
 * Module PUR : les données arrivent résolues, la fonction rend le contenu
 * texte. Journal unique VT (ventes) + BQ (banque) — suffisant pour un
 * prestataire de services sans achats dans ce périmètre.
 */

export interface FactureFec {
  numero: string;
  dateEmission: Date;
  clientNom: string;
  montantHtCents: number;
  montantTvaCents: number;
  montantTtcCents: number;
}

export interface EncaissementFec {
  factureNumero: string;
  clientNom: string;
  date: Date;
  montantCents: number;
  reference?: string;
}

const COLONNES = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

const fecDate = (d: Date): string =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

/** Montant FEC : valeur absolue, décimale à la virgule (norme DGFiP). */
const fecMontant = (cents: number): string => (Math.abs(cents) / 100).toFixed(2).replace(".", ",");

interface Ligne {
  journal: "VT" | "BQ";
  num: string;
  date: Date;
  compte: string;
  compteLib: string;
  piece: string;
  lib: string;
  debitCents: number;
  creditCents: number;
}

function versLigneFec(l: Ligne): string {
  const vals: Record<(typeof COLONNES)[number], string> = {
    JournalCode: l.journal,
    JournalLib: l.journal === "VT" ? "Ventes" : "Banque",
    EcritureNum: l.num,
    EcritureDate: fecDate(l.date),
    CompteNum: l.compte,
    CompteLib: l.compteLib,
    CompAuxNum: "",
    CompAuxLib: "",
    PieceRef: l.piece,
    PieceDate: fecDate(l.date),
    EcritureLib: l.lib,
    Debit: l.debitCents > 0 ? fecMontant(l.debitCents) : "0,00",
    Credit: l.creditCents > 0 ? fecMontant(l.creditCents) : "0,00",
    EcritureLet: "",
    DateLet: "",
    ValidDate: fecDate(l.date),
    Montantdevise: "",
    Idevise: "",
  };
  return COLONNES.map((c) => vals[c]).join("\t");
}

/**
 * Construit le contenu FEC (texte, TAB-séparé, en-tête inclus) pour un
 * exercice : factures émises/payées + encaissements. Les avoirs (montants
 * négatifs) génèrent les écritures inverses. Invariant vérifié par test :
 * Σ débits = Σ crédits.
 */
export function genererFec(
  factures: ReadonlyArray<FactureFec>,
  encaissements: ReadonlyArray<EncaissementFec>,
): string {
  const lignes: Ligne[] = [];
  let seq = 0;

  for (const f of factures) {
    seq++;
    const num = `VT${String(seq).padStart(6, "0")}`;
    const estAvoir = f.montantTtcCents < 0;
    const lib = `${estAvoir ? "Avoir" : "Facture"} ${f.numero} — ${f.clientNom}`;
    // Client (411) : débit si facture, crédit si avoir.
    lignes.push({
      journal: "VT",
      num,
      date: f.dateEmission,
      compte: "411000",
      compteLib: "Clients",
      piece: f.numero,
      lib,
      debitCents: estAvoir ? 0 : f.montantTtcCents,
      creditCents: estAvoir ? -f.montantTtcCents : 0,
    });
    // Produits (706) : crédit si facture, débit si avoir.
    lignes.push({
      journal: "VT",
      num,
      date: f.dateEmission,
      compte: "706000",
      compteLib: "Prestations de services",
      piece: f.numero,
      lib,
      debitCents: estAvoir ? -f.montantHtCents : 0,
      creditCents: estAvoir ? 0 : f.montantHtCents,
    });
    // TVA collectée (44571) si présente.
    if (f.montantTvaCents !== 0) {
      lignes.push({
        journal: "VT",
        num,
        date: f.dateEmission,
        compte: "445710",
        compteLib: "TVA collectée",
        piece: f.numero,
        lib,
        debitCents: estAvoir ? -f.montantTvaCents : 0,
        creditCents: estAvoir ? 0 : f.montantTvaCents,
      });
    }
  }

  for (const e of encaissements) {
    seq++;
    const num = `BQ${String(seq).padStart(6, "0")}`;
    const lib = `Règlement ${e.factureNumero} — ${e.clientNom}${e.reference ? ` (${e.reference})` : ""}`;
    lignes.push({
      journal: "BQ",
      num,
      date: e.date,
      compte: "512000",
      compteLib: "Banque",
      piece: e.factureNumero,
      lib,
      debitCents: e.montantCents,
      creditCents: 0,
    });
    lignes.push({
      journal: "BQ",
      num,
      date: e.date,
      compte: "411000",
      compteLib: "Clients",
      piece: e.factureNumero,
      lib,
      debitCents: 0,
      creditCents: e.montantCents,
    });
  }

  return [COLONNES.join("\t"), ...lignes.map(versLigneFec)].join("\r\n");
}
