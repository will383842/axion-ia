/**
 * Vue « 📁 Dossiers » — dérivation du statut de pipeline (refonte console
 * phase 2, 2026-08-01, cf. `_PLANS/PLAN-REFONTE-CONSOLE-2026-08.md`).
 *
 * ## Pourquoi ce module
 *
 * Verdict de Will sur la console : « un client vit dans 6 onglets sans lien ».
 * La vue Dossiers répond à « où en est chaque affaire ? » : UNE ligne par
 * affaire, rangée dans une colonne de pipeline. Le statut n'est stocké NULLE
 * PART — il se DÉRIVE des données existantes (Devis, TrainingSession,
 * CoachingSession, AuditMission + leurs pièces, factures et dossiers de
 * financement). Une colonne stockée serait une deuxième source de vérité qui
 * divergerait un jour des tables qu'elle prétend résumer ; une colonne dérivée
 * est toujours juste, par construction.
 *
 * 🔴 Le cœur est une fonction PURE (`deriverStatutDossier`) : mêmes entrées →
 * même colonne, sans horloge implicite ni I/O. C'est elle qui porte les règles
 * métier, et c'est elle que le spec verrouille — notamment LE piège :
 * « réalisée mais impayée N'EST PAS soldée ».
 *
 * `lireDossiersPipeline()` fait le reste : requêtes minimales, mapping vers
 * des lignes affichables, groupage par colonne. Stub-safe (build GH Actions
 * sans DB, cf. ADR 0026) : chaque lecture retombe sur [] en cas d'erreur.
 */

import { prisma } from "@/lib/prisma";
import { estDansPerimetreQualiopi } from "@/server/qualiopi/perimetre";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import type {
  AuditMissionStatut,
  CoachingSessionStatut,
  DevisStatut,
  TrainingSessionStatut,
} from "../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Colonnes du pipeline
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiants des colonnes, dans l'ordre du cycle de vie d'une affaire. */
export type ColonnePipeline =
  | "devis_attente"
  | "attente_financeur"
  | "signature_attente"
  | "a_preparer"
  | "en_cours"
  | "a_solder"
  | "soldes";

/**
 * Fenêtre d'affichage des dossiers soldés : au-delà, la ligne sort de la vue
 * (pas des données). Sans cette fenêtre, la colonne « Soldés » grossirait sans
 * fin et noierait les cinq colonnes qui demandent une action.
 */
export const FENETRE_SOLDES_JOURS = 30;

/** Plafond de lignes par SOURCE (devis / sessions / coachings / audits). */
export const TAKE_MAX = 200;

/**
 * Ordre + libellés des colonnes — consommés par la page pour le rendu.
 * L'ordre EST le cycle de vie : devis → signature → préparation → réalisation
 * → solde → clos. Lire la page de gauche à droite, c'est lire la vie d'une
 * affaire.
 */
export const COLONNES_PIPELINE: ReadonlyArray<{
  id: ColonnePipeline;
  label: string;
  description: string;
}> = [
  {
    id: "devis_attente",
    label: "Devis en attente",
    description: "Devis envoyés au client, sans réponse — à relancer ou à statuer.",
  },
  {
    id: "attente_financeur",
    label: "Attente financeur",
    // 🔴 Sous-lot 8D — cette colonne manquait, et son absence coûtait cher.
    // Une session dont l'OPCO n'a pas répondu tombait dans « À préparer », au
    // MÊME endroit qu'une affaire dont l'argent est sécurisé. Le système
    // EMPÊCHE de démarrer sans accord (`validateOpcoAccord`) mais ne PRÉVENAIT
    // pas qu'il allait l'empêcher : on le découvrait le matin de la formation,
    // quand le bouton « démarrer » refuse. La faute était évitée ; la surprise,
    // non. Et un dossier qui attend trois semaines n'apparaissait nulle part.
    description:
      "Demande de prise en charge déposée, sans accord du financeur — l'argent n'est PAS sécurisé, et le démarrage sera refusé.",
  },
  {
    id: "signature_attente",
    label: "Signature en attente",
    description: "Session planifiée dont une pièce attend une signature ou un contreseing.",
  },
  {
    id: "a_preparer",
    label: "À préparer",
    description: "Prestations planifiées, pièces signées — préparer le jour J.",
  },
  {
    id: "en_cours",
    label: "En cours",
    description: "Prestations en cours de réalisation — suivre les émargements.",
  },
  {
    id: "a_solder",
    label: "À solder",
    description: "Réalisées mais PAS payées : facture impayée ou financement non clos.",
  },
  {
    id: "soldes",
    label: "Soldés",
    description: `Réalisées et payées — ${FENETRE_SOLDES_JOURS} derniers jours seulement.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Badge d'activité
// ─────────────────────────────────────────────────────────────────────────────

/** Famille d'activité d'une ligne (badge visuel de la vue). */
export type ActiviteDossier = "formation" | "coaching" | "audit";

export const ACTIVITE_LABELS: Record<ActiviteDossier, string> = {
  formation: "Formation",
  coaching: "Coaching",
  audit: "Audit",
};

// ─────────────────────────────────────────────────────────────────────────────
// Fonction pure de dérivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrées de la dérivation — une variante par source, chacune réduite aux
 * SEULS faits dont les règles ont besoin. Les booléens (`signatureEnAttente`,
 * `factureImpayee`, `financementNonSolde`) sont calculés en amont par les
 * requêtes : la fonction pure ne connaît ni Prisma ni la forme des tables,
 * elle ne juge que des faits.
 */
export type DossierSource =
  | { source: "devis"; statut: DevisStatut }
  | {
      source: "session";
      statut: TrainingSessionStatut;
      /** Une pièce de la session porte `statutSignature` ∈ {en_attente, partielle}. */
      signatureEnAttente: boolean;
      /** Une facture liée est émise / partiellement payée / en retard. */
      factureImpayee: boolean;
      /** Un dossier de financement existe et n'est ni `paiement_recu` ni `clos`. */
      financementNonSolde: boolean;
      /**
       * Sous-lot 8D — le financement est mutualisé ET l'accord n'est PAS acquis.
       *
       * 🔴 Distinct de `financementNonSolde`, qui parle d'ARGENT PAS ENCORE
       * REÇU sur une affaire déjà réalisée. Celui-ci parle d'un accord PAS
       * ENCORE DONNÉ sur une affaire qui n'a pas commencé — et qui ne pourra
       * pas commencer. Les confondre, c'est ranger « on attend le virement »
       * et « on n'a pas le droit de démarrer » dans la même case.
       */
      accordFinanceurAttendu: boolean;
      updatedAt: Date;
    }
  | {
      source: "coaching";
      statut: CoachingSessionStatut;
      factureImpayee: boolean;
      updatedAt: Date;
    }
  | {
      source: "audit";
      statut: AuditMissionStatut;
      factureImpayee: boolean;
      updatedAt: Date;
    };

/** La ligne soldée est-elle encore assez récente pour rester affichée ? */
function estDansFenetreSoldes(updatedAt: Date, maintenant: Date): boolean {
  const ageMs = maintenant.getTime() - updatedAt.getTime();
  return ageMs <= FENETRE_SOLDES_JOURS * 24 * 60 * 60 * 1000;
}

/**
 * Règle « réalisée » commune aux trois prestations (session / coaching /
 * audit) : payée → soldée (si récente), sinon → à solder.
 *
 * 🔴 LE piège métier que cette factorisation verrouille : une prestation
 * réalisée mais IMPAYÉE n'est JAMAIS soldée — et elle ne sort JAMAIS de la
 * vue, quel que soit son âge. La fenêtre de 30 jours ne s'applique qu'aux
 * dossiers réellement clos : faire vieillir une créance hors de l'écran,
 * c'est exactement comme ça qu'on oublie de se faire payer.
 */
function colonneRealisee(
  resteASolder: boolean,
  updatedAt: Date,
  maintenant: Date,
): ColonnePipeline | null {
  if (resteASolder) return "a_solder";
  return estDansFenetreSoldes(updatedAt, maintenant) ? "soldes" : null;
}

/**
 * Dérive la colonne de pipeline d'une affaire — ou `null` si l'affaire n'a pas
 * sa place dans la vue (devis brouillon, session annulée, soldée trop vieille…).
 *
 * PURE : `maintenant` est un paramètre explicite, jamais `new Date()` interne
 * — sans quoi les tests de la fenêtre des 30 jours dépendraient de l'horloge
 * de la CI (et la machine de prod est en UTC, pas en heure de Paris).
 *
 * Règles (une par branche, chacune testée dans `dossiers-pipeline.spec.ts`) :
 * - Devis `envoye` → « Devis en attente ». `brouillon` = pas encore une
 *   affaire ; `accepte`/`transforme_convention` → l'affaire continue via sa
 *   session ; `refuse`/`expire` → terminée. Tous → null.
 * - Session `planifiee` + pièce en attente de signature → « Signature en
 *   attente » ; `planifiee` sinon → « À préparer » ; `en_cours` → « En cours »
 *   (même avec une signature en retard : le jour J prime) ; `realisee` →
 *   règle commune ci-dessus ; `annulee`/`reportee` → null (exclues de la vue,
 *   pas des données — la session reportée revit via sa session de
 *   remplacement).
 * - Coaching / Audit : logique simplifiée (pas de circuit de signature suivi
 *   ici) — `planifiee` → « À préparer », `realisee` → règle commune,
 *   `en_cours` (audit seulement) → « En cours ».
 */
export function deriverStatutDossier(
  dossier: DossierSource,
  maintenant: Date,
): ColonnePipeline | null {
  switch (dossier.source) {
    case "devis":
      return dossier.statut === "envoye" ? "devis_attente" : null;

    case "session":
      switch (dossier.statut) {
        case "planifiee":
          // 🔴 Sous-lot 8D — l'attente d'accord PRIME sur l'attente de
          // signature, et ce n'est pas un détail d'ordre. Faire signer une
          // convention avant d'avoir l'accord du financeur, c'est engager le
          // client sur une prestation qui ne pourra pas démarrer. Ce qui
          // bloque en premier doit se voir en premier.
          if (dossier.accordFinanceurAttendu) return "attente_financeur";
          return dossier.signatureEnAttente ? "signature_attente" : "a_preparer";
        case "en_cours":
          return "en_cours";
        case "realisee":
          return colonneRealisee(
            dossier.factureImpayee || dossier.financementNonSolde,
            dossier.updatedAt,
            maintenant,
          );
        case "annulee":
        case "reportee":
          return null;
      }
      // Exhaustivité garantie par le switch — jamais atteint.
      return null;

    case "coaching":
      switch (dossier.statut) {
        case "planifiee":
          return "a_preparer";
        case "realisee":
          return colonneRealisee(dossier.factureImpayee, dossier.updatedAt, maintenant);
        case "annulee":
        case "reportee":
          return null;
      }
      return null;

    case "audit":
      switch (dossier.statut) {
        case "planifiee":
          return "a_preparer";
        case "en_cours":
          return "en_cours";
        case "realisee":
          return colonneRealisee(dossier.factureImpayee, dossier.updatedAt, maintenant);
        case "annulee":
        case "reportee":
          return null;
      }
      return null;
  }
}

/**
 * Le dossier est-il ARCHIVÉ ? — c'est-à-dire soldé (réalisé ET payé/clos)
 * depuis PLUS de `FENETRE_SOLDES_JOURS` jours (refonte console phase 3).
 *
 * PURE, même contrat que `deriverStatutDossier` (dont elle est le complément
 * exact pour les soldés) : elle nomme la SEULE raison pour laquelle la
 * dérivation renvoie null alors que l'affaire est terminée proprement. Les
 * autres null (devis refusé, session annulée…) ne sont PAS des archives — une
 * affaire annulée n'a jamais été soldée, elle n'a rien à faire dans une vue
 * « dossiers soldés ».
 *
 * 🔴 Un dossier resté « À solder » (impayé) n'est JAMAIS archivé, quel que
 * soit son âge : l'archivage ne doit pas devenir la porte de sortie discrète
 * des créances qu'on a oublié d'encaisser.
 */
export function estDossierArchive(dossier: DossierSource, maintenant: Date): boolean {
  // Un devis ne se « solde » pas : accepté il continue via sa session,
  // refusé/expiré il est terminé sans avoir été une prestation.
  if (dossier.source === "devis") return false;
  if (dossier.statut !== "realisee") return false;
  const resteASolder =
    dossier.source === "session"
      ? dossier.factureImpayee || dossier.financementNonSolde
      : dossier.factureImpayee;
  return !resteASolder && !estDansFenetreSoldes(dossier.updatedAt, maintenant);
}

/**
 * Sous-lot 8D — l'accord du financeur est-il encore attendu ?
 *
 * 🔴 La règle est celle de `validateOpcoAccord` (`validation-service.ts`), le
 * blocage du démarrage, **délibérément recopiée à l'identique** plutôt
 * qu'importée : ce module est la couche de LECTURE du pipeline et n'importe
 * aucun service de validation. Ce qui compte est qu'elle reste alignée — la vue
 * doit annoncer ce que la garde refusera. Le test négatif de
 * `dossiers-pipeline.spec.ts` couple les deux : si l'une bouge sans l'autre,
 * il rougit.
 *
 * ⚠️ Volontairement limitée à `opco`. Le blocage du démarrage l'est aussi, et
 * peindre en « attente financeur » un dossier CPF ou France Travail que rien
 * n'empêche de démarrer serait une alerte fausse — le pire état d'un écran de
 * pilotage. Élargir la colonne suppose d'élargir d'abord la garde.
 */
export function accordFinanceurAttendu(
  financementType: string | null | undefined,
  opcoStatut: string | null | undefined,
): boolean {
  if (financementType !== "opco") return false;
  return opcoStatut !== "accord_recu" && opcoStatut !== "paiement_recu";
}

/**
 * Prochaine action HUMAINE d'une ligne, selon sa colonne. C'est ce qui
 * distingue un pipeline d'une liste : chaque ligne dit quoi faire ensuite.
 */
export function libellerProchaineAction(
  colonne: ColonnePipeline,
  activite: ActiviteDossier,
): string {
  switch (colonne) {
    case "devis_attente":
      return "Relancer le client, ou marquer la réponse (accepté / refusé)";
    case "attente_financeur":
      return "Relancer le financeur, ou acter sa réponse — sans accord, le démarrage sera refusé";
    case "signature_attente":
      return "Faire signer la pièce en attente (ou poser le contreseing)";
    case "a_preparer":
      return activite === "formation"
        ? "Préparer la session : convocations, émargement, formateur"
        : activite === "coaching"
          ? "Préparer la séance : protocole, convocation"
          : "Préparer la mission : cadrage, lettre de mission";
    case "en_cours":
      return "Suivre la réalisation (émargements, incidents)";
    case "a_solder":
      return "Encaisser : vérifier la facture et le dossier de financement";
    case "soldes":
      return "Rien à faire — dossier soldé";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture + groupage
// ─────────────────────────────────────────────────────────────────────────────

/** Une ligne affichable de la vue Dossiers. */
export interface LigneDossier {
  /** Clé React stable, préfixée par la source (`devis:…`, `session:…`). */
  cle: string;
  colonne: ColonnePipeline;
  activite: ActiviteDossier;
  /**
   * L'affaire relève-t-elle du périmètre Qualiopi ? Dérivé via LE SSOT
   * (`src/server/qualiopi/perimetre.ts`), jamais recalculé ailleurs — pour un
   * devis à partir de son activité de facturation RÉELLE (pas du badge, qui
   * agrège implementation/site_web sous « Formation »), pour une prestation à
   * partir de sa nature (session = formation, coaching = un_a_un, audit).
   */
  qualiopi: boolean;
  /**
   * Ligne d'ARCHIVE : soldée depuis plus de `FENETRE_SOLDES_JOURS` jours.
   * Toujours false en lecture normale (ces lignes n'y existent pas) ; en mode
   * `avecArchives`, distingue les soldés récents (vue normale) des archivés.
   */
  archive: boolean;
  /** Raison sociale du client, ou « — » si l'affaire n'est pas rattachée. */
  client: string;
  intitule: string;
  /** Numéro métier (AXI-DEV-…, AXI-SESS-…) — null pour un coaching (pas de numéro). */
  reference: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  prochaineAction: string;
  /**
   * Chemin de la fiche pertinente, RELATIF à la base admin (`/${locale}/${adminPrefix}`)
   * — le module ignore volontairement locale et adminPrefix (résolus par la page).
   */
  cheminFiche: string;
}

/** Les lignes groupées par colonne — toujours les 6 clés, listes vides incluses. */
export type DossiersPipeline = Record<ColonnePipeline, LigneDossier[]>;

/** Les quatre sources lues, dans l'ordre du `Promise.all`. */
export type SourcePipeline = "devis" | "sessions" | "coachings" | "audits";

/**
 * Ce qu'une source a RÉELLEMENT lu, et ce qu'elle aurait dû lire.
 *
 * 🔴 Pourquoi ce type existe. Le module promet, quinze lignes plus bas, qu'« une
 * prestation réalisée mais IMPAYÉE n'est JAMAIS soldée — et elle ne sort JAMAIS
 * de la vue, quel que soit son âge ». Le plafond `TAKE_MAX` la fait sortir : au
 * delà de 200 sessions vivantes, triées par `updatedAt desc`, une créance
 * ancienne n'atteint même pas `deriverStatutDossier`. **La garde métier est
 * désarmée par une limite de lecture, et rien ne le disait.**
 *
 * ⚠️ `total` compte les lignes de la SOURCE, avec le même `where` que le
 * `findMany` — PAS les lignes affichées, que la dérivation écarte ensuite
 * (soldés hors fenêtre, annulés). La phrase honnête est donc « 200 sessions
 * lues sur 1 187 », jamais « 200 affichées sur 1 187 ».
 */
export interface TroncatureSource {
  source: SourcePipeline;
  /** Libellé humain, pour le bandeau. */
  label: string;
  /** Lignes effectivement lues = min(TAKE_MAX, total). */
  lues: number;
  /** Total en base pour le MÊME `where` que le `findMany`. */
  total: number;
  /** `lues < total`. Le seul booléen que la page a le droit de croire. */
  tronquee: boolean;
  /**
   * `false` si la lecture a échoué (stub de build, base indisponible).
   *
   * 🔴 Distinct de `tronquee: false` : « je sais qu'il n'y a rien de plus » et
   * « je n'ai pas pu savoir » n'appellent pas le même message. Confondre les
   * deux ferait afficher une vue rassurante sur une panne.
   */
  fiable: boolean;
}

/** Retour de `lireDossiersPipeline` : les lignes ET l'aveu de ce qui manque. */
export interface LecturePipeline {
  colonnes: DossiersPipeline;
  sources: TroncatureSource[];
  /** Au moins une source tronquée — raccourci pour le bandeau. */
  tronquee: boolean;
}

/** Libellés des sources, pour le bandeau de troncature. */
const LABELS_SOURCE: Record<SourcePipeline, string> = {
  devis: "devis en attente",
  sessions: "sessions",
  coachings: "séances de coaching",
  audits: "missions d'audit",
};

/** Statuts de facture qui signifient « de l'argent est attendu ». `brouillon`
 *  n'est pas encore une créance ; `annulee` n'en sera jamais une.
 *  Alias local du SSOT `STATUTS_FACTURE_OUVERTE` — même définition, un seul
 *  endroit où la faire évoluer. */
const STATUTS_FACTURE_IMPAYEE = STATUTS_FACTURE_OUVERTE;

/** Statuts de dossier de financement considérés SOLDÉS. Tout le reste (y
 *  compris `refuse` : un refus se solde en clôturant le dossier) retient
 *  l'affaire en « À solder » — c'est voulu, un dossier refusé non clos est un
 *  reste à charge à refacturer, pas un dossier terminé. */
const STATUTS_FINANCEMENT_SOLDE = ["paiement_recu", "clos"] as const;

/**
 * Badge d'activité d'un devis, déduit de son activité de facturation.
 * `implementation`/`site_web`/null retombent sur « Formation » : la vue n'a
 * que trois badges (décision de la phase 2) et un mauvais badge vaut mieux
 * qu'une affaire invisible.
 */
function activiteDevis(activite: string | null): ActiviteDossier {
  if (activite === "un_a_un") return "coaching";
  if (activite === "audit") return "audit";
  return "formation";
}

/** Devis envoyés (colonne « Devis en attente »). Stub-safe → []. */
/** LE `where` des devis en attente — ecrit une fois, lu deux fois. */
const WHERE_DEVIS_ENVOYES = { statut: "envoye" } as const;

async function lireDevisEnvoyes() {
  try {
    const [lignes, total] = await Promise.all([
      prisma.devis.findMany({
        where: WHERE_DEVIS_ENVOYES,
        // Les plus anciens d'abord : ce sont eux qu'on relance en premier.
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        take: TAKE_MAX,
        select: {
          id: true,
          numero: true,
          activite: true,
          statut: true,
          sentAt: true,
          dateValidite: true,
          client: { select: { raisonSociale: true } },
        },
      }),
      prisma.devis.count({ where: WHERE_DEVIS_ENVOYES }),
    ]);
    return { lignes, total, fiable: true };
  } catch {
    return { lignes: [], total: 0, fiable: false };
  }
}

/**
 * Sessions vivantes (planifiée / en cours / réalisée) avec, pour chacune, les
 * TROIS faits dont la dérivation a besoin — chaque sous-liste est bornée à
 * `take: 1` : on ne veut pas les pièces, seulement savoir s'il en EXISTE une.
 * Stub-safe → [].
 */
/** LE `where` de cette source — ecrit une fois, lu deux fois. */
function whereSessionsVivantes() {
  return { statut: { in: ["planifiee", "en_cours", "realisee"] as TrainingSessionStatut[] } };
}

async function lireSessionsVivantes() {
  try {
    const [lignes, total] = await Promise.all([
      prisma.trainingSession.findMany({
        where: whereSessionsVivantes(),
        // Activité récente d'abord : sous plafond, on sacrifie les dossiers
        // dormants, jamais ceux qui bougent.
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: TAKE_MAX,
        select: {
          id: true,
          numero: true,
          titreSession: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          updatedAt: true,
          // Sous-lot 8D — les deux champs dont dépend « attente financeur ».
          // Ce sont EXACTEMENT ceux que lit `validateOpcoAccord`, le blocage du
          // démarrage : la vue doit annoncer ce que la garde va refuser, sinon
          // elle annonce autre chose.
          financementType: true,
          opcoStatut: true,
          client: { select: { raisonSociale: true } },
          documents: {
            where: { statutSignature: { in: ["en_attente", "partielle"] } },
            select: { id: true },
            take: 1,
          },
          facturesFormation: {
            where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
            select: { id: true },
            take: 1,
          },
          dossiersFinancement: {
            where: { statut: { notIn: [...STATUTS_FINANCEMENT_SOLDE] } },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.trainingSession.count({ where: whereSessionsVivantes() }),
    ]);
    return { lignes, total, fiable: true };
  } catch {
    return { lignes: [], total: 0, fiable: false };
  }
}

/**
 * Parcours de coaching vivants. Les factures d'un coaching vivent au niveau du
 * CONTRAT (`CoachingContract.factures`), pas de la séance — c'est là qu'on
 * regarde. Stub-safe → [].
 */
/** LE `where` de cette source — ecrit une fois, lu deux fois. */
function whereCoachingsVivants() {
  return { statut: { in: ["planifiee", "realisee"] as CoachingSessionStatut[] } };
}

async function lireCoachingsVivants() {
  try {
    const [lignes, total] = await Promise.all([
      prisma.coachingSession.findMany({
        where: whereCoachingsVivants(),
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: TAKE_MAX,
        select: {
          id: true,
          interventionSlug: true,
          statut: true,
          dateSeance: true,
          dateSeanceFin: true,
          updatedAt: true,
          beneficiaireNom: true,
          beneficiaireEntreprise: true,
          coachingContract: {
            select: {
              client: { select: { raisonSociale: true } },
              factures: {
                where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.coachingSession.count({ where: whereCoachingsVivants() }),
    ]);
    return { lignes, total, fiable: true };
  } catch {
    return { lignes: [], total: 0, fiable: false };
  }
}

/** Missions d'audit vivantes. Stub-safe → []. */
/** LE `where` de cette source — ecrit une fois, lu deux fois. */
function whereAuditsVivants() {
  return { statut: { in: ["planifiee", "en_cours", "realisee"] as AuditMissionStatut[] } };
}

async function lireAuditsVivants() {
  try {
    const [lignes, total] = await Promise.all([
      prisma.auditMission.findMany({
        where: whereAuditsVivants(),
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: TAKE_MAX,
        select: {
          id: true,
          numero: true,
          titre: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          updatedAt: true,
          client: { select: { raisonSociale: true } },
          facturesFormation: {
            where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.auditMission.count({ where: whereAuditsVivants() }),
    ]);
    return { lignes, total, fiable: true };
  } catch {
    return { lignes: [], total: 0, fiable: false };
  }
}

/** Pipeline vide — les 7 colonnes présentes, aucune ligne. */
function pipelineVide(): DossiersPipeline {
  return {
    devis_attente: [],
    attente_financeur: [],
    signature_attente: [],
    a_preparer: [],
    en_cours: [],
    a_solder: [],
    soldes: [],
  };
}

/**
 * Options de lecture du pipeline (refonte console phase 3).
 *
 * `avecArchives` : inclut AUSSI les dossiers soldés au-delà de la fenêtre des
 * 30 jours, rangés en colonne « Soldés » avec `archive: true`. Le DÉFAUT reste
 * strictement le comportement de la phase 2 (archives exclues) — les appelants
 * existants et leurs tests ne voient aucune différence.
 */
export interface OptionsLectureDossiers {
  avecArchives?: boolean;
}

/**
 * Lit les quatre sources en parallèle, dérive la colonne de chaque affaire et
 * groupe. `maintenant` est injectable pour les tests ; en production, l'appel
 * sans argument prend l'instant courant (UTC — la fenêtre des 30 jours se
 * moque du fuseau à ±2 h près).
 */
export async function lireDossiersPipeline(
  maintenant: Date = new Date(),
  options: OptionsLectureDossiers = {},
): Promise<LecturePipeline> {
  const avecArchives = options.avecArchives === true;
  /**
   * Colonne + drapeau d'archive d'une affaire. La dérivation de la phase 2
   * reste LA règle ; le mode archives ne fait que repêcher le null « soldé
   * trop vieux » (et LUI SEUL — `estDossierArchive` ignore les annulés,
   * refusés et impayés).
   */
  const resoudre = (
    dossier: DossierSource,
  ): { colonne: ColonnePipeline; archive: boolean } | null => {
    const colonne = deriverStatutDossier(dossier, maintenant);
    if (colonne) return { colonne, archive: false };
    if (avecArchives && estDossierArchive(dossier, maintenant)) {
      return { colonne: "soldes", archive: true };
    }
    return null;
  };
  const [srcDevis, srcSessions, srcCoachings, srcAudits] = await Promise.all([
    lireDevisEnvoyes(),
    lireSessionsVivantes(),
    lireCoachingsVivants(),
    lireAuditsVivants(),
  ]);
  const devis = srcDevis.lignes;
  const sessions = srcSessions.lignes;
  const coachings = srcCoachings.lignes;
  const audits = srcAudits.lignes;

  const pipeline = pipelineVide();
  const ajouter = (ligne: LigneDossier) => pipeline[ligne.colonne].push(ligne);

  for (const d of devis) {
    const resolu = resoudre({ source: "devis", statut: d.statut });
    if (!resolu) continue;
    const { colonne, archive } = resolu;
    const activite = activiteDevis(d.activite);
    ajouter({
      cle: `devis:${d.id}`,
      colonne,
      activite,
      // Sur l'activité RÉELLE du devis (nullable → hors périmètre), pas sur le
      // badge : un devis site_web badgé « Formation » reste hors Qualiopi.
      qualiopi: estDansPerimetreQualiopi(d.activite),
      archive,
      client: d.client.raisonSociale,
      intitule: `Devis ${d.numero}`,
      reference: d.numero,
      dateDebut: d.sentAt,
      // La « fin » d'un devis envoyé, c'est sa date de validité : après elle,
      // il expire — l'afficher rend la relance urgente visible d'un coup d'œil.
      dateFin: d.dateValidite,
      prochaineAction: libellerProchaineAction(colonne, activite),
      cheminFiche: `/qualiopi/devis/${d.id}`,
    });
  }

  for (const s of sessions) {
    const resolu = resoudre({
      source: "session",
      statut: s.statut,
      signatureEnAttente: s.documents.length > 0,
      factureImpayee: s.facturesFormation.length > 0,
      financementNonSolde: s.dossiersFinancement.length > 0,
      accordFinanceurAttendu: accordFinanceurAttendu(s.financementType, s.opcoStatut),
      updatedAt: s.updatedAt,
    });
    if (!resolu) continue;
    ajouter({
      cle: `session:${s.id}`,
      colonne: resolu.colonne,
      activite: "formation",
      // Une session de formation collective est par nature « formation ».
      qualiopi: estDansPerimetreQualiopi("formation"),
      archive: resolu.archive,
      client: s.client?.raisonSociale ?? "—",
      intitule: s.titreSession,
      reference: s.numero,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      prochaineAction: libellerProchaineAction(resolu.colonne, "formation"),
      cheminFiche: `/qualiopi/sessions/${s.id}`,
    });
  }

  for (const c of coachings) {
    const resolu = resoudre({
      source: "coaching",
      statut: c.statut,
      factureImpayee: (c.coachingContract?.factures.length ?? 0) > 0,
      updatedAt: c.updatedAt,
    });
    if (!resolu) continue;
    ajouter({
      cle: `coaching:${c.id}`,
      colonne: resolu.colonne,
      activite: "coaching",
      // Coaching 1-to-1 = « un_a_un » dans la taxonomie de facturation. C'est
      // du CONSEIL, HORS périmètre Qualiopi depuis la décision Will du
      // 2026-07-17 (doctrine AFEST abandonnée, confirmée le 2026-08-10) :
      // `estDansPerimetreQualiopi("un_a_un")` renvoie `false` (SSOT
      // perimetre.ts, `un_a_un: false`).
      qualiopi: estDansPerimetreQualiopi("un_a_un"),
      archive: resolu.archive,
      // Le « client » d'un coaching : le client du contrat s'il existe, sinon
      // l'entreprise du bénéficiaire, sinon le bénéficiaire lui-même (ad hoc).
      client:
        c.coachingContract?.client?.raisonSociale ??
        c.beneficiaireEntreprise ??
        c.beneficiaireNom ??
        "—",
      // Le slug d'intervention est la seule désignation portée par la séance ;
      // dé-slugifié pour rester lisible sans jointure sur le catalogue.
      intitule: c.interventionSlug.replace(/-/g, " "),
      reference: null,
      dateDebut: c.dateSeance,
      dateFin: c.dateSeanceFin,
      prochaineAction: libellerProchaineAction(resolu.colonne, "coaching"),
      cheminFiche: `/coaching/seances/${c.id}`,
    });
  }

  for (const a of audits) {
    const resolu = resoudre({
      source: "audit",
      statut: a.statut,
      factureImpayee: a.facturesFormation.length > 0,
      updatedAt: a.updatedAt,
    });
    if (!resolu) continue;
    ajouter({
      cle: `audit:${a.id}`,
      colonne: resolu.colonne,
      activite: "audit",
      // Un audit est une prestation de CONSEIL : hors périmètre, dixit le SSOT.
      qualiopi: estDansPerimetreQualiopi("audit"),
      archive: resolu.archive,
      client: a.client?.raisonSociale ?? "—",
      intitule: a.titre,
      reference: a.numero,
      dateDebut: a.dateDebut,
      dateFin: a.dateFin,
      prochaineAction: libellerProchaineAction(resolu.colonne, "audit"),
      cheminFiche: `/qualiopi/audits/${a.id}`,
    });
  }

  const sources: TroncatureSource[] = (
    [
      ["devis", srcDevis] as const,
      ["sessions", srcSessions] as const,
      ["coachings", srcCoachings] as const,
      ["audits", srcAudits] as const,
    ] satisfies ReadonlyArray<
      readonly [SourcePipeline, { lignes: unknown[]; total: number; fiable: boolean }]
    >
  ).map(([source, src]) => ({
    source,
    label: LABELS_SOURCE[source],
    lues: src.lignes.length,
    total: src.total,
    // `fiable: false` ⇒ jamais `tronquee: true` : on n'accuse pas une troncature
    // qu'on n'a pas pu mesurer. L'écran distingue les deux (cf. `TroncatureSource`).
    tronquee: src.fiable && src.lignes.length < src.total,
    fiable: src.fiable,
  }));

  return { colonnes: pipeline, sources, tronquee: sources.some((s) => s.tronquee) };
}
