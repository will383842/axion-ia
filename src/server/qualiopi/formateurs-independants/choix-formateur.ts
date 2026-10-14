/**
 * Choisir le formateur d'une session : cartes « 1er choix · 2e · 3e » (lots
 * L11b, L11b-ux et L11h, ADR 0066) — module PUR.
 *
 * 🔑 C'est TOUJOURS une personne de l'équipe qui choisit. Rien ici ne choisit
 * à sa place : l'outil trie, grise ce qui ne peut pas être choisi (avec la
 * raison et ce qui la lèverait), et FIGE les conditions financières au moment
 * du choix. Le moteur du rang suivant (L11h) ne fait que proposer, dans
 * l'ordre décidé, le choix suivant quand le précédent ne tient plus.
 *
 * 🔑 MÊME FONCTION QUE LA GARDE (T3). Une carte n'est grisée que par
 * `evaluerAffectation` (`evaluer-affectation.ts`), et l'action qui enregistre
 * le choix relit la même évaluation : aucune carte cliquable refusée, aucune
 * carte grisée acceptée.
 *
 * 🔑 CONDITIONS FINANCIÈRES FIGÉES AU CHOIX (08 §2.5, §2.8, N8). Pour un
 * indépendant, `ChoixFormateurSession.tarifHtCents` et
 * `forfaitDeplacementParJourHtCents` sont écrits ICI, une fois, puis recopiés
 * dans `MissionFormateur` à la proposition : le montant est affiché avant le
 * « J'accepte », quel que soit le rang. Le tarif est celui du texte arrêté
 * (`TARIF_JOURNEE_HT_CENTS`, 350 € HT la journée) ; le forfait de déplacement
 * vaut 0 (« compris ») dans le même département ou à distance, et se saisit
 * dans le même geste que le rang ailleurs. Un salarié ou le dirigeant n'a ni
 * tarif ni forfait ici : leur source reste `SessionFormateur.tarifHtCents`.
 *
 * 🔑 Le RÉGIME DE TVA est figé dans le même geste (`regimeTvaFige`, lu sur la
 * fiche au choix) : la proposition, la lettre et le paiement par mission lisent
 * la même valeur, jamais une valeur recalculée ni reçue du navigateur. Un
 * indépendant dont le régime n'est pas renseigné ne se choisit pas.
 *
 * Jamais de taux de refus, jamais de silence affiché : ni ici, ni sur l'écran.
 */

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

import { PARAMETRES_ARGENT_FORMATEURS } from "./argent/parametres";
import { MANQUES_MISSION } from "./garde-mission";
import { departementDeCodePostal, regionDeDepartement } from "./departement-region";
import {
  TARIF_JOURNEE_HT_CENTS,
  creneauxDeLaJournee,
  decompterJournees,
  honorairesLettre,
  type JourLettre,
} from "./lettre-mission-v2-calcul";

/** Trois rangs au plus (décision : 1er, 2e, 3e choix). */
export const RANGS = [1, 2, 3] as const;
export type Rang = (typeof RANGS)[number];
export const RANG_MAX: Rang = 3;

export const LIBELLE_RANG: Readonly<Record<Rang, string>> = {
  1: "1er choix",
  2: "2e",
  3: "3e",
};

export function estRang(x: unknown): x is Rang {
  return x === 1 || x === 2 || x === 3;
}

/**
 * Plafond de saisie du forfait de déplacement : CELUI DU PAIEMENT (150 € HT par
 * journée, `PARAMETRES_ARGENT_FORMATEURS`). Un forfait au-dessus serait annoncé
 * puis rangé en anomalie au paiement : il ne se saisit pas.
 */
export const FORFAIT_MAX_HT_CENTS =
  PARAMETRES_ARGENT_FORMATEURS.plafondForfaitDeplacementParJourHtCents;

// ─────────────────────────────────────────────────────────────────────────────
// Proximité et forfait
// ─────────────────────────────────────────────────────────────────────────────

export interface LieuChoix {
  readonly distanciel: boolean;
  /** Code postal du lieu de la session (`TrainingSession.lieuCodePostal`). */
  readonly codePostal: string | null;
}

/**
 * La session se tient-elle à distance ? LA règle du lieu, lue par les cartes,
 * la proposition, la lettre et le paiement (08 §8, L11b : « même département
 * ou visio = 0 ») : le forfait de déplacement n'existe que sur place.
 *
 * Le lieu renseigné fait foi ; sans lieu (`lieuType` nul, session d'avant le
 * lieu de déroulement), la modalité tranche. Une session hybride a des
 * journées sur place : son forfait reste dû.
 */
export function sessionADistance(s: {
  readonly lieuType: string | null;
  readonly modalite: string;
}): boolean {
  return s.lieuType === "distanciel" || (s.lieuType === null && s.modalite === "distanciel");
}

/** Le forfait figé, sauf à distance : `null` (compris). Même règle partout. */
export function forfaitSelonLieu(
  forfaitFigeHtCents: number | null,
  lieu: { readonly lieuType: string | null; readonly modalite: string },
): number | null {
  return sessionADistance(lieu) ? null : forfaitFigeHtCents;
}

export type Proximite = "distanciel" | "meme_departement" | "meme_region" | "ailleurs" | "inconnu";

/** Ordre de tri : département, puis région, puis le reste ; lieu inconnu à la fin. */
const ORDRE_PROXIMITE: Readonly<Record<Proximite, number>> = {
  distanciel: 0,
  meme_departement: 0,
  meme_region: 1,
  ailleurs: 2,
  inconnu: 3,
};

export const LIBELLE_PROXIMITE: Readonly<Record<Proximite, string>> = {
  distanciel: "à distance",
  meme_departement: "même département",
  meme_region: "même région",
  ailleurs: "autre région",
  inconnu: "lieu inconnu",
};

export function proximite(lieu: LieuChoix, codePostalFormateur: string | null): Proximite {
  if (lieu.distanciel) return "distanciel";
  const depSession = departementDeCodePostal(lieu.codePostal);
  const depFormateur = departementDeCodePostal(codePostalFormateur);
  if (depSession === null || depFormateur === null) return "inconnu";
  if (depSession === depFormateur) return "meme_departement";
  const regSession = regionDeDepartement(depSession);
  if (regSession !== null && regSession === regionDeDepartement(depFormateur)) {
    return "meme_region";
  }
  return "ailleurs";
}

/** Même département ou à distance : le déplacement est compris (forfait 0). */
export function deplacementCompris(p: Proximite): boolean {
  return p === "distanciel" || p === "meme_departement";
}

// ─────────────────────────────────────────────────────────────────────────────
// Raisons d'une carte grisée, et ce qui les lèverait
// ─────────────────────────────────────────────────────────────────────────────

export type CodeRaison =
  "inactif" | "non_habilite" | "non_verifie" | "double_emploi" | "garde" | "session" | "erreur";

export interface Raison {
  readonly code: CodeRaison;
  /** Ce qui empêche, en clair. */
  readonly texte: string;
  /** Ce qui le lèverait, ou `null` s'il n'y a rien à faire. */
  readonly levee: string | null;
}

const LEVEE_GARDE: Readonly<Record<keyof typeof MANQUES_MISSION, string | null>> = {
  inactif: "Réactiver la fiche du formateur.",
  finCollaboration: null,
  contrat: "Faire signer et contresigner le contrat-cadre en vigueur.",
  siretContrat: "Émettre un contrat-cadre à jour, au SIRET de la fiche, et le faire signer.",
  registre: "Relancer le contrôle du registre depuis sa fiche.",
  nda: "Renseigner son numéro de déclaration d'activité.",
  vigilance: "Recevoir et valider une attestation URSSAF à jour.",
  vigilanceMission: "Recevoir et valider son attestation URSSAF avant de lui confier la mission.",
  erreur: "Réessayer dans un instant.",
};

const LEVEE_PAR_CODE: Readonly<Record<Exclude<CodeRaison, "garde">, string | null>> = {
  inactif: "Réactiver la fiche du formateur.",
  non_habilite: "Ajouter la formation à ses habilitations, depuis sa fiche.",
  non_verifie: "Vérifier son entreprise au registre, depuis sa fiche.",
  double_emploi: "Libérer l'autre prestation, ou choisir un autre formateur.",
  session: null,
  erreur: "Réessayer dans un instant.",
};

/** Une raison de la garde de mission (texte de `MANQUES_MISSION`). */
export function raisonGarde(texte: string): Raison {
  const cle = (Object.keys(MANQUES_MISSION) as Array<keyof typeof MANQUES_MISSION>).find(
    (k) => MANQUES_MISSION[k] === texte,
  );
  return { code: "garde", texte, levee: cle === undefined ? null : LEVEE_GARDE[cle] };
}

export function raison(code: Exclude<CodeRaison, "garde">, texte: string): Raison {
  return { code, texte, levee: LEVEE_PAR_CODE[code] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cartes
// ─────────────────────────────────────────────────────────────────────────────

/** « Marie D. » — jamais le nom complet sur une carte. */
export function nomCourt(prenom: string, nom: string): string {
  const p = prenom.trim();
  const initiale = nom.trim().charAt(0).toLocaleUpperCase("fr-FR");
  if (p === "") return initiale === "" ? "Formateur" : `${initiale}.`;
  return initiale === "" ? p : `${p} ${initiale}.`;
}

export interface CarteFormateur {
  readonly trainerId: string;
  readonly nomCourt: string;
  /** Formateur indépendant : tarif et forfait figés au choix. */
  readonly independant: boolean;
  /** Régime de TVA de la fiche, lu au choix (indépendant seulement). */
  readonly regimeTva?: TvaRegimeHonoraires | null;
  readonly departement: string | null;
  readonly proximite: Proximite;
  /** Vide : la carte se choisit. Sinon : grisée, avec ces raisons. */
  readonly refus: ReadonlyArray<Raison>;
  /** Dites sans bloquer (garde en « avertir »). */
  readonly avertissements: ReadonlyArray<string>;
}

export function carteChoisissable(c: CarteFormateur): boolean {
  return c.refus.length === 0;
}

function comparerCartes(a: CarteFormateur, b: CarteFormateur): number {
  return (
    ORDRE_PROXIMITE[a.proximite] - ORDRE_PROXIMITE[b.proximite] ||
    a.nomCourt.localeCompare(b.nomCourt, "fr")
  );
}

/** Disponibles triés (département, région, ailleurs) ; les autres repliés à part. */
export function trierCartes(cartes: ReadonlyArray<CarteFormateur>): {
  disponibles: CarteFormateur[];
  indisponibles: CarteFormateur[];
} {
  const tri = [...cartes].sort(comparerCartes);
  return {
    disponibles: tri.filter(carteChoisissable),
    indisponibles: tri.filter((c) => !carteChoisissable(c)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Le choix et ses conditions figées
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoixSaisi {
  readonly trainerId: string;
  readonly rang: number;
  /** Centimes HT par journée ; `null` = non saisi. Ignoré si le déplacement est compris. */
  readonly forfaitDeplacementParJourHtCents: number | null;
}

export interface ChoixFige {
  readonly trainerId: string;
  readonly rang: Rang;
  readonly tarifHtCents: number | null;
  readonly forfaitDeplacementParJourHtCents: number | null;
  /** Figé au choix avec le tarif (indépendant) ; `null` pour un salarié. */
  readonly regimeTvaFige: TvaRegimeHonoraires | null;
}

export type ResultatFigerChoix =
  | { readonly ok: true; readonly choix: ReadonlyArray<ChoixFige> }
  | { readonly ok: false; readonly erreur: string };

/**
 * Valide la saisie contre les cartes (T3 : une carte grisée n'est jamais
 * acceptée) et fige les conditions financières. Rangs 1 à n sans trou,
 * formateurs distincts, trois au plus.
 */
export function figerChoix(
  saisis: ReadonlyArray<ChoixSaisi>,
  cartes: ReadonlyArray<CarteFormateur>,
): ResultatFigerChoix {
  if (saisis.length === 0) return { ok: false, erreur: "Choisissez au moins un formateur." };
  if (saisis.length > RANG_MAX) {
    return { ok: false, erreur: `Trois choix au plus.` };
  }
  const tries = [...saisis].sort((a, b) => a.rang - b.rang);
  if (!tries.every((s, i) => s.rang === i + 1)) {
    return { ok: false, erreur: "Les choix se suivent : 1er, puis 2e, puis 3e." };
  }
  if (new Set(tries.map((s) => s.trainerId)).size !== tries.length) {
    return { ok: false, erreur: "Un même formateur ne peut occuper deux rangs." };
  }
  const parId = new Map(cartes.map((c) => [c.trainerId, c] as const));
  const choix: ChoixFige[] = [];
  for (const s of tries) {
    const c = parId.get(s.trainerId);
    if (c === undefined) return { ok: false, erreur: "Formateur introuvable dans la liste." };
    if (!carteChoisissable(c)) {
      return {
        ok: false,
        erreur: `${c.nomCourt} ne peut pas recevoir cette mission : ${c.refus.map((r) => r.texte).join(" ")}`,
      };
    }
    const rang = s.rang as Rang;
    if (!c.independant) {
      choix.push({
        trainerId: c.trainerId,
        rang,
        tarifHtCents: null,
        forfaitDeplacementParJourHtCents: null,
        regimeTvaFige: null,
      });
      continue;
    }
    const regimeTva = c.regimeTva ?? null;
    if (regimeTva === null) {
      return {
        ok: false,
        erreur: `Renseignez d'abord le régime de TVA de ${c.nomCourt} sur sa fiche : il est figé au choix, avec ses honoraires.`,
      };
    }
    let forfait: number;
    if (deplacementCompris(c.proximite)) {
      forfait = 0;
    } else {
      const f = s.forfaitDeplacementParJourHtCents;
      if (f === null || !Number.isInteger(f) || f < 0 || f > FORFAIT_MAX_HT_CENTS) {
        return {
          ok: false,
          erreur: `Indiquez le forfait de déplacement de ${c.nomCourt}, par journée (0 si compris).`,
        };
      }
      forfait = f;
    }
    choix.push({
      trainerId: c.trainerId,
      rang,
      tarifHtCents: TARIF_JOURNEE_HT_CENTS,
      forfaitDeplacementParJourHtCents: forfait,
      regimeTvaFige: regimeTva,
    });
  }
  return { ok: true, choix };
}

/** « Proposer à Marie D. (puis Paul R.) » */
export function libelleProposer(noms: ReadonlyArray<string>): string {
  const [premier, ...suivants] = noms;
  if (premier === undefined) return "Proposer";
  return suivants.length === 0
    ? `Proposer à ${premier}`
    : `Proposer à ${premier} (puis ${suivants.join(", puis ")})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rang suivant (L11h, T15)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoixEnregistre {
  readonly trainerId: string;
  readonly rang: number;
  readonly sauteAt: Date | null;
  /** Date d'écriture du choix (`updatedAt`) : un nouveau choix ouvre un nouveau tour. */
  readonly choisiLe: Date;
}

export interface SollicitationPassee {
  readonly trainerId: string;
  /** Dernière écriture de la mission (proposition, réponse, retrait…). */
  readonly faitLe: Date;
  /** Proposition en attente ou accord donné : elle tient le rang. */
  readonly vivante: boolean;
}

/** Une mission consomme le rang si elle vit encore, ou si elle a bougé depuis le choix. */
export function rangConsomme(
  c: Pick<ChoixEnregistre, "trainerId" | "choisiLe">,
  sollicitations: ReadonlyArray<SollicitationPassee>,
): boolean {
  return sollicitations.some(
    (s) => s.trainerId === c.trainerId && (s.vivante || s.faitLe.getTime() >= c.choisiLe.getTime()),
  );
}

/**
 * Les choix encore à proposer, dans l'ordre des rangs : rang 1 à 3, non
 * sautés, et pas encore consommés. Une proposition faite ou close pendant ce
 * tour (quelle qu'en soit l'issue), ou encore vivante, consomme le rang : un
 * formateur qui vient de refuser n'est jamais resollicité par le moteur.
 */
export function choixRestants(
  choix: ReadonlyArray<ChoixEnregistre>,
  sollicitations: ReadonlyArray<SollicitationPassee>,
): ChoixEnregistre[] {
  return [...choix]
    .filter((c) => estRang(c.rang) && c.sauteAt === null)
    .filter((c) => !rangConsomme(c, sollicitations))
    .sort((a, b) => a.rang - b.rang);
}

/**
 * Les seules issues qui rendent la main au rang suivant (08 §2.5 : refus,
 * silence, désistement). Un retrait ou un remplacement fait par l'équipe
 * (`retiree`, ou un accord donné dont l'affectation a été retirée) arrête la
 * chaîne : le moteur ne va jamais contre le geste de l'équipe.
 */
export const ISSUES_QUI_PASSENT_LA_MAIN = ["refusee", "sans_reponse", "desistee"] as const;

/**
 * La chaîne des choix peut-elle continuer ? Oui seulement si la DERNIÈRE
 * mission (formateur principal) de la session est celle d'un formateur du
 * choix, close par refus, silence ou désistement. Aucune mission : rien.
 */
export function chaineOuverte(
  derniere: { readonly trainerId: string; readonly statut: string } | undefined,
  trainersDuChoix: ReadonlySet<string>,
): boolean {
  if (derniere === undefined) return false;
  if (!trainersDuChoix.has(derniere.trainerId)) return false;
  return (ISSUES_QUI_PASSENT_LA_MAIN as ReadonlyArray<string>).includes(derniere.statut);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ce que la proposition montre (page F-8, e-mail F23)
// ─────────────────────────────────────────────────────────────────────────────

/** « 1 400 € » — euros entiers sans décimales, sinon au centime. Espace insécable. */
export function eurosCourts(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Montant illisible : ${cents}`);
  const entiers = Math.trunc(cents / 100);
  const reste = cents % 100;
  const groupe = String(entiers).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return reste === 0 ? `${groupe} €` : `${groupe},${String(reste).padStart(2, "0")} €`;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

export interface HonorairesProposition {
  /** « 4 journées × 350 € HT = 1 400 € HT » */
  readonly ligneHonoraires: string;
  /** « 4 × 80 € HT » ou « compris » */
  readonly ligneDeplacement: string;
  readonly honorairesHtCents: number;
  readonly deplacementHtCents: number;
  readonly totalHtCents: number;
}

/**
 * Les honoraires d'une proposition, avec la même règle que la lettre
 * (`honorairesLettre`) : rien ne se recalcule autrement entre la page et la
 * lettre. `null` si une journée manque ou si le tarif n'est pas figé.
 */
export function honorairesProposition(entree: {
  jours: ReadonlyArray<JourLettre>;
  tarifJourneeHtCents: number | null;
  forfaitDeplacementParJourHtCents: number | null;
  distanciel: boolean;
}): HonorairesProposition | null {
  if (entree.jours.length === 0 || entree.tarifJourneeHtCents === null) return null;
  const forfait = entree.distanciel ? null : entree.forfaitDeplacementParJourHtCents;
  // Au-dessus du plafond du paiement, la lettre et le paiement refusent : la
  // proposition n'annonce donc rien.
  if (forfait !== null && forfait > FORFAIT_MAX_HT_CENTS) return null;
  const joursDeplacement = forfait !== null && forfait > 0 ? entree.jours.length : 0;
  let h: ReturnType<typeof honorairesLettre>;
  try {
    h = honorairesLettre({
      jours: entree.jours,
      tarifJourneeHtCents: entree.tarifJourneeHtCents,
      forfaitDeplacementParJourHtCents: forfait,
      joursDeplacement,
    });
  } catch {
    return null;
  }
  const { journees, demiJournees } = decompterJournees(entree.jours);
  const tarif = entree.tarifJourneeHtCents;
  const termes = [
    ...(journees > 0 ? [`${pluriel(journees, "journée")} × ${eurosCourts(tarif)} HT`] : []),
    ...(demiJournees > 0
      ? [`${pluriel(demiJournees, "demi-journée")} × ${eurosCourts(tarif / 2)} HT`]
      : []),
  ];
  return {
    ligneHonoraires: `${termes.join(" + ")} = ${eurosCourts(h.honorairesHtCents)} HT`,
    ligneDeplacement:
      h.deplacementHtCents > 0 && forfait !== null
        ? `${joursDeplacement} × ${eurosCourts(forfait)} HT`
        : "compris",
    honorairesHtCents: h.honorairesHtCents,
    deplacementHtCents: h.deplacementHtCents,
    totalHtCents: h.totalHtCents,
  };
}

const JOUR_PARIS = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/** « mardi 4 novembre · matin et après-midi » — une ligne par journée. */
export function ligneJour(j: JourLettre): string {
  const d = new Date(`${j.date}T12:00:00.000Z`);
  // Le créneau PAYÉ (découpage unique du paiement), jamais une autre lecture.
  const creneaux = creneauxDeLaJournee(j);
  const moment =
    creneaux.length === 2
      ? "matin et après-midi"
      : creneaux[0] === "matin"
        ? "matin"
        : "après-midi";
  return `${JOUR_PARIS.format(d)} · ${moment}`;
}
