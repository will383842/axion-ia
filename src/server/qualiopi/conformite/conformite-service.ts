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
 * AUDIT BLANC 2026-08-15 — cinq règles déclaraient « Couvert » sur un signal
 * qui ne prouvait pas l'exigence :
 *   - off.4  : un questionnaire de positionnement RÉPONDU, à n'importe quelle
 *              date, couvrait tout le catalogue. Il doit l'être AVANT le début
 *              de la session de l'inscription, et la mesure est une COUVERTURE
 *              (inscrits positionnés / inscrits de sessions démarrées).
 *   - off.8  : idem pour l'évaluation initiale (`dateEvaluation` ≤ début).
 *   - off.18 : la coordination se déduisait d'un NOMBRE d'intervenants et de
 *              moyens — nul avec un intervenant unique. Exige désormais une
 *              preuve ÉCRITE (config `modalites_coordination` ou pièce
 *              « inventaire des moyens » / « organisation de l'action »).
 *   - off.21 : une simple URL de CV suffisait, alors que `Trainer.cvUrl` peut
 *              pointer vers la fiche que l'outil a lui-même générée. Exige en
 *              plus une pièce de compétence VALIDÉE au dossier formateur.
 *   - off.30 : le groupBy sur `source` comptait des QUALITÉS déclarées, pas des
 *              parties prenantes — chez cet organisme les deux « sources
 *              distinctes » sont la même personne physique.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un résultat
 * vide (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerCouvertureOff32 } from "@/server/qualiopi/revues/plan-actions";
import { INDICATEURS_RNQ, indicateursApplicables } from "./indicateurs-registre";

// AFEST retiré le 2026-08-10 — le 1-to-1 est du conseil (décision 2026-07-17) ;
// déclarer l'AFEST au certificateur avec des prestations de conseil comme preuve
// était le risque d'audit n°1. Les parcours coaching ne dérivent PLUS
// `alternance_afest` ni ne couvrent off.28. off.28 reste DÉCLARABLE si un jour
// une Formation porte le type `alternance_afest` — on a retiré l'automatisme,
// pas la capacité.

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
    evaluationsInitiales,
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
    revueAnnuelle,
    referentHandicapNom,
    ndaNumero,
    typesActionResult,
    formationsCertifiantesResult,
    nbSupports,
    nbDocsAccueil,
    nbDocsPresence,
    responsableQualiteNom,
    nbFormationsAvecStructure,
    nbFormationsAvecContenu,
    moyensActifsParCategorie,
    moyensVerifiesParCategorie,
    off29Applicable,
    // ── P1 (durcissement anti-proxy — audit 2026-07-14) ──────────────────────
    appreciationSources,
    nbEnrollmentsEmarges,
    positionnementsRepondus,
    nbFormationsResultatsPublies,
    nbSousTraitantsConformes,
    nbTrainersAvecCVRecent,
    nbSupportsGeneres,
    nbFormationsActivesAvecSupport,
    nbFormationsActives,
    nbPartenariatsHandicap,
    nbVeilleLegaleExploitee,
    nbVeilleMetiersExploitee,
    nbVeillePedagogiqueExploitee,
    referentHandicapEmail,
    procedureReclamationsPubliee,
    nbDevActionsRecentes,
    nbFormateursSousTraitants,
    nbFormateursSousTraitantsConformes,
    nbProceduresSousTraitance,
    // ── Audit blanc 2026-08-15 (off.4 / off.8 / off.18 / off.21 / off.30) ────
    // ⚠️ Ajoutés EN FIN de liste, comme les trois précédents : plusieurs tests
    // mockent des compteurs par POSITION (`mockResolvedValueOnce` en cascade).
    nbInscritsSessionsDemarrees,
    nbFormateursPieceCompetence,
    nbPiecesCoordination,
    modalitesCoordination,
    appreciationsAuteurs,
    // ── Audit blanc 2026-08-15, dernier faux positif — off.5 ────────────────
    // Ajouté EN FIN de liste, pour la même raison que les précédents.
    nbFormationsActivesAvecObjectifs,
  ] = await Promise.all([
    prisma.formation.count(),
    prisma.trainingSession.count({ where: { statut: "realisee" } }),
    // off.8 : positionnement À L'ENTRÉE — la DATE fait la preuve.
    //
    // 🔴 Audit blanc 2026-08-15. `count({ type: "initiale" })` acceptait une
    // grille saisie n'importe quand, y compris après la fin de l'action : une
    // évaluation « initiale » remplie le dernier jour ne positionne personne.
    // Prisma ne sait pas comparer deux colonnes à travers une relation
    // (`date_evaluation <= sessions.date_debut`) → on rapatrie les dates et on
    // rapproche en mémoire. `take` généreux : le volume est de l'ordre du
    // millier de lignes chez un OF de cette taille.
    prisma.evaluationAcquis.findMany({
      where: { type: "initiale" },
      select: {
        enrollmentId: true,
        dateEvaluation: true,
        enrollment: { select: { session: { select: { dateDebut: true } } } },
      },
      take: 2000,
    }),
    prisma.evaluationAcquis.count({ where: { type: "finale" } }),
    // off.30 : compter les appréciations multi-parties (≠ questionnaires stagiaire seul)
    prisma.appreciation.count(),
    prisma.reclamation.count(),
    prisma.veille.count({ where: { type: "legale" } }),
    prisma.veille.count({ where: { type: "metiers" } }),
    prisma.veille.count({ where: { type: "pedagogique" } }),
    prisma.partenariat.count(),
    // off.27 — DÉNOMINATEUR de la vigilance : les sous-traitants ACTIFS.
    //
    // 🔴 2026-08-19. Ce compteur ne portait aucun filtre alors que le
    // numérateur (`nbSousTraitantsConformes`, plus bas) exige `actif: true` :
    // archiver une ligne faisait donc BAISSER le taux d'un super-indicateur, et
    // aucune action ne pouvait le corriger. Un organisme dont on ne se sert
    // plus n'est pas un intervenant sur lequel exercer une vigilance ; il n'a
    // rien à faire au dénominateur. La ligne voisine
    // (`trainer.count({ actif: true })`) filtre depuis toujours — c'était un
    // oubli, pas une convention.
    prisma.sousTraitant.count({ where: { actif: true } }),
    prisma.trainer.count({ where: { actif: true } }),
    // off.21 : formateurs avec CV téléversé (cvUrl non null)
    prisma.trainer.count({ where: { actif: true, cvUrl: { not: null } } }),
    prisma.trainee.count({ where: { situationHandicap: true } }),
    prisma.enrollment.count({ where: { adaptationsRealisees: { not: null } } }),
    // Les pièces ANNULÉES ne comptent pas : une pièce déclarée sans valeur ne
    // peut pas servir de preuve à un indicateur.
    prisma.documentGenere.count({ where: { annuleeAt: null } }),
    // R5 (audit) : off.32 n'est couvert QUE par une revue de direction VALIDÉE
    // ET de l'ANNÉE COURANTE. L'amélioration continue est une exigence annuelle :
    // sans le filtre `annee`, une revue validée en 2024 couvrait l'indicateur
    // indéfiniment — un super-indicateur (NC majeure) satisfait par une preuve
    // périmée. `RevueDirection.annee` est unique par an (schéma), donc au plus 1.
    //
    // 🔴 2026-08-23 — C'ÉTAIT UN `count()`, ET C'EST TOUT CE QUE LA RÈGLE REGARDAIT.
    // `nbRevues > 0` verdissait off.32 ⭐ pour une revue validée dont
    // `participants`, `decisions` ET `planActions` étaient VIDES : une case cochée
    // valait une démarche d'amélioration continue, sur un indicateur dont une
    // seule NC est majeure. On lit désormais le CONTENU de la revue et le verdict
    // est délégué à `evaluerCouvertureOff32` — le seul prédicat d'off.32.
    prisma.revueDirection.findFirst({
      where: { statut: "validee", annee: maintenant.getFullYear() },
      select: { annee: true, participants: true, decisions: true, planActions: true },
    }),
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
      where: {
        type: { in: ["convocation", "livret_accueil", "reglement_interieur"] },
        annuleeAt: null,
      },
    }),
    // off.12 : preuves de suivi/présence (émargement, relevé de connexion) — pas tous types confondus
    prisma.documentGenere.count({
      where: { type: { in: ["emargement", "releve_connexion"] }, annuleeAt: null },
    }),
    // off.31 : responsable qualité = propriétaire du process réclamations/amélioration (config)
    getQualiopiConfig("responsable_qualite_nom").catch(() => ""),
    // (AFEST retiré 2026-08-10 : la requête `coachingSession` qui dérivait des
    //  preuves off.28 depuis les parcours coaching vivait ici — supprimée.)
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
    // off.4 : analyse du besoin = questionnaire de positionnement RÉPONDU (≠ grille d'acquis off.8),
    //   et RÉPONDU AVANT le démarrage de la session de l'inscription.
    //
    // 🔴 Audit blanc 2026-08-15. Le compteur ne portait aucune contrainte de
    // date : UNE réponse, à n'importe quel moment, « couvrait » les 22
    // formations du catalogue. Analyser un besoin après avoir formé n'est pas
    // une analyse du besoin. Rapprochement des dates en mémoire (Prisma ne
    // compare pas deux colonnes à travers une relation).
    prisma.questionnaire.findMany({
      where: { type: "positionnement", reponduAt: { not: null } },
      select: {
        enrollmentId: true,
        reponduAt: true,
        enrollment: { select: { session: { select: { dateDebut: true } } } },
      },
      take: 2000,
    }),
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
    // off.19 — COUVERTURE, pas volumétrie : combien de formations ACTIVES portent
    // au moins un support finalisé, et non combien de supports existent.
    //
    // 🔴 Corrigé le 2026-07-26 après contre-vérification. La version précédente
    // de ce commentaire affirmait « 13 supports concentrés sur 2 formations
    // suffisaient à masquer que 20 des 22 formations actives n'avaient aucune
    // ressource ». C'était faux, et dans le sens qui MINIMISE : les deux
    // formations qui portent ces supports sont toutes deux ARCHIVÉES. La
    // couverture réelle du catalogue actif est de 0 sur 22, pas 2 sur 22.
    // Vérifié en base le 2026-07-26 : jointure formations × supports_formation
    // groupée par statut → archive : 2, actif : 0.
    prisma.supportFormation
      .findMany({
        where: { statut: "genere", pdfKey: { not: null }, formation: { statut: "actif" } },
        select: { formationId: true },
        distinct: ["formationId"],
      })
      .then((r) => r.length),
    prisma.formation.count({ where: { statut: "actif" } }),
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
    // ── off.27 : les formateurs INDÉPENDANTS sont des sous-traitants eux aussi ──
    //
    // 🔴 Ajoutés EN FIN de liste, à dessein. Plusieurs specs mockent
    // `prisma.trainer.count` par POSITION (`mockResolvedValueOnce` en cascade) et
    // documentent l'ordre attendu. Insérer au milieu décale la séquence et fait
    // rougir des tests qui n'ont rien à voir — constaté en le faisant.
    //
    // `SousTraitant` = un ORGANISME (autre OF) ; `Trainer` avec
    // `statut: "sous_traitant"` = une PERSONNE PHYSIQUE indépendante. Seule la
    // première était comptée, alors que le modèle économique d'Axion repose sur
    // des freelances qui facturent l'OF. Axion pouvait donc référencer dix
    // intervenants conformes et voir l'indicateur 27 rester à zéro. Le critère 6
    // du RNQ vise « sous-traitants ET formateurs occasionnels ». [2026-08-03]
    prisma.trainer.count({ where: { actif: true, statut: "sous_traitant" } }),
    // ⚠️ La RC pro n'entre PAS dans le critère (décision Will du 2026-08-03) :
    // demandée et suivie par alerte, jamais bloquante. L'inclure gèlerait
    // l'indicateur sur une pièce volontairement non exigée. Cf. § 4.2.
    prisma.trainer.count({
      where: {
        actif: true,
        statut: "sous_traitant",
        sousTraitantNda: { not: null },
        sousTraitantVerifieAt: { not: null },
        sousTraitantContratSigneAt: { not: null },
      },
    }),
    // 🔴 off.27 — la PROCÉDURE écrite, seconde voie de couverture. [2026-08-04]
    //
    // Le commentaire de la règle disait lui-même : « si l'OF ne sous-traite pas,
    // off.27 reste applicable et exige une PROCÉDURE documentée (voie NON
    // COUVERTE par ce flag — action Will hors-code) ». Elle l'est désormais : la
    // PR 531 a fait de cette procédure une pièce GÉNÉRÉE, précisément pour
    // l'indicateur 27 — et personne n'a rebranché la règle dessus. Générée en
    // production le 04/08 (`AXI-DOC-2026-026`), elle laissait l'indicateur
    // afficher « exige alors une procédure » alors que la procédure existait.
    //
    // ⚠️ Ajouté EN FIN de liste, comme les deux précédents : des specs mockent
    // ces compteurs par POSITION.
    // ⚠️ `annuleeAt: null` — une procédure annulée ne couvre rien.
    prisma.documentGenere.count({
      where: { type: "procedure_sous_traitance", annuleeAt: null },
    }),
    // ── Audit blanc 2026-08-15 — 5 règles durcies. Ajouts EN FIN de liste. ───
    //
    // off.4 / off.8 — DÉNOMINATEUR de couverture : les inscriptions dont la
    // session a DÉMARRÉ. C'est la population sur laquelle un auditeur tire au
    // sort. Les inscriptions sur une session à venir sont exclues à dessein :
    // un stagiaire inscrit pour dans deux mois n'est pas encore en défaut de
    // positionnement, et l'inclure ferait crier la garde sans motif.
    prisma.enrollment.count({ where: { session: { dateDebut: { lte: maintenant } } } }),
    // off.21 — formateurs ACTIFS disposant d'au moins une pièce de compétence
    // VALIDÉE au dossier (CV source, diplôme ou certification).
    //
    // 🔴 `Trainer.cvUrl` ne prouve rien à lui seul : quand l'outil génère la
    // fiche formateur (DocumentType `cv_formateur`), il pose lui-même `cvUrl`
    // sur la route de téléchargement de CETTE fiche. L'indicateur validait donc
    // une pièce que l'organisme s'était écrite. Seule une pièce VERSÉE puis
    // VALIDÉE par un administrateur justifie la compétence.
    //
    // ⚠️ Une pièce périmée est exclue : le schéma pose explicitement que
    // l'expiration n'est PAS un statut et se déduit de `dateExpiration`. Sans
    // ce filtre, une certification expirée resterait « valide » indéfiniment.
    // `dateExpiration: null` = pièce sans échéance (un diplôme) → conservée.
    prisma.trainerDocument
      .findMany({
        where: {
          type: { in: ["cv", "diplome", "certification"] },
          statutValidation: "valide",
          trainer: { actif: true },
          OR: [{ dateExpiration: null }, { dateExpiration: { gte: maintenant } }],
        },
        select: { trainerId: true },
        distinct: ["trainerId"],
      })
      .then((r) => r.length),
    // off.18 — pièces écrites décrivant l'organisation et les moyens mobilisés.
    // Seconde voie de preuve de la coordination, à côté de la config.
    // `annuleeAt: null` : une pièce annulée ne prouve rien.
    prisma.documentGenere.count({
      where: {
        type: { in: ["inventaire_moyens", "organisation_action"] },
        annuleeAt: null,
      },
    }),
    // off.18 — modalités de coordination des intervenants, écrites en
    // configuration (qui pilote, quels points, quel support, quelle fréquence).
    getQualiopiConfig("modalites_coordination").catch(() => ""),
    // off.30 — QUI s'exprime, et pas seulement en quelle qualité. Voir le bloc
    // de dérivation plus bas : `groupBy(["source"])` comptait des qualités
    // déclarées, alors que deux qualités peuvent être la même personne.
    prisma.appreciation.findMany({
      select: {
        source: true,
        clientId: true,
        trainee: { select: { email: true } },
      },
      take: 2000,
    }),
    // off.5 — les OBJECTIFS eux-mêmes, et non l'avancement du moteur.
    //
    // 🔴 2026-08-19, dernier des huit faux positifs de l'audit blanc du 15/08.
    // La couverture reposait sur `statutGeneration notIn ("intention",
    // "archive")` : un état du PIPELINE DE GÉNÉRATION, pas une exigence RNQ.
    // `Formation.objectifsPedagogiques` n'était lu nulle part dans ce fichier —
    // une formation sortie de « intention » avec un tableau d'objectifs VIDE
    // déclarait l'indicateur couvert.
    //
    // `objectifsPedagogiques` est un Json : Prisma ne sait pas compter la
    // longueur d'un tableau Json en base, d'où le `findMany` + filtrage en
    // mémoire. Le coût est celui d'une colonne Json sur le catalogue ACTIF
    // (22 lignes en production) — négligeable, et `take` borne le pire cas.
    prisma.formation
      .findMany({
        where: { statut: "actif" },
        select: { objectifsPedagogiques: true },
        take: 500,
      })
      .then(
        (rows) =>
          rows.filter((r) => {
            const objectifs = r.objectifsPedagogiques;
            return Array.isArray(objectifs) && objectifs.length > 0;
          }).length,
      ),
  ]);

  const typesAction = typesActionResult;
  // off.3/7/16 : formations avec ≥1 code RS ou RNCP renseigné
  const nbFormationsCertifiantes = formationsCertifiantesResult.length;
  // AFEST retiré le 2026-08-10 — le 1-to-1 est du conseil (décision 2026-07-17) ;
  // déclarer l'AFEST au certificateur avec des prestations de conseil comme
  // preuve était le risque d'audit n°1. `typesActionEffectifs` ne dérive QUE des
  // `typesAction` déclarés sur les `Formation` : plus AUCUNE injection
  // d'`alternance_afest` depuis l'existence d'une `coachingSession`.
  const typesActionEffectifs = Array.from(
    new Set([...(typesAction.length > 0 ? typesAction : ["classique"])]),
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
  // off.28 (AFEST) : applicable UNIQUEMENT si une Formation déclare
  //   `alternance_afest` (plus jamais déduit du coaching — 2026-08-10).
  //   off.13/14/15 (APP/apprentissage) : hors périmètre Axion-IA →
  //   non_applicable via applicablesNums.
  const appAfestApplicable = typesActionEffectifs.includes("alternance_afest");

  // ── Dérivés P1 (durcissement anti-proxy) ───────────────────────────────────
  //   off.30 : nombre de QUALITÉS déclarées distinctes sur les appréciations.
  //   ⚠️ Une qualité déclarée n'est PAS une partie prenante — cf. le bloc
  //   « personnes physiques » plus bas, qui est la garde réelle depuis
  //   l'audit blanc 2026-08-15.
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

  // ── off.4 / off.8 : la DATE fait la preuve (audit blanc 2026-08-15) ────────
  //
  // Les deux indicateurs portent sur ce qui se passe AVANT l'entrée en
  // formation : recueillir le besoin (off.4), situer le niveau (off.8). Une
  // pièce datée d'après le démarrage documente l'action, elle ne la prépare
  // pas — et c'est très exactement ce qu'un auditeur regarde en premier sur ces
  // deux lignes. Le rapprochement des dates se fait ici, en mémoire : Prisma ne
  // compare pas deux colonnes à travers une relation.
  //
  // Les positionnements HORS DÉLAI sont comptés séparément, à dessein : agrégés
  // au compteur unique, ils s'y cachaient et gonflaient un chiffre rassurant.
  const positionnementsAvantDebut = new Set<string>();
  let nbPositionnementsHorsDelai = 0;
  for (const q of positionnementsRepondus) {
    const reponduAt = q.reponduAt;
    if (reponduAt === null) continue;
    const dateDebut = q.enrollment.session.dateDebut;
    if (reponduAt.getTime() > dateDebut.getTime()) {
      nbPositionnementsHorsDelai += 1;
      continue;
    }
    // Conforme. Retenu dans la couverture seulement si la session a démarré —
    // sinon le numérateur dépasserait un dénominateur qui l'exclut.
    if (dateDebut.getTime() <= maintenant.getTime()) {
      positionnementsAvantDebut.add(q.enrollmentId);
    }
  }
  const nbInscritsPositionnesAvantDebut = positionnementsAvantDebut.size;

  const evaluationsInitialesAvantDebut = new Set<string>();
  let nbEvaluationsInitialesHorsDelai = 0;
  for (const e of evaluationsInitiales) {
    const enrollmentId = e.enrollmentId;
    const dateDebut = e.enrollment?.session.dateDebut ?? null;
    if (enrollmentId === null || dateDebut === null) {
      // Évaluation rattachée à un parcours 1-to-1 (conseil, hors périmètre
      // Qualiopi depuis le 2026-08-10) : aucune date de démarrage de session à
      // laquelle la comparer, donc rien de prouvé sur le positionnement.
      nbEvaluationsInitialesHorsDelai += 1;
      continue;
    }
    if (e.dateEvaluation.getTime() > dateDebut.getTime()) {
      nbEvaluationsInitialesHorsDelai += 1;
      continue;
    }
    if (dateDebut.getTime() <= maintenant.getTime()) {
      evaluationsInitialesAvantDebut.add(enrollmentId);
    }
  }
  const nbInscritsEvaluesAEntree = evaluationsInitialesAvantDebut.size;

  // ── off.18 : la coordination se PROUVE par écrit (audit blanc 2026-08-15) ──
  //   Config `modalites_coordination` non vide OU pièce « inventaire des
  //   moyens » / « organisation de l'action » non annulée au registre.
  const modalitesCoordinationRenseignees = modalitesCoordination.trim().length > 0;
  const preuveCoordinationEcrite = modalitesCoordinationRenseignees || nbPiecesCoordination > 0;

  // ── off.30 : QUI s'exprime, pas en quelle qualité (audit blanc 2026-08-15) ─
  //
  // `groupBy(["source"])` comptait les QUALITÉS déclarées (stagiaire,
  // entreprise, financeur, formateur). Chez cet organisme, les deux « sources
  // distinctes » relevées étaient la MÊME personne physique : la stagiaire est
  // aussi la représentante du client. L'indicateur affichait donc « multi-
  // parties » sur une seule voix.
  //
  // Identité retenue : l'ADRESSE E-MAIL seule, normalisée. Choix délibéré —
  //   • le nom seul est ambigu (deux homonymes compteraient pour deux, et une
  //     même personne écrite « W. Jullin » puis « Williams Jullin » pour deux
  //     également : dans les deux sens, l'erreur SUR-compte les parties) ;
  //   • l'identifiant technique (traineeId / clientId) ne dédoublonne rien : la
  //     même personne physique est justement portée par deux enregistrements
  //     différents, et c'est le cœur du problème.
  //
  // L'auteur se déduit de la QUALITÉ déclarée : une appréciation « entreprise »
  // est écrite par le contact du client, pas par le stagiaire inscrit. On ne
  // bascule PAS de l'un à l'autre en repli — ce repli fabriquerait un second
  // auteur là où il n'y en a peut-être qu'un, c'est-à-dire exactement la
  // complaisance qu'on corrige. Sans information de rattachement, on ne
  // fabrique rien : l'appréciation est comptée « auteur non établi » et ne
  // participe pas à la couverture.
  const clientIdsAppreciations = Array.from(
    new Set(
      appreciationsAuteurs
        .map((a) => a.clientId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  // `Appreciation.clientId` n'a pas de relation Prisma déclarée (colonne nue) :
  // la résolution des contacts demande une seconde requête, faite seulement si
  // au moins une appréciation porte un client.
  const contactsClients =
    clientIdsAppreciations.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIdsAppreciations } },
          select: { id: true, contactEmail: true },
        })
      : [];
  const contactParClient = new Map(contactsClients.map((c) => [c.id, c.contactEmail]));
  const personnesAppreciations = new Set<string>();
  let nbAppreciationsAuteurNonEtabli = 0;
  for (const a of appreciationsAuteurs) {
    const emailAuteur =
      a.source === "stagiaire"
        ? (a.trainee?.email ?? null)
        : a.clientId != null
          ? (contactParClient.get(a.clientId) ?? null)
          : null;
    const cle = typeof emailAuteur === "string" ? emailAuteur.trim().toLowerCase() : "";
    if (cle === "") {
      nbAppreciationsAuteurNonEtabli += 1;
      continue;
    }
    personnesAppreciations.add(cle);
  }
  const nbPersonnesAppreciations = personnesAppreciations.size;

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
    `${nbFormations} formation${nbFormations > 1 ? "s" : ""} créée${nbFormations > 1 ? "s" : ""}`,
    `${nbDocuments} document${nbDocuments > 1 ? "s" : ""} généré${nbDocuments > 1 ? "s" : ""}`,
    ndaNumero.trim().length > 0
      ? `NDA DREETS : ${ndaNumero}`
      : "NDA DREETS : non renseigné (requis pour couverture off.1)",
  ];
  if (nbFormationsCertifiantes > 0) {
    off1Preuves.push(
      `${nbFormationsCertifiantes} formation${nbFormationsCertifiantes > 1 ? "s" : ""} certifiante${nbFormationsCertifiantes > 1 ? "s" : ""} avec code RS/RNCP renseigné`,
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
      `${nbFormationsResultatsPublies} formation${nbFormationsResultatsPublies > 1 ? "s" : ""} avec indicateurs de résultats publiés`,
      `${nbEvaluationsFinales} évaluation${nbEvaluationsFinales > 1 ? "s" : ""} finale${nbEvaluationsFinales > 1 ? "s" : ""} (taux de réussite mesurable)`,
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
      `${nbFormationsCertifiantes} formation${nbFormationsCertifiantes > 1 ? "s" : ""} certifiante${nbFormationsCertifiantes > 1 ? "s" : ""} avec code RS/RNCP`,
      `${nbEvaluationsFinales} évaluation${nbEvaluationsFinales > 1 ? "s" : ""} finale${nbEvaluationsFinales > 1 ? "s" : ""} (taux d'obtention)`,
    ],
    nbFormationsCertifiantes > 0 && nbEvaluationsFinales > 0,
  );

  // Critère 2
  // off.4 : ANALYSE DU BESOIN — [P1] mesurée par le questionnaire de positionnement
  //         RÉPONDU (attentes/besoins/contexte), et non plus par la grille d'acquis
  //         (qui est off.8). Dissociation off.4 ≠ off.8.
  //
  // [audit blanc 2026-08-15] COUVERTURE et DATE, plus volumétrie. L'ancien
  // calcul (`nbPositionnementsBesoin > 0`) déclarait l'indicateur couvert dès
  // UNE réponse, à n'importe quelle date : une seule analyse du besoin, saisie
  // après coup, « couvrait » les 22 formations du catalogue. Seuil retenu :
  // TOUS les inscrits d'une session déjà démarrée doivent avoir été positionnés
  // avant son début — c'est ce que vérifie un auditeur qui tire un dossier au
  // hasard.
  set(
    4,
    [
      `${nbInscritsPositionnesAvantDebut} inscrit${nbInscritsPositionnesAvantDebut > 1 ? "s" : ""} sur ${nbInscritsSessionsDemarrees} positionné${nbInscritsPositionnesAvantDebut > 1 ? "s" : ""} avant le début de leur session (questionnaire de positionnement répondu)`,
      nbPositionnementsHorsDelai > 0
        ? `${nbPositionnementsHorsDelai} positionnement${nbPositionnementsHorsDelai > 1 ? "s" : ""} répondu${nbPositionnementsHorsDelai > 1 ? "s" : ""} HORS DÉLAI (après le démarrage) — ne prouve${nbPositionnementsHorsDelai > 1 ? "nt" : ""} pas l'analyse du besoin en amont`
        : "Aucun positionnement répondu hors délai",
      nbInscritsSessionsDemarrees === 0
        ? "Aucune inscription sur une session démarrée — l'analyse du besoin en amont n'est pas encore démontrable"
        : nbInscritsPositionnesAvantDebut < nbInscritsSessionsDemarrees
          ? `${nbInscritsSessionsDemarrees - nbInscritsPositionnesAvantDebut} inscrit(s) entré(s) en formation sans analyse du besoin préalable`
          : "Chaque inscrit d'une session démarrée a été positionné avant le début",
    ],
    nbInscritsSessionsDemarrees > 0 &&
      nbInscritsPositionnesAvantDebut === nbInscritsSessionsDemarrees,
  );
  // off.5 : objectifs pédagogiques définis.
  //
  // 🔴 [2026-08-19] La couverture LIT désormais les objectifs. Elle se déduisait
  // du `statutGeneration` — l'avancement du moteur de génération — et jamais du
  // contenu du champ : une formation sortie de « intention » avec un tableau
  // d'objectifs vide déclarait l'indicateur couvert, alors que c'est très
  // exactement la pièce que l'auditeur ouvre en premier sur cette ligne.
  //
  // Exprimé en COUVERTURE du catalogue actif, comme off.4, off.8 et off.19 :
  // l'auditeur tire une formation au hasard, pas la meilleure. Le compteur de
  // structure reste affiché — il dit où en est la production —, il ne décide
  // plus.
  //
  // ⚠️ Conséquence assumée : tant que les objectifs ne sont pas remontés en
  // base, off.5 bascule en « à compléter » et le score affiché au propriétaire
  // BAISSE. C'est le comportement correct : le score doit mesurer le dossier
  // d'audit réel, pas l'état du pipeline logiciel.
  const tauxObjectifsDefinis =
    nbFormationsActives > 0
      ? Math.round((nbFormationsActivesAvecObjectifs / nbFormationsActives) * 100)
      : 0;
  set(
    5,
    [
      `${nbFormationsActivesAvecObjectifs}/${nbFormationsActives} formation${nbFormationsActives > 1 ? "s" : ""} active${nbFormationsActives > 1 ? "s" : ""} portant au moins un objectif pédagogique renseigné (${tauxObjectifsDefinis} %)`,
      `${nbFormationsAvecStructure} formation${nbFormationsAvecStructure > 1 ? "s" : ""} sortie${nbFormationsAvecStructure > 1 ? "s" : ""} de l'état « intention » (avancement de la production, ≠ preuve)`,
      nbFormationsActives === 0
        ? "Aucune formation active au catalogue — les objectifs ne sont pas encore démontrables"
        : nbFormationsActivesAvecObjectifs < nbFormationsActives
          ? `${nbFormationsActives - nbFormationsActivesAvecObjectifs} formation(s) active(s) SANS aucun objectif pédagogique renseigné`
          : "Chaque formation active porte des objectifs pédagogiques renseignés",
    ],
    nbFormationsActives > 0 && nbFormationsActivesAvecObjectifs === nbFormationsActives,
  );
  // off.6 : contenus et modalités adaptés — durci sur les formations dont le contenu
  //         a été réellement produit (signal distinct de off.5).
  set(
    6,
    [
      `${nbFormationsAvecContenu} formation${nbFormationsAvecContenu > 1 ? "s" : ""} avec contenu et modalités réellement produits`,
    ],
    nbFormationsAvecContenu > 0,
  );
  // off.7 : adéquation contenus / exigences certification — [P1] exige désormais que
  //         les BLOCS DE COMPÉTENCES soient réellement renseignés (non vides), et pas
  //         seulement un code RS/RNCP. On ne prétend plus « blocs renseignés » sans les vérifier.
  set(
    7,
    [
      `${nbFormationsCertifiantesAvecBlocs} formation${nbFormationsCertifiantesAvecBlocs > 1 ? "s" : ""} certifiante${nbFormationsCertifiantesAvecBlocs > 1 ? "s" : ""} avec code RS/RNCP ET blocs de compétences renseignés`,
      nbFormationsCertifiantesAvecBlocs > 0
        ? "Adéquation aux blocs de compétences du référentiel vérifiable"
        : `Aucune formation certifiante avec blocs renseignés (${nbFormationsCertifiantes} avec code RS/RNCP seul)`,
    ],
    nbFormationsCertifiantesAvecBlocs > 0,
  );
  // off.8 : POSITIONNEMENT À L'ENTRÉE — [audit blanc 2026-08-15] même exigence
  //         de date et même expression en couverture que off.4. Une grille
  //         « initiale » saisie après le démarrage documente l'action, elle ne
  //         positionne personne à l'entrée.
  set(
    8,
    [
      `${nbInscritsEvaluesAEntree} inscrit${nbInscritsEvaluesAEntree > 1 ? "s" : ""} sur ${nbInscritsSessionsDemarrees} évalué${nbInscritsEvaluesAEntree > 1 ? "s" : ""} à l'entrée avant le début de leur session`,
      nbEvaluationsInitialesHorsDelai > 0
        ? `${nbEvaluationsInitialesHorsDelai} évaluation${nbEvaluationsInitialesHorsDelai > 1 ? "s" : ""} initiale${nbEvaluationsInitialesHorsDelai > 1 ? "s" : ""} HORS DÉLAI ou sans session rattachée sur ${evaluationsInitiales.length} enregistrée${evaluationsInitiales.length > 1 ? "s" : ""}`
        : `${evaluationsInitiales.length} évaluation${evaluationsInitiales.length > 1 ? "s" : ""} initiale${evaluationsInitiales.length > 1 ? "s" : ""} enregistrée${evaluationsInitiales.length > 1 ? "s" : ""}, aucune hors délai`,
      nbInscritsSessionsDemarrees === 0
        ? "Aucune inscription sur une session démarrée — le positionnement à l'entrée n'est pas encore démontrable"
        : nbInscritsEvaluesAEntree < nbInscritsSessionsDemarrees
          ? `${nbInscritsSessionsDemarrees - nbInscritsEvaluesAEntree} inscrit(s) entré(s) en formation sans évaluation initiale préalable`
          : "Chaque inscrit d'une session démarrée a été évalué avant le début",
    ],
    nbInscritsSessionsDemarrees > 0 && nbInscritsEvaluesAEntree === nbInscritsSessionsDemarrees,
  );

  // Critère 3
  // off.9 : conditions de déroulement communiquées — docs d'accueil/info réels
  //         (convocation, livret, règlement), pas n'importe quel document généré.
  set(
    9,
    [
      `${nbDocsAccueil} document${nbDocsAccueil > 1 ? "s" : ""} d'accueil/information (convocation, livret, règlement)`,
      `${nbSessionsRealisees} session${nbSessionsRealisees > 1 ? "s" : ""} réalisées`,
    ],
    nbDocsAccueil > 0 && nbSessionsRealisees > 0,
  );
  set(
    10,
    [
      `${nbEnrollmentsAdaptations} adaptation${nbEnrollmentsAdaptations > 1 ? "s" : ""} réalisées renseignées`,
    ],
    nbEnrollmentsAdaptations > 0,
  );
  set(
    11,
    [
      `${nbEvaluationsFinales} évaluation${nbEvaluationsFinales > 1 ? "s" : ""} finale${nbEvaluationsFinales > 1 ? "s" : ""}`,
    ],
    nbEvaluationsFinales > 0,
  );
  // off.12 : suivi de l'assiduité — [P1] rattaché au sous-système de présence RÉEL
  //          (Enrollment.emargementSigneAt : émargement présentiel signé / relevé
  //          distanciel rapproché), et non plus au seul comptage de PDF générés.
  set(
    12,
    [
      `${nbSessionsRealisees} session${nbSessionsRealisees > 1 ? "s" : ""} réalisée${nbSessionsRealisees > 1 ? "s" : ""}`,
      // 🔴 2026-08-20 — libellé RECTIFIÉ. Il disait « émargement réellement
      // signé ». Personne ne signe : `emargementSigneAt` est posé par
      // l'administrateur qui enregistre la feuille, et il l'était jusqu'ici même
      // quand la feuille déclarait la personne ABSENTE partout (`CONF-02`).
      //
      // 🔑 « Réellement » est un adjectif d'insistance, et l'audit en a trouvé
      // trois dans ce domaine : deux mentaient. Il signale presque toujours
      // qu'on a voulu croire une propriété sans la vérifier — le mot fait le
      // travail que le code n'a pas fait.
      //
      // Le libellé dit désormais ce que la colonne mesure vraiment : une
      // présence constatée sur la feuille. C'est plus modeste, et c'est vrai.
      `${nbEnrollmentsEmarges} inscription${nbEnrollmentsEmarges > 1 ? "s" : ""} avec présence constatée sur la feuille d'émargement (présentiel/distanciel)`,
      `${nbDocsPresence} preuve${nbDocsPresence > 1 ? "s" : ""} documentaire${nbDocsPresence > 1 ? "s" : ""} de présence générée${nbDocsPresence > 1 ? "s" : ""}`,
    ],
    nbSessionsRealisees > 0 && nbEnrollmentsEmarges > 0,
  );
  // off.13/14/15 = indicateurs APPRENTISSAGE/CFA (« Coordination des intervenants
  //   apprentissage », « Exercice de la citoyenneté de l'apprenti », « droits et
  //   devoirs de l'apprenti »). Axion-IA n'exerce PAS l'apprentissage → ces
  //   indicateurs restent NON APPLICABLES (cf. indicateurs-registre : "app"
  //   découplé de l'AFEST). Seul off.28 est l'AFEST — et depuis le 2026-08-10
  //   plus rien n'est déduit du coaching 1-to-1 (conseil, hors Qualiopi).
  set(13, [], false);
  set(14, [], false);
  set(15, [], false);
  // off.16 : présentation à la certification — couvert si ≥1 formation certifiante
  //          avec code RS/RNCP (la présentation implique un code enregistré)
  set(
    16,
    [
      `${nbFormationsCertifiantes} formation${nbFormationsCertifiantes > 1 ? "s" : ""} certifiante${nbFormationsCertifiantes > 1 ? "s" : ""} avec code RS/RNCP`,
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
      `${nbTrainers} formateur${nbTrainers > 1 ? "s" : ""} actif${nbTrainers > 1 ? "s" : ""}`,
      `${nbMoyensTechniquesVerifies} moyen${nbMoyensTechniquesVerifies > 1 ? "s" : ""} technique${nbMoyensTechniquesVerifies > 1 ? "s" : ""} actif${nbMoyensTechniquesVerifies > 1 ? "s" : ""} vérifié${nbMoyensTechniquesVerifies > 1 ? "s" : ""} (salle/matériel/plateforme)`,
    ],
    nbTrainers > 0 && nbMoyensTechniquesVerifies > 0,
  );
  // off.18 : coordination des moyens — exige des formateurs actifs ET, pour
  //          chaque catégorie de moyens UTILISÉE (≥1 moyen actif), au moins 1
  //          moyen vérifié (dateVerification non null).
  //
  // 🔴 [audit blanc 2026-08-15] Ces deux conditions restent nécessaires, elles
  // ne sont plus suffisantes. Elles ne comptaient que des OBJETS : avec un
  // intervenant unique, « 1 formateur coordonné » ne coordonne personne, et un
  // inventaire vérifié dit que les moyens existent, pas comment on les articule.
  // La coordination se prouve par écrit — les modalités décrites en
  // configuration, ou une pièce « inventaire des moyens » / « organisation de
  // l'action » versée au registre (celle-ci porte le calendrier réel, la
  // modalité, le lieu et l'encadrement).
  set(
    18,
    [
      `${nbTrainers} formateur${nbTrainers > 1 ? "s" : ""} coordonnés`,
      categoriesUtilisees.length > 0
        ? `${categoriesUtilisees.length} catégorie${categoriesUtilisees.length > 1 ? "s" : ""} de moyens utilisée${categoriesUtilisees.length > 1 ? "s" : ""} (${categoriesUtilisees.join(", ")})`
        : "Aucun moyen pédagogique actif dans l'inventaire",
      categoriesSansVerification.length > 0
        ? `Catégorie(s) sans moyen vérifié : ${categoriesSansVerification.join(", ")}`
        : "Chaque catégorie utilisée a au moins 1 moyen vérifié",
      modalitesCoordinationRenseignees
        ? "Modalités de coordination des intervenants décrites en configuration"
        : nbPiecesCoordination > 0
          ? `${nbPiecesCoordination} pièce${nbPiecesCoordination > 1 ? "s" : ""} « inventaire des moyens » / « organisation de l'action » au registre`
          : "Aucune preuve écrite de coordination — off.18 exige les modalités de coordination en configuration OU une pièce « inventaire des moyens » / « organisation de l'action »",
    ],
    nbTrainers > 0 && moyensParCategorieCouverts && preuveCoordinationEcrite,
  );
  // off.19 : ressources pédagogiques mises à disposition — [P1] supports RÉELLEMENT
  //          finalisés (statut=genere ET pdfKey non null), pas un brouillon IA jamais rendu.
  // [audit 2026-07-26] Couverture, pas volumétrie. L'ancien calcul (`nbSupportsGeneres > 0`)
  // déclarait l'indicateur couvert dès UN support finalisé : en production, 13 supports
  // concentrés sur 2 formations suffisaient à masquer que 20 des 22 formations actives
  // n'avaient aucune ressource. Seuil retenu : TOUTES les formations actives doivent être
  // dotées — c'est ce que vérifie un auditeur qui tire une formation au hasard.
  const tauxCouvertureSupports =
    nbFormationsActives > 0
      ? Math.round((nbFormationsActivesAvecSupport / nbFormationsActives) * 100)
      : 0;
  set(
    19,
    [
      `${nbFormationsActivesAvecSupport}/${nbFormationsActives} formation${nbFormationsActives > 1 ? "s" : ""} active${nbFormationsActives > 1 ? "s" : ""} dotée${nbFormationsActives > 1 ? "s" : ""} d'au moins une ressource finalisée (${tauxCouvertureSupports} %)`,
      `${nbSupportsGeneres} support${nbSupportsGeneres > 1 ? "s" : ""} finalisé${nbSupportsGeneres > 1 ? "s" : ""} (généré + PDF disponible) sur ${nbSupports} au total`,
      nbFormationsActives > 0 && nbFormationsActivesAvecSupport < nbFormationsActives
        ? `${nbFormationsActives - nbFormationsActivesAvecSupport} formation(s) active(s) SANS aucune ressource — off.19 exige la mise à disposition pour chaque prestation`
        : `Toutes les formations actives disposent d'une ressource`,
    ],
    nbFormationsActives > 0 && nbFormationsActivesAvecSupport === nbFormationsActives,
  );
  set(
    20,
    [
      `${nbTraineesHandicap} stagiaire${nbTraineesHandicap > 1 ? "s" : ""} en situation de handicap suivi${nbTraineesHandicap > 1 ? "s" : ""}`,
    ],
    nbTraineesHandicap > 0 || nbEnrollmentsAdaptations > 0,
  );

  // Critère 5
  // off.21 : [P1] couvert seulement si ≥1 formateur actif avec fiche à jour
  //          (cvUploadedAt < 24 mois — aligné sur le pilotage M11 / l'alerte R11). Une
  //          fiche non datée ou périmée ne prouve pas la mobilisation actuelle
  //          de la compétence.
  //
  // 🔴 [audit blanc 2026-08-15] DEUX corrections.
  //
  //   1. Le LIBELLÉ mentait. Il annonçait « CV téléversé » alors que la seule
  //      chose vérifiée était la présence d'une URL dans `cvUrl` — et quand
  //      l'outil génère la fiche formateur, c'est LUI qui pose cette URL, sur
  //      la route de téléchargement de la fiche qu'il vient d'écrire. Devant un
  //      auditeur, présenter cette pièce comme un CV téléversé par le formateur
  //      est une affirmation fausse. Le libellé dit désormais « fiche formateur
  //      au dossier », qui est exactement ce dont l'organisme dispose.
  //
  //   2. La COUVERTURE exige en plus une pièce de compétence VALIDÉE au dossier
  //      (CV source, diplôme ou certification, statut « valide », non périmée).
  //      Une fiche que l'organisme s'écrit à lui-même ne justifie pas une
  //      qualification ; la pièce d'origine, versée puis validée, si.
  set(
    21,
    [
      `${nbTrainersAvecCVRecent} formateur${nbTrainersAvecCVRecent > 1 ? "s" : ""} actif${nbTrainersAvecCVRecent > 1 ? "s" : ""} avec fiche formateur au dossier, datée de moins de 24 mois`,
      `${nbFormateursPieceCompetence} formateur${nbFormateursPieceCompetence > 1 ? "s" : ""} actif${nbFormateursPieceCompetence > 1 ? "s" : ""} avec au moins une pièce de compétence validée au registre (CV source, diplôme ou certification)`,
      `${nbTrainersAvecCV} formateur${nbTrainersAvecCV > 1 ? "s" : ""} avec fiche au dossier toutes dates confondues / ${nbTrainers} actif${nbTrainers > 1 ? "s" : ""}`,
      nbFormateursPieceCompetence === 0
        ? "Aucune pièce de compétence validée — la fiche formateur peut être celle que l'outil a lui-même générée : elle ne justifie pas la qualification"
        : "Compétences justifiées par des pièces versées et validées au dossier formateur",
    ],
    nbTrainersAvecCVRecent > 0 && nbFormateursPieceCompetence > 0,
  );
  // off.22 : [P1] entretien/développement des compétences DANS LE TEMPS — exige une
  //          trace DATÉE et RÉCENTE (< 24 mois) d'action de développement (entretien
  //          professionnel, formation suivie, veille), source DISTINCTE du CV (off.21).
  //          La seule présence d'un CV ne prouve pas le maintien de la compétence.
  set(
    22,
    [
      `${nbDevActionsRecentes} action${nbDevActionsRecentes > 1 ? "s" : ""} de développement des compétences tracée${nbDevActionsRecentes > 1 ? "s" : ""} (< 24 mois : entretien pro / formation / veille)`,
      `${nbTrainersAvecCV} formateur${nbTrainersAvecCV > 1 ? "s" : ""} avec CV/qualification tracée`,
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
      `${nbVeilleLegaleExploitee} entrée${nbVeilleLegaleExploitee > 1 ? "s" : ""} de veille légale/réglementaire exploitée${nbVeilleLegaleExploitee > 1 ? "s" : ""} (< 12 mois, avec décision) sur ${nbVeilleLegale} au total`,
    ],
    nbVeilleLegaleExploitee > 0,
  );
  set(
    24,
    [
      `${nbVeilleMetiersExploitee} entrée${nbVeilleMetiersExploitee > 1 ? "s" : ""} de veille emplois/métiers exploitée${nbVeilleMetiersExploitee > 1 ? "s" : ""} (< 12 mois, avec décision) sur ${nbVeilleMetiers} au total`,
    ],
    nbVeilleMetiersExploitee > 0,
  );
  set(
    25,
    [
      `${nbVeillePedagogiqueExploitee} entrée${nbVeillePedagogiqueExploitee > 1 ? "s" : ""} de veille pédagogique/technologique exploitée${nbVeillePedagogiqueExploitee > 1 ? "s" : ""} (< 12 mois, avec décision) sur ${nbVeillePedagogique} au total`,
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
      `${nbPartenariatsHandicap} partenariat${nbPartenariatsHandicap > 1 ? "s" : ""} réseau handicap (Agefiph/Cap emploi/RHF) sur ${nbPartenariats} au total`,
      `${nbTraineesHandicap} stagiaire${nbTraineesHandicap > 1 ? "s" : ""} handicap suivi${nbTraineesHandicap > 1 ? "s" : ""}`,
      referentHandicapEmailRenseigne
        ? `Référent handicap : ${referentHandicapNom} (${referentHandicapEmail})`
        : "Référent handicap : email non renseigné (désignation à formaliser)",
    ],
    nbPartenariatsHandicap > 0 && referentHandicapEmailRenseigne,
  );
  // off.27 : [P1] la couverture exige la VIGILANCE réelle par sous-traitant actif —
  //   NDA renseigné + vérification data.gouv datée + contrat signé. Une ligne coquille
  //   (sans NDA/vérif/contrat) ne prouve pas les dispositions de sous-traitance.
  //
  // 🔴 2026-08-04 — DEUX voies de couverture, et la seconde manquait.
  //   Le RNQ demande les DISPOSITIONS de sous-traitance. Un OF qui sous-traite
  //   les prouve par la vigilance exercée sur chaque intervenant ; un OF qui ne
  //   sous-traite pas encore les prouve par sa PROCÉDURE ÉCRITE — c'est même le
  //   seul moyen dont il dispose, et c'est ce que l'auditeur demande en premier.
  //   Ce commentaire disait « voie non couverte par ce flag — action Will
  //   hors-code », alors que la PR 531 avait fait de cette procédure une pièce
  //   générée POUR cet indicateur. Le code existait, personne ne l'appelait ici.
  //
  // 🔴 2026-08-03 — Les DEUX natures de sous-traitant comptent désormais.
  //   `SousTraitant` = un ORGANISME (autre OF). `Trainer` avec
  //   `statut: "sous_traitant"` = une PERSONNE PHYSIQUE indépendante.
  //   Seule la première était comptée : Axion, dont le modèle repose sur des
  //   formateurs freelances, pouvait en référencer dix conformes et rester à zéro.
  //   Le critère 6 du RNQ vise « sous-traitants ET formateurs occasionnels ».
  const totalSousTraitants = nbSousTraitants + nbFormateursSousTraitants;
  const totalSousTraitantsConformes = nbSousTraitantsConformes + nbFormateursSousTraitantsConformes;
  // 🔴 2026-08-19 — les deux voies sont EXCLUSIVES, elles ne s'additionnent pas.
  //
  // La couverture s'écrivait `conformes > 0 || procédures > 0`, sans aucune
  // condition sur le `||`. Dix intervenants référencés, tous sans NDA, sans
  // vérification data.gouv et sans contrat signé, plus une procédure au
  // registre : `false || true` — un super-indicateur (NC majeure) affiché
  // « couvert ». La doctrine écrite trois lignes plus haut dit l'inverse, et
  // l'AFFICHAGE la respectait déjà (la preuve « dispositions prouvées par la
  // procédure écrite » n'est rendue que si `totalSousTraitants === 0`) : seule
  // la couverture ignorait la distinction.
  //
  // Le choix du seuil : quand des intervenants sont mobilisés, c'est la
  // vigilance exercée sur CHACUN qui prouve l'indicateur — un seul dossier
  // incomplet est exactement le dossier que l'auditeur tire au sort. La
  // procédure écrite n'est PAS ajoutée comme condition supplémentaire de cette
  // branche : le RNQ la demande comme moyen de preuve, pas en surcroît de
  // dossiers complets, et l'exiger gèlerait l'indicateur d'un OF dont tous les
  // intervenants sont en règle sur une pièce qu'il n'a pas encore générée.
  const off27Couvert =
    totalSousTraitants === 0
      ? nbProceduresSousTraitance > 0
      : totalSousTraitantsConformes === totalSousTraitants;
  const off27Preuves: string[] = [
    `${totalSousTraitantsConformes} sous-traitant${totalSousTraitantsConformes > 1 ? "s" : ""} conforme${totalSousTraitantsConformes > 1 ? "s" : ""} : NDA + vérif data.gouv + contrat signé`,
    totalSousTraitants > 0
      ? `${totalSousTraitants} référencé${totalSousTraitants > 1 ? "s" : ""} au total — ${nbSousTraitants} organisme${nbSousTraitants > 1 ? "s" : ""} actif${nbSousTraitants > 1 ? "s" : ""}, ${nbFormateursSousTraitants} formateur${nbFormateursSousTraitants > 1 ? "s" : ""} indépendant${nbFormateursSousTraitants > 1 ? "s" : ""}`
      : nbProceduresSousTraitance > 0
        ? "Aucun sous-traitant référencé — dispositions prouvées par la procédure écrite versée au registre"
        : "Aucun sous-traitant référencé — off.27 exige alors une procédure « dispositions sous-traitance »",
    nbProceduresSousTraitance > 0
      ? `${nbProceduresSousTraitance} procédure${nbProceduresSousTraitance > 1 ? "s" : ""} « dispositions sous-traitance » au registre`
      : "Aucune procédure « dispositions sous-traitance » générée",
  ];
  if (totalSousTraitants > 0 && totalSousTraitantsConformes < totalSousTraitants) {
    off27Preuves.push(
      `${totalSousTraitants - totalSousTraitantsConformes} intervenant${totalSousTraitants - totalSousTraitantsConformes > 1 ? "s" : ""} mobilisé${totalSousTraitants - totalSousTraitantsConformes > 1 ? "s" : ""} sans dossier de vigilance complet — la procédure écrite ne supplée pas la vigilance exercée sur chacun`,
    );
  }
  set(27, off27Preuves, off27Couvert);
  // off.28 (AFEST) : plus AUCUNE couverture automatique depuis le coaching
  //   (retrait 2026-08-10 — le 1-to-1 est du conseil, décision 2026-07-17 ;
  //   les parcours coaching comme preuve AFEST étaient le risque d'audit n°1).
  //   L'indicateur reste déclarable : si une Formation porte `alternance_afest`,
  //   il devient applicable et les preuves sont à constituer manuellement.
  set(
    28,
    appAfestApplicable
      ? [
          "Preuves AFEST à constituer manuellement (analyse de l'activité, alternance mises en situation/phases réflexives, évaluation — L.6313-1-2) — à compléter.",
        ]
      : [],
    false,
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
  // off.30 : « multi-parties » — [audit blanc 2026-08-15] deux conditions, pas une.
  //
  // Le `groupBy(["source"])` comptait des QUALITÉS DÉCLARÉES, pas des parties
  // prenantes. Chez cet organisme les deux « sources distinctes » relevées sont
  // la MÊME personne physique : la stagiaire est aussi la représentante du
  // client. L'indicateur affichait « multi-parties » sur une seule voix — et
  // c'est précisément la question que pose l'auditeur (« qui d'autre s'est
  // exprimé ? »).
  //
  // Couverture = ≥ 2 qualités déclarées ET ≥ 2 personnes physiques distinctes.
  // Les deux sont nécessaires : deux stagiaires font deux personnes mais une
  // seule partie prenante ; deux qualités portées par une seule personne font
  // une seule voix. Les appréciations dont l'auteur n'est pas rattaché en base
  // ne comptent ni pour l'un ni pour l'autre — on ne les invente pas, on les
  // affiche telles quelles.
  const off30MultiPartiesEtabli =
    nbAppreciationSourcesDistinctes >= 2 && nbPersonnesAppreciations >= 2;
  const off30Preuves: string[] = [
    `${nbAppreciations} appréciation${nbAppreciations > 1 ? "s" : ""} recueillie${nbAppreciations > 1 ? "s" : ""}`,
    `${nbAppreciationSourcesDistinctes} qualité${nbAppreciationSourcesDistinctes > 1 ? "s" : ""} déclarée${nbAppreciationSourcesDistinctes > 1 ? "s" : ""} parmi stagiaire/entreprise/financeur/formateur (≥ 2 requises)`,
    `${nbPersonnesAppreciations} personne${nbPersonnesAppreciations > 1 ? "s" : ""} physique${nbPersonnesAppreciations > 1 ? "s" : ""} distincte${nbPersonnesAppreciations > 1 ? "s" : ""} identifiée${nbPersonnesAppreciations > 1 ? "s" : ""} derrière ces appréciations (≥ 2 requises)`,
  ];
  if (nbAppreciationsAuteurNonEtabli > 0) {
    off30Preuves.push(
      `${nbAppreciationsAuteurNonEtabli} appréciation${nbAppreciationsAuteurNonEtabli > 1 ? "s" : ""}, rattachement des auteurs non établi — ne compte${nbAppreciationsAuteurNonEtabli > 1 ? "nt" : ""} pas comme partie prenante distincte`,
    );
  }
  if (nbAppreciations > 0 && !off30MultiPartiesEtabli) {
    off30Preuves.push(
      "Multi-parties non démontré : deux qualités déclarées peuvent être la même personne physique (stagiaire également représentante du client).",
    );
  }
  set(30, off30Preuves, off30MultiPartiesEtabli);
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
      `${nbReclamations} réclamation${nbReclamations > 1 ? "s" : ""} enregistrée${nbReclamations > 1 ? "s" : ""} et traitée${nbReclamations > 1 ? "s" : ""}`,
    ],
    procedureReclamationsOk && responsableQualiteNom.trim().length > 0,
  );
  // off.32 ⭐ — verdict et preuves viennent TOUS DEUX du prédicat unique.
  //
  // 🔑 L'ancien libellé affirmait « N réclamations + plan d'actions » : le plan
  // était ÉNONCÉ dans la preuve que lit l'auditeur, alors que rien nulle part ne
  // le comptait. On n'affiche plus que ce qui a été mesuré — et `preuves` porte
  // aussi bien ce qui est établi que ce qui manque, action par action, pour que
  // l'écran dise quoi remplir plutôt que de se contenter de rougir.
  const couvertureOff32 = evaluerCouvertureOff32(revueAnnuelle, maintenant);
  set(32, couvertureOff32.preuves, couvertureOff32.couvert);

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
