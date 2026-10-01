/**
 * L'AIDE AU DEVIS — « Ce que le client a dit », affiché À CÔTÉ du formulaire
 * de devis (chantier visio, PR 7).
 *
 * ## Décision de Will du 29/09 (option A) : AUCUN PRÉ-REMPLISSAGE
 *
 * Le formulaire de devis s'ouvre VIDE. À côté, un panneau en lecture seule
 * rappelle ce que le client a dit pour CE projet : besoins, nombre de
 * personnes, niveau, budget, délais, financement, contraintes, offre
 * envisagée, mise en relation. Rien de ce module n'est écrit dans le devis :
 * pas de ligne proposée, pas de prix, pas de TVA, pas de `PreRemplissage`.
 * Gardes : `__tests__/l-aide-au-devis-n-ecrit-rien-dans-le-devis.spec.ts`,
 * `__tests__/le-devis-s-ouvre-vide-et-l-aide-est-a-cote.spec.ts`.
 *
 * ## Ce qu'il lit, et rien d'autre
 *
 * Les VALEURS de `consoliderFaits` (autorité unique de la synthèse) pour la
 * portée du projet visé, et, pour un type que le projet n'a pas abordé, la
 * valeur générale de l'entreprise — affichée comme telle, jamais comparée
 * (rien d'un autre projet n'apparaît : même règle que « Préparer »).
 *
 *   · « à trancher » (deux rendez-vous se contredisent) est montré TEL QUEL,
 *     avec les deux valeurs : aucune n'est choisie en silence ;
 *   · « à reconfirmer », « dit avant la réouverture », « valeur effacée » :
 *     la mention seule, sans la valeur ;
 *   · la PHRASE EXACTE du client n'est rendue que pour les rôles de
 *     `ROLES_DOSSIER_ECHANGES` (décision A2) : pour tout autre rôle, le champ
 *     `citations` vaut `null` et la phrase ne quitte jamais le serveur ;
 *   · le signal OPCO (échéance trop proche) vient de `signalEcheanceOpco`,
 *     source unique partagée avec « Préparer ».
 *
 * Module PUR : aucune lecture, aucune écriture, aucune date implicite.
 */

import type { FaitType } from "../../../prisma/generated/client";
import type {
  Consolidation,
  EtatValeur,
  FaitAConsolider,
  PorteeConsolidee,
  ValeurConsolidee,
} from "@/features/dossier-client/consolider-faits";
import { peutVoirLesEchanges } from "@/features/dossier-client/acces";
import { MENTION_ETAT, valeurLisible } from "@/features/dossier-client/libelles";
import { signalEcheanceOpco, type SignalOpco } from "@/features/dossier-client/preparer";

/** Les rubriques du panneau, dans l'ordre où Will les lit en rédigeant un devis. */
export const RUBRIQUES_AIDE = [
  { cle: "besoins", titre: "Besoins", types: ["besoin", "probleme", "objectif"] },
  {
    cle: "personnes",
    titre: "Nombre de personnes et public",
    types: ["nb_participants", "public_cible"],
  },
  { cle: "niveau", titre: "Niveau en IA", types: ["niveau_ia"] },
  { cle: "budget", titre: "Budget dit par le client", types: ["budget"] },
  { cle: "delais", titre: "Délais", types: ["echeance"] },
  { cle: "financement", titre: "Financement", types: ["financement"] },
  {
    cle: "contraintes",
    titre: "Contraintes, modalité, lieu",
    types: ["contrainte", "modalite_souhaitee", "lieu_intervention"],
  },
  { cle: "offre", titre: "Offre envisagée", types: ["offre_envisagee"] },
  { cle: "mise_en_relation", titre: "Mise en relation par", types: ["mise_en_relation"] },
] as const satisfies ReadonlyArray<{
  cle: string;
  titre: string;
  types: ReadonlyArray<FaitType>;
}>;

export type CleRubriqueAide = (typeof RUBRIQUES_AIDE)[number]["cle"];

/**
 * Types JAMAIS montrés dans l'aide : un prix annoncé par Williams n'est pas ce
 * que le client a dit, et il ne doit pas se retrouver recopié dans un devis.
 */
export const TYPES_EXCLUS_DE_L_AIDE: ReadonlySet<FaitType> = new Set(["prix_annonce_axion"]);

export interface ValeurAide {
  /** La valeur lisible (montant, date, nombre, texte), ou `null` si elle ne s'affiche pas. */
  readonly texte: string | null;
  /** Référence du catalogue (`OFF:…`, `TIER:…`) pour une offre envisagée. */
  readonly reference: string | null;
  /**
   * Les phrases exactes du client — `null` pour un rôle non habilité (A2).
   * Tableau vide : habilité, mais aucune phrase vérifiée (saisie manuelle).
   */
  readonly citations: ReadonlyArray<string> | null;
}

export interface ElementAide {
  readonly type: FaitType;
  readonly etat: EtatValeur;
  /** Vrai si la valeur vient de la portée « entreprise » (le projet n'en dit rien). */
  readonly valeurGenerale: boolean;
  /** Mention en français pour Will, ou `null` pour une valeur courante sans réserve. */
  readonly mention: string | null;
  /** Une valeur pour une valeur courante ; toutes les valeurs en conflit pour « à trancher ». */
  readonly valeurs: ReadonlyArray<ValeurAide>;
}

export interface RubriqueAide {
  readonly cle: CleRubriqueAide;
  readonly titre: string;
  readonly elements: ReadonlyArray<ElementAide>;
}

export interface AideAuDevis {
  readonly rubriques: ReadonlyArray<RubriqueAide>;
  readonly signalOpco: SignalOpco | null;
  /** Vrai si les citations sont montrées (rôle habilité). */
  readonly citationsVisibles: boolean;
  /** Vrai si rien n'a été dit pour ce projet ni pour l'entreprise. */
  readonly vide: boolean;
}

export interface EntreeAideAuDevis {
  readonly consolidation: Consolidation;
  /** `null` : devis sans projet — la partie ENTREPRISE seulement (m-8). */
  readonly projetId: string | null;
  /** Citations DÉCHIFFRÉES par fait (lues après la garde, `lireCitationsDesFaits`). */
  readonly citations: ReadonlyMap<string, string>;
  readonly role: string | null | undefined;
  readonly maintenant: Date;
}

/**
 * La mention : la table UNIQUE `MENTION_ETAT` (même phrase que sur la fiche).
 * Seule « échéance dépassée » est propre à l'aide : la fiche la montre par un
 * badge, ici elle dit ce qu'il faut faire avant de chiffrer.
 */
function mentionDe(v: ValeurConsolidee): string | null {
  if (v.etat === "courante" && v.depassee) return "échéance dépassée : à redemander";
  return MENTION_ETAT[v.etat];
}

function valeurDe(f: FaitAConsolider, e: EntreeAideAuDevis, habilite: boolean): ValeurAide {
  const citation = e.citations.get(f.id);
  return {
    texte: valeurLisible(f),
    reference: f.type === "offre_envisagee" ? f.refCatalogue : null,
    citations: habilite ? (citation !== undefined && citation !== "" ? [citation] : []) : null,
  };
}

/** Les valeurs à montrer : aucune pour une mention seule, toutes (distinctes) si à trancher. */
function valeursAffichees(
  v: ValeurConsolidee,
  e: EntreeAideAuDevis,
  habilite: boolean,
): ValeurAide[] {
  if (v.etat === "courante") return v.faits.map((f) => valeurDe(f, e, habilite)).slice(0, 5);
  if (v.etat !== "a_trancher") return [];
  const vues = new Set<string>();
  const sortie: ValeurAide[] = [];
  for (const f of v.faits) {
    const val = valeurDe(f, e, habilite);
    const cle = `${val.texte ?? ""}|${val.reference ?? ""}`;
    if (vues.has(cle)) {
      // Même valeur dite deux fois : on garde la phrase de plus, pas une ligne de plus.
      const deja = sortie.find((s) => `${s.texte ?? ""}|${s.reference ?? ""}` === cle);
      if (deja && deja.citations && val.citations) {
        sortie[sortie.indexOf(deja)] = {
          ...deja,
          citations: [...deja.citations, ...val.citations],
        };
      }
      continue;
    }
    vues.add(cle);
    sortie.push(val);
  }
  return sortie;
}

function elementsDuType(
  type: FaitType,
  projet: PorteeConsolidee | undefined,
  entreprise: PorteeConsolidee,
  e: EntreeAideAuDevis,
  habilite: boolean,
): ElementAide[] {
  const duProjet = (projet?.valeurs ?? []).filter((v) => v.type === type);
  const source = duProjet.length > 0 ? duProjet : entreprise.valeurs.filter((v) => v.type === type);
  const generale = duProjet.length === 0;
  return source.map((v) => ({
    type,
    etat: v.etat,
    valeurGenerale: generale,
    mention: mentionDe(v),
    valeurs: valeursAffichees(v, e, habilite),
  }));
}

/** Construit l'aide au devis d'un projet. */
export function aideAuDevis(e: EntreeAideAuDevis): AideAuDevis {
  const habilite = peutVoirLesEchanges(e.role);
  const projet = e.projetId === null ? undefined : e.consolidation.projets[e.projetId];
  const entreprise = e.consolidation.entreprise;
  const rubriques: RubriqueAide[] = RUBRIQUES_AIDE.map((r) => ({
    cle: r.cle,
    titre: r.titre,
    elements: (r.types as ReadonlyArray<FaitType>)
      .filter((t) => !TYPES_EXCLUS_DE_L_AIDE.has(t))
      .flatMap((t) => elementsDuType(t, projet, entreprise, e, habilite)),
  }));
  return {
    rubriques,
    signalOpco: signalEcheanceOpco(projet, e.maintenant),
    citationsVisibles: habilite,
    vide: rubriques.every((r) => r.elements.length === 0),
  };
}
