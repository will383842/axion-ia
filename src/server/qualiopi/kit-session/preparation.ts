/**
 * Préparation du kit d'une session — l'état se DÉDUIT, il ne se coche pas.
 *
 * ## Le problème
 *
 * Le classeur imprimé promet au formateur un filet : « quand l'outil tombe, les
 * sorties sont imprimées dans le kit ». Ces sorties se produisent session par
 * session (une interface d'outil qui a changé rend la démonstration
 * incompréhensible en salle). Rien, jusqu'ici, ne rappelait de les faire — et
 * un filet qu'on oublie de tendre ne se remarque qu'au moment de la chute.
 *
 * ## Pourquoi déduire plutôt que cocher
 *
 * Une case à cocher se coche par avance, par optimisme ou par erreur, et
 * personne ne la décoche quand la réalité change. `evaluerConformite` du module
 * Qualiopi ne stocke aucun statut : il les déduit de la présence des données.
 * On fait pareil. Ici l'état vient de trois faits vérifiables :
 *
 *   1. la formation a-t-elle un kit publié ?      (SupportFormation)
 *   2. les sorties ont-elles été générées ?        (SessionKitSorties.sorties)
 *   3. quelqu'un les a-t-il LUES et validées ?     (SessionKitSorties.valideLe)
 *
 * Le troisième point n'est pas une formalité : les fiches promettent que « les
 * sorties du kit ont été vérifiées ». Une sortie générée que personne n'a lue
 * n'est pas un filet — c'est un trou avec une date dessus. Une démonstration
 * peut rater (le modèle n'invente pas le chiffre qu'on voulait lui faire
 * inventer) ; si personne ne l'a vu, le formateur le découvre devant la salle.
 */

import { prisma } from "@/lib/prisma";

/** Ce qu'il reste à faire, du plus bloquant au moins. */
export type EtapePreparation = "kit_absent" | "a_generer" | "a_valider" | "pret";

export interface SortieCapturee {
  readonly moduleId: string;
  readonly moduleTitre: string;
  readonly prompt: string;
  readonly sortie: string;
  readonly provider?: string;
  readonly model?: string;
}

export interface PreparationSession {
  readonly sessionId: string;
  readonly etape: EtapePreparation;
  /**
   * Faut-il montrer quoi que ce soit à l'utilisateur ?
   *
   * Faux quand il n'y a plus rien à faire (`pret`) ET quand la session est
   * TERMINÉE ou annulée : préparer le filet d'une séance déjà passée n'a pas de
   * sens, et un rappel sans objet apprend à ignorer les rappels. La règle
   * d'alerte `kit_sorties_non_pretes` applique la même exclusion — c'est la
   * même vérité, elle doit être dite pareil aux deux endroits.
   */
  readonly aPreparer: boolean;
  readonly formationSlug: string;
  readonly kitPublie: boolean;
  readonly nbSorties: number;
  readonly genereLe: Date | null;
  readonly valideLe: Date | null;
  /** Phrase unique à afficher — pas de vocabulaire d'état à décoder. */
  readonly aFaire: string;
}

const LIBELLES: Readonly<Record<EtapePreparation, string>> = {
  kit_absent:
    "Le classeur de cette formation n'est pas publié — rien à préparer tant qu'il manque.",
  a_generer: "Produire les sorties de démonstration (le filet si l'outil tombe en salle).",
  a_valider:
    "Relire les sorties produites, puis les valider — sans relecture, ce n'est pas un filet.",
  pret: "Rien à faire : les sorties sont produites et validées.",
};

/** Le tableau `sorties` en base, tel qu'il est stocké — défensif par nature. */
function lireSorties(brut: unknown): SortieCapturee[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(
    (s): s is SortieCapturee =>
      s !== null &&
      typeof s === "object" &&
      typeof (s as SortieCapturee).sortie === "string" &&
      (s as SortieCapturee).sortie.trim().length > 0,
  );
}

/**
 * L'état de préparation d'une session.
 *
 * `null` si la session n'existe pas. Jamais d'exception : cette lecture décore
 * une page, elle ne doit pas la faire tomber.
 */
export async function lirePreparation(sessionId: string): Promise<PreparationSession | null> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      statut: true,
      formationId: true,
      formation: { select: { slug: true } },
      kitSorties: { select: { sorties: true, genereLe: true, valideLe: true } },
    },
  });
  if (session === null) return null;

  const kitPublie =
    (await prisma.supportFormation.count({
      where: {
        formationId: session.formationId,
        type: "kit_formateur_imprime",
        pdfKey: { not: null },
      },
    })) > 0;

  const sorties = lireSorties(session.kitSorties?.sorties);
  const valideLe = session.kitSorties?.valideLe ?? null;

  const etape: EtapePreparation = !kitPublie
    ? "kit_absent"
    : sorties.length === 0
      ? "a_generer"
      : valideLe === null
        ? "a_valider"
        : "pret";

  // `reportee` reste à préparer : la séance aura lieu, plus tard.
  const terminee = session.statut === "realisee" || session.statut === "annulee";

  return {
    sessionId: session.id,
    etape,
    aPreparer: !terminee && etape !== "pret",
    formationSlug: session.formation.slug,
    kitPublie,
    nbSorties: sorties.length,
    genereLe: session.kitSorties?.genereLe ?? null,
    valideLe,
    aFaire: LIBELLES[etape],
  };
}

/** Les sorties déjà produites pour une session, pour l'écran de relecture. */
export async function lireSortiesSession(sessionId: string): Promise<SortieCapturee[]> {
  const row = await prisma.sessionKitSorties.findUnique({
    where: { sessionId },
    select: { sorties: true },
  });
  return lireSorties(row?.sorties);
}

/**
 * Les sessions À VENIR dont le kit n'est pas prêt — l'écran anti-oubli.
 *
 * Ne remonte QUE les sessions futures et non annulées : rappeler de préparer
 * une session passée fait du bruit, et le bruit fait qu'on cesse de lire.
 */
export async function listerSessionsAPreparer(dansLesProchainsJours = 30): Promise<
  ReadonlyArray<{
    sessionId: string;
    titre: string;
    dateDebut: Date;
    joursRestants: number;
    etape: EtapePreparation;
    aFaire: string;
  }>
> {
  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() + dansLesProchainsJours * 86_400_000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      dateDebut: { gte: maintenant, lte: limite },
      statut: { notIn: ["annulee", "realisee"] },
    },
    orderBy: { dateDebut: "asc" },
    select: { id: true, titreSession: true, dateDebut: true },
  });

  const resultats = [];
  for (const s of sessions) {
    const prep = await lirePreparation(s.id);
    if (prep === null || prep.etape === "pret") continue;
    resultats.push({
      sessionId: s.id,
      titre: s.titreSession,
      dateDebut: s.dateDebut,
      joursRestants: Math.ceil((s.dateDebut.getTime() - maintenant.getTime()) / 86_400_000),
      etape: prep.etape,
      aFaire: prep.aFaire,
    });
  }
  return resultats;
}
