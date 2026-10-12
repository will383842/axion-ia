/**
 * PAIEMENTS SORTANTS — la vue commune « Virements à faire » (FAC-9, plan 08 §12.1).
 *
 * 🔑 UNE VUE, DEUX FLUX, AUCUNE FUSION. Les virements des apporteurs sont lus par
 * leur fonction existante (`lireVirementsAFaire`, inchangée), ceux des formateurs
 * dans leurs relevés ; ce module les MET CÔTE À CÔTE, dans le même ordre (la date
 * cible la plus proche d'abord), sans rien écrire ni rien recalculer. « Virement
 * fait » reste l'action de chaque flux.
 *
 * Module neutre : il n'importe ni la zone Qualiopi, ni un écran. Pur pour la mise
 * en ordre (`ordonnerVirements`) ; la lecture est isolée dans `lireVirementsSortants`.
 */

import { dernierJourOuvreAuPlusTard } from "@/lib/jours-ouvres";

import { ORANGE_AVANT_DATE_CIBLE_JOURS, STATUTS_RELEVE_A_VIRER } from "./parametres";

export type FluxPaiement = "apporteur" | "formateur";

export type CouleurVirement = "rouge" | "orange" | "a_venir" | "sans_echeance";

/** Un virement à faire, tel que lu dans son flux (avant mise en ordre). */
export interface VirementLu {
  readonly flux: FluxPaiement;
  /** Identifiant de la pièce dans son flux (numéro d'autofacture ou relevé). */
  readonly pieceId: string;
  readonly beneficiaireId: string;
  readonly beneficiaire: string;
  /** Numéro de la pièce (autofacture ou facture reçue), s'il existe. */
  readonly reference: string | null;
  /** Montant à virer, TTC, en centimes. */
  readonly montantCents: number;
  readonly emissionAt: Date;
  /** Échéance légale « AAAA-MM-JJ », si le flux la connaît. */
  readonly echeance: string | null;
  /**
   * Formateur seulement : la facture rapprochée ne correspond pas au dû. Le
   * virement est bloqué (« facture non conforme ») ; la vue affiche le DÛ.
   */
  readonly nonConforme?: boolean;
  /** Formateur seulement : relevé validé, facture pas encore émise ni reçue. */
  readonly factureAttendue?: boolean;
  /** Formateur seulement : origine du relevé (`passage_mission` : gardes du virement de mission). */
  readonly origineReleve?: string;
}

export interface VirementSortant extends VirementLu {
  /** Dernier jour ouvré au plus tard à l'échéance. */
  readonly dateCible: string | null;
  readonly couleur: CouleurVirement;
}

function jours(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/** Couleur d'un virement au regard de sa date cible. */
export function couleurDe(dateCible: string | null, aujourdhui: string): CouleurVirement {
  if (dateCible === null) return "sans_echeance";
  const reste = jours(aujourdhui, dateCible);
  if (reste < 0) return "rouge";
  if (reste <= ORANGE_AVANT_DATE_CIBLE_JOURS) return "orange";
  return "a_venir";
}

/**
 * Pure : date cible et couleur de chaque virement, puis l'ordre commun — les
 * dates cibles les plus proches d'abord, les virements sans échéance ensuite (par
 * date d'émission, les plus anciens d'abord). Aucun montant n'est modifié.
 */
export function ordonnerVirements(
  lus: ReadonlyArray<VirementLu>,
  aujourdhui: string,
): VirementSortant[] {
  return lus
    .map((v): VirementSortant => {
      const dateCible = v.echeance ? dernierJourOuvreAuPlusTard(v.echeance) : null;
      return { ...v, dateCible, couleur: couleurDe(dateCible, aujourdhui) };
    })
    .sort((a, b) => {
      if (a.dateCible && b.dateCible && a.dateCible !== b.dateCible)
        return a.dateCible < b.dateCible ? -1 : 1;
      if (a.dateCible && !b.dateCible) return -1;
      if (!a.dateCible && b.dateCible) return 1;
      return a.emissionAt.getTime() - b.emissionAt.getTime();
    });
}

/** Totaux par flux et en tout, pour l'en-tête de la vue. */
export function totauxVirements(vs: ReadonlyArray<VirementSortant>): {
  total: number;
  parFlux: Record<FluxPaiement, number>;
  enRetard: number;
} {
  const parFlux: Record<FluxPaiement, number> = { apporteur: 0, formateur: 0 };
  let enRetard = 0;
  for (const v of vs) {
    parFlux[v.flux] += v.montantCents;
    if (v.couleur === "rouge") enRetard += 1;
  }
  return { total: parFlux.apporteur + parFlux.formateur, parFlux, enRetard };
}

const PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jourParis(d: Date): string {
  const p = Object.fromEntries(PARIS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ce que la vue lit d'un relevé pour le dater (forme de `ReleveDatable`). */
export interface ReleveADater {
  readonly statut: (typeof STATUTS_RELEVE_A_VIRER)[number];
  readonly dateFacture: Date | null;
  readonly echeanceAt: Date | null;
  readonly payeAt: Date | null;
}

/**
 * La vue commune, lue en base. Apporteurs : la fonction existante, telle quelle.
 * Formateurs : les relevés dont le virement est dû, non payés, non contestés.
 * Lecture seule.
 *
 * 🔑 L'échéance d'un relevé de formateur est DONNÉE par l'appelant
 * (`echeanceEffective` de la rémunération, qui sait retomber sur « facture + 30
 * jours » pour le stock sans `echeanceAt`) : ce module neutre ne la recalcule
 * pas, pour qu'il n'en existe qu'une règle.
 */
export async function lireVirementsSortants(
  maintenant: Date,
  echeanceFormateur: (r: ReleveADater) => Date | null,
): Promise<VirementSortant[]> {
  const [{ lireVirementsAFaire }, { prisma }] = await Promise.all([
    import("@/features/apporteurs-reseau/facturation"),
    import("@/lib/prisma"),
  ]);
  const [apporteurs, releves] = await Promise.all([
    lireVirementsAFaire(),
    prisma.trainerStatement.findMany({
      where: {
        statut: { in: [...STATUTS_RELEVE_A_VIRER] },
        payeAt: null,
        contesteeAt: null,
        totalTtcCents: { gt: 0 },
      },
      select: {
        id: true,
        statut: true,
        trainerId: true,
        numeroFacture: true,
        totalTtcCents: true,
        montantFactureTtcCents: true,
        echeanceAt: true,
        payeAt: true,
        autofactureAt: true,
        dateFacture: true,
        createdAt: true,
        origine: true,
        trainer: { select: { prenom: true, nom: true } },
      },
    }),
  ]);
  const lus: VirementLu[] = [
    ...apporteurs.map((a): VirementLu => ({
      flux: "apporteur",
      pieceId: a.numero,
      beneficiaireId: a.apporteurId,
      beneficiaire: a.apporteur,
      reference: a.numero,
      montantCents: a.totalCents,
      emissionAt: a.emissionAt,
      echeance: null,
    })),
    ...releves.map((r): VirementLu => {
      const echeance = echeanceFormateur({
        statut: r.statut as ReleveADater["statut"],
        dateFacture: r.dateFacture,
        echeanceAt: r.echeanceAt,
        payeAt: r.payeAt,
      });
      return {
        flux: "formateur",
        pieceId: r.id,
        beneficiaireId: r.trainerId,
        beneficiaire: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
        reference: r.numeroFacture,
        // Toujours le DÛ : une facture d'un autre montant bloque le virement.
        montantCents: r.totalTtcCents,
        nonConforme:
          r.montantFactureTtcCents !== null && r.montantFactureTtcCents !== r.totalTtcCents,
        factureAttendue: r.statut === "valide",
        origineReleve: r.origine,
        emissionAt: r.autofactureAt ?? r.dateFacture ?? r.createdAt,
        echeance: echeance ? jourParis(echeance) : null,
      };
    }),
  ];
  return ordonnerVirements(lus, jourParis(maintenant));
}
