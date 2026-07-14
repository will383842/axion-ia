/**
 * Qualiopi — Service conformité (AGENT B — T12).
 *
 * evaluerConformite : évalue le statut de chacun des 32 indicateurs RNQ V9
 *   en déduisant la couverture depuis la présence de données en base.
 *   Score = couverts / applicables (JAMAIS /22).
 *
 * LOT 2 (2026-07-13) :
 *   - off.17/18 dépendent AUSSI de l'inventaire des moyens pédagogiques
 *     (MoyenPedagogique actif + dateVerification non null) — plus seulement
 *     du proxy nbTrainers > 0.
 *   - off.29 gaté par la config `off29_applicable` (défaut false → non
 *     applicable ; true → applicable, à renseigner manuellement).
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

  // Seuils de fraîcheur (calculés au runtime — hors contexte workflow, `new Date()` OK).
  //   veille exploitée = récente < 12 mois ; CV formateur à jour < 24 mois (aligné M11/R11).
  const maintenant = new Date();
  const seuil12Mois = new Date(maintenant);
  seuil12Mois.setMonth(seuil12Mois.getMonth() - 12);
  const seuil24Mois = new Date(maintenant);
  seuil24Mois.setMonth(seuil24Mois.getMonth() - 24);

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
    moyensActifsParCategorie,
    moyensVerifiesParCategorie,
    off29Applicable,
    // ── P1 (durcissement anti-proxy — audit 2026-07-14) ──────────────────────
    appreciationSources,
    nbEnrollmentsEmarges,
    nbPositionnementsBesoin,
    nbFormationsResultatsPublies,
    nbSousTraitantsConformes,
    nbTrainersAvecCVRecent,
    nbSupportsGeneres,
    nbPartenariatsHandicap,
    nbVeilleLegaleExploitee,
    nbVeilleMetiersExploitee,
    nbVeillePedagogiqueExploitee,
    referentHandicapEmail,
    procedureReclamationsPubliee,
    nbDevActionsRecentes,
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
        // [P1] « évaluation des acquis » AFEST = évaluation FINALE (≠ simple
        //   positionnement d'entrée). On ne retient que les évaluations type=finale.
        evaluations: { where: { type: "finale" }, select: { id: true } },
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
    // off.17/18 : inventaire des moyens pédagogiques (LOT 2 — doc A14).
    //   Moyens ACTIFS par catégorie (les catégories « utilisées » de l'OF).
    prisma.moyenPedagogique.groupBy({
      by: ["categorie"],
      where: { actif: true },
      _count: { _all: true },
    }),
    //   Moyens actifs VÉRIFIÉS (dateVerification non null) par catégorie — un
    //   moyen jamais vérifié ne prouve pas l'adéquation à l'audit.
    prisma.moyenPedagogique.groupBy({
      by: ["categorie"],
      where: { actif: true, dateVerification: { not: null } },
      _count: { _all: true },
    }),
    // off.29 : applicabilité pilotée par config (défaut false — OF d'actions de
    //   formation non certifiantes ; à confirmer avec le certificateur).
    getQualiopiConfig("off29_applicable").catch(() => false),
    // ── P1 (durcissement anti-proxy — audit 2026-07-14) ──────────────────────
    // off.30 : diversité RÉELLE des sources d'appréciation (multi-parties = ≥2 sources).
    prisma.appreciation.groupBy({ by: ["source"] }),
    // off.12 : émargements RÉELLEMENT signés (Enrollment.emargementSigneAt), ≠ simple PDF.
    prisma.enrollment.count({ where: { emargementSigneAt: { not: null } } }),
    // off.4 : analyse du besoin = questionnaire de positionnement RÉPONDU (≠ grille d'acquis off.8).
    prisma.questionnaire.count({ where: { type: "positionnement", reponduAt: { not: null } } }),
    // off.2 : indicateurs de résultats RÉELLEMENT publiés (diffusion), pas seulement mesurés.
    prisma.formation.count({ where: { indicateursPubliesAt: { not: null } } }),
    // off.27 : sous-traitants CONFORMES (vigilance) = NDA + vérif data.gouv + contrat signé.
    prisma.sousTraitant.count({
      where: {
        actif: true,
        nda: { not: null },
        verifieDataGouvAt: { not: null },
        contratSigneAt: { not: null },
      },
    }),
    // off.21 : CV téléversé ET À JOUR (< 24 mois) — un CV daté, pas une simple URL non datée.
    prisma.trainer.count({
      where: { actif: true, cvUrl: { not: null }, cvUploadedAt: { gte: seuil24Mois } },
    }),
    // off.19 : supports RÉELLEMENT produits (statut=genere ET pdfKey non null), pas un brouillon.
    prisma.supportFormation.count({ where: { statut: "genere", pdfKey: { not: null } } }),
    // off.26 : partenariats du réseau HANDICAP spécifiquement (≠ partenariat commercial).
    prisma.partenariat.count({ where: { type: "reseau_handicap" } }),
    // off.23/24/25 : veille EXPLOITÉE (actionDecidee non vide) et RÉCENTE (< 12 mois).
    prisma.veille.count({
      where: {
        type: "legale",
        dateVeille: { gte: seuil12Mois },
        AND: [{ actionDecidee: { not: null } }, { actionDecidee: { not: "" } }],
      },
    }),
    prisma.veille.count({
      where: {
        type: "metiers",
        dateVeille: { gte: seuil12Mois },
        AND: [{ actionDecidee: { not: null } }, { actionDecidee: { not: "" } }],
      },
    }),
    prisma.veille.count({
      where: {
        type: "pedagogique",
        dateVeille: { gte: seuil12Mois },
        AND: [{ actionDecidee: { not: null } }, { actionDecidee: { not: "" } }],
      },
    }),
    // off.26 : email du référent handicap — le NOM seul (défaut config) ne prouve pas la désignation.
    getQualiopiConfig("referent_handicap_email").catch(() => ""),
    // off.31 : procédure de réclamation PUBLIÉE (attestation explicite ≠ nom responsable par défaut).
    getQualiopiConfig("procedure_reclamations_publiee").catch(() => false),
    // off.22 : actions de développement des compétences formateur RÉCENTES (< 24 mois) —
    //   entretien pro / formation suivie / veille. Preuve distincte du CV (off.21).
    prisma.trainerDevelopmentAction.count({ where: { dateAction: { gte: seuil24Mois } } }),
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
  // off.29 (insertion professionnelle) : indicateur « app » (apprentissage) —
  //   non applicable par défaut chez Axion-IA. La config `off29_applicable`
  //   (défaut false) permet de le réactiver si le certificateur le demande ;
  //   il redevient alors applicable et reste à renseigner manuellement.
  if (off29Applicable === true && !applicablesNums.includes(29)) {
    applicablesNums.push(29);
    applicablesNums.sort((a, b) => a - b);
  }

  // ── Inventaire des moyens pédagogiques (off.17/18 — LOT 2) ─────────────────
  //   off.17 : ≥1 moyen TECHNIQUE (salle/matériel/plateforme) actif ET vérifié.
  //   off.18 : chaque catégorie UTILISÉE (≥1 moyen actif) a ≥1 moyen vérifié.
  const CATEGORIES_TECHNIQUES = new Set(["salle", "materiel", "plateforme"]);
  const verifiesParCategorie = new Map<string, number>(
    moyensVerifiesParCategorie.map((g) => [g.categorie as string, g._count._all]),
  );
  const categoriesUtilisees = moyensActifsParCategorie
    .filter((g) => g._count._all > 0)
    .map((g) => g.categorie as string);
  const nbMoyensTechniquesVerifies = moyensVerifiesParCategorie
    .filter((g) => CATEGORIES_TECHNIQUES.has(g.categorie as string))
    .reduce((acc, g) => acc + g._count._all, 0);
  const categoriesSansVerification = categoriesUtilisees.filter(
    (c) => (verifiesParCategorie.get(c) ?? 0) === 0,
  );
  const moyensParCategorieCouverts =
    categoriesUtilisees.length > 0 && categoriesSansVerification.length === 0;
  // off.28 (AFEST) : applicable si l'OF déclare alternance_afest OU s'il existe un
  //   parcours AFEST 1-to-1. a_completer avec preuve explicite si applicable sans
  //   parcours conforme. off.13/14/15 (APP/apprentissage) : hors périmètre Axion-IA
  //   → non_applicable via applicablesNums (jamais déduits du coaching).
  const appAfestApplicable = typesActionEffectifs.includes("alternance_afest");

  // ── Dérivés P1 (durcissement anti-proxy) ───────────────────────────────────
  //   off.30 : nombre de sources d'appréciation DISTINCTES (multi-parties si ≥ 2).
  const nbAppreciationSourcesDistinctes = appreciationSources.length;
  //   off.26 : email référent handicap réellement renseigné (le nom a un défaut config).
  const referentHandicapEmailRenseigne = referentHandicapEmail.trim().length > 0;
  //   off.31 : procédure de réclamation attestée publiée (flag config explicite).
  const procedureReclamationsOk = procedureReclamationsPubliee === true;
  //   off.7 : formations certifiantes dont les blocs de compétences sont RÉELLEMENT renseignés.
  const nbFormationsCertifiantesAvecBlocs = formationsCertifiantesResult.filter((r) => {
    const blocs = r.blocsCompetences;
    return Array.isArray(blocs) && blocs.length > 0;
  }).length;

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

  // off.2 : résultats publiés — l'exigence RNQ est la DIFFUSION des indicateurs de
  //         résultats. Couvert seulement si ≥1 formation a des résultats RÉELLEMENT
  //         publiés (indicateursPubliesAt non null), pas la seule mesure interne.
  //         [P1] dissocié du proxy « 1 session + 1 éval finale ».
  set(
    2,
    [
      `${nbFormationsResultatsPublies} formation(s) avec indicateurs de résultats publiés`,
      `${nbEvaluationsFinales} évaluation(s) finale(s) (taux de réussite mesurable)`,
      nbFormationsResultatsPublies === 0
        ? "Aucun indicateur de résultat publié — off.2 exige la diffusion (canal public à alimenter)"
        : "Indicateurs de résultats diffusés",
    ],
    nbFormationsResultatsPublies > 0,
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
  // off.4 : ANALYSE DU BESOIN — [P1] mesurée par le questionnaire de positionnement
  //         RÉPONDU (attentes/besoins/contexte), et non plus par la grille d'acquis
  //         (qui est off.8). Dissociation off.4 ≠ off.8.
  set(
    4,
    [
      `${nbFormations} formation(s)`,
      `${nbPositionnementsBesoin} analyse(s) du besoin (questionnaire de positionnement répondu)`,
    ],
    nbFormations > 0 && nbPositionnementsBesoin > 0,
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
  // off.7 : adéquation contenus / exigences certification — [P1] exige désormais que
  //         les BLOCS DE COMPÉTENCES soient réellement renseignés (non vides), et pas
  //         seulement un code RS/RNCP. On ne prétend plus « blocs renseignés » sans les vérifier.
  set(
    7,
    [
      `${nbFormationsCertifiantesAvecBlocs} formation(s) certifiante(s) avec code RS/RNCP ET blocs de compétences renseignés`,
      nbFormationsCertifiantesAvecBlocs > 0
        ? "Adéquation aux blocs de compétences du référentiel vérifiable"
        : `Aucune formation certifiante avec blocs renseignés (${nbFormationsCertifiantes} avec code RS/RNCP seul)`,
    ],
    nbFormationsCertifiantesAvecBlocs > 0,
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
  // off.12 : suivi de l'assiduité — [P1] rattaché au sous-système de présence RÉEL
  //          (Enrollment.emargementSigneAt : émargement présentiel signé / relevé
  //          distanciel rapproché), et non plus au seul comptage de PDF générés.
  set(
    12,
    [
      `${nbSessionsRealisees} session(s) réalisée(s)`,
      `${nbEnrollmentsEmarges} inscription(s) avec émargement réellement signé (présentiel/distanciel)`,
      `${nbDocsPresence} preuve(s) documentaire(s) de présence générée(s)`,
    ],
    nbSessionsRealisees > 0 && nbEnrollmentsEmarges > 0,
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
  // off.17 : moyens humains ET techniques — exige des formateurs actifs ET au
  //          moins 1 moyen TECHNIQUE (salle/matériel/plateforme) actif vérifié
  //          dans l'inventaire (LOT 2 — un proxy « formateurs seuls » ne prouve
  //          pas les moyens techniques).
  set(
    17,
    [
      `${nbTrainers} formateur(s) actif(s)`,
      `${nbMoyensTechniquesVerifies} moyen(s) technique(s) actif(s) vérifié(s) (salle/matériel/plateforme)`,
    ],
    nbTrainers > 0 && nbMoyensTechniquesVerifies > 0,
  );
  // off.18 : coordination des moyens — exige des formateurs actifs ET, pour
  //          chaque catégorie de moyens UTILISÉE (≥1 moyen actif), au moins 1
  //          moyen vérifié (dateVerification non null).
  set(
    18,
    [
      `${nbTrainers} formateur(s) coordonnés`,
      categoriesUtilisees.length > 0
        ? `${categoriesUtilisees.length} catégorie(s) de moyens utilisée(s) (${categoriesUtilisees.join(", ")})`
        : "Aucun moyen pédagogique actif dans l'inventaire",
      categoriesSansVerification.length > 0
        ? `Catégorie(s) sans moyen vérifié : ${categoriesSansVerification.join(", ")}`
        : "Chaque catégorie utilisée a au moins 1 moyen vérifié",
    ],
    nbTrainers > 0 && moyensParCategorieCouverts,
  );
  // off.19 : ressources pédagogiques mises à disposition — [P1] supports RÉELLEMENT
  //          finalisés (statut=genere ET pdfKey non null), pas un brouillon IA jamais rendu.
  set(
    19,
    [
      `${nbSupportsGeneres} support(s) pédagogique(s) finalisé(s) (généré + PDF disponible)`,
      nbSupportsGeneres === 0 && nbSupports > 0
        ? `${nbSupports} support(s) au total (aucun finalisé)`
        : `${nbSupports} support(s) au total`,
    ],
    nbSupportsGeneres > 0,
  );
  set(
    20,
    [`${nbTraineesHandicap} stagiaire(s) en situation de handicap suivi(s)`],
    nbTraineesHandicap > 0 || nbEnrollmentsAdaptations > 0,
  );

  // Critère 5
  // off.21 : [P1] couvert seulement si ≥1 formateur actif avec CV téléversé ET À JOUR
  //          (cvUploadedAt < 24 mois — aligné sur le pilotage M11 / l'alerte R11). Un CV
  //          non daté ou périmé ne prouve pas la mobilisation actuelle de la compétence.
  set(
    21,
    [
      `${nbTrainersAvecCVRecent} formateur(s) actif(s) avec CV téléversé et à jour (< 24 mois)`,
      `${nbTrainersAvecCV} formateur(s) avec CV téléversé (toutes dates) / ${nbTrainers} actif(s)`,
    ],
    nbTrainersAvecCVRecent > 0,
  );
  // off.22 : [P1] entretien/développement des compétences DANS LE TEMPS — exige une
  //          trace DATÉE et RÉCENTE (< 24 mois) d'action de développement (entretien
  //          professionnel, formation suivie, veille), source DISTINCTE du CV (off.21).
  //          La seule présence d'un CV ne prouve pas le maintien de la compétence.
  set(
    22,
    [
      `${nbDevActionsRecentes} action(s) de développement des compétences tracée(s) (< 24 mois : entretien pro / formation / veille)`,
      `${nbTrainersAvecCV} formateur(s) avec CV/qualification tracée`,
    ],
    nbDevActionsRecentes > 0,
  );

  // Critère 6
  // off.23/24/25 : [P1] la veille doit être EXPLOITÉE (décision/action tracée) et RÉCENTE
  //   (< 12 mois). Une entrée ancienne ou sans `actionDecidee` ne prouve pas une veille
  //   active exploitée (exigence du Guide de lecture). `updatedAt` n'est pas une preuve.
  set(
    23,
    [
      `${nbVeilleLegaleExploitee} entrée(s) de veille légale/réglementaire exploitée(s) (< 12 mois, avec décision) sur ${nbVeilleLegale} au total`,
    ],
    nbVeilleLegaleExploitee > 0,
  );
  set(
    24,
    [
      `${nbVeilleMetiersExploitee} entrée(s) de veille emplois/métiers exploitée(s) (< 12 mois, avec décision) sur ${nbVeilleMetiers} au total`,
    ],
    nbVeilleMetiersExploitee > 0,
  );
  set(
    25,
    [
      `${nbVeillePedagogiqueExploitee} entrée(s) de veille pédagogique/technologique exploitée(s) (< 12 mois, avec décision) sur ${nbVeillePedagogique} au total`,
    ],
    nbVeillePedagogiqueExploitee > 0,
  );
  // off.26 : [P1] couvert seulement si un partenaire du RÉSEAU HANDICAP est référencé
  //   (type=reseau_handicap, ≠ partenariat commercial quelconque) ET si le référent
  //   handicap est réellement désigné — attesté par un EMAIL renseigné (le nom seul a
  //   un défaut de configuration « Williams Jullin » qui ne prouve pas la désignation).
  set(
    26,
    [
      `${nbPartenariatsHandicap} partenariat(s) réseau handicap (Agefiph/Cap emploi/RHF) sur ${nbPartenariats} au total`,
      `${nbTraineesHandicap} stagiaire(s) handicap suivi(s)`,
      referentHandicapEmailRenseigne
        ? `Référent handicap : ${referentHandicapNom} (${referentHandicapEmail})`
        : "Référent handicap : email non renseigné (désignation à formaliser)",
    ],
    nbPartenariatsHandicap > 0 && referentHandicapEmailRenseigne,
  );
  // off.27 : [P1] la couverture exige la VIGILANCE réelle par sous-traitant actif —
  //   NDA renseigné + vérification data.gouv datée + contrat signé. Une ligne coquille
  //   (sans NDA/vérif/contrat) ne prouve pas les dispositions de sous-traitance.
  //   NB : si l'OF ne sous-traite pas, off.27 reste applicable et exige une PROCÉDURE
  //   documentée (voie non couverte par ce flag — action Will hors-code).
  set(
    27,
    [
      `${nbSousTraitantsConformes} sous-traitant(s) conforme(s) : NDA + vérif data.gouv + contrat signé`,
      nbSousTraitants > 0
        ? `${nbSousTraitants} sous-traitant(s) référencé(s) au total`
        : "Aucun sous-traitant référencé — off.27 exige alors une procédure « dispositions sous-traitance »",
    ],
    nbSousTraitantsConformes > 0,
  );
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
  // off.29 : insertion / débouchés — NON APPLICABLE par défaut (indicateur
  //          apprentissage/CFA, config `off29_applicable` = false). Si le
  //          certificateur le juge applicable (config = true), la donnée de
  //          suivi post-formation n'est PAS déductible d'un artefact logiciel
  //          → a_completer avec preuve explicite (à renseigner manuellement).
  set(
    29,
    [
      "Suivi de l'insertion / des débouchés à renseigner manuellement (donnée post-formation non automatisable).",
    ],
    false,
  );

  // Critère 7
  // off.30 : [P1] « multi-parties » réellement vérifié — exige des appréciations d'au
  //   moins 2 SOURCES DISTINCTES (stagiaire/entreprise/financeur/formateur). Une seule
  //   appréciation stagiaire ne couvre plus l'indicateur.
  set(
    30,
    [
      `${nbAppreciations} appréciation(s) recueillie(s)`,
      `${nbAppreciationSourcesDistinctes} source(s) distincte(s) parmi stagiaire/entreprise/financeur/formateur (≥ 2 requis)`,
    ],
    nbAppreciationSourcesDistinctes >= 2,
  );
  // off.31 : traitement des réclamations — le RNQ exige un PROCESS opérationnel
  //   DIFFUSÉ, avec un responsable identifié. [P1] la couverture n'est plus déduite du
  //   seul nom du responsable (qui a un défaut de configuration auto-seedé) : elle exige
  //   l'ATTESTATION explicite que la procédure de réclamation est publiée
  //   (SiteSetting `procedure_reclamations_publiee` = true, posé délibérément par Will)
  //   ET un responsable qualité renseigné. Fin de l'auto-pass.
  set(
    31,
    [
      procedureReclamationsOk
        ? "Procédure de traitement des réclamations publiée (attestée en configuration)"
        : "Procédure de réclamations : non attestée publiée (requis pour couverture off.31)",
      responsableQualiteNom.trim().length > 0
        ? `Process réclamations piloté par : ${responsableQualiteNom}`
        : "Responsable qualité (propriétaire du process réclamations) : non renseigné",
      `${nbReclamations} réclamation(s) enregistrée(s) et traitée(s)`,
    ],
    procedureReclamationsOk && responsableQualiteNom.trim().length > 0,
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
