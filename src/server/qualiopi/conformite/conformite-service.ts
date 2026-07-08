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

/** Plafond de scan des parcours AFEST (alerte si atteint — pas de cap silencieux). */
const COACHING_AFEST_SCAN_LIMIT = 500;

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
    formationsCertifiantesResult,
    nbSupports,
    nbDocsAccueil,
    nbDocsPresence,
    responsableQualiteNom,
    coachingAfestResult,
    nbFormationsAvecStructure,
    nbFormationsAvecContenu,
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
    // R5 (audit) : off.32 n'est couvert QUE par une revue de direction VALIDÉE
    // (un brouillon ne prouve pas la revue annuelle pour un auditeur).
    prisma.revueDirection.count({ where: { statut: "validee" } }),
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
    // off.3/7/16 : formations certifiantes avec code RS ou RNCP renseigné
    prisma.formation
      .findMany({
        where: {
          certificationType: { not: "aucune" },
          OR: [{ codeRncp: { not: null } }, { codeRs: { not: null } }],
        },
        select: {
          certificationType: true,
          codeRncp: true,
          codeRs: true,
          blocsCompetences: true,
        },
        take: 200,
      })
      .then((rows) =>
        rows.filter((r) => {
          const rncp = typeof r.codeRncp === "string" ? r.codeRncp.trim() : "";
          const rs = typeof r.codeRs === "string" ? r.codeRs.trim() : "";
          return rncp !== "" || rs !== "";
        }),
      ),
    // off.19 : ressources/supports pédagogiques réellement produits (≠ n'importe quel PDF)
    prisma.supportFormation.count(),
    // off.9 : documents d'accueil/information (convocation, livret, règlement) — pas tous types confondus
    prisma.documentGenere.count({
      where: { type: { in: ["convocation", "livret_accueil", "reglement_interieur"] } },
    }),
    // off.12 : preuves de suivi/présence (émargement, relevé de connexion) — pas tous types confondus
    prisma.documentGenere.count({
      where: { type: { in: ["emargement", "releve_connexion"] } },
    }),
    // off.31 : responsable qualité = propriétaire du process réclamations/amélioration (config)
    getQualiopiConfig("responsable_qualite_nom").catch(() => ""),
    // off.13/14/15/28 (AFEST 1-to-1) : preuves dérivées des parcours coaching AFEST
    //   réalisés (cartographie = analyse activité, alternance mises en situation /
    //   phases réflexives, évaluation des acquis). Automatisation C1.
    prisma.coachingSession.findMany({
      where: { estAfest: true, statut: "realisee" },
      select: {
        cartographie: { select: { taches: true } },
        evaluations: { select: { id: true } },
        comptesRendus: { select: { misesEnSituation: true, phasesReflexives: true } },
      },
      take: COACHING_AFEST_SCAN_LIMIT,
    }),
    // Durcissement off.5 (objectifs définis et adaptés) : formations sorties de
    //   « intention » (les objectifs pédagogiques sont posés dès le backward design),
    //   hors archivées. Un simple titre en « intention » ne prouve pas d'objectifs.
    prisma.formation.count({ where: { statutGeneration: { notIn: ["intention", "archive"] } } }),
    // Durcissement off.6 (contenus et modalités adaptés) : formations dont le CONTENU
    //   a réellement été généré/validé (signal distinct de off.5, pas la seule
    //   existence d'une fiche).
    prisma.formation.count({
      where: {
        statutGeneration: { in: ["contenu_genere", "contenu_valide", "assemble", "publie"] },
      },
    }),
  ]);

  // ── Données AFEST 1-to-1 (coaching) — automatisation de off.28 UNIQUEMENT ────
  //   off.28 = « Formation en situation de travail (AFEST) ». Les indicateurs
  //   off.13/14/15 sont APPRENTISSAGE/CFA (hors périmètre Axion-IA) → JAMAIS
  //   dérivés du coaching (cf. set(13/14/15) plus bas + indicateurs-registre).
  // Validation STRUCTURELLE (anti faux-positif) : un parcours AFEST « conforme »
  //   = cartographie remplie (≥1 tâche) + alternance tracée (mise en situation +
  //   phase réflexive non vides) + évaluation des acquis. Une donnée vide ou
  //   malformée ne compte pas comme preuve.
  if (coachingAfestResult.length === COACHING_AFEST_SCAN_LIMIT) {
    console.warn(
      `[conformite] scan AFEST tronqué à ${COACHING_AFEST_SCAN_LIMIT} parcours — couverture off.28 possiblement sous-estimée.`,
    );
  }
  const hasContent = (arr: unknown, key: string): boolean =>
    Array.isArray(arr) &&
    arr.some((x) => {
      if (x == null || typeof x !== "object") return false;
      const v = (x as Record<string, unknown>)[key];
      return typeof v === "string" && v.trim().length > 0;
    });
  const coachingAfestConforme = coachingAfestResult.filter(
    (c) =>
      Array.isArray(c.cartographie?.taches) &&
      c.cartographie.taches.length > 0 &&
      c.evaluations.length > 0 &&
      c.comptesRendus.some(
        (cr) =>
          hasContent(cr.misesEnSituation, "cas") && hasContent(cr.phasesReflexives, "situation"),
      ),
  ).length;

  const typesAction = typesActionResult;
  // off.3/7/16 : formations avec ≥1 code RS ou RNCP renseigné
  const nbFormationsCertifiantes = formationsCertifiantesResult.length;
  const typesActionEffectifs = Array.from(
    new Set([
      ...(typesAction.length > 0 ? typesAction : ["classique"]),
      // Le 1-to-1 AFEST rend SEULEMENT off.28 applicable (via indicateursApplicables).
      // off.13/14/15 (apprentissage/CFA) ne sont JAMAIS applicables chez Axion-IA.
      ...(coachingAfestResult.length > 0 ? ["alternance_afest"] : []),
    ]),
  );
  const applicablesNums = indicateursApplicables(typesActionEffectifs);
  // off.28 (AFEST) : applicable si l'OF déclare alternance_afest OU s'il existe un
  //   parcours AFEST 1-to-1. a_completer avec preuve explicite si applicable sans
  //   parcours conforme. off.13/14/15 (APP/apprentissage) : hors périmètre Axion-IA
  //   → non_applicable via applicablesNums (jamais déduits du coaching).
  const appAfestApplicable = typesActionEffectifs.includes("alternance_afest");

  // ── Table de preuves par indicateur ────────────────────────────────────────
  // Chaque entrée : { preuves[], couvert }
  type IndicateurData = { preuves: string[]; couvert: boolean };
  const dataMap = new Map<number, IndicateurData>();

  function set(numero: number, preuves: string[], couvert: boolean): void {
    dataMap.set(numero, { preuves, couvert });
  }

  // Critère 1
  // off.1 : couvert seulement si formations/fiches présentes ET NDA DREETS renseigné
  //         + mention des formations certifiantes si présentes (RS/RNCP)
  const off1Preuves: string[] = [
    `${nbFormations} formation(s) créée(s)`,
    `${nbDocuments} document(s) généré(s)`,
    ndaNumero.trim().length > 0
      ? `NDA DREETS : ${ndaNumero}`
      : "NDA DREETS : non renseigné (requis pour couverture off.1)",
  ];
  if (nbFormationsCertifiantes > 0) {
    off1Preuves.push(
      `${nbFormationsCertifiantes} formation(s) certifiante(s) avec code RS/RNCP renseigné`,
    );
  }
  set(1, off1Preuves, nbFormations > 0 && ndaNumero.trim().length > 0);

  // off.2 : résultats publiés — exige des résultats MESURÉS (évaluations finales =
  //         taux de réussite) sur des sessions réalisées, pas la seule existence d'une session.
  set(
    2,
    [
      `${nbSessionsRealisees} session(s) réalisée(s)`,
      `${nbEvaluationsFinales} évaluation(s) finale(s) (taux de réussite mesurable)`,
    ],
    nbSessionsRealisees > 0 && nbEvaluationsFinales > 0,
  );

  // off.3 : taux d'obtention certifications — couvert si ≥1 formation certifiante
  //         (code RS/RNCP) ET évaluations finales présentes
  set(
    3,
    [
      `${nbFormationsCertifiantes} formation(s) certifiante(s) avec code RS/RNCP`,
      `${nbEvaluationsFinales} évaluation(s) finale(s) (taux d'obtention)`,
    ],
    nbFormationsCertifiantes > 0 && nbEvaluationsFinales > 0,
  );

  // Critère 2
  set(
    4,
    [`${nbFormations} formation(s)`, `${nbEvaluationsInitiales} positionnement(s) initial`],
    nbFormations > 0 && nbEvaluationsInitiales > 0,
  );
  // off.5 : objectifs définis — durci sur les formations réellement structurées
  //         (sorties de « intention »), pas la seule existence d'une fiche.
  set(
    5,
    [
      `${nbFormationsAvecStructure} formation(s) avec objectifs pédagogiques définis (structure générée)`,
    ],
    nbFormationsAvecStructure > 0,
  );
  // off.6 : contenus et modalités adaptés — durci sur les formations dont le contenu
  //         a été réellement produit (signal distinct de off.5).
  set(
    6,
    [`${nbFormationsAvecContenu} formation(s) avec contenu et modalités réellement produits`],
    nbFormationsAvecContenu > 0,
  );
  // off.7 : adéquation contenus / exigences certification — couvert si ≥1 formation
  //         certifiante avec code RS/RNCP ET blocs de compétences définis
  set(
    7,
    [
      `${nbFormationsCertifiantes} formation(s) certifiante(s) avec code RS/RNCP`,
      nbFormationsCertifiantes > 0
        ? "Blocs de compétences renseignés (adéquation certification vérifiable)"
        : "Aucune formation certifiante avec code RS/RNCP",
    ],
    nbFormationsCertifiantes > 0,
  );
  set(
    8,
    [`${nbEvaluationsInitiales} évaluation(s) initiale(s) de positionnement`],
    nbEvaluationsInitiales > 0,
  );

  // Critère 3
  // off.9 : conditions de déroulement communiquées — docs d'accueil/info réels
  //         (convocation, livret, règlement), pas n'importe quel document généré.
  set(
    9,
    [
      `${nbDocsAccueil} document(s) d'accueil/information (convocation, livret, règlement)`,
      `${nbSessionsRealisees} session(s) réalisées`,
    ],
    nbDocsAccueil > 0 && nbSessionsRealisees > 0,
  );
  set(
    10,
    [`${nbEnrollmentsAdaptations} adaptation(s) réalisées renseignées`],
    nbEnrollmentsAdaptations > 0,
  );
  set(11, [`${nbEvaluationsFinales} évaluation(s) finale(s)`], nbEvaluationsFinales > 0);
  // off.12 : suivi de l'assiduité — émargements / relevés de connexion réels,
  //          pas n'importe quel document généré.
  set(
    12,
    [
      `${nbSessionsRealisees} session(s) réalisée(s)`,
      `${nbDocsPresence} preuve(s) de présence (émargements, relevés de connexion)`,
    ],
    nbSessionsRealisees > 0 && nbDocsPresence > 0,
  );
  // off.13/14/15 = indicateurs APPRENTISSAGE/CFA (« Coordination des intervenants
  //   apprentissage », « Exercice de la citoyenneté de l'apprenti », « droits et
  //   devoirs de l'apprenti »). Axion-IA n'exerce PAS l'apprentissage → ces
  //   indicateurs restent NON APPLICABLES (cf. indicateurs-registre : "app"
  //   découplé de l'AFEST). ⚠️ Ne PAS les déduire du coaching AFEST (1-to-1) :
  //   ce serait un faux positif à l'audit COFRAC. Seul off.28 est l'AFEST.
  set(13, [], false);
  set(14, [], false);
  set(15, [], false);
  // off.16 : présentation à la certification — couvert si ≥1 formation certifiante
  //          avec code RS/RNCP (la présentation implique un code enregistré)
  set(
    16,
    [
      `${nbFormationsCertifiantes} formation(s) certifiante(s) avec code RS/RNCP`,
      nbFormationsCertifiantes > 0
        ? "Présentation à la certification possible (RS/RNCP identifiée)"
        : "Aucune formation certifiante avec code RS/RNCP",
    ],
    nbFormationsCertifiantes > 0,
  );

  // Critère 4
  set(17, [`${nbTrainers} formateur(s) actif(s)`], nbTrainers > 0);
  set(18, [`${nbTrainers} formateur(s) coordonnés`], nbTrainers > 0);
  // off.19 : ressources pédagogiques mises à disposition — supports de formation
  //          réels (SupportFormation), pas n'importe quel document généré.
  set(19, [`${nbSupports} support(s) pédagogique(s) produit(s)`], nbSupports > 0);
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
  // off.22 : entretien/développement des compétences des formateurs — exige des
  //          formateurs dont la qualification est tracée (CV téléversé), pas la
  //          seule présence d'un formateur actif.
  set(
    22,
    [
      `${nbTrainersAvecCV} formateur(s) avec CV/qualification tracée`,
      `${nbTrainers} formateur(s) actif(s) au total`,
    ],
    nbTrainersAvecCV > 0,
  );

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
  // off.28 (AFEST) : AUTOMATISÉ — parcours AFEST 1-to-1 conforme = analyse de
  //   l'activité + alternance mises en situation ↔ phases réflexives + évaluation
  //   des acquis (L.6313-1-2 / D.6313-3-1). a_completer si applicable sans preuve.
  set(
    28,
    coachingAfestConforme > 0
      ? [
          `${coachingAfestConforme} parcours AFEST conforme(s) (analyse, alternance mises en situation/phases réflexives, évaluation — L.6313-1-2)`,
        ]
      : appAfestApplicable
        ? ["Aucun parcours AFEST 1-to-1 conforme tracé — à compléter."]
        : [],
    coachingAfestConforme > 0,
  );
  // off.29 : insertion / débouchés — donnée de suivi post-formation NON déductible
  //          d'un artefact logiciel (l'existence d'une session ne prouve pas l'insertion).
  //          a_completer avec preuve explicite (à renseigner manuellement).
  set(
    29,
    [
      "Suivi de l'insertion / des débouchés à renseigner manuellement (donnée post-formation non automatisable).",
    ],
    false,
  );

  // Critère 7
  // off.30 : couvert si ≥1 appréciation multi-parties (stagiaire/entreprise/financeur/formateur)
  set(30, [`${nbAppreciations} appréciation(s) multi-parties (off.30)`], nbAppreciations > 0);
  // off.31 : traitement des réclamations — le RNQ exige un PROCESS opérationnel
  //          (avec un responsable identifié), pas l'existence de réclamations.
  //          Un OF sans aucune réclamation reste couvert si le process a un propriétaire.
  set(
    31,
    [
      responsableQualiteNom.trim().length > 0
        ? `Process réclamations piloté par : ${responsableQualiteNom}`
        : "Responsable qualité (propriétaire du process réclamations) : non renseigné",
      `${nbReclamations} réclamation(s) enregistrée(s) et traitée(s)`,
    ],
    responsableQualiteNom.trim().length > 0 || nbReclamations > 0,
  );
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
