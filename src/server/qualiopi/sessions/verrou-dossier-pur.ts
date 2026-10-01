/**
 * ADR 0060 — LE PRÉDICAT DU VERROU, sans aucune dépendance d'E/S.
 *
 * Extrait tel quel de `verrou-dossier.ts` (qui le ré-exporte) pour que les
 * modules PURS — le parcours d'une session (`session-parcours.ts`) au premier
 * chef — lisent la MÊME règle sans importer Prisma. Ce n'est pas une copie :
 * c'est l'unique définition (RM-01), et `verrou-dossier.ts` n'y ajoute que
 * les chargeurs.
 */

import { STATUTS_SORTIS } from "@/server/qualiopi/inscriptions/inscriptions-actives";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatutSessionVerrou = "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

export type TypeEvenementDossier = "reouverture" | "reverrouillage";

/** Types de pièce qui valent attestation de fin de formation. */
export const TYPES_ATTESTATION = ["attestation", "attestation_partielle"] as const;

export interface EvenementDossierEntree {
  readonly type: TypeEvenementDossier;
  readonly createdAt: Date;
  readonly auteurNom: string;
  readonly motif: string | null;
}

export interface InscriptionVerrouEntree {
  readonly id: string;
  readonly statut: string;
  /** « Prénom Nom », pour nommer le manquant. */
  readonly stagiaire: string;
  readonly sortieAt: Date | null;
  /**
   * La pièce désignée par `enrollment.attestationDocumentId`, telle qu'elle
   * est en base — `null` si la colonne est vide OU si la pièce n'existe plus.
   */
  readonly attestation: {
    readonly type: string;
    readonly annuleeAt: Date | null;
    readonly createdAt: Date;
  } | null;
  /** Expiration du jeton d'émargement VALIDE le plus tardif, `null` s'il n'y en a aucun. */
  readonly jetonEmargementValideJusquA: Date | null;
  /**
   * 🔴 Revue PR #1245 — la dernière trace d'émargement DÉJÀ PASSÉE : fin de
   * fenêtre d'un jeton (expiration, ou révocation si elle vient avant) ou
   * signature. Le dossier ne peut pas être clos avant elle (condition c) : la
   * date de clôture ne doit donc jamais la précéder, sans quoi le dossier
   * annonce des preuves « figées » à une date antérieure à l'une d'elles.
   */
  readonly emargementFermeLe?: Date | null;
}

export interface EntreeVerrouDossier {
  readonly statut: StatutSessionVerrou;
  /** Date du passage à `realisee` (dernière `FormationTransition` vers realisee). */
  readonly realiseeLe: Date | null;
  readonly inscriptions: ReadonlyArray<InscriptionVerrouEntree>;
  readonly evenements: ReadonlyArray<EvenementDossierEntree>;
  readonly maintenant: Date;
}

export type RaisonManquant = "attestation_absente" | "attestation_annulee" | "emargement_ouvert";

export interface ManquantVerrou {
  readonly enrollmentId: string;
  readonly stagiaire: string;
  readonly raison: RaisonManquant;
  /** Pour `emargement_ouvert` : jusqu'à quand le stagiaire peut encore signer. */
  readonly jusquA?: Date;
}

export type EtatVerrouDossier =
  | { readonly etat: "en_preparation" }
  | { readonly etat: "en_cours" }
  | { readonly etat: "a_recueillir"; readonly manquants: ReadonlyArray<ManquantVerrou> }
  | { readonly etat: "clos"; readonly depuis: Date }
  | {
      readonly etat: "rouvert";
      readonly depuis: Date;
      readonly par: string;
      readonly motif: string;
    }
  | { readonly etat: "hors_parcours"; readonly statut: "annulee" | "reportee" };

export type NomEtatVerrou = EtatVerrouDossier["etat"];

export type PhaseDossier = "preparer" | "jour_j" | "apres" | "cloturee" | "hors_parcours";

// ─────────────────────────────────────────────────────────────────────────────
// Prédicat pur
// ─────────────────────────────────────────────────────────────────────────────

function estSortie(statut: string): boolean {
  return (STATUTS_SORTIS as ReadonlyArray<string>).includes(statut);
}

/**
 * Ce qui manque pour que le dossier d'une session RÉALISÉE soit clos, conditions
 * (b) et (c), inscription par inscription. Liste vide = conditions remplies.
 *
 * ⚠️ N'examine PAS le statut ni les événements : c'est aussi la liste que le
 * reverrouillage manuel exige vide, et qu'il affiche quand il refuse.
 */
export function manquantsPourClore(entree: EntreeVerrouDossier): ManquantVerrou[] {
  const out: ManquantVerrou[] = [];
  for (const i of entree.inscriptions) {
    if (estSortie(i.statut)) continue;
    const a = i.attestation;
    if (a === null || !(TYPES_ATTESTATION as ReadonlyArray<string>).includes(a.type)) {
      out.push({ enrollmentId: i.id, stagiaire: i.stagiaire, raison: "attestation_absente" });
    } else if (a.annuleeAt !== null) {
      out.push({ enrollmentId: i.id, stagiaire: i.stagiaire, raison: "attestation_annulee" });
    }
    if (
      i.jetonEmargementValideJusquA !== null &&
      i.jetonEmargementValideJusquA.getTime() > entree.maintenant.getTime()
    ) {
      out.push({
        enrollmentId: i.id,
        stagiaire: i.stagiaire,
        raison: "emargement_ouvert",
        jusquA: i.jetonEmargementValideJusquA,
      });
    }
  }
  return out;
}

function dernier(evenements: ReadonlyArray<EvenementDossierEntree>): EvenementDossierEntree | null {
  let d: EvenementDossierEntree | null = null;
  for (const e of evenements) {
    if (d === null || e.createdAt.getTime() >= d.createdAt.getTime()) d = e;
  }
  return d;
}

export function dateMax(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let m: Date | null = null;
  for (const d of dates) {
    if (d == null) continue;
    if (m === null || d.getTime() > m.getTime()) m = d;
  }
  return m;
}

/**
 * L'état du dossier. Fonction PURE : toutes les dates viennent de l'entrée,
 * `maintenant` compris.
 */
export function etatVerrouDossier(entree: EntreeVerrouDossier): EtatVerrouDossier {
  if (entree.statut === "annulee" || entree.statut === "reportee") {
    return { etat: "hors_parcours", statut: entree.statut };
  }
  const ev = dernier(entree.evenements);
  if (ev !== null && ev.type === "reouverture") {
    return {
      etat: "rouvert",
      depuis: ev.createdAt,
      par: ev.auteurNom,
      motif: ev.motif ?? "",
    };
  }
  if (entree.statut === "planifiee") return { etat: "en_preparation" };
  if (entree.statut === "en_cours") return { etat: "en_cours" };

  const manquants = manquantsPourClore(entree);
  if (manquants.length > 0) return { etat: "a_recueillir", manquants };

  if (ev !== null && ev.type === "reverrouillage") return { etat: "clos", depuis: ev.createdAt };

  const actives = entree.inscriptions.filter((i) => !estSortie(i.statut));
  const depuis =
    dateMax([
      entree.realiseeLe,
      ...actives.map((i) => i.attestation?.createdAt ?? null),
      ...entree.inscriptions.map((i) => i.sortieAt),
      ...actives.map((i) => i.emargementFermeLe ?? null),
    ]) ?? entree.maintenant;
  return { etat: "clos", depuis };
}

/**
 * 🔴 INTERRUPTEUR DE SECOURS (demande du dirigeant, 2026-09-30 : « ne rien
 * casser »). `QUALIOPI_VERROU_DOSSIER=off` sur l'app ET le worker, puis
 * redémarrage : plus aucune écriture n'est refusée pour cause de dossier clos,
 * sans redéploiement. L'ÉTAT, lui, continue d'être calculé et affiché tel quel
 * (dossier d'audit, fiche) : l'interrupteur coupe le blocage, jamais la vérité.
 * Toute autre valeur, ou l'absence de la variable, laisse le verrou actif.
 */
export function verrouDossierActif(): boolean {
  return (process.env["QUALIOPI_VERROU_DOSSIER"] ?? "").trim().toLowerCase() !== "off";
}

/** Vrai quand les écritures classées VERROU doivent être refusées. */
export function dossierFige(etat: EtatVerrouDossier): boolean {
  return verrouDossierActif() && etat.etat === "clos";
}

/**
 * La phase affichée (L2/L3 : onglet par défaut de la fiche ; L4 : liste).
 *
 * `rouvert` et `a_recueillir` restent dans « Après » : il y a quelque chose à
 * faire. Seul un dossier `clos` est « Clôturé ».
 */
export function phaseDossier(statut: StatutSessionVerrou, etat: EtatVerrouDossier): PhaseDossier {
  if (etat.etat === "hors_parcours" || statut === "annulee" || statut === "reportee") {
    return "hors_parcours";
  }
  if (etat.etat === "clos") return "cloturee";
  if (statut === "planifiee") return "preparer";
  if (statut === "en_cours") return "jour_j";
  return "apres";
}

// ─────────────────────────────────────────────────────────────────────────────
// Texte — source unique de l'écran ET du dossier d'audit
// ─────────────────────────────────────────────────────────────────────────────

const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const FMT_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 30/09/2026 à 14:05 (heure de Paris) ». */
export function dateHeureParis(d: Date): string {
  return `${FMT_JOUR.format(d)} à ${FMT_HEURE.format(d)} (heure de Paris)`;
}

/** « 30/09/2026 » (heure de Paris). */
export function dateParis(d: Date): string {
  return FMT_JOUR.format(d);
}

const LIBELLE_RAISON: Record<RaisonManquant, string> = {
  attestation_absente: "attestation à émettre",
  attestation_annulee: "attestation annulée, à réémettre",
  emargement_ouvert: "émargement encore signable",
};

/** Une ligne par manquant : « Prénom Nom — attestation à émettre ». */
export function libelleManquant(m: ManquantVerrou): string {
  const suffixe =
    m.raison === "emargement_ouvert" && m.jusquA !== undefined
      ? ` (jusqu'au ${dateHeureParis(m.jusquA)})`
      : "";
  return `${m.stagiaire} — ${LIBELLE_RAISON[m.raison]}${suffixe}`;
}

/**
 * Le texte de l'état, MOT POUR MOT le même à l'écran (bandeau) et dans le
 * dossier d'audit remis au certificateur. Deux formulations divergentes
 * feraient deux vérités.
 */
export function texteEtatVerrou(etat: EtatVerrouDossier): string {
  switch (etat.etat) {
    case "en_preparation":
      return "Dossier en préparation : la session n'a pas commencé, tout reste modifiable.";
    case "en_cours":
      return "Session en cours : le dossier se constitue, tout reste modifiable.";
    case "a_recueillir": {
      const n = etat.manquants.length;
      return (
        `Session réalisée, dossier pas encore clos : ${n} élément${n > 1 ? "s" : ""} à recueillir — ` +
        etat.manquants.map(libelleManquant).join(" ; ") +
        ". Le dossier se fermera de lui-même quand tout sera recueilli."
      );
    }
    case "clos":
      return (
        `Dossier clos le ${dateParis(etat.depuis)} : les pièces et les preuves de cette session sont figées. ` +
        "Restent possibles la lecture, les téléchargements, le recueil entrant des stagiaires " +
        "(questionnaire à froid, signatures restantes), les contreseings restants, les demandes RGPD " +
        "et le suivi financier. Toute autre modification exige de rouvrir le dossier, avec un motif tracé " +
        "et visible par l'auditeur."
      );
    case "rouvert":
      return (
        `Dossier rouvert le ${dateHeureParis(etat.depuis)} par ${etat.par} — motif : « ${etat.motif} ». ` +
        "Les modifications sont possibles et journalisées ; le dossier doit être clos à nouveau."
      );
    case "hors_parcours":
      return etat.statut === "annulee"
        ? "Session annulée : hors du parcours de réalisation."
        : "Session reportée : hors du parcours de réalisation (voir la session de remplacement).";
  }
}

/** Message du refus d'une écriture sur un dossier clos (garde `assertDossierOuvert`). */
export function messageDossierClos(depuis: Date): string {
  return (
    `Dossier clos le ${dateParis(depuis)} : cette modification est refusée pour préserver la preuve. ` +
    "Pour corriger, rouvrez le dossier (bouton « Rouvrir le dossier », motif obligatoire, tracé et visible par l'auditeur)."
  );
}
