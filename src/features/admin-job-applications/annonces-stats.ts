// Statistiques de recrutement PAR ANNONCE — l'écran qui répond à « quelle
// annonce rapporte ? ».
//
// Pourquoi il existe : sans lui, on paie une annonce à l'aveugle. Une
// candidature arrive dans la console sans qu'on sache d'où elle vient — Le Bon
// Coin, le Mémorial de l'Isère, LinkedIn, Google ? Trois semaines plus tard on
// a 30 candidatures et aucun moyen de décider s'il faut remettre de l'argent
// dans un canal. C'est pourtant la seule question qu'un test de canal doit
// trancher.
//
// 🔴 LA COLONNE QUI DÉCIDE EST « COÛT PAR APPORTEUR ACTIF », PAS LE VOLUME.
// Un canal gratuit qui produit 200 inscrits et 0 actif coûte plus cher qu'un
// canal à 300 € qui en produit 10. Cet écran s'arrête aujourd'hui aux
// candidatures et aux scores : le nombre d'ACTIFS (ceux qui ont déposé un
// premier contact) suppose le registre d'attribution, qui n'existe pas encore.
// Il ne faut donc PAS lire ce tableau comme un classement de rentabilité —
// seulement comme un classement de VOLUME et de QUALITÉ D'ENTRÉE. La nuance
// est rappelée à l'écran, elle n'est pas décorative.
//
// DEUX SOURCES, VOLONTAIREMENT :
//   - `sourceConnaissance` = ce que le candidat DÉCLARE (les chips du tunnel) ;
//   - `utm.source` = ce que le lien PROUVE (cookie posé au premier clic).
// Elles divergent souvent : on clique une annonce, on revient trois jours plus
// tard par Google, et on coche « site web ». Les afficher côte à côte est le
// seul moyen de voir cet écart plutôt que de le subir.

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CANDIDATURE_COMMERCIALE_SUBTYPE,
  SOURCE_OPTIONS,
  optionLabel,
} from "@/lib/commercial-application/model";
import { SCORE_SEUIL_HAUTE, SCORE_SEUIL_MOYENNE } from "@/lib/commercial-application/scoring";

export interface AnnonceStatRow {
  /** Identifiant de source (`leboncoin`, `memorial-isere`…) ou `"—"`. */
  readonly id: string;
  readonly label: string;
  readonly candidatures: number;
  /** Score ≥ 70 — ceux qu'on appelle sous 24 h. */
  readonly prioritaires: number;
  /** Score entre 40 et 69 — invitation à l'échange visio. */
  readonly aQualifier: number;
  /** Score < 40 — vivier, séquence email. */
  readonly vivier: number;
  /** Candidatures antérieures au scoring (aucune note figée). */
  readonly sansScore: number;
  /** Moyenne des scores connus, arrondie. `null` si aucun. */
  readonly scoreMoyen: number | null;
  /** Dernière candidature reçue pour cette source. */
  readonly derniere: Date | null;
}

export interface AnnoncesStats {
  /** Par source DÉCLARÉE (chips du tunnel), volume décroissant. */
  readonly parSourceDeclaree: readonly AnnonceStatRow[];
  /** Par `utm_source` PROUVÉE (cookie), volume décroissant. */
  readonly parUtmSource: readonly AnnonceStatRow[];
  readonly total: number;
  /** Nombre de candidatures sans aucune provenance — l'angle mort à surveiller. */
  readonly sansProvenance: number;
  /** Début de la fenêtre observée. */
  readonly depuis: Date;
}

interface Accumulateur {
  candidatures: number;
  prioritaires: number;
  aQualifier: number;
  vivier: number;
  sansScore: number;
  sommeScores: number;
  nbScores: number;
  derniere: Date | null;
}

function vide(): Accumulateur {
  return {
    candidatures: 0,
    prioritaires: 0,
    aQualifier: 0,
    vivier: 0,
    sansScore: 0,
    sommeScores: 0,
    nbScores: 0,
    derniere: null,
  };
}

function ajoute(acc: Accumulateur, score: number | null, at: Date): void {
  acc.candidatures += 1;
  if (score === null) {
    acc.sansScore += 1;
  } else {
    acc.sommeScores += score;
    acc.nbScores += 1;
    if (score >= SCORE_SEUIL_HAUTE) acc.prioritaires += 1;
    else if (score >= SCORE_SEUIL_MOYENNE) acc.aQualifier += 1;
    else acc.vivier += 1;
  }
  if (!acc.derniere || at > acc.derniere) acc.derniere = at;
}

function enLignes(
  map: Map<string, Accumulateur>,
  libelle: (id: string) => string,
): AnnonceStatRow[] {
  return [...map.entries()]
    .map(([id, a]) => ({
      id,
      label: libelle(id),
      candidatures: a.candidatures,
      prioritaires: a.prioritaires,
      aQualifier: a.aQualifier,
      vivier: a.vivier,
      sansScore: a.sansScore,
      scoreMoyen: a.nbScores > 0 ? Math.round(a.sommeScores / a.nbScores) : null,
      derniere: a.derniere,
    }))
    .sort((x, y) => y.candidatures - x.candidatures || x.label.localeCompare(y.label, "fr"));
}

/** Lecture défensive : le JSON vient de la base, un enregistrement partiel ne
 *  doit jamais faire tomber l'écran. */
function lireDetails(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const SANS_PROVENANCE = "—";

/**
 * Agrège les candidatures commerciales par provenance.
 *
 * @param joursFenetre — profondeur d'observation. 90 jours par défaut : au-delà,
 *   on compare des annonces qui ne tournaient pas en même temps, ce qui ne veut
 *   plus rien dire.
 */
export async function getAnnoncesStats(joursFenetre = 90): Promise<AnnoncesStats> {
  const depuis = new Date(Date.now() - joursFenetre * 24 * 60 * 60 * 1000);

  const rows = await prisma.submission.findMany({
    where: {
      details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE },
      deletedAt: null,
      submittedAt: { gte: depuis },
    },
    select: { details: true, submittedAt: true },
  });

  const parDeclaree = new Map<string, Accumulateur>();
  const parUtm = new Map<string, Accumulateur>();
  let sansProvenance = 0;

  for (const r of rows) {
    const d = lireDetails(r.details);
    const score = d && typeof d.score === "number" ? d.score : null;

    const candidature = lireDetails(d?.candidature);
    const declaree =
      candidature && typeof candidature.sourceConnaissance === "string"
        ? candidature.sourceConnaissance
        : SANS_PROVENANCE;

    const funnel = lireDetails(d?.funnel);
    const utm = lireDetails(funnel?.utm);
    const utmSource = utm && typeof utm.source === "string" ? utm.source : SANS_PROVENANCE;

    if (declaree === SANS_PROVENANCE && utmSource === SANS_PROVENANCE) sansProvenance += 1;

    const a = parDeclaree.get(declaree) ?? vide();
    ajoute(a, score, r.submittedAt);
    parDeclaree.set(declaree, a);

    const b = parUtm.get(utmSource) ?? vide();
    ajoute(b, score, r.submittedAt);
    parUtm.set(utmSource, b);
  }

  return {
    parSourceDeclaree: enLignes(parDeclaree, (id) =>
      id === SANS_PROVENANCE ? "Non renseignée" : optionLabel(SOURCE_OPTIONS, id),
    ),
    parUtmSource: enLignes(parUtm, (id) => (id === SANS_PROVENANCE ? "Aucun UTM" : id)),
    total: rows.length,
    sansProvenance,
    depuis,
  };
}
