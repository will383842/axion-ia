/**
 * Régime de paiement OPCO après la réforme TVA du 1er octobre 2026 (chantier
 * OPCO A3) — module PUR.
 *
 * Rescrits DLF (nov. 2025, fév. 2026) et communiqué commun des 11 OPCO du
 * 22/12/2025 : la SUBROGATION (l'OPCO paie l'organisme directement) devient
 * l'exception. Hors subrogation, l'organisme facture l'entreprise TTC,
 * l'entreprise paie, l'OPCO la rembourse HT.
 *
 * Le résultat est une INDICATION pour la console : seul l'accord écrit de
 * l'OPCO fait foi pour un dossier donné. Les règles sont appliquées dans
 * l'ordre ci-dessous ; la première qui conclut l'emporte.
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import { OPCO_FICHES, isOpcoId } from "./opco-referentiel";

export type RegimePaiement = "subrogation_possible" | "remboursement_entreprise" | "inconnu";

export type ResultatRegimePaiement = {
  regime: RegimePaiement;
  motif: string;
  source: string;
};

export type EntreeRegimePaiement = {
  opco: string | null | undefined;
  effectif: number | null | undefined;
  cofinancement: boolean;
  versementVolontaire: boolean;
  dateAccord: Date | null | undefined;
  dateDepot: Date | null | undefined;
  /** OPCO Mobilités : l'entreprise a-t-elle adhéré à l'offre de services ? */
  adhesionOffreMobilites: boolean | null | undefined;
  /** Repère quand aucun accord n'est daté (Constructys). Défaut : maintenant. */
  aujourdhui?: Date;
};

const DEBUT_REFORME = "2026-10-01";
const ATLAS_DEPOT_ANCIEN_REGIME_AVANT = "2026-09-15";
const CONSTRUCTYS_FIN_TRANSITOIRE = "2026-12-31";

export const SOURCE_COMMUNIQUE_OPCO =
  "https://www.akto.fr/content/uploads/2025/12/CPcommunOpcos_TVA.pdf";
const SOURCE_CENTRE_INFFO =
  "https://www.centre-inffo.fr/site-centre-inffo/actualites-centre-inffo/le-quotidien-de-la-formation-actualite-formation-professionnelle-apprentissage/actualites-2026/le-choc-de-la-tva-sur-les-operateurs-de-competences";
const SOURCE_CONSTRUCTYS = "https://www.constructys.fr";

const OPCO_SUBROGATION_TPE = new Set(["atlas", "akto", "opcommerce", "afdas"]);
const OPCO_SELON_DISPOSITIF = new Set(["opco_ep", "opco2i", "ocapiat"]);

function jour(date: Date | null | undefined): string | null {
  return date ? dayKeyInParis(date) : null;
}

export function regimePaiementOpco(e: EntreeRegimePaiement): ResultatRegimePaiement {
  const opco = e.opco ?? null;
  if (!isOpcoId(opco)) {
    return { regime: "inconnu", motif: "OPCO non renseigné", source: SOURCE_COMMUNIQUE_OPCO };
  }

  if (OPCO_FICHES[opco].opcoHorsChampTva.valeur === true) {
    return {
      regime: "subrogation_possible",
      motif: "OPCO resté hors du champ de la TVA : la subrogation demeure",
      source: OPCO_FICHES[opco].opcoHorsChampTva.source ?? SOURCE_COMMUNIQUE_OPCO,
    };
  }

  const accord = jour(e.dateAccord);
  const depot = jour(e.dateDepot);
  if (accord !== null && accord < DEBUT_REFORME) {
    return {
      regime: "subrogation_possible",
      motif: "accord antérieur au 1er octobre 2026 : ancien régime",
      source: SOURCE_COMMUNIQUE_OPCO,
    };
  }
  if (opco === "atlas" && depot !== null && depot < ATLAS_DEPOT_ANCIEN_REGIME_AVANT) {
    return {
      regime: "subrogation_possible",
      motif: "demande déposée chez Atlas avant le 15 septembre 2026 : ancien régime",
      source: SOURCE_CENTRE_INFFO,
    };
  }

  if (opco === "constructys") {
    const repere = accord ?? dayKeyInParis(e.aujourdhui ?? new Date());
    return repere <= CONSTRUCTYS_FIN_TRANSITOIRE
      ? {
          regime: "remboursement_entreprise",
          motif: "aucune subrogation du 1/10 au 31/12/2026, nouveau régime début 2027",
          source: SOURCE_CONSTRUCTYS,
        }
      : {
          regime: "inconnu",
          motif: "nouveau régime Constructys de 2027 : voir l'accord de prise en charge",
          source: SOURCE_CONSTRUCTYS,
        };
  }

  if (e.effectif === null || e.effectif === undefined) {
    return { regime: "inconnu", motif: "effectif non renseigné", source: SOURCE_COMMUNIQUE_OPCO };
  }
  if (e.effectif >= 50) {
    return {
      regime: "remboursement_entreprise",
      motif: "entreprise de 50 salariés ou plus : pas de subrogation",
      source: SOURCE_CENTRE_INFFO,
    };
  }
  if (e.cofinancement || e.versementVolontaire) {
    return {
      regime: "remboursement_entreprise",
      motif: "un cofinancement ou un versement volontaire fait perdre la subrogation",
      source: SOURCE_CENTRE_INFFO,
    };
  }

  if (OPCO_SUBROGATION_TPE.has(opco)) {
    return {
      regime: "subrogation_possible",
      motif:
        "moins de 50 salariés, financement à 100 % sur le plan de développement des compétences",
      source: SOURCE_CENTRE_INFFO,
    };
  }
  if (opco === "mobilites") {
    return e.adhesionOffreMobilites === true
      ? {
          regime: "subrogation_possible",
          motif: "l'entreprise a adhéré à l'offre de services d'OPCO Mobilités",
          source: SOURCE_CENTRE_INFFO,
        }
      : {
          regime: "inconnu",
          motif:
            "subrogation seulement si l'entreprise a adhéré à l'offre de services ou si la branche l'autorise",
          source: SOURCE_CENTRE_INFFO,
        };
  }
  if (OPCO_SELON_DISPOSITIF.has(opco)) {
    return {
      regime: "inconnu",
      motif: "selon le dispositif : voir l'accord de prise en charge",
      source: SOURCE_CENTRE_INFFO,
    };
  }
  return { regime: "inconnu", motif: "OPCO non couvert", source: SOURCE_COMMUNIQUE_OPCO };
}
