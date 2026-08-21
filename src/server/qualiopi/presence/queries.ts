/**
 * Qualiopi — Lectures serveur pour l'émargement et les créneaux de présence.
 *
 * Stub-safe (try/catch → [] / null). Jamais de `*OrThrow`.
 * Ces fonctions sont exclusivement appelées depuis des Server Components.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { arrondirTauxMoyen, bornesPagination, debutFenetreSessions } from "./sessions-liste";
import type {
  EnrollmentStatut,
  PresenceCreneau,
  Prisma,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types composés
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionEmargementRow {
  session: {
    id: string;
    numero: string;
    titreSession: string | null;
    dateDebut: Date;
    dateFin: Date;
    dureeReelleHeures: number | null;
    modalite: string;
    statut: string;
    formationId: string;
    nbParticipantsPrevus: number;
    nbParticipantsReels: number | null;
  };
  enrollments: Array<{
    id: string;
    traineeId: string;
    statut: string;
    tauxPresencePct: number | null;
    emargementSigneAt: Date | null;
    trainee: {
      nom: string;
      prenom: string;
      email: string;
    };
  }>;
  creneaux: PresenceCreneau[];
  /**
   * Journées RÉELLEMENT animées (décision D14), ordonnées.
   *
   * Tableau vide = la session n'en déclare aucune et retombe sur
   * `dateDebut..dateFin` — ce qui n'est correct que si les journées se suivent.
   */
  jours: Array<{
    date: string;
    heureDebut: string;
    heureFin: string;
    /** Faux tant que ce sont les horaires PROPOSÉS à la création de la session. */
    horairesConfirmes: boolean;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Charge une session avec ses enrollments (stagiaire inclus) et tous les
 * créneaux de présence. Utilisé par la page d'émargement.
 * Stub-safe → null.
 */
export async function getSessionEmargement(
  sessionId: string,
): Promise<SessionEmargementRow | null> {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        enrollments: {
          // 🔴 OUBLI O3 DU PLAN — dissocier le filtre de LECTURE de celui
          // d'ÉCRITURE.
          //
          // Filtrer les abandons et exclus ici faisait DISPARAÎTRE de la grille
          // les créneaux et les signatures déjà apposés. C'est le cas le plus
          // fréquent en formation collective : quelqu'un suit deux jours sur
          // trois puis abandonne. Ces heures ont été réellement suivies, elles
          // sont facturables à l'OPCO, et leur preuve existe — la masquer revient
          // à s'en priver.
          //
          // On garde donc en lecture toute inscription qui a DÉJÀ un créneau,
          // quel que soit son statut. Le filtre d'écriture, lui, reste : on ne
          // crée pas de nouveaux créneaux pour quelqu'un qui a abandonné.
          where: {
            OR: [{ ...inscriptionsActives() }, { presences: { some: {} } }],
          },
          include: {
            trainee: {
              select: { nom: true, prenom: true, email: true },
            },
          },
          orderBy: [{ trainee: { nom: "asc" } }, { trainee: { prenom: "asc" } }],
        },
        jours: {
          select: { date: true, heureDebut: true, heureFin: true, horairesConfirmes: true },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!session) return null;

    const creneaux = await prisma.presenceCreneau.findMany({
      where: { enrollmentId: { in: session.enrollments.map((e) => e.id) } },
      orderBy: [{ date: "asc" }, { demiJournee: "asc" }],
    });

    return {
      session: {
        id: session.id,
        numero: session.numero,
        titreSession: session.titreSession,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        dureeReelleHeures: session.dureeReelleHeures,
        modalite: session.modalite,
        statut: session.statut,
        formationId: session.formationId,
        nbParticipantsPrevus: session.nbParticipantsPrevus,
        nbParticipantsReels: session.nbParticipantsReels,
      },
      enrollments: session.enrollments.map((e) => ({
        id: e.id,
        traineeId: e.traineeId,
        statut: e.statut,
        tauxPresencePct: e.tauxPresencePct,
        emargementSigneAt: e.emargementSigneAt,
        trainee: {
          nom: e.trainee.nom,
          prenom: e.trainee.prenom,
          email: e.trainee.email,
        },
      })),
      creneaux,
      // `@db.Date` stocké à minuit UTC → `YYYY-MM-DD` sans conversion de fuseau.
      // Passer par `toLocaleDateString` décalerait la date d'un jour.
      jours: session.jours.map((j) => ({
        date: j.date.toISOString().slice(0, 10),
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
        horairesConfirmes: j.horairesConfirmes,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Une ligne de la liste admin des sessions : l'essentiel de la session, le
 * nombre d'inscrits et le taux de présence moyen.
 */
export interface SessionListRow {
  id: string;
  numero: string;
  titreSession: string | null;
  formationId: string;
  /** Numéro métier de la formation (AXI-FORM-2026-XXX) — affiché à la place de l'UUID. */
  formationNumero: string;
  formationTitre: string;
  dateDebut: Date;
  dateFin: Date;
  modalite: string;
  statut: string;
  nbInscrits: number;
  tauxPresenceMoyen: number | null;
}

/**
 * Statuts d'inscription EXCLUS de la moyenne de présence. Un abandon ou une
 * exclusion tire mécaniquement le taux vers le bas alors que la session s'est
 * bien déroulée pour les autres : la moyenne mesure la session, pas les
 * départs. Filtre repris À L'IDENTIQUE de la version qui calculait en
 * JavaScript — le passage à l'agrégat SQL ne change QUE le lieu du calcul.
 */
const STATUTS_HORS_MOYENNE: ReadonlyArray<EnrollmentStatut> = ["abandon", "exclu"];

/** Options de lecture de la liste des sessions. */
export interface OptionsListeSessions {
  /** Page demandée (1-indexée). Recadrée sur le total réel. */
  page?: number;
  /**
   * Lève la fenêtre des 12 mois et rend TOUT l'historique, page par page.
   * Le défaut reste la fenêtre — c'est un accès explicite, pas un réglage.
   */
  avecArchives?: boolean;
  /**
   * Injectable pour les tests : sans quoi la fenêtre glissante dépendrait de
   * l'horloge de la CI.
   */
  maintenant?: Date;
}

/** Une page de la liste des sessions, avec de quoi la rendre honnêtement. */
export interface ListeSessionsAdmin {
  rows: SessionListRow[];
  /** Sessions de la fenêtre courante, TOUTES pages confondues. */
  total: number;
  page: number;
  totalPages: number;
  /**
   * Compteurs par statut sur la fenêtre ENTIÈRE.
   *
   * 🔴 Ils viennent d'un `groupBy`, pas d'un `filter` sur `rows` : paginer
   * sans les recalculer aurait transformé les cartes « En cours / Planifiées /
   * Réalisées » en compteurs des 25 lignes visibles, sans que rien ne le dise.
   */
  compteurs: { enCours: number; planifiees: number; realisees: number };
  avecArchives: boolean;
  /** Sessions ANTÉRIEURES à la fenêtre — 0 quand `avecArchives`. */
  nbArchives: number;
  /** Borne basse de la fenêtre affichée, `null` en mode archives. */
  depuis: Date | null;
}

function listeVide(options: {
  page: number;
  avecArchives: boolean;
  depuis: Date | null;
}): ListeSessionsAdmin {
  return {
    rows: [],
    total: 0,
    page: options.page,
    totalPages: 1,
    compteurs: { enCours: 0, planifiees: 0, realisees: 0 },
    avecArchives: options.avecArchives,
    nbArchives: 0,
    depuis: options.depuis,
  };
}

/**
 * Lit UNE page de la liste des sessions.
 *
 * 🔴 Défaut D1 corrigé ici : la version précédente n'avait ni `take` ni
 * `where`, et incluait les inscriptions de CHAQUE session pour en faire la
 * moyenne en JavaScript. À la cible (~1 200 sessions × ~7 inscrits), afficher
 * 1 200 moyennes rapatriait ~8 400 lignes d'inscription — pour n'en garder que
 * 1 200 nombres. La moyenne est désormais calculée par Postgres
 * (`groupBy` + `_avg`), et seules les inscriptions des sessions RÉELLEMENT
 * affichées sont agrégées.
 *
 * 🔴 La sémantique de la moyenne est INCHANGÉE : `AVG` de Postgres ignore les
 * NULL, exactement comme le `.filter(v => v !== null)` d'avant, et rend NULL
 * si aucune valeur n'est mesurée. Ne pas « corriger » cela avec un `COALESCE`
 * ni un `?? 0` : compter les taux non renseignés comme des zéros ferait
 * chuter tous les taux affichés (voir `arrondirTauxMoyen`).
 *
 * Stub-safe (build GH Actions sans DB, cf. ADR 0026) → page vide.
 */
export async function listSessionsForAdmin(
  options: OptionsListeSessions = {},
): Promise<ListeSessionsAdmin> {
  const maintenant = options.maintenant ?? new Date();
  const avecArchives = options.avecArchives === true;
  const debutFenetre = debutFenetreSessions(maintenant);
  const depuis = avecArchives ? null : debutFenetre;
  const pageDemandee = options.page ?? 1;

  // La fenêtre porte sur `dateDebut` (indexé, seul ou avec `statut`) : c'est la
  // date que la liste trie et affiche. Aucune borne haute — les sessions à
  // venir sont précisément celles qu'on veut voir.
  const where: Prisma.TrainingSessionWhereInput = avecArchives
    ? {}
    : { dateDebut: { gte: debutFenetre } };

  try {
    const [total, nbArchives, parStatut] = await Promise.all([
      prisma.trainingSession.count({ where }),
      avecArchives
        ? Promise.resolve(0)
        : prisma.trainingSession.count({ where: { dateDebut: { lt: debutFenetre } } }),
      prisma.trainingSession.groupBy({
        by: ["statut"],
        where,
        _count: { _all: true },
      }),
    ]);

    const compteurDe = (statut: string): number =>
      parStatut.find((g) => g.statut === statut)?._count?._all ?? 0;

    const { page, skip, take, totalPages } = bornesPagination(pageDemandee, total);

    const sessions = await prisma.trainingSession.findMany({
      where,
      orderBy: [{ dateDebut: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        id: true,
        numero: true,
        titreSession: true,
        formationId: true,
        dateDebut: true,
        dateFin: true,
        modalite: true,
        statut: true,
        _count: { select: { enrollments: true } },
        // Audit UX : la liste affichait `formationId.slice(0, 8)…` (UUID brut).
        // On résout numéro + titre de la formation pour un affichage lisible.
        formation: { select: { numero: true, titre: true } },
      },
    });

    // Une seule requête d'agrégat pour toute la page, bornée à ses sessions.
    // Page vide = aucun identifiant à agréger : la requête serait un aller-retour
    // pour rien.
    const moyenneParSession = new Map<string, number | null>();
    if (sessions.length > 0) {
      const moyennes = await prisma.enrollment.groupBy({
        by: ["sessionId"],
        where: {
          sessionId: { in: sessions.map((s) => s.id) },
          statut: { notIn: [...STATUTS_HORS_MOYENNE] },
        },
        _avg: { tauxPresencePct: true },
      });
      for (const m of moyennes) {
        moyenneParSession.set(m.sessionId, m._avg?.tauxPresencePct ?? null);
      }
    }

    return {
      rows: sessions.map((s) => ({
        id: s.id,
        numero: s.numero,
        titreSession: s.titreSession,
        formationId: s.formationId,
        formationNumero: s.formation.numero,
        formationTitre: s.formation.titre,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
        modalite: s.modalite,
        statut: s.statut,
        nbInscrits: s._count.enrollments,
        // Session absente de l'agrégat = aucune inscription retenue → pas de
        // moyenne. `undefined` et `null` mènent au même « — » à l'écran.
        tauxPresenceMoyen: arrondirTauxMoyen(moyenneParSession.get(s.id)),
      })),
      total,
      page,
      totalPages,
      compteurs: {
        enCours: compteurDe("en_cours"),
        planifiees: compteurDe("planifiee"),
        realisees: compteurDe("realisee"),
      },
      avecArchives,
      nbArchives,
      depuis,
    };
  } catch {
    // Un total inconnu vaut 0 : la seule page servable est la première.
    return listeVide({ page: bornesPagination(pageDemandee, 0).page, avecArchives, depuis });
  }
}
