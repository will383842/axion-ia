/**
 * Lot 1 §1.4 — LES ÉCHÉANCES, toutes sessions confondues.
 *
 * ## La question à laquelle ce module répond
 *
 * Le hub répond à « où en est CETTE session ». La question quotidienne est
 * l'autre : **« qu'est-ce qui presse, toutes sessions confondues ? »** — et
 * elle n'avait aucune réponse. La page « À traiter » existait et **ignorait les
 * sessions** ; il fallait ouvrir chaque dossier pour découvrir qu'une
 * convention n'était pas signée à J-3.
 *
 * ## Un seul calcul, quatre surfaces
 *
 * `construireParcours` (pur) reste la SSOT. Ce module ne fait qu'aller chercher
 * l'état et l'aplatir. Les quatre consommateurs — page « À traiter », pastille
 * de navigation, colonne « Dossier » de la liste, moteur d'alertes — passent
 * tous par ici. Deux calculs concurrents diraient un jour deux chiffres pour la
 * même chose, et **un badge qui ment une fois n'est plus jamais regardé**.
 *
 * ## Ce qui borne le coût
 *
 * 🔴 On ne construit PAS le parcours de 1 200 sessions. Le périmètre est celui
 * où un geste reste dû : sessions `planifiee` / `en_cours`, plus les
 * `realisee` récentes (les pièces d'après-séance ont encore une échéance).
 * Au-delà, plus rien n'est ni rattrapable ni utile à afficher.
 *
 * ⚠️ Et la troncature est **déclarée**, jamais silencieuse. Un moteur qui
 * remonte les N premières sans le dire fabrique la certitude qu'il n'y a rien
 * d'autre — c'est la leçon posée par T3a sur le moteur d'alertes, au même
 * domaine.
 */

import { prisma } from "@/lib/prisma";
import { appelleUneAction, type EtatEtape } from "./etat-echeance";
import {
  construireParcours,
  type EtapeParcours,
  type SessionParcoursInput,
} from "./session-parcours";

const MS_JOUR = 24 * 60 * 60 * 1000;

/**
 * Fenêtre arrière pour les sessions déjà réalisées.
 *
 * 45 jours : le suivi à froid se recueille à J+30, sa fenêtre de relance court
 * jusqu'à J+37. Couper plus tôt ferait disparaître de « À traiter » exactement
 * l'obligation la plus oubliée. Couper beaucoup plus tard afficherait des
 * dossiers que personne ne rouvrira.
 */
const FENETRE_ARRIERE_JOURS = 45;

/** Plafond de sessions examinées en une passe. Voir `troncature`. */
const PLAFOND_SESSIONS = 300;

/**
 * La ligne Prisma telle que la requête ci-dessous la rapporte, réduite à ce
 * dont le parcours a besoin.
 *
 * Décrite explicitement plutôt qu'inférée : elle est le CONTRAT entre la
 * requête et le mapping. Inférée, un `select` amputé par mégarde ferait
 * simplement disparaître un champ du type — et l'étape correspondante se
 * calculerait sur `undefined` sans que rien ne rougisse.
 */
export interface LigneSessionParcours {
  readonly statut: string;
  readonly dateDebut: Date;
  readonly dateFin: Date;
  readonly formateurPrincipalId: string | null;
  readonly financementType: SessionParcoursInput["session"]["financementType"];
  readonly documents: SessionParcoursInput["documents"];
  readonly enrollments: ReadonlyArray<{
    readonly id: string;
    readonly statut: string;
    readonly emargementSigneAt: Date | null;
    readonly convocationEnvoyeeAt: Date | null;
    readonly questionnaires: SessionParcoursInput["inscriptions"][number]["questionnaires"];
    readonly evaluations: ReadonlyArray<{ readonly dateEvaluation: Date }>;
    readonly emargementTokens: ReadonlyArray<{ readonly id: string }>;
    readonly presences: ReadonlyArray<{ readonly id: string }>;
    readonly trainee: { readonly portailAcces: ReadonlyArray<{ readonly id: string }> };
  }>;
}

/**
 * 🔴 LE MAPPING EST UNIQUE — une seule traduction ligne Prisma → parcours.
 *
 * Il était écrit en clair dans `prochainesEcheances`. Le hub de session a
 * besoin du MÊME parcours, et le recopier aurait fabriqué deux vérités : le
 * jour où une quinzième étape arrive, l'une des deux copies l'ignore, et
 * l'écran qui compte « 12/14 » n'est plus celui qui compte « 13/15 ». C'est la
 * doctrine SSOT du dépôt, et le défaut qu'on a déjà payé sept fois sur les
 * habilitations.
 */
export function entreeParcours(
  s: LigneSessionParcours,
  signaturesParPiece: ReadonlyMap<string, { partie: string }[]>,
  maintenant: Date,
): SessionParcoursInput {
  return {
    session: {
      statut: s.statut as SessionParcoursInput["session"]["statut"],
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      formateurPrincipalId: s.formateurPrincipalId,
      financementType: s.financementType,
    },
    documents: s.documents,
    signaturesParPiece,
    inscriptions: s.enrollments.map((e) => ({
      id: e.id,
      statut: e.statut,
      emargementSigneAt: e.emargementSigneAt,
      convocationEnvoyeeAt: e.convocationEnvoyeeAt,
      questionnaires: e.questionnaires,
      evaluationFinaleAt: e.evaluations[0]?.dateEvaluation ?? null,
      aUnAccesPortail: e.trainee.portailAcces.length > 0,
    })),
    liensEmargementActifs: s.enrollments.reduce((n, e) => n + e.emargementTokens.length, 0),
    creneauxEmargement: s.enrollments.reduce((n, e) => n + e.presences.length, 0),
    maintenant,
  };
}

export interface EcheanceSession {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly dateDebut: Date;
  readonly etape: EtapeParcours;
}

export interface ResultatEcheances {
  readonly echeances: ReadonlyArray<EcheanceSession>;
  /**
   * Le parcours de chaque session du périmètre.
   *
   * `pire` / `fait` / `total` alimentent la colonne « Dossier » de la liste.
   *
   * 🔴 `etapes` porte les QUATORZE étapes, pas seulement celles qui appellent
   * une action : le hub d'une session doit montrer ce qui est FAIT autant que
   * ce qui reste, sinon la checklist se lit comme une liste de reproches. Elles
   * sont déjà construites par `construireParcours` — on les jetait.
   */
  readonly parSession: ReadonlyMap<
    string,
    {
      readonly pire: EtatEtape;
      readonly fait: number;
      readonly total: number;
      readonly etapes: ReadonlyArray<EtapeParcours>;
    }
  >;
  /**
   * 🔴 Non nul si le plafond a mordu. Une liste tronquée en silence se lit
   * comme une liste complète.
   */
  readonly troncature: { readonly examinees: number; readonly plafond: number } | null;
}

const VIDE: ResultatEcheances = { echeances: [], parSession: new Map(), troncature: null };

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Les étapes qui appellent une action, sur toutes les sessions du périmètre.
 *
 * Triées par urgence : `hors_delai`, puis `rattrapable`, puis le reste, et à
 * gravité égale par date de début. Un tri par date seule remonterait une
 * session lointaine dont tout est en règle avant une session de demain dont
 * la convention n'est pas signée.
 */
export async function prochainesEcheances(options?: {
  readonly maintenant?: Date;
  /**
   * Restreint le balayage à ces sessions.
   *
   * 🔴 C'est ce qui rend la colonne « Dossier » de la LISTE des sessions
   * possible sans casser son budget. La liste est paginée (~25 lignes) ; lui
   * faire balayer les 300 sessions du périmètre pour en afficher 25 ferait
   * exploser la sonde `sessions_liste`, mesurée à 10 ms et budgétée à 450.
   * Le Lot 0 existe précisément pour qu'on ne le découvre pas en production.
   */
  readonly sessionIds?: ReadonlyArray<string>;
}): Promise<ResultatEcheances> {
  if (isStub()) return VIDE;
  const maintenant = options?.maintenant ?? new Date();
  const bornePassee = new Date(maintenant.getTime() - FENETRE_ARRIERE_JOURS * MS_JOUR);
  const cible = options?.sessionIds;
  if (cible !== undefined && cible.length === 0) return VIDE;

  const sessions = await prisma.trainingSession.findMany({
    where:
      cible !== undefined
        ? { id: { in: [...cible] } }
        : {
            OR: [
              { statut: { in: ["planifiee", "en_cours"] } },
              { statut: "realisee", dateFin: { gte: bornePassee } },
            ],
          },
    orderBy: { dateDebut: "asc" },
    // +1 pour SAVOIR qu'on a mordu, sans rapporter la ligne excédentaire.
    // Sur un balayage ciblé, le plafond ne mord jamais : l'appelant a déjà
    // borné sa page.
    take: PLAFOND_SESSIONS + 1,
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      formateurPrincipalId: true,
      financementType: true,
      documents: {
        select: {
          id: true,
          type: true,
          numero: true,
          createdAt: true,
          annuleeAt: true,
          traineeId: true,
        },
      },
      enrollments: {
        select: {
          id: true,
          statut: true,
          emargementSigneAt: true,
          convocationEnvoyeeAt: true,
          questionnaires: { select: { type: true, envoyeAt: true, reponduAt: true } },
          evaluations: {
            where: { type: "finale" },
            orderBy: { dateEvaluation: "asc" },
            take: 1,
            select: { dateEvaluation: true },
          },
          emargementTokens: {
            where: { revokedAt: null, expiresAt: { gt: maintenant } },
            select: { id: true },
          },
          // 🔴 Les créneaux sont portés par l'INSCRIPTION, pas par la session :
          // `PresenceCreneau.enrollmentId`. Les chercher sur la session ne
          // compile pas — et c'est tant mieux, une somme sur la mauvaise
          // relation aurait compté zéro en silence.
          presences: { select: { id: true } },
          trainee: {
            select: {
              portailAcces: {
                where: { revoked: false, expiresAt: { gt: maintenant } },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  const tronque = sessions.length > PLAFOND_SESSIONS;
  const retenues = tronque ? sessions.slice(0, PLAFOND_SESSIONS) : sessions;

  // 🔴 Les signatures ne se chargent PAS session par session : une requête par
  // session, c'est le patron que T3a vient de retirer au même domaine. Une
  // seule passe sur toutes les pièces contractuelles du périmètre.
  const idsPieces = retenues.flatMap((s) => s.documents.map((d) => d.id));
  const signaturesParPiece = new Map<string, { partie: string }[]>();
  if (idsPieces.length > 0) {
    const lignes = await prisma.documentSignature.findMany({
      where: { documentGenereId: { in: idsPieces }, revokedAt: null },
      select: { documentGenereId: true, partie: true },
    });
    for (const l of lignes) {
      const liste = signaturesParPiece.get(l.documentGenereId) ?? [];
      liste.push({ partie: l.partie });
      signaturesParPiece.set(l.documentGenereId, liste);
    }
  }

  const echeances: EcheanceSession[] = [];
  const parSession = new Map<
    string,
    { pire: EtatEtape; fait: number; total: number; etapes: ReadonlyArray<EtapeParcours> }
  >();

  for (const s of retenues) {
    const parcours = construireParcours(entreeParcours(s, signaturesParPiece, maintenant));
    parSession.set(s.id, {
      pire: parcours.pire,
      fait: parcours.avancement.fait,
      total: parcours.avancement.total,
      etapes: parcours.etapes,
    });

    for (const etape of parcours.etapes) {
      if (!appelleUneAction(etape.etat)) continue;
      echeances.push({
        sessionId: s.id,
        numero: s.numero,
        titre: s.titreSession,
        dateDebut: s.dateDebut,
        etape,
      });
    }
  }

  echeances.sort(
    (a, b) =>
      URGENCE[b.etape.etat] - URGENCE[a.etape.etat] ||
      a.dateDebut.getTime() - b.dateDebut.getTime(),
  );

  return {
    echeances,
    parSession,
    troncature: tronque ? { examinees: PLAFOND_SESSIONS, plafond: PLAFOND_SESSIONS } : null,
  };
}

/**
 * Urgence d'affichage.
 *
 * ⚠️ Distincte de la gravité de `pireEtat` : ici on classe ce qu'il faut FAIRE
 * en premier. `rattrapable` passe donc devant `hors_delai` ? Non — l'inverse.
 * Un dossier hors délai réclame en plus une consignation d'écart, et c'est la
 * seule chose qu'on ne peut plus rattraper si on l'oublie.
 */
const URGENCE: Readonly<Record<EtatEtape, number>> = {
  hors_delai: 4,
  rattrapable: 3,
  a_faire: 2,
  indetermine: 1,
  fait: 0,
  sans_objet: 0,
};

/**
 * Le compteur de la pastille : les échéances **dépassées**, pas le volume.
 *
 * 🔴 Compter aussi les `a_faire` ferait une pastille qui ne descend jamais à
 * zéro — toute session à venir a des étapes en attente, par construction. La
 * doctrine des compteurs du dépôt est explicite : « le badge compte ce qu'il
 * RESTE À FAIRE, il descend à zéro ; jamais un compteur de volume, qu'on finit
 * par ignorer. »
 */
export async function compterEcheancesDepassees(options?: {
  readonly maintenant?: Date;
}): Promise<number> {
  const { echeances } = await prochainesEcheances(options);
  return echeances.filter((e) => e.etape.etat === "hors_delai" || e.etape.etat === "rattrapable")
    .length;
}
