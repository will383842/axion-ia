/**
 * Ce que le formateur voit pour évaluer les acquis de ses stagiaires (ind. 11).
 *
 * 🔴 `D4-1-C` (2026-08-20) — cette lecture n'existait pas : l'évaluation des
 * acquis, acte propre du formateur, ne figurait sur aucun de ses écrans.
 *
 * ## Politique de champs, et elle est stricte
 *
 * On ne remonte QUE ce que l'écran affiche. L'espace formateur applique déjà
 * cette règle sur les autres surfaces — pas d'e-mail stagiaire, pas de détail de
 * handicap, pas de montant. Une grille d'évaluation n'a besoin que d'un nom et
 * d'un prénom.
 *
 * 🔑 En inter-entreprises, les stagiaires d'une même session sont des salariés
 * de sociétés concurrentes. Ce que le formateur doit voir pour travailler, il le
 * voit ; le reste ne sort pas de la base.
 *
 * ## Les compétences pré-remplies
 *
 * La grille se pré-remplit depuis les `objectifsPedagogiques` de la formation —
 * la forme est `[{ id, verbe, description, niveauBloom }]`, on en tire un
 * libellé lisible et on garde l'`id` comme `objectifRef`.
 *
 * ⚠️ C'est ce rattachement qui permet à l'auditeur de relier une note à
 * l'objectif annoncé (indicateur 5 ↔ 11). Sans lui, la grille dirait « bien
 * acquis » sans qu'on sache de quoi.
 *
 * ⚠️ Une formation sans objectifs saisis rend une grille VIDE, pas une grille
 * inventée : le formateur ajoute alors ses propres lignes. Fabriquer des
 * compétences par défaut donnerait une preuve qui ne prouve rien.
 */

import { prisma } from "@/lib/prisma";
import { estMembreDeSession } from "@/server/formateur/membre-de-session";

export interface CompetenceProposee {
  /** `objectifRef` — l'identifiant de l'objectif pédagogique d'origine. */
  readonly ref: string;
  readonly libelle: string;
}

export interface StagiaireAEvaluer {
  readonly enrollmentId: string;
  readonly nomComplet: string;
  /** Types d'évaluation DÉJÀ saisis, pour ne pas les redemander en aveugle. */
  readonly typesDejaSaisis: ReadonlyArray<string>;
}

export interface EcranEvaluations {
  readonly sessionId: string;
  readonly formationIntitule: string;
  readonly competencesProposees: ReadonlyArray<CompetenceProposee>;
  readonly stagiaires: ReadonlyArray<StagiaireAEvaluer>;
}

/** Un objectif pédagogique tel que stocké — champs tous facultatifs en Json. */
interface ObjectifBrut {
  id?: unknown;
  verbe?: unknown;
  description?: unknown;
  libelle?: unknown;
}

/**
 * Rend le libellé lisible d'un objectif.
 *
 * Deux formes coexistent en base : `{ verbe, description }` sur `Formation`,
 * `{ libelle }` sur les parcours de coaching. On lit les deux plutôt que d'en
 * imposer une — le contraire viderait la grille pour la moitié des formations.
 */
function libelleObjectif(o: ObjectifBrut): string {
  if (typeof o.libelle === "string" && o.libelle.trim() !== "") return o.libelle.trim();
  const verbe = typeof o.verbe === "string" ? o.verbe.trim() : "";
  const desc = typeof o.description === "string" ? o.description.trim() : "";
  return [verbe, desc].filter((p) => p !== "").join(" ");
}

/**
 * @returns `null` si le formateur n'intervient pas sur cette session, ou si elle
 *          n'existe pas — les deux cas rendent la MÊME chose : un formateur n'a
 *          pas à apprendre qu'une session existe s'il n'y intervient pas.
 */
export async function ecranEvaluationsFormateur(
  sessionId: string,
  trainerId: string,
): Promise<EcranEvaluations | null> {
  // 🔴 La garde AVANT la lecture, et pas après : sinon n'importe quel formateur
  // authentifié ferait exécuter la requête complète, puis on jetterait le
  // résultat. C'est la doctrine déjà écrite sur les autres écrans formateur.
  if (!(await estMembreDeSession(sessionId, trainerId))) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      formation: { select: { titre: true, objectifsPedagogiques: true } },
      enrollments: {
        select: {
          id: true,
          trainee: { select: { nom: true, prenom: true } },
          evaluations: { select: { type: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (session === null) return null;

  const brut = session.formation?.objectifsPedagogiques;
  const objectifs: ObjectifBrut[] = Array.isArray(brut) ? (brut as ObjectifBrut[]) : [];

  const competencesProposees = objectifs
    .map((o, i) => ({
      ref: typeof o.id === "string" && o.id !== "" ? o.id : `objectif-${i + 1}`,
      libelle: libelleObjectif(o),
    }))
    // Un objectif sans libellé lisible ne devient pas une ligne vide à noter :
    // il disparaît de la proposition, et le formateur saisit la sienne.
    .filter((c) => c.libelle !== "");

  return {
    sessionId: session.id,
    formationIntitule: session.formation?.titre ?? session.titreSession,
    competencesProposees,
    stagiaires: session.enrollments.map((e) => ({
      enrollmentId: e.id,
      nomComplet: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      typesDejaSaisis: e.evaluations.map((ev) => ev.type),
    })),
  };
}
