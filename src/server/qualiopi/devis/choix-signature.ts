/**
 * Choix du client à la signature d'un devis à formules — validation PURE (lot 4).
 *
 * Le navigateur ne propose que des CHOIX (formule, automatisations facultatives, case
 * maintenance, périodicité). Tout le reste — prix, remises, règle de maintenance, numéro
 * du devis, empreinte de l'offre — vient de l'offre FIGÉE en base. Un champ supplémentaire
 * envoyé par le navigateur est ignoré, jamais scellé.
 *
 * Aucun import Prisma, aucune horloge (la date est un paramètre).
 */
import { selectionComplete } from "./dependances";
import {
  choixCanonique,
  sha256Choix,
  sha256Offre,
  totauxFormule,
  type ChoixCanonique,
} from "./offre-calculs";
import type { Formule, OffreDevisV1 } from "./offre-devis";

/** Ce que le navigateur a le droit de dire. */
export interface ChoixSaisi {
  readonly formule: Formule;
  readonly automatisationsRetenues: readonly string[];
  /** Formule A seulement ; `null` accepté en formule B. */
  readonly maintenanceRetenue: boolean | null;
  /** Mois de la maintenance (A) ou de l'abonnement (B) ; `null` si non retenue. */
  readonly periodiciteMois: number | null;
}

/** Ce que le serveur lit en base, jamais dans la requête. */
export interface OffreFigee {
  readonly offre: OffreDevisV1;
  readonly devisNumero: string;
  /** `devis.offre_sha256`. */
  readonly offreSha256: string;
}

export type RaisonRefusChoix =
  | "formule_hors_offre"
  | "maintenance_obligatoire"
  | "periodicite_hors_offre"
  | "selection_incomplete"
  | "choix_incoherent"
  | "offre_alteree";

export type ResultatChoix =
  | { readonly ok: true; readonly choix: ChoixCanonique; readonly sha256Choix: string }
  | { readonly ok: false; readonly raison: RaisonRefusChoix; readonly message: string };

const MESSAGES: Record<RaisonRefusChoix, string> = {
  formule_hors_offre: "Choisissez l'une des formules proposées par ce devis.",
  maintenance_obligatoire: "La maintenance est obligatoire avec cette formule.",
  periodicite_hors_offre: "Choisissez une durée parmi celles proposées par ce devis.",
  selection_incomplete:
    "Votre sélection d'automatisations est incomplète : certaines dépendent d'autres automatisations.",
  choix_incoherent: "Vos choix ne sont pas cohérents. Rechargez la page et recommencez.",
  offre_alteree:
    "Ce devis ne peut pas être signé en l'état. Contactez votre interlocuteur chez Axion-IA.",
};

function refus(raison: RaisonRefusChoix): ResultatChoix {
  return { ok: false, raison, message: MESSAGES[raison] };
}

/** Vérifie le choix contre l'offre figée et rend le choix canonique scellable. */
export function validerChoixSignature(figee: OffreFigee, saisi: ChoixSaisi): ResultatChoix {
  const { offre } = figee;

  // L'offre lue doit être celle dont l'empreinte a été figée à l'envoi.
  let empreinteLue: string;
  try {
    empreinteLue = sha256Offre(offre);
  } catch {
    return refus("offre_alteree");
  }
  if (empreinteLue !== figee.offreSha256) return refus("offre_alteree");

  const { formule } = saisi;
  if (formule !== "achat" && formule !== "abonnement") return refus("formule_hors_offre");
  if (!offre.formulesProposees.includes(formule)) return refus("formule_hors_offre");
  if ((formule === "achat" ? offre.achat : offre.abonnement) === undefined) {
    return refus("formule_hors_offre");
  }

  const sel = selectionComplete(saisi.automatisationsRetenues, offre.automatisations);
  if (!sel.ok) return refus("selection_incomplete");

  let maintenanceRetenue = false;
  let periodiciteMois: number | null = null;

  if (formule === "achat") {
    const m = offre.achat!.maintenance;
    if (m.regle === "obligatoire") {
      if (saisi.maintenanceRetenue !== true) return refus("maintenance_obligatoire");
    } else if (typeof saisi.maintenanceRetenue !== "boolean") {
      // Facultative : une réponse EXPLICITE. Un oubli ne vaut ni oui ni non.
      return refus("choix_incoherent");
    }
    maintenanceRetenue = saisi.maintenanceRetenue === true;
    if (maintenanceRetenue) {
      const mois = saisi.periodiciteMois;
      if (mois === null || !(m.periodesMois as readonly number[]).includes(mois)) {
        return refus("periodicite_hors_offre");
      }
      periodiciteMois = mois;
    } else if (saisi.periodiciteMois !== null) {
      return refus("choix_incoherent");
    }
  } else {
    // Formule B : pas de case maintenance ; la périodicité est celle de l'abonnement.
    if (saisi.maintenanceRetenue === true) return refus("choix_incoherent");
    const mois = saisi.periodiciteMois;
    const proposees = offre.abonnement!.periodes.map((p) => p.mois as number);
    if (mois === null || !proposees.includes(mois)) return refus("periodicite_hors_offre");
    periodiciteMois = mois;
  }

  const choix = choixCanonique({
    devisNumero: figee.devisNumero,
    offreSha256: figee.offreSha256,
    formule,
    // 🔴 La liste RÉELLEMENT facturée (`sel.retenues`), jamais la liste brute du navigateur.
    automatisationsRetenues: sel.retenues,
    maintenanceRetenue,
    periodiciteMois,
  });
  return { ok: true, choix, sha256Choix: sha256Choix(choix) };
}

/**
 * Un devis à formules ne se signe plus passé sa date de validité, même si le cron
 * d'expiration (06:45) n'a pas encore posé le statut `expire`. Borne EXCLUE.
 */
export function devisSignableParFormules(
  devis: { readonly dateValidite: Date },
  maintenant: Date,
): boolean {
  return maintenant.getTime() < devis.dateValidite.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Présentation au signataire (aucun calcul de prix côté navigateur)
// ─────────────────────────────────────────────────────────────────────────────

export interface FormulePresentee {
  readonly formule: Formule;
  readonly totalHtCents: number;
  readonly totalTtcCents: number;
  readonly maintenance: {
    readonly regle: "obligatoire" | "facultative";
    readonly mensuelHtCents: number;
    readonly periodesMois: readonly number[];
  } | null;
  readonly periodes: readonly { readonly mois: number; readonly remiseBps: number }[] | null;
  /** Mensuel HT de l'abonnement (catalogue, avant remise). */
  readonly mensuelHtCents: number | null;
}

export interface AutomatisationPresentee {
  readonly code: string;
  readonly libelle: string;
  readonly facultative: boolean;
  readonly dependDe: readonly string[];
  readonly prixHtCents: number;
}

export interface PresentationChoix {
  readonly formules: readonly FormulePresentee[];
  readonly automatisations: readonly AutomatisationPresentee[];
}

/**
 * Le total ponctuel affiché pour une formule est celui du plancher (automatisations non
 * facultatives seulement) : les facultatives s'ajoutent à la sélection du client, et le
 * total définitif est recalculé par le serveur à la signature.
 */
export function presentationDuChoix(offre: OffreDevisV1): PresentationChoix {
  const obligatoires = offre.automatisations.filter((a) => !a.facultative).map((a) => a.code);
  const formules: FormulePresentee[] = offre.formulesProposees.map((formule) => {
    const t = totauxFormule(offre, formule, obligatoires);
    return {
      formule,
      totalHtCents: t.totalHtCents,
      totalTtcCents: t.totalTtcCents,
      maintenance:
        formule === "achat" && offre.achat
          ? {
              regle: offre.achat.maintenance.regle,
              mensuelHtCents: offre.achat.maintenance.mensuelHtCents,
              periodesMois: offre.achat.maintenance.periodesMois,
            }
          : null,
      periodes:
        formule === "abonnement" && offre.abonnement
          ? offre.abonnement.periodes.map((p) => ({ mois: p.mois, remiseBps: p.remiseBps }))
          : null,
      mensuelHtCents:
        formule === "abonnement" && offre.abonnement
          ? offre.abonnement.mensuelCatalogueHtCents
          : null,
    };
  });
  return {
    formules,
    automatisations: offre.automatisations.map((a) => ({
      code: a.code,
      libelle: a.libelle,
      facultative: a.facultative,
      dependDe: a.dependDe,
      prixHtCents: a.prixHtCents,
    })),
  };
}
