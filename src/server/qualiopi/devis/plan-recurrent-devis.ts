/**
 * Plans récurrents PROPOSÉS par un devis à formules — PUR, en centimes entiers.
 *
 * Décide, pour la formule retenue, QUELS plans récurrents naissent (abonnement de la
 * formule B, maintenance retenue de la formule A), à quel prix, à quelle périodicité,
 * à partir de quelle date et pour combien de factures. Il ne crée rien, n'écrit rien,
 * n'envoie rien : l'écriture (statut `pause`) est dans `proposer-plans.ts`.
 *
 * ⛔ AUCUN montant, taux ni durée par défaut ici : tout vient de l'offre FIGÉE à la
 * signature et du choix du client. Aucun calcul n'est dupliqué : les fonctions de
 * `offre-calculs.ts` (`prixPeriode`, `nbMaxFactures`, `debutMaintenance`) et la
 * date `calculerProchaineGeneration` du cron sont réutilisées telles quelles.
 *
 * Doctrine : dans le doute, on REFUSE de proposer (le plan se crée alors à la main,
 * en connaissance de cause) plutôt que d'inventer une règle de facturation.
 */
import type { LigneFacture } from "../documents/templates/facture";
import { calculerProchaineGeneration } from "../financements/facture-libre-pur";
import { debutMaintenance, nbMaxFactures, prixPeriode } from "./offre-calculs";
import type { Formule, OffreDevisV1 } from "./offre-devis";

export type NaturePlan = "abonnement" | "maintenance";

/**
 * Plafond technique d'une facture de période (HT, centimes) : `montantHtCents` et
 * `montantTtcCents` sont des Int 32 bits en base. Au-delà, l'émission planterait.
 * Borne de sécurité technique, pas une règle commerciale.
 */
export const PLAFOND_PERIODE_HT_CENTS = 1_000_000_000;

/** Sous-ensemble du choix canonique (cf. `ChoixCanonique`) dont le plan a besoin. */
export interface ChoixPourPlan {
  readonly formule: Formule;
  readonly maintenanceRetenue: boolean;
  readonly periodiciteMois: number | null;
}

export interface EntreePlans {
  readonly offre: OffreDevisV1;
  readonly choix: ChoixPourPlan;
  /**
   * Date de début indicative : celle de l'acceptation. Les plans naissent en `pause`
   * et Will valide (ou recrée) ensuite — la livraison n'est pas connue à ce stade.
   */
  readonly debutAt: Date;
  readonly devisNumero: string;
}

export interface PlanPropose {
  readonly nature: NaturePlan;
  readonly periodiciteMois: number;
  /** Une ligne, quantité 1, prix de la PÉRIODE entière (déjà remisé et arrondi). */
  readonly lignes: readonly LigneFacture[];
  readonly prochaineGenerationAt: Date;
  /** Jour du mois de la date de début (1-31) : ancre contre la dérive après un mois court. */
  readonly jourAncre: number;
  /** NULL = sans engagement : pas de borne de nombre de factures. */
  readonly nbMaxFactures: number | null;
  readonly notes: string;
}

export type CodeRefusPlan =
  | "formule_non_proposee"
  | "periode_inconnue"
  | "avance_premiere_periode_ambigue"
  | "engagement_non_multiple"
  | "prix_nul"
  | "prix_hors_borne"
  | "maintenance_obligatoire_non_retenue";

export type PlansProposes =
  | {
      readonly ok: true;
      readonly plans: readonly PlanPropose[];
      /** Éléments de l'offre qui existent mais que ce lot ne transforme PAS en plan. */
      readonly nonTraites: readonly string[];
    }
  | { readonly ok: false; readonly code: CodeRefusPlan; readonly motif: string };

const refus = (code: CodeRefusPlan, motif: string): PlansProposes => ({ ok: false, code, motif });

function verifierPrix(prixCents: number, libelle: string): PlansProposes | null {
  if (prixCents <= 0) return refus("prix_nul", `${libelle} : prix de période nul, aucun plan.`);
  if (prixCents > PLAFOND_PERIODE_HT_CENTS) {
    return refus("prix_hors_borne", `${libelle} : prix de période hors borne technique.`);
  }
  return null;
}

function planAbonnement(e: EntreePlans): PlansProposes {
  const ab = e.offre.abonnement;
  if (!e.offre.formulesProposees.includes("abonnement") || ab === undefined) {
    return refus("formule_non_proposee", "Formule B non proposée par l'offre.");
  }
  const mois = e.choix.periodiciteMois;
  const periode = ab.periodes.find((p) => p.mois === mois);
  if (mois === null || periode === undefined) {
    return refus(
      "periode_inconnue",
      "Période payée d'avance absente du choix ou non proposée par l'offre.",
    );
  }
  // Point OUVERT du contrat devis↔console (n°3) : « l'avance vaut-elle pour la 1re période
  // seulement, ou pour chaque période ? ». Avec une période > 1 mois, « première période
  // seulement » ne dit pas à quel prix ni à quel rythme facturer ensuite : on n'invente pas.
  if (ab.modeAvance === "premiere_periode_seulement" && mois > 1) {
    return refus(
      "avance_premiere_periode_ambigue",
      "Avance sur la première période seulement avec une période > 1 mois : règle de facturation non décidée, plan à créer à la main.",
    );
  }
  // L'engagement doit couvrir un nombre ENTIER de périodes : 3 mois d'engagement avec des
  // périodes de 2 mois, c'est 1,5 facture — une division entière sous-facturerait 1 mois.
  if (ab.engagementMois > 0 && ab.engagementMois % mois !== 0) {
    return refus(
      "engagement_non_multiple",
      `Engagement de ${ab.engagementMois} mois non multiple de la période de ${mois} mois.`,
    );
  }
  const prix = prixPeriode(ab.mensuelCatalogueHtCents, periode.remiseBps, mois);
  const prixRefuse = verifierPrix(prix, "Abonnement");
  if (prixRefuse !== null) return prixRefuse;

  // À échoir : 1re génération à la date de début. Échu : début + une période.
  const premiere =
    ab.terme === "a_echoir" ? e.debutAt : calculerProchaineGeneration(e.debutAt, mois);
  return {
    ok: true,
    nonTraites: [],
    plans: [
      {
        nature: "abonnement",
        periodiciteMois: mois,
        lignes: [
          {
            designation: `Abonnement — période de ${mois} mois — devis ${e.devisNumero}`,
            quantite: 1,
            prixUnitaireHtCents: prix,
            tauxTvaPercent: ab.tauxTvaBps / 100,
          },
        ],
        prochaineGenerationAt: premiere,
        jourAncre: e.debutAt.getUTCDate(),
        // L'engagement n'est la FIN de la facturation que sans reconduction : sinon le contrat
        // continue (CGV art. 44.3) et borner le plan le ferait clore au passage suivant.
        nbMaxFactures:
          ab.reconduction === "aucune" && ab.engagementMois > 0
            ? nbMaxFactures(ab.engagementMois, mois)
            : null,
        notes: `Proposé à l'acceptation du devis ${e.devisNumero} — en pause jusqu'à validation. Date de début indicative (acceptation).`,
      },
    ],
  };
}

function planMaintenance(e: EntreePlans): PlansProposes {
  const achat = e.offre.achat;
  if (!e.offre.formulesProposees.includes("achat") || achat === undefined) {
    return refus("formule_non_proposee", "Formule A non proposée par l'offre.");
  }
  const m = achat.maintenance;
  // Hébergement chez Axion : ligne séparée de l'offre, sans taux de TVA ni périodicité
  // dans le schéma v1 — non transformé en plan par ce lot, signalé à l'appelant.
  const nonTraites = achat.hebergement === "axion" ? ["hebergement"] : [];

  if (m.regle === "obligatoire" && !e.choix.maintenanceRetenue) {
    return refus(
      "maintenance_obligatoire_non_retenue",
      "Maintenance obligatoire non retenue dans le choix : incohérence, aucun plan.",
    );
  }
  if (!e.choix.maintenanceRetenue) return { ok: true, plans: [], nonTraites };

  // Une seule périodicité dans le choix : pour la formule A c'est celle de la maintenance.
  const unique = m.periodesMois.length === 1 ? m.periodesMois[0] : undefined;
  const mois = e.choix.periodiciteMois ?? unique;
  if (mois === undefined || !m.periodesMois.some((p) => p === mois)) {
    return refus(
      "periode_inconnue",
      "Périodicité de maintenance absente du choix ou non proposée.",
    );
  }
  const prix = prixPeriode(m.mensuelHtCents, 0, mois);
  const prixRefuse = verifierPrix(prix, "Maintenance");
  if (prixRefuse !== null) return prixRefuse;

  return {
    ok: true,
    nonTraites,
    plans: [
      {
        nature: "maintenance",
        periodiciteMois: mois,
        // Pas de taux sur la ligne : le taux standard en vigueur s'applique à l'émission
        // (la TVA est toujours facturée), le schéma v1 n'en porte pas pour la maintenance.
        lignes: [
          {
            designation: `Maintenance — période de ${mois} mois — devis ${e.devisNumero}`,
            quantite: 1,
            prixUnitaireHtCents: prix,
          },
        ],
        // Mois offerts : la facturation démarre après eux (fin de mois bornée).
        prochaineGenerationAt: debutMaintenance(e.debutAt, m.moisOfferts),
        jourAncre: e.debutAt.getUTCDate(),
        nbMaxFactures: null,
        notes: `Proposé à l'acceptation du devis ${e.devisNumero} — en pause jusqu'à validation. Début = acceptation + ${m.moisOfferts} mois offerts ; à recaler sur la livraison.`,
      },
    ],
  };
}

/** Plans à proposer pour la formule retenue. Refus explicite plutôt que supposition. */
export function planifierPlansRecurrents(e: EntreePlans): PlansProposes {
  return e.choix.formule === "abonnement" ? planAbonnement(e) : planMaintenance(e);
}
