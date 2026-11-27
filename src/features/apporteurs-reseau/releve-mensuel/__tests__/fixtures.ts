import type { CommissionLue, ContenuReleveV1, PieceLue } from "../types";
import { MENTION_PAS_UNE_FACTURE } from "../types";

export function commission(over: Partial<CommissionLue> = {}): CommissionLue {
  return {
    id: "c-1",
    activite: "formation",
    palier: null,
    parrainage: false,
    statut: "due",
    montantCents: 10_000,
    factureHtCents: 100_000,
    prixPublicHtCents: 100_000,
    entreprise: "Société fictive",
    factureClientNumero: "F-2026-0001",
    factureClientDate: new Date("2026-09-20T10:00:00Z"),
    encaissementIntegralAt: new Date("2026-10-14T10:00:00Z"),
    autofactureNumero: "AXI-APP-2026-0001",
    autofactureEmiseAt: new Date("2026-10-15T10:00:00Z"),
    avoirNumero: null,
    autofactureAttenteMotif: null,
    autofactureAttenteDepuis: null,
    litigeDepuis: null,
    verseeAt: null,
    creeAt: new Date("2026-09-25T10:00:00Z"),
    majAt: new Date("2026-10-15T10:00:00Z"),
    regleAppliquee: "forfait_palier",
    versionContrat: "2.8",
    ...over,
  };
}

export function piece(over: Partial<PieceLue> = {}): PieceLue {
  return {
    numero: "AXI-APP-2026-0001",
    genre: "facture",
    regimeTva: "assujetti",
    totalHtCents: 10_000,
    totalTvaCents: 2_000,
    totalTtcCents: 12_000,
    factureRectifiee: null,
    emiseAt: new Date("2026-10-15T10:00:00Z"),
    ...over,
  };
}

/** Un contenu valide minimal pour les tests d'empreinte. */
export function contenuExemple(): ContenuReleveV1 {
  return {
    formatVersion: 1,
    periode: "2026-10",
    coupureAt: "2026-10-31T23:00:00.000Z",
    mention: MENTION_PAS_UNE_FACTURE,
    aucunMouvement: false,
    facturees: {
      lignes: [
        {
          dateEmission: "2026-10-15",
          entreprise: "Société fictive",
          prestation: "Audit",
          factureClient: { numero: "F-2026-0001", date: "2026-09-20" },
          encaissementIntegralLe: "2026-10-14",
          baseHtCents: 100_000,
          prixPublicHtCents: 100_000,
          montantHtCents: 10_000,
          regle: { code: "taux_ht", libelle: "10 % du HT facturé" },
          renvoiDecompte: null,
          versionContrat: "Contrat v2.8",
          parrainage: false,
          pieceNumero: "AXI-APP-2026-0001",
          statut: { code: "facturee", echeanceLe: "2026-11-13" },
        },
      ],
      pieces: [
        {
          numero: "AXI-APP-2026-0001",
          emiseLe: "2026-10-15",
          regimeTva: "assujetti",
          mention293b: false,
          htCents: 10_000,
          tvaCents: 2_000,
          ttcCents: 12_000,
          renvoiFacture: null,
        },
      ],
    },
    avoirs: { lignes: [], pieces: [] },
    virements: [],
    sousTotaux: { facturees: { nb: 1, htCents: 10_000 }, versees: { nb: 0, htCents: 0 } },
    totaux: {
      factureHtCents: 10_000,
      avoirHtCents: 0,
      netHtCents: 10_000,
      tvaCents: 2_000,
      ttcCents: 12_000,
      vireTtcCents: 0,
    },
    report: {
      facturesNonVirees: [],
      enAttenteAutofacture: [],
      indicatif: { auJour: "2026-11-02", lignes: [] },
    },
    cumulAnnee: {
      annee: 2026,
      factureHtCents: 10_000,
      avoirHtCents: 0,
      netHtCents: 10_000,
      netTtcCents: 12_000,
      vireTtcCents: 0,
    },
  };
}

export type Modifiable<T> = { -readonly [K in keyof T]: Modifiable<T[K]> };

export function copieModifiable(c: ContenuReleveV1): Modifiable<ContenuReleveV1> {
  return structuredClone(c) as Modifiable<ContenuReleveV1>;
}
