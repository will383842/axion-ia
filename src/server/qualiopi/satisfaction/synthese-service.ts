/**
 * Qualiopi — Synthèse des questionnaires de satisfaction (LOT 4).
 *
 * getSyntheseQuestionnaires({ annee, formationId? }) :
 *   - par formation puis global : nb réponses, note moyenne (noteGlobale /5),
 *     moyennes par bloc quand les réponses stockent des scores par question ;
 *   - verbatims : toutes les réponses en TEXTE LIBRE des questions ouvertes,
 *     listés du plus récent au plus ancien avec date + session + formation.
 *
 * Format réel des `reponses` Json (Questionnaire.reponses) :
 *   - portail stagiaire (SatisfactionPortailForm) → `{ commentaire: "..." }`
 *     + noteGlobale /5 en colonne dédiée ;
 *   - saisie admin/papier (template PDF 17 questions) → clés `q1`..`q13`
 *     scores 1-5 (blocs A q1-4, B q5-8, C q9-11, D q12-13), `q14`..`q17`
 *     texte libre, éventuelle clé `recommandation`.
 *   Le parsing est FAIL-SOFT : valeurs numériques (ou chaînes numériques) sur
 *   clés `qN` → scores ; chaînes non vides non numériques → verbatims ; tout
 *   format inattendu est ignoré sans faire échouer la synthèse.
 *
 * Stub-aware : retourne une synthèse vide si DATABASE_URL contient "stub.invalid".
 */

import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface MoyenneBloc {
  /** Code bloc : A (contenu), B (animation), C (organisation), D (résultats). */
  bloc: "A" | "B" | "C" | "D";
  libelle: string;
  /** Moyenne des scores 1-5 du bloc, arrondie à 1 décimale. */
  moyenne: number;
  /** Nombre de scores agrégés. */
  nb: number;
}

export interface SyntheseFormation {
  formationId: string;
  formationTitre: string;
  nbReponses: number;
  /** Moyenne des noteGlobale (/5), arrondie à 1 décimale. Null si aucune note. */
  noteMoyenne: number | null;
  /** Moyennes par bloc — vide si aucune réponse ne stocke de scores par question. */
  moyennesBlocs: MoyenneBloc[];
}

export interface Verbatim {
  texte: string;
  /** Clé de la question ouverte (ex. "commentaire", "q14"). */
  questionCle: string;
  /** Date de réponse (reponduAt). Null si inconnue. */
  date: Date | null;
  sessionNumero: string;
  formationTitre: string;
}

export interface SyntheseQuestionnairesResult {
  annee: number;
  global: {
    nbReponses: number;
    noteMoyenne: number | null;
    moyennesBlocs: MoyenneBloc[];
  };
  parFormation: SyntheseFormation[];
  verbatims: Verbatim[];
  calculeAt: Date;
}

export interface SyntheseQuestionnairesInput {
  annee: number;
  formationId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocs du questionnaire (alignés sur le template PDF satisfaction 17 questions)
// ─────────────────────────────────────────────────────────────────────────────

const BLOCS: Array<{ bloc: MoyenneBloc["bloc"]; libelle: string; questions: number[] }> = [
  { bloc: "A", libelle: "Contenu de la formation", questions: [1, 2, 3, 4] },
  { bloc: "B", libelle: "Animation et formateur", questions: [5, 6, 7, 8] },
  { bloc: "C", libelle: "Organisation et logistique", questions: [9, 10, 11] },
  { bloc: "D", libelle: "Résultats et apports", questions: [12, 13] },
];

const QUESTION_TO_BLOC = new Map<number, MoyenneBloc["bloc"]>(
  BLOCS.flatMap((b) => b.questions.map((q) => [q, b.bloc] as const)),
);

// ─────────────────────────────────────────────────────────────────────────────
// Parsing fail-soft des réponses d'un questionnaire
// ─────────────────────────────────────────────────────────────────────────────

interface ReponsesParsees {
  /** Scores par bloc : bloc → liste de scores 1-5. */
  scoresParBloc: Map<MoyenneBloc["bloc"], number[]>;
  /** Textes libres non vides (clé + texte). */
  textes: Array<{ cle: string; texte: string }>;
}

/** Parse le Json `reponses` d'un questionnaire. Jamais ne lève (fail-soft). */
export function parseReponses(raw: unknown): ReponsesParsees {
  const scoresParBloc = new Map<MoyenneBloc["bloc"], number[]>();
  const textes: Array<{ cle: string; texte: string }> = [];

  try {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { scoresParBloc, textes };
    }
    for (const [cle, valeur] of Object.entries(raw as Record<string, unknown>)) {
      // Score numérique (nombre ou chaîne numérique) sur une clé qN ?
      const matchQ = /^q(\d{1,2})$/.exec(cle);
      const num =
        typeof valeur === "number"
          ? valeur
          : typeof valeur === "string" && valeur.trim() !== "" && !isNaN(Number(valeur))
            ? Number(valeur)
            : null;
      if (matchQ && num !== null && num >= 1 && num <= 5) {
        const bloc = QUESTION_TO_BLOC.get(parseInt(matchQ[1] ?? "0", 10));
        if (bloc !== undefined) {
          const arr = scoresParBloc.get(bloc) ?? [];
          arr.push(num);
          scoresParBloc.set(bloc, arr);
        }
        continue;
      }
      // Texte libre non vide et non purement numérique → verbatim.
      if (typeof valeur === "string" && valeur.trim().length > 0 && num === null) {
        textes.push({ cle, texte: valeur.trim() });
      }
    }
  } catch {
    // fail-soft : format hétérogène → contribution ignorée
  }

  return { scoresParBloc, textes };
}

function moyenne1Dec(valeurs: number[]): number {
  return Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 10) / 10;
}

function buildMoyennesBlocs(scoresParBloc: Map<MoyenneBloc["bloc"], number[]>): MoyenneBloc[] {
  return BLOCS.filter((b) => (scoresParBloc.get(b.bloc) ?? []).length > 0).map((b) => {
    const scores = scoresParBloc.get(b.bloc) ?? [];
    return { bloc: b.bloc, libelle: b.libelle, moyenne: moyenne1Dec(scores), nb: scores.length };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getSyntheseQuestionnaires
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthèse des questionnaires de satisfaction répondus (chaud + froid) sur les
 * sessions dont dateDebut est dans l'année. Agrégats par formation puis global.
 */
export async function getSyntheseQuestionnaires(
  input: SyntheseQuestionnairesInput,
): Promise<SyntheseQuestionnairesResult> {
  const { annee, formationId } = input;

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptySynthese(annee);
  }

  const plage = {
    gte: new Date(`${annee}-01-01T00:00:00.000Z`),
    lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
  };

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      type: { in: ["satisfaction_chaud", "satisfaction_froid"] },
      reponduAt: { not: null },
      enrollment: {
        session: {
          dateDebut: plage,
          ...(formationId !== undefined ? { formationId } : {}),
        },
      },
    },
    select: {
      reponses: true,
      noteGlobale: true,
      reponduAt: true,
      enrollment: {
        select: {
          session: {
            select: {
              numero: true,
              formation: { select: { id: true, titre: true } },
            },
          },
        },
      },
    },
    orderBy: { reponduAt: "desc" },
    take: 2000,
  });

  // Agrégats
  interface Agg {
    formationTitre: string;
    notes: number[];
    nbReponses: number;
    scoresParBloc: Map<MoyenneBloc["bloc"], number[]>;
  }
  const parFormationMap = new Map<string, Agg>();
  const globalNotes: number[] = [];
  const globalScores = new Map<MoyenneBloc["bloc"], number[]>();
  const verbatims: Verbatim[] = [];

  for (const q of questionnaires) {
    const formation = q.enrollment.session.formation;
    const agg = parFormationMap.get(formation.id) ?? {
      formationTitre: formation.titre,
      notes: [],
      nbReponses: 0,
      scoresParBloc: new Map<MoyenneBloc["bloc"], number[]>(),
    };
    agg.nbReponses += 1;
    if (q.noteGlobale !== null) {
      agg.notes.push(q.noteGlobale);
      globalNotes.push(q.noteGlobale);
    }

    const parsed = parseReponses(q.reponses);
    for (const [bloc, scores] of parsed.scoresParBloc) {
      agg.scoresParBloc.set(bloc, [...(agg.scoresParBloc.get(bloc) ?? []), ...scores]);
      globalScores.set(bloc, [...(globalScores.get(bloc) ?? []), ...scores]);
    }
    for (const t of parsed.textes) {
      verbatims.push({
        texte: t.texte,
        questionCle: t.cle,
        date: q.reponduAt,
        sessionNumero: q.enrollment.session.numero,
        formationTitre: formation.titre,
      });
    }

    parFormationMap.set(formation.id, agg);
  }

  const parFormation: SyntheseFormation[] = [...parFormationMap.entries()]
    .map(([id, agg]) => ({
      formationId: id,
      formationTitre: agg.formationTitre,
      nbReponses: agg.nbReponses,
      noteMoyenne: agg.notes.length > 0 ? moyenne1Dec(agg.notes) : null,
      moyennesBlocs: buildMoyennesBlocs(agg.scoresParBloc),
    }))
    .sort(
      (a, b) => b.nbReponses - a.nbReponses || a.formationTitre.localeCompare(b.formationTitre),
    );

  return {
    annee,
    global: {
      nbReponses: questionnaires.length,
      noteMoyenne: globalNotes.length > 0 ? moyenne1Dec(globalNotes) : null,
      moyennesBlocs: buildMoyennesBlocs(globalScores),
    },
    parFormation,
    verbatims,
    calculeAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────────

function buildEmptySynthese(annee: number): SyntheseQuestionnairesResult {
  return {
    annee,
    global: { nbReponses: 0, noteMoyenne: null, moyennesBlocs: [] },
    parFormation: [],
    verbatims: [],
    calculeAt: new Date(),
  };
}
