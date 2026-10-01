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
import {
  dateMax as max,
  etatVerrouDossier,
  type EntreeVerrouDossier,
  type EtatVerrouDossier,
  type EvenementDossierEntree,
  type StatutSessionVerrou,
  type TypeEvenementDossier,
} from "./verrou-dossier-pur";

// Le prédicat, les types et les textes vivent dans le module pur ; ce fichier
// les ré-exporte pour que tous les appelants existants restent inchangés.
export * from "./verrou-dossier-pur";

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
