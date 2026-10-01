/**
 * 🔴 ADR 0060 — LE VERROU DU DOSSIER DE SESSION. Source UNIQUE (RM-01).
 *
 * ## Ce que ce module décide
 *
 * Quand une session est « Réalisée » et que chaque stagiaire encore inscrit a
 * SA propre attestation vivante, le dossier est une preuve : il ne doit plus
 * bouger sans que cela se voie. Le verrou n'est PAS un statut — la machine à
 * états de `TrainingSession` reste intacte, `realisee` reste final — c'est un
 * état DÉRIVÉ, recalculé à chaque lecture depuis les pièces et le journal
 * append-only `session_dossier_evenements`.
 *
 * L'écran, les Server Actions (`assertDossierOuvert`), les workers, le parcours
 * et le dossier d'audit lisent TOUS cette fonction. Aucune autre copie de la
 * règle n'est permise : c'est une règle recopiée qui laisse une porte ouverte.
 *
 * ## Le prédicat (décision du dirigeant, 30/09/2026)
 *
 * Le dossier est `clos` quand :
 *   (a) `statut = realisee` ;
 *   (b) chaque inscription ACTIVE (hors abandon et exclu) a SA propre
 *       attestation vivante — rapprochement PAR INSCRIPTION via
 *       `attestationDocumentId`, jamais par comptage : deux attestations pour A
 *       et zéro pour B ne font pas un dossier complet ;
 *   (c) aucun jeton d'émargement n'est encore valide pour une inscription
 *       active (le jeton expire à fin + 48 h) : tant qu'un stagiaire peut
 *       encore signer, rien n'est figé.
 *
 * Le DERNIER événement de réouverture/reverrouillage prime : après une
 * `reouverture`, le dossier est `rouvert` quelles que soient (a), (b), (c).
 *
 * Les recueils qui arrivent APRÈS l'attestation (questionnaire à froid à J+30,
 * contreseings restants) ne retardent pas le verrou : ils restent ouverts
 * pendant que le dossier est clos (classement ENTRANTE du registre).
 *
 * Module sans `"use server"` : importable par les workers et les tests.
 */

import { prisma } from "@/lib/prisma";
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

function max(dates: ReadonlyArray<Date | null | undefined>): Date | null {
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
    max([
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

// ─────────────────────────────────────────────────────────────────────────────
// Chargeurs (Prisma)
// ─────────────────────────────────────────────────────────────────────────────

/** Client Prisma ou transaction interactive. */
type ClientLecture = Pick<typeof prisma, "trainingSession" | "sessionDossierEvenement">;

function selectSession() {
  return {
    id: true,
    statut: true,
    transitions: {
      where: { toStatus: "realisee" as const },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" as const },
      take: 1,
    },
    enrollments: {
      select: {
        id: true,
        statut: true,
        sortieAt: true,
        trainee: { select: { prenom: true, nom: true } },
        attestationDocument: { select: { type: true, annuleeAt: true, createdAt: true } },
        // TOUS les jetons (valides, expirés, révoqués) : les valides disent si
        // l'émargement est encore ouvert, les autres QUAND il s'est fermé —
        // la date de clôture ne peut pas précéder cette fermeture.
        emargementTokens: {
          select: { expiresAt: true, revokedAt: true },
        },
        emargementSignatures: {
          select: { signeAt: true },
          orderBy: { signeAt: "desc" as const },
          take: 1,
        },
      },
    },
  };
}

interface LigneSession {
  id: string;
  statut: string;
  transitions: Array<{ createdAt: Date }>;
  enrollments: Array<{
    id: string;
    statut: string;
    sortieAt: Date | null;
    trainee: { prenom: string; nom: string };
    attestationDocument: { type: string; annuleeAt: Date | null; createdAt: Date } | null;
    emargementTokens: Array<{ expiresAt: Date; revokedAt: Date | null }>;
    emargementSignatures: Array<{ signeAt: Date }>;
  }>;
}

function entreeDepuisLigne(
  s: LigneSession,
  evenements: EvenementDossierEntree[],
  maintenant: Date,
): EntreeVerrouDossier {
  return {
    statut: s.statut as StatutSessionVerrou,
    realiseeLe: s.transitions[0]?.createdAt ?? null,
    evenements,
    maintenant,
    inscriptions: s.enrollments.map((e) => {
      const t = maintenant.getTime();
      const valides = e.emargementTokens
        .filter((j) => j.revokedAt === null && j.expiresAt.getTime() > t)
        .map((j) => j.expiresAt);
      // Fin de fenêtre de chaque jeton : sa révocation si elle précède son
      // expiration. Seules les fins DÉJÀ passées comptent pour la clôture.
      const fermetures = e.emargementTokens
        .map((j) =>
          j.revokedAt !== null && j.revokedAt.getTime() < j.expiresAt.getTime()
            ? j.revokedAt
            : j.expiresAt,
        )
        .filter((d) => d.getTime() <= t);
      return {
        id: e.id,
        statut: e.statut,
        stagiaire: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
        sortieAt: e.sortieAt,
        attestation: e.attestationDocument,
        jetonEmargementValideJusquA: max(valides),
        emargementFermeLe: max([...fermetures, ...e.emargementSignatures.map((x) => x.signeAt)]),
      };
    }),
  };
}

/**
 * Lit les événements du dossier. Tolère l'absence de la table pendant la
 * fenêtre de déploiement (worker bâti avant la migration de l'app) : sans
 * table, « aucun événement » — le verrou se calcule alors sur les pièces
 * seules, ce qui FERME (un dossier rouvert paraîtrait clos) plutôt qu'ouvrir.
 */
async function lireEvenements(
  client: ClientLecture,
  sessionIds: string[],
): Promise<Map<string, EvenementDossierEntree[]>> {
  const out = new Map<string, EvenementDossierEntree[]>();
  if (sessionIds.length === 0) return out;
  let lignes: Array<{
    sessionId: string;
    type: TypeEvenementDossier;
    createdAt: Date;
    auteurNom: string;
    motif: string | null;
  }> = [];
  try {
    lignes = await client.sessionDossierEvenement.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, type: true, createdAt: true, auteurNom: true, motif: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  for (const l of lignes ?? []) {
    const lot = out.get(l.sessionId) ?? [];
    lot.push({ type: l.type, createdAt: l.createdAt, auteurNom: l.auteurNom, motif: l.motif });
    out.set(l.sessionId, lot);
  }
  return out;
}

function tableAbsente(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  return code === "P2021" || /session_dossier_evenements.*does not exist/i.test(message);
}

/**
 * L'état du dossier d'UNE session, `null` si elle n'existe pas.
 *
 * @param tx transaction interactive, pour relire l'état DANS la transaction
 *           qui écrit un événement (réouverture, reverrouillage).
 */
export async function chargerEtatVerrou(
  sessionId: string,
  tx?: ClientLecture,
  maintenant: Date = new Date(),
): Promise<{
  statut: StatutSessionVerrou;
  etat: EtatVerrouDossier;
  entree: EntreeVerrouDossier;
} | null> {
  const client = tx ?? prisma;
  const s = (await client.trainingSession.findUnique({
    where: { id: sessionId },
    select: selectSession(),
  })) as LigneSession | null;
  if (s === null) return null;
  const evenements = (await lireEvenements(client, [sessionId])).get(sessionId) ?? [];
  const entree = entreeDepuisLigne(s, evenements, maintenant);
  return { statut: entree.statut, etat: etatVerrouDossier(entree), entree };
}

/** Les états de plusieurs sessions en DEUX requêtes (liste des sessions, L4). */
export async function chargerEtatsVerrou(
  sessionIds: ReadonlyArray<string>,
  maintenant: Date = new Date(),
): Promise<Map<string, { statut: StatutSessionVerrou; etat: EtatVerrouDossier }>> {
  const ids = [...new Set(sessionIds)];
  const out = new Map<string, { statut: StatutSessionVerrou; etat: EtatVerrouDossier }>();
  if (ids.length === 0) return out;
  const lignes = (await prisma.trainingSession.findMany({
    where: { id: { in: ids } },
    select: selectSession(),
  })) as LigneSession[];
  const evenements = await lireEvenements(prisma, ids);
  for (const s of lignes) {
    const entree = entreeDepuisLigne(s, evenements.get(s.id) ?? [], maintenant);
    out.set(s.id, { statut: entree.statut, etat: etatVerrouDossier(entree) });
  }
  return out;
}

/** Ce qu'une écriture sait de sa cible, pour retrouver la session. */
export type RefSession =
  | { readonly sessionId: string }
  | { readonly enrollmentId: string }
  | { readonly documentId: string }
  | { readonly creneauId: string }
  | { readonly questionnaireId: string }
  | { readonly incidentId: string }
  | { readonly signatureDocumentId: string }
  | { readonly signatureEmargementId: string }
  | { readonly jourId: string }
  | { readonly importReleveId: string };

/**
 * Résout la session visée par une écriture. `null` = la cible n'est rattachée
 * à aucune session (pièce hors session, incident libre) ou n'existe pas : la
 * garde laisse alors l'action répondre elle-même (« introuvable »).
 */
export async function resoudreSessionId(ref: RefSession): Promise<string | null> {
  if ("sessionId" in ref) return ref.sessionId;
  if ("enrollmentId" in ref) {
    const e = await prisma.enrollment.findUnique({
      where: { id: ref.enrollmentId },
      select: { sessionId: true },
    });
    return e?.sessionId ?? null;
  }
  if ("documentId" in ref) {
    const d = await prisma.documentGenere.findUnique({
      where: { id: ref.documentId },
      select: { sessionId: true },
    });
    return d?.sessionId ?? null;
  }
  if ("creneauId" in ref) {
    const c = await prisma.presenceCreneau.findUnique({
      where: { id: ref.creneauId },
      select: { enrollment: { select: { sessionId: true } } },
    });
    return c?.enrollment.sessionId ?? null;
  }
  if ("questionnaireId" in ref) {
    const q = await prisma.questionnaire.findUnique({
      where: { id: ref.questionnaireId },
      select: { enrollment: { select: { sessionId: true } } },
    });
    return q?.enrollment.sessionId ?? null;
  }
  if ("incidentId" in ref) {
    const i = await prisma.incident.findUnique({
      where: { id: ref.incidentId },
      select: { sessionId: true },
    });
    return i?.sessionId ?? null;
  }
  if ("signatureDocumentId" in ref) {
    const s = await prisma.documentSignature.findUnique({
      where: { id: ref.signatureDocumentId },
      select: { documentGenere: { select: { sessionId: true } } },
    });
    return s?.documentGenere.sessionId ?? null;
  }
  if ("signatureEmargementId" in ref) {
    const s = await prisma.emargementSignature.findUnique({
      where: { id: ref.signatureEmargementId },
      select: { enrollment: { select: { sessionId: true } } },
    });
    return s?.enrollment?.sessionId ?? null;
  }
  if ("importReleveId" in ref) {
    const r = await prisma.releveConnexionImport.findUnique({
      where: { id: ref.importReleveId },
      select: { sessionId: true },
    });
    return r?.sessionId ?? null;
  }
  const j = await prisma.sessionJour.findUnique({
    where: { id: ref.jourId },
    select: { sessionId: true },
  });
  return j?.sessionId ?? null;
}
