/**
 * Qualiopi — Génération du manifeste d'audit (AGENT B — T12).
 *
 * genererManifesteAudit() : pour chaque indicateur des 32 RNQ V9, liste les
 *   preuves disponibles (types DocumentGenere présents, comptes) + état de
 *   couverture. Retourne JSON + Markdown. PAS de binaire ZIP.
 *
 * genererDossierAuditZip() : construit un ZIP contenant le manifeste + les
 *   PDFs de preuve téléchargés depuis R2. Fail-soft sur chaque PDF manquant.
 *
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 */

import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerConformite } from "@/server/qualiopi/conformite/conformite-service";
import { renderRegistrePdfBuffer, REGISTRE_TYPES } from "@/server/qualiopi/registres/registres-pdf";
import { evaluerCouvertureOff32 } from "@/server/qualiopi/revues/plan-actions";
import { getObjectBufferR2, isR2Configured, documentPdfKey } from "@/lib/r2-storage";
import type { DocumentType, TrainingSessionStatut } from "../../../../prisma/generated/client";

/**
 * Le `where` des pièces ADMISSIBLES au dossier de preuves — écrit une seule fois.
 *
 * ## Deux exclusions, deux raisons distinctes
 *
 * **`annuleeAt: null`** — une pièce déclarée sans valeur n'est pas une preuve.
 * L'y glisser sans marquage reviendrait à présenter comme preuve un document
 * qu'on a soi-même annulé.
 *
 * **La session ni ANNULÉE ni REPORTÉE** — 🔴 `D2-5-12` (2026-08-20). Ce filtre
 * manquait. Une session reportée conserve la convention émise pour ses dates
 * INITIALES : la pièce n'est pas annulée — elle a bien été signée — mais aucune
 * formation n'a eu lieu à ces dates. Le certificateur recevait donc **deux
 * conventions pour la même prestation**, dont une pour une période vide. Un
 * dossier qui se contredit lui-même ne fait pas douter d'une pièce : il fait
 * douter de toutes.
 *
 * ⚠️ `sessionId: null` est ADMIS, et ce n'est pas un oubli : les pièces
 * générales de l'organisme (procédures, registres, lettres-cadres couvrant
 * plusieurs sessions) n'ont pas de session et sont précisément ce que la moitié
 * des indicateurs réclame. Les exclure viderait le dossier.
 *
 * 🔑 UNE fonction, pas trois recopies. Ce prédicat vivait en littéral à **trois**
 * endroits — le comptage `groupBy`, la liste par type, et la constitution du
 * ZIP — avec, à chaque fois, un commentaire priant le lecteur de les garder
 * identiques. Une prière n'est pas une garantie : c'est exactement ainsi que
 * `regleSignatureEnAttente` a divergé de `enAttente()` (constat `D3-4-06`, une
 * alerte critique par nuit sur des pièces annulées). Tout nouveau consommateur
 * appelle cette fonction, jamais ne réécrit son prédicat.
 *
 * La trace des annulations et des reports, elle, reste entière au registre
 * (motif, date, auteur) et au journal d'activité — c'est là que l'auditeur la
 * recoupe s'il la demande. Le dossier de PREUVES n'est pas le registre.
 */
export function pieceAdmissibleAuDossier(): {
  annuleeAt: null;
  OR: [{ sessionId: null }, { session: { statut: { notIn: TrainingSessionStatut[] } } }];
} {
  return {
    annuleeAt: null,
    OR: [{ sessionId: null }, { session: { statut: { notIn: ["annulee", "reportee"] } } }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface DossierAuditZipResult {
  /** Contenu du ZIP encodé en base64 (envoyable via Server Action). */
  readonly base64: string;
  /** Nom de fichier suggéré pour le téléchargement (sans extension). */
  readonly filename: string;
  /**
   * `true` si le dossier livré est incomplet : au moins un avertissement a été
   * émis (R2 non configuré, mode stub) OU toutes les preuves attendues n'ont pas
   * pu être jointes. L'appelant DOIT alerter l'utilisateur dans ce cas — un ZIP
   * incomplet remis à un auditeur peut ne contenir aucune preuve stagiaire.
   */
  readonly incomplet: boolean;
  /**
   * Nombre de PDF de preuve attendus (= documents présents en base dont le PDF
   * devrait être joint depuis R2). 0 s'il n'y a aucun document en base.
   */
  readonly nbPreuvesAttendues: number;
  /** Nombre de PDF de preuve effectivement joints au ZIP depuis R2. */
  readonly nbPreuvesJointes: number;
  /**
   * Avertissements lisibles décrivant chaque cause d'incomplétude (miroir du
   * fichier `AVERTISSEMENTS.txt` inclus dans le ZIP). Vide si le dossier est
   * complet.
   */
  readonly avertissements: string[];
}

/**
 * Nombre maximum de pièces NOMMÉES par type de document dans le manifeste.
 *
 * 🔴 Le manifeste n'a jamais porté le moindre identifiant : `{ type, count }`,
 * rien d'autre. L'auditrice lisait « émargement — 12 pièces » sans qu'aucune de
 * ces douze pièces ne soit désignable, ni ouvrable depuis l'écran. Le compte
 * disait qu'il y avait quelque chose ; il ne disait pas QUOI.
 *
 * Mais une session peut porter des dizaines de pièces d'un même type : lister
 * les 200 émargements d'une année transformerait la carte de l'indicateur en
 * annuaire, et le manifeste imprimé en listing. On plafonne donc à cinq — assez
 * pour ouvrir un échantillon et vérifier une numérotation, pas assez pour noyer
 * la lecture.
 *
 * ⚠️ Le plafond se DIT partout où il mord (`count > pieces.length`) : à
 * l'écran comme dans le Markdown. Une troncature muette se lit comme une liste
 * complète, et l'auditrice conclurait qu'il n'existe que cinq pièces là où le
 * registre en porte douze. `count` reste EXACT (il vient du `groupBy`) — seule
 * l'énumération est bornée.
 */
export const MAX_PIECES_LISTEES = 5;

/** Une pièce désignable : son identifiant technique et son numéro au registre. */
export interface PieceReference {
  /** `DocumentGenere.id` — cible de `/api/qualiopi/documents/<id>`. */
  readonly id: string;
  /** Numéro au registre (`AXI-DOC-2026-038`), seul lisible par un humain. */
  readonly numero: string;
}

export interface PreuveDocument {
  /** Type Prisma du document (DocumentType enum). */
  readonly type: DocumentType;
  /**
   * Nombre EXACT de documents de ce type en base (pièces annulées exclues).
   * Jamais plafonné : c'est le compte du registre.
   */
  readonly count: number;
  /**
   * Pièces désignables de ce type, les plus récentes d'abord, PLAFONNÉES à
   * {@link MAX_PIECES_LISTEES}. `pieces.length < count` signifie « liste
   * tronquée » — et doit être annoncé par tout rendu.
   */
  readonly pieces: readonly PieceReference[];
}

export interface IndicateurManifeste {
  readonly numero: number;
  readonly critere: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly libelle: string;
  readonly super: boolean;
  readonly statut: "couvert" | "a_completer" | "non_applicable";
  /** Preuves textuelles (depuis evaluerConformite). */
  readonly preuves: string[];
  /** Documents Prisma présents pertinents pour cet indicateur. */
  readonly documents: PreuveDocument[];
}

export interface ManifesteAuditPayload {
  readonly meta: {
    readonly genereAt: string;
    readonly version: string;
    readonly nbIndicateurs: number;
    readonly nbCouverts: number;
    readonly nbApplicables: number;
    readonly scorePct: number;
  };
  readonly indicateurs: IndicateurManifeste[];
}

export interface ManifesteAuditResult {
  readonly json: ManifesteAuditPayload;
  readonly markdown: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping indicateur → types de documents pertinents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Associe chaque indicateur à la liste des DocumentType qui servent de preuve.
 * Seuls les types présents en base sont comptés (les 0 ne sont pas affichés).
 *
 * 🔴 Révision 2026-08-15 (audit blanc). Une pièce ne figure ici que si elle
 * PROUVE l'exigence de l'indicateur en face duquel elle est présentée. Ce
 * manifeste est lu par l'auditrice à côté du référentiel : lui montrer un kit
 * de financement à l'indicateur 19 (« ressources pédagogiques »), un certificat
 * de réalisation à l'indicateur 3 (« taux d'obtention des certifications ») ou
 * une convention tripartite à l'indicateur 27 (« sous-traitance ») ne remplit
 * pas la colonne : cela ouvre un écart, parce que l'organisme démontre qu'il
 * n'a pas lu ce qu'il produit. Un indicateur SANS pièce documentaire est
 * préférable à une pièce hors sujet — ses éléments constatés restent affichés,
 * et le trou se voit.
 *
 * Les types absents de cette table (facture, devis, avoir, kit_opco, kit_cpf,
 * kit_france_travail, autorisation_captation) ne prouvent aucun indicateur du
 * RNQ : ils restent intégralement joints au ZIP, ils ne sont simplement pas
 * présentés comme preuve de quelque chose qu'ils ne prouvent pas.
 */
const INDICATEUR_DOCUMENT_TYPES: Partial<Record<number, DocumentType[]>> = {
  // C1 — Information public
  // Le règlement intérieur ne dit rien des prestations, de leurs tarifs ni de
  // leurs délais d'accès : il informe sur les conditions de déroulement, donc
  // il est rattaché à off.9 et à lui seul.
  1: ["livret_accueil"],
  2: ["satisfaction", "grille_evaluation"],
  // off.3 (conditionnel « cert ») — taux d'OBTENTION des certifications
  // préparées. Ni le certificat de réalisation (qui atteste une présence) ni
  // l'attestation de fin de formation (qui atteste des acquis) ne disent qu'une
  // certification a été obtenue. La preuve de cet indicateur est statistique et
  // publiée ; aucune pièce du registre ne la porte.
  3: [],

  // C2 — Objectifs
  4: ["positionnement"],
  // off.5 / off.6 — le PROGRAMME est l'annexe que la convention annonce : c'est
  // lui qui énonce les objectifs et détaille les contenus et les modalités,
  // donc la pièce que l'auditrice ouvre sur ces deux indicateurs. La
  // convocation, elle, informe des conditions de déroulement : elle relève
  // d'off.9 et n'a jamais rien prouvé des objectifs.
  5: ["programme"],
  6: ["programme", "convention", "contrat", "convention_tripartite"],
  // off.7 (conditionnel « cert ») — adéquation des contenus aux exigences du
  // référentiel de certification visée. Ni la convention ni la lettre de
  // mission ne portent ce croisement contenus ↔ référentiel.
  7: [],
  // off.8 — positionnement ET évaluation des acquis à l'entrée : la grille
  // d'évaluation est la seconde moitié de l'exigence.
  8: ["positionnement", "grille_evaluation"],

  // C3 — Accueil & suivi
  9: ["convocation", "livret_accueil", "reglement_interieur", "organisation_action"],
  10: ["convention", "contrat"],
  11: ["grille_evaluation", "attestation", "attestation_partielle"],
  12: ["emargement", "releve_connexion", "organisation_action"],
  13: [],
  14: [],
  15: [],
  // off.16 (conditionnel « cert ») — présentation effective des bénéficiaires
  // aux épreuves de certification. Les preuves sont les inscriptions et les
  // convocations aux épreuves : aucune n'est produite au registre. Le
  // certificat de réalisation atteste l'exécution de l'action, pas l'accès à
  // une certification.
  16: [],

  // C4 — Moyens (inventaire_moyens = doc A14, LOT 2)
  17: ["lettre_mission", "liste_formateurs", "inventaire_moyens"],
  // off.18 — coordination des INTERVENANTS (pédagogiques, administratifs,
  // logistiques), pas des financeurs : la lettre de mission et le contrat de
  // sous-traitance sont les pièces qui les mobilisent et répartissent les
  // rôles. La convention tripartite, elle, organise une prise en charge
  // financière.
  18: ["lettre_mission", "contrat_sous_traitance", "inventaire_moyens"],
  // off.19 — ressources PÉDAGOGIQUES mises à disposition. Les kits OPCO / CPF /
  // France Travail sont des dossiers de financement : les présenter ici
  // revenait à répondre « voici nos demandes de prise en charge » à la question
  // « quels supports remettez-vous aux bénéficiaires ». Le programme, lui,
  // décrit les moyens et supports mobilisés.
  19: ["programme", "inventaire_moyens"],
  20: [],

  // C5 — Qualification
  // La liste des formateurs (titres, qualités, lien contractuel) est réclamée
  // telle quelle par off.21 ; une fiche par intervenant n'en tient pas lieu.
  21: ["cv_formateur", "liste_formateurs", "lettre_mission"],
  22: [],

  // C6 — Environnement
  23: [],
  24: [],
  25: [],
  26: [],
  // off.27 — la procédure écrite prouve que les dispositions sont DÉFINIES, le
  // contrat de sous-traitance qu'elles sont APPLIQUÉES. La convention
  // tripartite qui figurait ici est une convention de financement : elle ne
  // porte aucune clause de sous-traitance.
  27: ["procedure_sous_traitance", "contrat_sous_traitance"],
  // off.28 (AFEST) : AFEST retiré le 2026-08-10 — le 1-to-1 est du conseil
  // (décision 2026-07-17). Plus aucun document coaching (protocole AFEST,
  // attestation, émargement 1-to-1) ne sert de preuve à cet indicateur ;
  // il reste conditionnel « afest » et non applicable tant qu'aucune
  // Formation ne déclare `alternance_afest`.
  28: [],
  29: [],

  // C7 — Amélioration
  30: ["satisfaction"],
  31: [],
  32: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// genererManifesteAudit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le manifeste d'audit Qualiopi.
 *
 * Pour chaque indicateur :
 *   1. Évaluation de conformité (via evaluerConformite).
 *   2. Comptage des DocumentGenere par type (preuves documentaires).
 * Résultat : JSON structuré + Markdown lisible par l'auditeur.
 */
export async function genererManifesteAudit(): Promise<ManifesteAuditResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyManifeste();
  }

  // Évaluation des 32 indicateurs

  const conformite = await evaluerConformite();

  // Comptage global des documents par type (une seule requête groupBy)
  //
  // 🔴 Sans ce `where`, le manifeste ANNONÇAIT des preuves que le dossier remis
  // ne contenait pas : « lettre_mission — 1 document » à l'indicateur 17 alors
  // que la seule pièce de ce type avait été annulée et que le ZIP n'en portait
  // aucune. L'auditrice ouvre le dossier à la page annoncée et n'y trouve rien.
  //
  // Le prédicat est celui de `pieceAdmissibleAuDossier()` — le MÊME objet, pas
  // une copie qu'on prie de rester identique. Ce qu'il exclut, et pourquoi, est
  // écrit une seule fois, en tête de ce fichier.
  const docCounts = await prisma.documentGenere.groupBy({
    by: ["type"],
    where: pieceAdmissibleAuDossier(),
    _count: { _all: true },
  });

  // ── Preuves enrichies pour le manifeste ──────────────────────────────────
  // off.23/24/25 : veille par type
  const [nbVeilleLegale, nbVeilleMetiers, nbVeillePedagogique] = await Promise.all([
    prisma.veille.count({ where: { type: "legale" } }),
    prisma.veille.count({ where: { type: "metiers" } }),
    prisma.veille.count({ where: { type: "pedagogique" } }),
  ]);

  // off.26 : nom du référent handicap
  // 🔴 2026-08-23 — le manifeste AFFIRMAIT une désignation que personne n'avait
  // faite. Il ne lisait que `referent_handicap_nom`, clé dont le registre porte
  // le défaut `str("Williams Jullin")` : sur une base entièrement vierge,
  // `getQualiopiConfig` rend ce défaut et la pièce remise au certificateur
  // écrivait « Référent handicap désigné : Williams Jullin ».
  //
  // Un manifeste qui se trompe en DÉFAVEUR d'Axion-IA coûte du temps ; un
  // manifeste qui se trompe en sa FAVEUR met une affirmation inexacte dans les
  // mains de l'auditeur, sur un super-indicateur (26 ⭐). C'est le pire des deux.
  //
  // La désignation exige donc désormais un référent NOMMÉ **et JOIGNABLE** —
  // le même signal que retient `evaluerConformite` pour off.26, et que
  // l'alerte R01 retient depuis le même jour. Trois lectures, un seul prédicat.
  const [referentHandicapNom, referentHandicapEmail] = await Promise.all([
    getQualiopiConfig("referent_handicap_nom").catch(() => ""),
    getQualiopiConfig("referent_handicap_email").catch(() => ""),
  ]);
  const referentHandicapEstDesigne =
    referentHandicapNom.trim().length > 0 && referentHandicapEmail.trim().length > 0;

  // off.1 : numéro NDA DREETS (obligatoire pour considérer off.1 comme couvert)
  const ndaNumero = await getQualiopiConfig("nda_numero").catch(() => "");

  // off.31/32 : responsable qualité (pilote le RNQ + la revue de direction).
  // Lecture APRÈS nda_numero pour ne pas perturber l'ordre des appels mockés en test.
  const responsableQualiteNom = await getQualiopiConfig("responsable_qualite_nom").catch(() => "");

  // off.32 ⭐ : la revue de direction VALIDÉE de l'année courante, avec son CONTENU.
  //
  // 🔴 2026-08-23 — le manifeste ne disait d'off.32 que le nom du pilote. Nommer
  // un responsable de l'amélioration continue n'est PAS la mise en œuvre de
  // mesures d'amélioration : la pièce remise au certificateur ne portait aucune
  // trace de ce qui avait été décidé, ni de qui en répondait, ni pour quand.
  // Même prédicat que la matrice — `evaluerCouvertureOff32` — pour que le dossier
  // remis et l'écran de l'auditeur ne puissent pas dire deux choses différentes.
  const maintenantOff32 = new Date();
  const revueAnnuelleOff32 = await prisma.revueDirection
    .findFirst({
      where: { statut: "validee", annee: maintenantOff32.getFullYear() },
      select: { annee: true, participants: true, decisions: true, planActions: true },
    })
    .catch(() => null);
  const couvertureOff32 = evaluerCouvertureOff32(revueAnnuelleOff32, maintenantOff32);

  // off.30 : appréciations multi-parties
  const nbAppreciations = await prisma.appreciation.count();

  // off.21 : formateurs actifs avec CV
  const trainersAvecCV = await prisma.trainer.findMany({
    where: { actif: true, cvUrl: { not: null } },
    select: { id: true, nom: true, prenom: true, cvUrl: true },
  });

  // Preuves supplémentaires par indicateur (complètent celles de conformite-service)
  const preuvesSuppMap = new Map<number, string[]>([
    [
      1,
      [
        ndaNumero.trim().length > 0
          ? `NDA DREETS obtenu : ${ndaNumero}`
          : "NDA DREETS : non renseigné — off.1 ne peut pas être couvert sans numéro de déclaration d'activité",
      ],
    ],
    [
      23,
      nbVeilleLegale > 0
        ? [
            `${nbVeilleLegale} entrée${nbVeilleLegale > 1 ? "s" : ""} de veille légale/réglementaire`,
          ]
        : [],
    ],
    [
      24,
      nbVeilleMetiers > 0
        ? [`${nbVeilleMetiers} entrée${nbVeilleMetiers > 1 ? "s" : ""} de veille emplois/métiers`]
        : [],
    ],
    [
      25,
      nbVeillePedagogique > 0
        ? [
            `${nbVeillePedagogique} entrée${nbVeillePedagogique > 1 ? "s" : ""} de veille pédagogique/technologique`,
          ]
        : [],
    ],
    [
      26,
      [
        ...(referentHandicapEstDesigne
          ? [`Référent handicap désigné : ${referentHandicapNom} (${referentHandicapEmail})`]
          : [
              referentHandicapNom.trim().length > 0
                ? `Référent handicap : « ${referentHandicapNom} » nommé, mais AUCUN e-mail de contact — désignation non établie`
                : "Référent handicap : non renseigné en config",
            ]),
      ],
    ],
    [
      30,
      [
        `${nbAppreciations} appréciation${nbAppreciations > 1 ? "s" : ""} multi-parties (stagiaire/entreprise/financeur/formateur)`,
      ],
    ],
    [
      31,
      responsableQualiteNom.trim().length > 0
        ? [`Responsable qualité désigné (pilote la revue de direction) : ${responsableQualiteNom}`]
        : ["Responsable qualité : non renseigné en config"],
    ],
    [
      32,
      [
        // Le pilote reste utile à l'auditeur — mais il n'est plus la SEULE chose
        // dite d'off.32 : il ne prouve pas qu'une mesure a été mise en œuvre.
        responsableQualiteNom.trim().length > 0
          ? `Démarche d'amélioration continue pilotée par : ${responsableQualiteNom}`
          : "Responsable qualité : non renseigné en config (pilotage amélioration continue)",
        ...couvertureOff32.preuves,
      ],
    ],
    [
      21,
      trainersAvecCV.length > 0
        ? [
            `${trainersAvecCV.length} formateur${trainersAvecCV.length > 1 ? "s" : ""} avec CV téléversé`,
            ...trainersAvecCV.map((t) => `- ${t.prenom ?? ""} ${t.nom} (CV : ${t.cvUrl ?? "—"})`),
          ]
        : ["Aucun formateur avec CV téléversé"],
    ],
  ]);

  const countByType = new Map<DocumentType, number>(docCounts.map((d) => [d.type, d._count._all]));

  // ── Pièces DÉSIGNABLES, par type ─────────────────────────────────────────
  //
  // Le `groupBy` ci-dessus donne des COMPTES ; il ne donne aucun identifiant.
  // Sans identifiant, ni la console ni le Markdown ne peuvent renvoyer vers la
  // pièce : le manifeste annonçait des preuves qu'il ne permettait pas d'ouvrir.
  //
  // Une requête par type, bornée à MAX_PIECES_LISTEES : on ne rapatrie jamais
  // les milliers de lignes du registre, et le plafond est appliqué par Postgres
  // (`take`), pas après coup en mémoire. Seuls les types qui servent de preuve
  // à un indicateur ET qui existent en base sont interrogés — les autres ne
  // seraient affichés nulle part.
  const typesInteroges = [
    ...new Set(
      Object.values(INDICATEUR_DOCUMENT_TYPES).flatMap((types) => types ?? ([] as DocumentType[])),
    ),
  ].filter((type) => (countByType.get(type) ?? 0) > 0);

  const piecesParType = new Map<DocumentType, PieceReference[]>(
    await Promise.all(
      typesInteroges.map(async (type): Promise<[DocumentType, PieceReference[]]> => {
        const pieces = await prisma.documentGenere.findMany({
          // Ce qui ne se compte pas ne se propose pas non plus en
          // téléchargement : même prédicat, par construction.
          where: { type, ...pieceAdmissibleAuDossier() },
          select: { id: true, numero: true },
          orderBy: { createdAt: "desc" },
          take: MAX_PIECES_LISTEES,
        });
        return [type, pieces];
      }),
    ),
  );

  // Construction des entrées du manifeste
  const indicateurs: IndicateurManifeste[] = conformite.indicateurs.map((ind) => {
    // 🔴 Un indicateur NON APPLICABLE ne présente aucune pièce. Le Markdown
    // l'écrivait déjà (« Non applicable au périmètre de l'OF. », sans rubrique
    // « Documents »), mais le JSON — donc la vue manifeste de la console, celle
    // que l'auditrice lit à l'écran — continuait de lister deux rubriques de
    // documents sous l'indicateur 7 marqué « Non applicable ». Les deux sorties
    // disent désormais la même chose : hors périmètre, rien à montrer.
    const docTypes =
      ind.statut === "non_applicable" ? [] : (INDICATEUR_DOCUMENT_TYPES[ind.numero] ?? []);
    const documents: PreuveDocument[] = docTypes
      .map((type) => ({
        type,
        count: countByType.get(type) ?? 0,
        pieces: piecesParType.get(type) ?? [],
      }))
      .filter((d) => d.count > 0);

    // Fusionner les preuves de conformite-service avec les preuves enrichies du manifeste
    const preuvesSupplémentaires = preuvesSuppMap.get(ind.numero) ?? [];
    const toutesPreuves = [
      ...ind.preuves,
      // Ajouter seulement les preuves supplémentaires non déjà présentes
      ...preuvesSupplémentaires.filter((p) => !ind.preuves.includes(p)),
    ];

    return {
      numero: ind.numero,
      critere: ind.critere,
      libelle: ind.libelle,
      super: ind.super,
      statut: ind.statut,
      preuves: toutesPreuves,
      documents,
    };
  });

  const json: ManifesteAuditPayload = {
    meta: {
      genereAt: new Date().toISOString(),
      version: "RNQ-V9",
      nbIndicateurs: indicateurs.length,
      nbCouverts: conformite.nbCouverts,
      nbApplicables: conformite.nbApplicables,
      scorePct: conformite.scorePct,
    },
    indicateurs,
  };

  const markdown = buildMarkdown(json);

  return { json, markdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// genererDossierAuditZip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un dossier d'audit complet au format ZIP.
 *
 * Contenu du ZIP :
 *   - `manifeste.json`  — manifeste structuré (32 indicateurs RNQ V9)
 *   - `manifeste.md`    — rendu Markdown lisible par l'auditeur
 *   - `preuves/<type>/<numero>.pdf` — PDF de chaque DocumentGenere ayant une
 *     clé R2 reconstructible. Les PDFs manquants (R2 absent ou 404) sont omis
 *     et consignés dans `index.txt` (fail-soft).
 *   - `registres/<nom>.pdf` — exports d'état des 5 registres (réclamations,
 *     veille, revue de direction, partenariats, sous-traitants) rendus à la
 *     volée depuis les données réelles (LOT 2 — fail-soft).
 *
 * Stub-aware : retourne un ZIP minimal (manifeste seulement) si la magic
 * string "stub.invalid" est détectée dans DATABASE_URL.
 */
export async function genererDossierAuditZip(): Promise<DossierAuditZipResult> {
  const now = new Date();
  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `dossier-audit-qualiopi-${horodatage}`;

  // ── Mode stub : ZIP minimal manifeste-only ──────────────────────────────
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    const manifeste = buildEmptyManifeste();
    const zip = new JSZip();
    zip.file("manifeste.json", JSON.stringify(manifeste.json, null, 2));
    zip.file("manifeste.md", manifeste.markdown);
    zip.file("index.txt", "Mode build (stub) — données indisponibles. Aucun PDF inclus.\n");
    const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
    return {
      base64,
      filename,
      incomplet: true,
      nbPreuvesAttendues: 0,
      nbPreuvesJointes: 0,
      avertissements: ["Mode build (stub) — données indisponibles, aucun PDF de preuve inclus."],
    };
  }

  // ── Génération normale ──────────────────────────────────────────────────
  const manifeste = await genererManifesteAudit();

  // Récupération de tous les DocumentGenere (id + type + numero + createdAt)
  // pour reconstruire les clés R2. On limite aux types qui ont des preuves
  // documentaires pour éviter de requêter des milliers de lignes inutiles.
  // ⚠️ Ce ZIP est le dossier de PREUVES remis au certificateur. Ce qui n'y a pas
  // sa place — pièce annulée, session annulée ou reportée — est écrit une seule
  // fois, en tête de ce fichier.
  const allDocuments = await prisma.documentGenere.findMany({
    where: pieceAdmissibleAuDossier(),
    select: { id: true, type: true, numero: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const zip = new JSZip();
  zip.file("manifeste.json", JSON.stringify(manifeste.json, null, 2));
  zip.file("manifeste.md", manifeste.markdown);

  // 🔴 OUBLI M3 — les pièces FORMATEUR n'étaient jamais exportées : ni CV, ni
  // Kbis, ni NDA, ni contrat de sous-traitance. Le manifeste ne portait qu'une
  // URL en clair dans un Markdown. Or les indicateurs 21 (maîtrise VÉRIFIÉE des
  // intervenants) et 27 (sous-traitance) sont à non-conformité MAJEURE, et le
  // plan les présente comme le gain principal du chantier. Ils n'étaient pas
  // outillés du tout.
  const piecesFormateurs = await prisma.trainerDocument.findMany({
    select: {
      type: true,
      numeroPiece: true,
      fichierUrl: true,
      dateEmission: true,
      dateExpiration: true,
      statutValidation: true,
      trainer: { select: { nom: true, prenom: true } },
    },
    orderBy: [{ trainer: { nom: "asc" } }, { type: "asc" }],
  });

  zip.file(
    "formateurs/pieces.json",
    JSON.stringify(
      piecesFormateurs.map((p) => ({
        formateur: `${p.trainer.prenom} ${p.trainer.nom}`.trim(),
        type: p.type,
        numeroPiece: p.numeroPiece,
        fichierUrl: p.fichierUrl,
        dateEmission: p.dateEmission,
        dateExpiration: p.dateExpiration,
        statutValidation: p.statutValidation,
        // ⚠️ Une pièce expirée reste dans l'export, signalée : la retirer
        // donnerait l'illusion d'un dossier complet.
        expiree:
          p.dateExpiration !== null && p.dateExpiration.getTime() < Date.now() ? true : false,
      })),
      null,
      2,
    ),
  );

  const indexLines: string[] = [`Dossier d'audit Qualiopi — ${horodatage}`, ""];
  indexLines.push(
    `Pièces formateurs (ind. 21 / 27) : ${piecesFormateurs.length} → formateurs/pieces.json`,
  );
  const sansFichier = piecesFormateurs.filter((p) => p.fichierUrl === null).length;
  const expirees = piecesFormateurs.filter(
    (p) => p.dateExpiration !== null && p.dateExpiration.getTime() < Date.now(),
  ).length;
  if (sansFichier > 0) {
    indexLines.push(
      `  ⚠️ ${sansFichier} pièce${sansFichier > 1 ? "s" : ""} sans fichier joint — référence sans preuve.`,
    );
  }
  if (expirees > 0) {
    indexLines.push(`  ⚠️ ${expirees} pièce${expirees > 1 ? "s" : ""} EXPIRÉE(S).`);
  }

  // [P1] Alerte NON silencieuse : si R2 n'est pas configuré, AUCUN PDF de preuve
  //   ne sera restituable — le dossier serait livré vide sans avertissement.
  const r2Ok = isR2Configured();
  const avertissements: string[] = [];
  if (!r2Ok) {
    avertissements.push(
      "⚠️ STOCKAGE R2 NON CONFIGURÉ — aucun PDF de preuve n'est restituable. Le dossier ne contient que le manifeste et les registres. Configurez R2 avant l'audit.",
    );
  }

  indexLines.push(
    `Manifeste : ${allDocuments.length} document${allDocuments.length > 1 ? "s" : ""} en base.`,
  );
  indexLines.push("");

  let nbInclus = 0;
  let nbOmis = 0;
  let nbDocsInclus = 0;

  for (const doc of allDocuments) {
    // [P1] clé alignée sur l'écriture (documents-service.ts utilise l'année LOCALE
    //   au moment de la génération) — évite d'omettre des PDF à la bascule d'année.
    const r2Key = documentPdfKey(doc);
    const buffer = await getObjectBufferR2(r2Key);

    if (buffer !== null) {
      // Chemin dans le ZIP : preuves/<type>/<numero>.pdf
      zip.file(`preuves/${doc.type}/${doc.numero}.pdf`, buffer);
      indexLines.push(`[OK]  preuves/${doc.type}/${doc.numero}.pdf  (${buffer.byteLength} octets)`);
      nbInclus++;
      nbDocsInclus++;
    } else {
      indexLines.push(`[OMIS] ${r2Key} — non disponible (R2 absent ou clé introuvable)`);
      nbOmis++;
    }
  }

  // [P1] Alerte NON silencieuse : des documents existent en base mais AUCUN PDF
  //   de preuve n'a pu être joint → le dossier stagiaire est vide (R2 / clés).
  if (allDocuments.length > 0 && nbDocsInclus === 0) {
    avertissements.push(
      `⚠️ ${allDocuments.length} document${allDocuments.length > 1 ? "s" : ""} en base mais AUCUN PDF de preuve joint — vérifiez le stockage R2 (les preuves stagiaires convention→attestation sont absentes du dossier).`,
    );
  }

  // ── Exports d'état des registres (LOT 2 — A3/A7/A8/A17/A18) ─────────────
  //   Rendus à la volée depuis les données réelles (pas des DocumentGenere).
  //   Fail-soft : un registre en erreur est consigné et n'invalide pas le ZIP.
  indexLines.push("");
  for (const type of REGISTRE_TYPES) {
    try {
      const { buffer, filename } = await renderRegistrePdfBuffer(type);
      zip.file(`registres/${filename}`, buffer);
      indexLines.push(`[OK]  registres/${filename}  (${buffer.byteLength} octets)`);
      nbInclus++;
    } catch (err) {
      indexLines.push(
        `[OMIS] registres/${type} — erreur de rendu (${err instanceof Error ? err.message : String(err)})`,
      );
      nbOmis++;
      // 🔴 #3 — un registre réglementaire manquant DOIT rendre le dossier INCOMPLET.
      // Avant, l'échec n'était que dans index.txt et `incomplet` ne dépendait que des
      // preuves R2 → un dossier privé de son registre sous-traitants (ind. 27) ou revue
      // de direction (ind. 32) était remis à l'auditeur COFRAC comme « complet ».
      avertissements.push(
        `⚠️ Registre réglementaire « ${type} » absent du dossier (erreur de rendu). Corrigez-le avant de remettre ce dossier à un auditeur.`,
      );
    }
  }

  indexLines.push("");
  indexLines.push(`Résumé : ${nbInclus} PDF inclus, ${nbOmis} omis.`);
  zip.file("index.txt", indexLines.join("\n") + "\n");

  // [P1] Les avertissements sont écrits à la fois EN TÊTE de l'index et dans un
  //   fichier dédié bien visible, pour que les trous ne passent pas inaperçus.
  if (avertissements.length > 0) {
    const banniere = ["AVERTISSEMENTS — dossier d'audit incomplet", "", ...avertissements, ""];
    zip.file("AVERTISSEMENTS.txt", banniere.join("\n") + "\n");
    zip.file("index.txt", [...banniere, "", ...indexLines].join("\n") + "\n");
  }

  const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });

  // [C3] Incomplétude VISIBLE dans le type de retour : le ZIP se génère toujours
  //   (fail-soft), mais l'appelant sait combien de preuves manquent et pourquoi.
  //   nbPreuvesAttendues = documents en base ; nbPreuvesJointes = PDF R2 réellement
  //   inclus. Incomplet dès qu'un avertissement existe (R2 absent) OU qu'une
  //   preuve attendue manque.
  const nbPreuvesAttendues = allDocuments.length;
  const nbPreuvesJointes = nbDocsInclus;
  const incomplet = avertissements.length > 0 || nbPreuvesJointes < nbPreuvesAttendues;

  return {
    base64,
    filename,
    incomplet,
    nbPreuvesAttendues,
    nbPreuvesJointes,
    avertissements,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suffixe Markdown d'une rubrique « Documents » : les NUMÉROS des pièces.
 *
 * Le format de la ligne est INCHANGÉ (« - `type` : N document(s) ») — seuls des
 * numéros s'y ajoutent, et jamais d'identifiants techniques : un UUID sur une
 * feuille imprimée ne dit rien à personne, alors qu'un numéro de registre est
 * exactement ce que l'auditrice recoupe avec `preuves/<type>/<numero>.pdf` dans
 * le ZIP du même dossier.
 *
 * ⚠️ Quand la liste est plafonnée, le suffixe le DIT. Un « 12 documents — A, B,
 * C, D, E » muet se lirait comme une énumération complète, donc comme un
 * registre de cinq pièces amputé de sept.
 */
function suffixeNumeros(d: PreuveDocument): string {
  const numeros = d.pieces.map((p) => p.numero);
  if (numeros.length === 0) return "";
  if (numeros.length < d.count) {
    return ` — ${numeros.length} numéro${numeros.length > 1 ? "s" : ""} listé${numeros.length > 1 ? "s" : ""} sur ${d.count} : ${numeros.join(", ")}`;
  }
  return ` — ${numeros.join(", ")}`;
}

function buildMarkdown(payload: ManifesteAuditPayload): string {
  const lignes: string[] = [];

  lignes.push("# Manifeste d'audit Qualiopi — Axion-IA SAS");
  lignes.push("");
  lignes.push(`**Généré le :** ${new Date(payload.meta.genereAt).toLocaleString("fr-FR")}`);
  lignes.push(`**Référentiel :** ${payload.meta.version}`);
  lignes.push(
    `**Score de couverture :** ${payload.meta.nbCouverts} / ${payload.meta.nbApplicables} indicateurs applicables (${payload.meta.scorePct} %)`,
  );
  lignes.push("");
  lignes.push("---");
  lignes.push("");

  const criteres = [1, 2, 3, 4, 5, 6, 7] as const;

  for (const critere of criteres) {
    const inds = payload.indicateurs.filter((i) => i.critere === critere);
    if (inds.length === 0) continue;

    lignes.push(`## Critère ${critere}`);
    lignes.push("");

    for (const ind of inds) {
      const emoji =
        ind.statut === "couvert"
          ? "[OK]"
          : ind.statut === "non_applicable"
            ? "[N/A]"
            : "[A COMPLETER]";
      const superLabel = ind.super ? " ⭐" : "";
      lignes.push(`### Ind. ${ind.numero}${superLabel} — ${ind.libelle} ${emoji}`);
      lignes.push("");

      if (ind.statut !== "non_applicable") {
        if (ind.preuves.length > 0) {
          // 🔴 Constat F15, 2026-07-26. Ce bloc s'intitulait « Preuves » alors
          // que la liste mélange, produits par le même code, des preuves réelles
          // et des constats d'ABSENCE : « 0 réclamation enregistrée et traitée »,
          // « Procédure de réclamations : non attestée publiée ». Ce manifeste
          // est le document remis au certificateur — y présenter un manque comme
          // une preuve est exactement ce qu'un auditeur relève.
          // Titre neutre tant que `preuves: string[]` ne porte pas de polarité.
          lignes.push("**Éléments constatés :**");
          for (const p of ind.preuves) {
            lignes.push(`- ${p}`);
          }
        }

        if (ind.documents.length > 0) {
          lignes.push("");
          lignes.push("**Documents :**");
          for (const d of ind.documents) {
            lignes.push(
              `- \`${d.type}\` : ${d.count} document${d.count > 1 ? "s" : ""}${suffixeNumeros(d)}`,
            );
          }
        }

        if (ind.preuves.length === 0 && ind.documents.length === 0) {
          lignes.push("*Aucune preuve disponible.*");
        }
      } else {
        lignes.push("*Non applicable au périmètre de l'OF.*");
      }

      lignes.push("");
    }
  }

  lignes.push("---");
  lignes.push("");
  lignes.push(
    "*Ce manifeste est généré automatiquement par le Formation Engine Axion-IA. Il constitue un état des lieux à date et ne remplace pas un audit externe.*",
  );

  return lignes.join("\n");
}

function buildEmptyManifeste(): ManifesteAuditResult {
  const json: ManifesteAuditPayload = {
    meta: {
      genereAt: new Date().toISOString(),
      version: "RNQ-V9",
      nbIndicateurs: 0,
      nbCouverts: 0,
      nbApplicables: 0,
      scorePct: 0,
    },
    indicateurs: [],
  };
  return {
    json,
    markdown: "# Manifeste d'audit Qualiopi\n\n*Mode build — données indisponibles.*",
  };
}
