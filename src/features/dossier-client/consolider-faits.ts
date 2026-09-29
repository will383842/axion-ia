/**
 * `consoliderFaits` — AUTORITÉ UNIQUE de la synthèse d'un client (chantier
 * visio, plan §3.5, ADR 0053). Fonction PURE : aucune lecture, aucune date
 * implicite (`maintenant` est un paramètre).
 *
 * La synthèse est CALCULÉE, jamais stockée (PA-7). Elle part des faits d'un
 * client et rend, pour la portée « entreprise » et pour CHAQUE projet
 * séparément :
 *
 *   · la VALEUR COURANTE par (type, clé) : parmi les faits validés AVEC une
 *     valeur, non remplacés, non remis en cause, non « à reconfirmer », le plus
 *     récent (date de la rencontre, puis position dans l'appel). Si une autre
 *     valeur validée DIFFÉRENTE existe — même rencontre ou non — la valeur est
 *     « à trancher » : aucune n'est choisie en silence ;
 *   · les marques « avant la réouverture du … », « dépassée » (échéance
 *     passée) et « valeur effacée » — SANS repli silencieux vers une valeur plus
 *     ancienne ;
 *   · les trous : les rubriques jamais abordées ;
 *   · les suivis ouverts (engagements, questions, objections, prochaine étape) ;
 *   · le nombre de faits proposés non validés, et de faits « à ranger ».
 *
 * 🔴 On ne compare JAMAIS deux portées. La vue d'un projet montre la valeur du
 * projet, puis À CÔTÉ la « valeur générale » de l'entreprise : un effectif dit
 * pour l'entreprise ne rend pas « à trancher » un effectif dit pour un projet.
 * Et rien d'un projet n'apparaît dans un autre.
 *
 * Ce qui en dépend : l'onglet Synthèse, la page d'un projet, « Préparer », et
 * plus tard le pré-remplissage du devis (PR 7), qui ne lit QUE des valeurs
 * `courante` — « à trancher », « à reconfirmer » ou « avant réouverture »
 * donnent une case vide avec la mention.
 */

import type {
  FaitPortee,
  FaitStatut,
  FaitSuivi,
  FaitType,
  RelationFait,
} from "../../../prisma/generated/client";
import { TYPES_DE_FAITS } from "@/server/visio/types-de-faits";

/** Un fait tel que la consolidation le lit (énoncés DÉJÀ déchiffrés par `queries.ts`). */
export interface FaitAConsolider {
  readonly id: string;
  readonly type: FaitType;
  readonly cle: string;
  readonly portee: FaitPortee;
  readonly projetId: string | null;
  readonly statut: FaitStatut;
  readonly suivi: FaitSuivi | null;
  readonly enonce: string;
  readonly texteCourt: string | null;
  readonly montantMinCents: number | null;
  readonly montantMaxCents: number | null;
  readonly dateCible: Date | null;
  readonly quantite: number | null;
  readonly refCatalogue: string | null;
  readonly constateLe: Date;
  readonly citationDebutMs: number | null;
  readonly rencontreId: string | null;
  readonly contactSujetId: string | null;
  readonly relation: RelationFait | null;
  readonly relationAvecFaitId: string | null;
  readonly remplaceParId: string | null;
}

export interface ProjetAConsolider {
  readonly id: string;
  /** Dernière réouverture (`Projet.derniereReouvertureLe`), ou `null`. */
  readonly derniereReouvertureLe: Date | null;
}

export type EtatValeur =
  /** Une seule valeur retenue : elle peut pré-remplir. */
  | "courante"
  /** Plusieurs valeurs validées différentes : Will tranche. */
  | "a_trancher"
  /** Remise en cause (« je dois revoir le budget ») : case vide. */
  | "a_reconfirmer"
  /** Dite avant la réouverture du projet : case vide. */
  | "avant_reouverture"
  /** La dernière valeur a été effacée : case vide, pas de retour à l'ancienne. */
  | "effacee";

export interface ValeurConsolidee {
  readonly type: FaitType;
  readonly cle: string;
  readonly etat: EtatValeur;
  /** Les faits en jeu, le plus récent d'abord (pour une valeur courante : le retenu en tête). */
  readonly faits: ReadonlyArray<FaitAConsolider>;
  /** Échéance passée (type `echeance`, valeur courante). */
  readonly depassee: boolean;
  /** Pour `avant_reouverture` : la date de la réouverture. */
  readonly reouvertLe: Date | null;
}

export interface PorteeConsolidee {
  /** Une entrée par (type, clé) abordé, dans l'ordre des rubriques. */
  readonly valeurs: ReadonlyArray<ValeurConsolidee>;
  /** Rubriques du compte rendu jamais abordées dans cette portée. */
  readonly trous: ReadonlyArray<number>;
  /** Faits validés dont le suivi est OUVERT, le plus récent d'abord. */
  readonly suivisOuverts: ReadonlyArray<FaitAConsolider>;
}

export interface Consolidation {
  readonly entreprise: PorteeConsolidee;
  /** Une entrée par projet FOURNI (même sans fait). */
  readonly projets: Readonly<Record<string, PorteeConsolidee>>;
  /** Faits proposés ou en attente, pas encore validés (hors « à ranger »). */
  readonly nbProposes: number;
  /** Faits pas encore rangés dans un projet (jamais validables tels quels). */
  readonly nbARanger: number;
}

// ─────────────────────────────────────────────────────────────────────────────

/** Le fait porte-t-il une VALEUR ? Un fait sans valeur n'est jamais la valeur courante. */
export function aUneValeur(f: FaitAConsolider): boolean {
  switch (f.type) {
    case "budget":
    case "prix_annonce_axion":
      return f.montantMinCents !== null || f.montantMaxCents !== null;
    case "echeance":
      return f.dateCible !== null;
    case "effectif":
    case "nb_participants":
      return f.quantite !== null;
    case "offre_envisagee":
      return f.refCatalogue !== null || (f.texteCourt ?? f.enonce).trim() !== "";
    default:
      return (f.texteCourt ?? f.enonce).trim() !== "";
  }
}

/** Clé de comparaison d'une valeur : deux faits de même valeur ne sont pas « à trancher ». */
export function valeurComparable(f: FaitAConsolider): string {
  switch (f.type) {
    case "budget":
    case "prix_annonce_axion":
      return `${f.montantMinCents ?? ""}-${f.montantMaxCents ?? ""}`;
    case "echeance":
      return f.dateCible ? f.dateCible.toISOString().slice(0, 10) : "";
    case "effectif":
    case "nb_participants":
      return String(f.quantite ?? "");
    case "offre_envisagee":
      return f.refCatalogue ?? (f.texteCourt ?? f.enonce).trim().toLowerCase();
    default:
      return (f.texteCourt ?? f.enonce).trim().toLowerCase().replace(/\s+/g, " ");
  }
}

/** Le plus récent d'abord : date de la rencontre, puis position dans l'appel. */
function plusRecentDabord(a: FaitAConsolider, b: FaitAConsolider): number {
  const d = b.constateLe.getTime() - a.constateLe.getTime();
  if (d !== 0) return d;
  return (b.citationDebutMs ?? 0) - (a.citationDebutMs ?? 0);
}

/** Relations qui RETIRENT le fait visé de la valeur courante. */
const RELATIONS_QUI_REMPLACENT: ReadonlySet<RelationFait> = new Set(["change", "precise"]);

const ORDRE_DES_TYPES = Object.keys(TYPES_DE_FAITS) as FaitType[];

function rubriqueDe(type: FaitType): number | "divers" {
  return TYPES_DE_FAITS[type].rubrique;
}

/** Rubriques qu'une portée est censée aborder (d'après la portée par défaut de chaque type). */
function rubriquesAttendues(portee: "entreprise" | "projet"): number[] {
  const r = new Set<number>();
  for (const t of ORDRE_DES_TYPES) {
    const meta = TYPES_DE_FAITS[t];
    if (meta.rubrique === "divers") continue;
    if (meta.porteeParDefaut === portee) r.add(meta.rubrique);
  }
  return [...r].sort((a, b) => a - b);
}

function consoliderUnePortee(
  faits: ReadonlyArray<FaitAConsolider>,
  portee: "entreprise" | "projet",
  reouvertLe: Date | null,
  maintenant: Date,
  // Faits VALIDÉS du client (toutes portées) : une relation posée depuis un
  // autre fait retire le fait visé, où qu'il soit.
  relations: ReadonlyArray<FaitAConsolider>,
): PorteeConsolidee {
  const retiresParRelation = new Set<string>();
  const remisEnCause = new Set<string>();
  for (const r of relations) {
    if (r.relation === null || r.relationAvecFaitId === null) continue;
    if (RELATIONS_QUI_REMPLACENT.has(r.relation)) retiresParRelation.add(r.relationAvecFaitId);
    if (r.relation === "remet_en_cause") remisEnCause.add(r.relationAvecFaitId);
  }

  // Groupement par (type, clé). Les faits `efface` restent : ils disent « la
  // dernière valeur a été effacée ».
  const groupes = new Map<string, FaitAConsolider[]>();
  for (const f of faits) {
    if (f.statut !== "valide" && f.statut !== "efface") continue;
    const k = `${f.type}\u0000${f.cle}`;
    const g = groupes.get(k);
    if (g) g.push(f);
    else groupes.set(k, [f]);
  }

  const valeurs: ValeurConsolidee[] = [];
  for (const groupe of groupes.values()) {
    const tries = [...groupe].sort(plusRecentDabord);
    const premier = tries[0];
    if (premier === undefined) continue;
    const type = premier.type;
    const cle = premier.cle;
    const unique = TYPES_DE_FAITS[type].cardinalite === "unique";

    // La plus récente trace est un effacement : case vide, jamais de retour à l'ancienne.
    const valides = tries.filter((f) => f.statut === "valide");
    if (premier.statut === "efface") {
      valeurs.push({ type, cle, etat: "effacee", faits: [], depassee: false, reouvertLe: null });
      continue;
    }

    const candidats = valides.filter(
      (f) =>
        aUneValeur(f) &&
        f.remplaceParId === null &&
        f.suivi !== "a_reconfirmer" &&
        !retiresParRelation.has(f.id) &&
        !remisEnCause.has(f.id),
    );
    const avant = reouvertLe
      ? candidats.filter((f) => f.constateLe.getTime() < reouvertLe.getTime())
      : [];
    const apres = reouvertLe
      ? candidats.filter((f) => f.constateLe.getTime() >= reouvertLe.getTime())
      : candidats;

    if (apres.length === 0) {
      // Rien de valable depuis la réouverture, ou tout a été remis en cause.
      if (avant.length > 0) {
        valeurs.push({
          type,
          cle,
          etat: "avant_reouverture",
          faits: avant,
          depassee: false,
          reouvertLe,
        });
      } else if (valides.length > 0) {
        valeurs.push({
          type,
          cle,
          etat: "a_reconfirmer",
          faits: valides,
          depassee: false,
          reouvertLe: null,
        });
      }
      continue;
    }

    if (unique) {
      const distinctes = new Set(apres.map(valeurComparable));
      const etat: EtatValeur = distinctes.size > 1 ? "a_trancher" : "courante";
      const retenu = apres[0];
      const depassee =
        etat === "courante" &&
        type === "echeance" &&
        retenu !== undefined &&
        retenu.dateCible !== null &&
        retenu.dateCible.getTime() < maintenant.getTime();
      valeurs.push({ type, cle, etat, faits: apres, depassee, reouvertLe: null });
    } else {
      // Liste : chaque valeur retenue est courante (une par fait).
      valeurs.push({
        type,
        cle,
        etat: "courante",
        faits: apres,
        depassee: false,
        reouvertLe: null,
      });
    }
  }

  valeurs.sort(
    (a, b) =>
      ORDRE_DES_TYPES.indexOf(a.type) - ORDRE_DES_TYPES.indexOf(b.type) ||
      a.cle.localeCompare(b.cle),
  );

  const abordees = new Set<number | "divers">();
  for (const f of faits) {
    if (f.statut === "valide") abordees.add(rubriqueDe(f.type));
  }
  const trous = rubriquesAttendues(portee).filter((r) => !abordees.has(r));

  const suivisOuverts = faits
    .filter((f) => f.statut === "valide" && f.suivi === "ouvert")
    .sort(plusRecentDabord);

  return { valeurs, trous, suivisOuverts };
}

/**
 * Consolide les faits d'UN client. `faits` peut contenir tous les statuts : la
 * fonction ne retient elle-même que ce qui compte.
 */
export function consoliderFaits(
  faits: ReadonlyArray<FaitAConsolider>,
  projets: ReadonlyArray<ProjetAConsolider>,
  maintenant: Date,
): Consolidation {
  const relations = faits.filter((f) => f.statut === "valide");

  const entreprise = consoliderUnePortee(
    faits.filter((f) => f.portee === "entreprise"),
    "entreprise",
    null,
    maintenant,
    relations,
  );

  const parProjet: Record<string, PorteeConsolidee> = {};
  for (const p of projets) {
    parProjet[p.id] = consoliderUnePortee(
      // 🔴 LE filtre qui empêche deux projets de se mélanger.
      faits.filter((f) => f.portee === "projet" && f.projetId === p.id),
      "projet",
      p.derniereReouvertureLe,
      maintenant,
      relations,
    );
  }

  const nbProposes = faits.filter(
    (f) => (f.statut === "propose" || f.statut === "en_attente") && f.portee !== "a_ranger",
  ).length;
  const nbARanger = faits.filter(
    (f) => f.portee === "a_ranger" && (f.statut === "propose" || f.statut === "en_attente"),
  ).length;

  return { entreprise, projets: parProjet, nbProposes, nbARanger };
}

/** La valeur retenue d'une entrée, ou `null` si elle ne peut pas pré-remplir. */
export function valeurRetenue(v: ValeurConsolidee | undefined): FaitAConsolider | null {
  if (v === undefined || v.etat !== "courante") return null;
  return v.faits[0] ?? null;
}

/** L'entrée (type, clé) d'une portée, ou la première du type si la clé est omise. */
export function trouverValeur(
  portee: PorteeConsolidee | undefined,
  type: FaitType,
  cle?: string,
): ValeurConsolidee | undefined {
  if (portee === undefined) return undefined;
  return portee.valeurs.find((v) => v.type === type && (cle === undefined || v.cle === cle));
}
