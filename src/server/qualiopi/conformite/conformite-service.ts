/**
 * Qualiopi — Service conformité (AGENT B — T12).
 *
 * evaluerConformite : évalue le statut de chacun des 32 indicateurs RNQ V9
 *   en déduisant la couverture depuis la présence de données en base.
 *   Score = couverts / applicables (JAMAIS /22).
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un résultat
 * vide (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { INDICATEURS_RNQ, indicateursApplicables } from "./indicateurs-registre";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type StatutConformite = "couvert" | "a_completer" | "non_applicable";

export interface IndicateurConformite {
  numero: number;
  libelle: string;
  critere: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  super: boolean;
  statut: StatutConformite;
  preuves: string[];
}

export interface ConformiteResult {
  indicateurs: IndicateurConformite[];
  scorePct: number;
  nbCouverts: number;
  nbApplicables: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluerConformite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Évalue la conformité de l'OF sur les 32 indicateurs RNQ V9.
 *
 * Principe de déduction :
 *   - Chaque indicateur est "couvert" si des artefacts logiciels correspondants
 *     existent en base (formations, sessions, documents, réclamations, etc.).
 *   - "non_applicable" pour les conditionnels hors périmètre (ex. off.13-15 APP
 *     si aucune formation alternance, off.3/7/16 CERT si aucun certifiant).
 *   - "a_completer" sinon.
 *
 * Score = nbCouverts / nbApplicables × 100 (arrondi entier).
 * JAMAIS divisé par 22 (score sur les applicables, pas sur un sous-ensemble fixe).
 */
export async function evaluerConformite(): Promise<ConformiteResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyConformite();
  }

  // ── Collecte des données nécessaires en parallèle ──────────────────────────
  const [
    nbFormations,
    nbSessionsRealisees,
    nbEvaluationsInitiales,
    nbEvaluationsFinales,
    nbAppreciations,
    nbReclamations,
    nbVeilleLegale,
    nbVeilleMetiers,
    nbVeillePedagogique,
    nbPartenariats,
    nbSousTraitants,
    nbTrainers,
    nbTrainersAvecCV,
    nbTraineesHandicap,
    nbEnrollmentsAdaptations,
    nbDocuments,
    nbRevues,
    referentHandicapNom,
    ndaNumero,
    typesActionResult,
  ] = await Promise.all([
    prisma.formation.count(),
    prisma.trainingSession.count({ where: { statut: "realisee" } }),
    prisma.evaluationAcquis.count({ where: { type: "initiale" } }),
    prisma.evaluationAcquis.count({ where: { type: "finale" } }),
    // off.30 : compter les appréciations multi-parties (≠ questionnaires stagiaire seul)
    prisma.appreciation.count(),
    prisma.reclamation.count(),
    prisma.veille.count({ where: { type: "legale" } }),
    prisma.veille.count({ where: { type: "metiers" } }),
    prisma.veille.count({ where: { type: "pedagogique" } }),
    prisma.partenariat.count(),
    prisma.sousTraitant.count(),
    prisma.trainer.count({ where: { actif: true } }),
    // off.21 : formateurs avec CV téléversé (cvUrl non null)
    prisma.trainer.count({ where: { actif: true, cvUrl: { not: null } } }),
    prisma.trainee.count({ where: { situationHandicap: true } }),
    prisma.enrollment.count({ where: { adaptationsRealisees: { not: null } } }),
    prisma.documentGenere.count(),
    prisma.revueDirection.count(),
    // off.26 : nom du référent handicap (config Qualiopi)
    getQualiopiConfig("referent_handicap_nom").catch(() => ""),
    // off.1 : numéro NDA DREETS (condition supplémentaire pour couverture off.1)
    getQualiopiConfig("nda_numero").catch(() => ""),
    // Types d'action déclarés : liste des modalités présentes sur les formations
    prisma.formation
      .findMany({
        select: { typesActionQualiopi: true },
        take: 200,
      })
      .then((rows) => {
        const types = new Set<string>();
        for (const row of rows) {
          const arr = row.typesActionQualiopi as unknown as string[] | null;
          if (Array.isArray(arr)) {
            for (const t of arr) types.add(t);
          }
        }
        return Array.from(types);
      }),
  ]);

  const typesAction = typesActionResult;
  const applicablesNums = indicateursApplicables(
    typesAction.length > 0 ? typesAction : ["classique"],
  );

  // ── Table de preuves par indicateur ────────────────────────────────────────
  // Chaque entrée : { preuves[], couvert }
  type IndicateurData = { preuves: string[]; couvert: boolean };
  const dataMap = new Map<number, IndicateurData>();

  function set(numero: number, preuves: string[], couvert: boolean): void {
    dataMap.set(numero, { preuves, couvert });
  }

  // Critère 1
  // off.1 : couvert seulement si formations/fiches présentes ET NDA DREETS renseigné
  set(
    1,
    [
      `${nbFormations} formation(s) créée(s)`,
      `${nbDocuments} document(s) généré(s)`,
      ndaNumero.trim().length > 0
        ? `NDA DREETS : ${ndaNumero}`
        : "NDA DREETS : non renseigné (requis pour couverture off.1)",
    ],
    nbFormations > 0 && ndaNumero.trim().length > 0,
  );
  set(2, [`${nbSessionsRealisees} session(s) réalisée(s)`], nbSessionsRealisees > 0);
  set(3, [], false); // certifiant conditionnel — non couvert par défaut (TC seul)

  // Critère 2
  set(
    4,
    [`${nbFormations} formation(s)`, `${nbEvaluationsInitiales} positionnement(s) initial`],
    nbFormations > 0 && nbEvaluationsInitiales > 0,
  );
  set(5, [`${nbFormations} formation(s) avec objectifs définis`], nbFormations > 0);
  set(6, [`${nbFormations} formation(s) avec contenus et modalités`], nbFormations > 0);
  set(7, [], false); // certifiant conditionnel
  set(
    8,
    [`${nbEvaluationsInitiales} évaluation(s) initiale(s) de positionnement`],
    nbEvaluationsInitiales > 0,
  );

  // Critère 3
  set(
    9,
    [`${nbDocuments} document(s) généré(s)`, `${nbSessionsRealisees} session(s) réalisées`],
    nbDocuments > 0 && nbSessionsRealisees > 0,
  );
  set(
    10,
    [`${nbEnrollmentsAdaptations} adaptation(s) réalisées renseignées`],
    nbEnrollmentsAdaptations > 0,
  );
  set(11, [`${nbEvaluationsFinales} évaluation(s) finale(s)`], nbEvaluationsFinales > 0);
  set(
    12,
    [
      `${nbSessionsRealisees} session(s) réalisée(s)`,
      `${nbDocuments} document(s) de suivi (émargements, relevés de connexion)`,
    ],
    nbSessionsRealisees > 0 && nbDocuments > 0,
  );
  set(13, [], false); // APP conditionnel
  set(14, [], false); // APP conditionnel
  set(15, [], false); // APP conditionnel
  set(16, [], false); // CERT conditionnel

  // Critère 4
  set(17, [`${nbTrainers} formateur(s) actif(s)`], nbTrainers > 0);
  set(18, [`${nbTrainers} formateur(s) coordonnés`], nbTrainers > 0);
  set(19, [`${nbDocuments} document(s) pédagogiques générés`], nbDocuments > 0);
  set(
    20,
    [`${nbTraineesHandicap} stagiaire(s) en situation de handicap suivi(s)`],
    nbTraineesHandicap > 0 || nbEnrollmentsAdaptations > 0,
  );

  // Critère 5
  // off.21 : couvert SEULEMENT si ≥1 formateur actif avec cvUrl non null (CV réel uploadé)
  set(
    21,
    [
      `${nbTrainersAvecCV} formateur(s) actif(s) avec CV téléversé`,
      `${nbTrainers} formateur(s) actif(s) au total`,
    ],
    nbTrainersAvecCV > 0,
  );
  set(22, [`${nbTrainers} formateur(s) actif(s)`], nbTrainers > 0);

  // Critère 6
  set(23, [`${nbVeilleLegale} entrée(s) de veille légale/réglementaire`], nbVeilleLegale > 0);
  set(24, [`${nbVeilleMetiers} entrée(s) de veille emplois/métiers`], nbVeilleMetiers > 0);
  set(
    25,
    [`${nbVeillePedagogique} entrée(s) de veille pédagogique/technologique`],
    nbVeillePedagogique > 0,
  );
  // off.26 : couvert si partenariats existent ET référent handicap nommé (config non vide)
  set(
    26,
    [
      `${nbPartenariats} partenariat(s) (dont réseau handicap)`,
      `${nbTraineesHandicap} stagiaire(s) handicap suivi(s)`,
      referentHandicapNom
        ? `Référent handicap : ${referentHandicapNom}`
        : "Référent handicap : non renseigné",
    ],
    nbPartenariats > 0 && referentHandicapNom.trim().length > 0,
  );
  set(27, [`${nbSousTraitants} sous-traitant(s) référencé(s)`], nbSousTraitants > 0);
  set(28, [], false); // AFEST conditionnel
  set(29, [`${nbSessionsRealisees} session(s) réalisée(s)`], nbSessionsRealisees > 0);

  // Critère 7
  // off.30 : couvert si ≥1 appréciation multi-parties (stagiaire/entreprise/financeur/formateur)
  set(30, [`${nbAppreciations} appréciation(s) multi-parties (off.30)`], nbAppreciations > 0);
  set(31, [`${nbReclamations} réclamation(s) enregistrée(s)`], nbReclamations > 0);
  set(
    32,
    [`${nbRevues} revue(s) de direction`, `${nbReclamations} réclamation(s) + plan d'actions`],
    nbRevues > 0,
  );

  // ── Assemblage du résultat ─────────────────────────────────────────────────
  const indicateurs: IndicateurConformite[] = INDICATEURS_RNQ.map((ind) => {
    const isApplicable = applicablesNums.includes(ind.numero);
    if (!isApplicable) {
      return {
        numero: ind.numero,
        libelle: ind.libelleOfficiel,
        critere: ind.critere,
        super: ind.super,
        statut: "non_applicable" as StatutConformite,
        preuves: [],
      };
    }
    const data = dataMap.get(ind.numero) ?? { preuves: [], couvert: false };
    return {
      numero: ind.numero,
      libelle: ind.libelleOfficiel,
      critere: ind.critere,
      super: ind.super,
      statut: (data.couvert ? "couvert" : "a_completer") as StatutConformite,
      preuves: data.preuves,
    };
  });

  const nbApplicables = indicateurs.filter((i) => i.statut !== "non_applicable").length;
  const nbCouverts = indicateurs.filter((i) => i.statut === "couvert").length;
  const scorePct = nbApplicables > 0 ? Math.round((nbCouverts / nbApplicables) * 100) : 0;

  return { indicateurs, scorePct, nbCouverts, nbApplicables };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────────

function buildEmptyConformite(): ConformiteResult {
  const indicateurs: IndicateurConformite[] = INDICATEURS_RNQ.map((ind) => ({
    numero: ind.numero,
    libelle: ind.libelleOfficiel,
    critere: ind.critere,
    super: ind.super,
    statut: "a_completer" as StatutConformite,
    preuves: [],
  }));
  return {
    indicateurs,
    scorePct: 0,
    nbCouverts: 0,
    nbApplicables: indicateurs.length,
  };
}
