/**
 * Lot 1 §1.1 + §1.3 — LE PARCOURS D'UN DOSSIER DE SESSION. Module PUR.
 *
 * ## Ce qu'il est, et ce qu'il n'est surtout pas
 *
 * 🔴 **Il ne remplace pas `dossier-session.ts`, et il ne l'appelle jamais.**
 * `genererDossierSessionZip` télécharge chaque PDF et chaque image de signature
 * depuis R2 pour les re-hacher, dans des boucles `await` séquentielles.
 * L'appeler au rendu du hub multiplierait exactement le défaut de lenteur qu'on
 * prétend soigner. On lui emprunte ses PRÉDICATS SÉMANTIQUES — pièce annulée
 * exclue, toutes les parties du circuit signataires — jamais son exécution.
 *
 * ## Zéro requête
 *
 * Ce module ne connaît ni Prisma ni horloge : il reçoit un état déjà chargé et
 * la date. C'est ce qui le rend testable sans base — et le contrat stub du
 * dépôt (ADR 0026) l'exige de toute façon.
 *
 * Le hub charge déjà session, inscriptions, questionnaires, documents et
 * signatures. Ce module n'ajoute **aucune requête dupliquée** : il traduit.
 *
 * ## SSOT
 *
 * Un seul calcul alimente le hub, la liste des sessions, « À traiter » et les
 * alertes. Deux listes rivales de « reste à faire » reproduiraient le défaut
 * qu'on corrige — c'est déjà la raison pour laquelle la carte « kit formateur »
 * est absorbée comme une étape plutôt que laissée à côté.
 */

import { partiesRequisesPour } from "../documents/signature/parties-requises";
import { calculerEtat, mentionPour, pireEtat, type EtatEtape } from "./etat-echeance";

// ─────────────────────────────────────────────────────────────────────────────
// L'état d'entrée — exactement ce que le hub porte déjà
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionParcoursInput {
  readonly session: {
    readonly statut: "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";
    readonly dateDebut: Date;
    readonly dateFin: Date;
    readonly formateurPrincipalId: string | null;
    readonly financementType: string | null;
    /** Filiation, pour un statut terminal. */
    readonly sessionReporteeNumero?: string | null;
  };
  /** Pièces de la session, telles que le hub les charge. */
  readonly documents: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly numero: string;
    readonly createdAt: Date;
    readonly annuleeAt: Date | null;
    readonly traineeId?: string | null;
  }>;
  /** Signatures apposées, par `documentGenereId`. Révoquées déjà exclues. */
  readonly signaturesParPiece: ReadonlyMap<string, ReadonlyArray<{ readonly partie: string }>>;
  readonly inscriptions: ReadonlyArray<{
    readonly id: string;
    readonly statut: string;
    readonly emargementSigneAt: Date | null;
    readonly convocationEnvoyeeAt: Date | null;
    readonly questionnaires: ReadonlyArray<{
      readonly type: string;
      readonly envoyeAt: Date | null;
      readonly reponduAt: Date | null;
    }>;
    readonly evaluationFinaleAt: Date | null;
    /** Accès portail vivant — 🔴 GLOBAL au stagiaire, pas scopé session. */
    readonly aUnAccesPortail: boolean;
  }>;
  /** Nombre de jetons d'émargement encore vivants pour la session. */
  readonly liensEmargementActifs: number;
  /** Nombre de journées de présence confirmées. */
  readonly creneauxEmargement: number;
  readonly maintenant: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// La sortie
// ─────────────────────────────────────────────────────────────────────────────

export type EtapeCle =
  | "formateur_assigne"
  | "convention_generee"
  | "convention_signee"
  | "convention_contresignee"
  | "positionnement_envoye"
  | "positionnement_repondu"
  | "convocation_envoyee"
  | "creneaux_emargement"
  | "liens_signature_emis"
  | "emargement_signe"
  | "evaluation_finale"
  | "attestation"
  | "acces_portail"
  | "satisfaction_chaud"
  | "satisfaction_froid";

export interface EtapeParcours {
  readonly cle: EtapeCle;
  readonly libelle: string;
  readonly etat: EtatEtape;
  /** Phrase rendue à l'écran. L'état est dans le TEXTE (WCAG 1.4.1). */
  readonly mention: string;
  /** Le geste ET l'acteur — « qui fait quoi », jamais implicite. */
  readonly geste: string;
  /** « n/m » quand l'étape se compte par stagiaire. */
  readonly avancement?: { readonly fait: number; readonly total: number };
  /** Mise en garde propre à l'étape, quand il y en a une. */
  readonly avertissement?: string;
  /**
   * Pourquoi cette étape n'a AUCUNE borne de rattrapage — donc pourquoi elle ne
   * peut jamais devenir `hors_delai`.
   *
   * 🔴 Trouvé le 2026-08-17 en auditant le Lot 5. Quatre étapes déclaraient
   * `borne: null`, et `calculerEtat` rend alors `rattrapable` **pour toujours** :
   * elles ne peuvent MATHÉMATIQUEMENT pas atteindre l'état terminal.
   *
   * C'est délibéré pour les quatre — évaluer ou attester en retard laisse un
   * écart de date, pas une impossibilité, et les déclarer « hors délai » ferait
   * RENONCER. Mais le code ne distinguait pas ce choix d'un oubli : **une borne
   * oubliée ressemble exactement à une borne volontairement absente**. C'est le
   * même défaut que `resolutionAuto: false` sans motif, corrigé ce matin au
   * catalogue d'alertes — et corrigé ici de la même façon, au niveau du TYPE.
   */
  readonly motifSansBorne?: string;
}

export interface Parcours {
  readonly etapes: ReadonlyArray<EtapeParcours>;
  readonly pire: EtatEtape;
  /** n/N étapes acquittées — les `sans_objet` ne comptent dans aucun des deux. */
  readonly avancement: { readonly fait: number; readonly total: number };
  /**
   * Statut terminal (annulée / reportée) : la checklist se REPLIE, avec sa
   * filiation. Dérouler quatorze étapes sur une session annulée demanderait des
   * gestes que plus personne ne doit poser.
   */
  readonly repliee: { readonly motif: string } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jalons
// ─────────────────────────────────────────────────────────────────────────────

const MS_JOUR = 24 * 60 * 60 * 1000;

const avant = (d: Date, jours: number): Date => new Date(d.getTime() - jours * MS_JOUR);
const apres = (d: Date, jours: number): Date => new Date(d.getTime() + jours * MS_JOUR);

/**
 * Les pièces vivantes d'un type — annulées exclues.
 *
 * 🔴 Prédicat emprunté à `dossier-session.ts` : une pièce annulée au registre
 * n'atteste plus rien. La compter ferait afficher « convention générée » sur un
 * dossier dont la seule convention a été annulée — c'est arrivé sur
 * `AXI-DOC-2026-003`.
 */
function piecesVivantes(
  documents: SessionParcoursInput["documents"],
  ...types: string[]
): SessionParcoursInput["documents"] {
  return documents.filter((d) => types.includes(d.type) && d.annuleeAt === null);
}

/**
 * La pièce contractuelle est-elle signée par TOUTES les parties de son circuit ?
 *
 * 🔴 `partiesRequisesPour` est le SSOT (dix circuits). Recompter à la main ici
 * ferait diverger les deux listes, et une convention passerait « signée » à
 * deux signatures sur trois — sans que l'organisme ait contresigné. Rien ne
 * planterait ; l'écran mentirait.
 */
/** La partie ORGANISME du circuit — celle qui contresigne, toujours en dernier. */
const PARTIE_ORGANISME = "axionia";

/**
 * La pièce porte-t-elle au moins UNE signature d'une partie EXTERNE ?
 *
 * 🔴 On ne peut pas se contenter de compter les signatures : l'organisme
 * pourrait avoir contresigné une pièce que le client n'a jamais signée, et
 * l'étape « signée par le client » passerait au vert sur la signature de
 * l'organisme lui-même. C'est le genre d'inversion qu'un auditeur repère.
 */
function signeeParUneAutrePartie(
  piece: { readonly id: string },
  signaturesParPiece: SessionParcoursInput["signaturesParPiece"],
): boolean {
  return (signaturesParPiece.get(piece.id) ?? []).some((s) => s.partie !== PARTIE_ORGANISME);
}

/** L'organisme a-t-il contresigné ? */
function contresigneeParOrganisme(
  piece: { readonly id: string },
  signaturesParPiece: SessionParcoursInput["signaturesParPiece"],
): boolean {
  return (signaturesParPiece.get(piece.id) ?? []).some((s) => s.partie === PARTIE_ORGANISME);
}

function pieceEntierementSignee(
  piece: { readonly id: string; readonly type: string },
  signaturesParPiece: SessionParcoursInput["signaturesParPiece"],
): boolean {
  const requises = partiesRequisesPour(piece.type);
  if (requises === null || requises.length === 0) return false;
  const apposees = new Set((signaturesParPiece.get(piece.id) ?? []).map((s) => s.partie));
  return requises.every((p) => apposees.has(p));
}

// ─────────────────────────────────────────────────────────────────────────────
// Le parcours
// ─────────────────────────────────────────────────────────────────────────────

export function construireParcours(input: SessionParcoursInput): Parcours {
  const { session, documents, signaturesParPiece, inscriptions, maintenant } = input;

  // Statut terminal : on replie, on ne déroule pas.
  if (session.statut === "annulee" || session.statut === "reportee") {
    const filiation =
      session.statut === "reportee" && session.sessionReporteeNumero
        ? ` vers ${session.sessionReporteeNumero}`
        : "";
    return {
      etapes: [],
      pire: "sans_objet",
      avancement: { fait: 0, total: 0 },
      repliee: { motif: `Session ${session.statut}${filiation}` },
    };
  }

  const debut = session.dateDebut;
  const fin = session.dateFin;
  const actives = inscriptions.filter((e) => e.statut === "planifiee" || e.statut === "presente");
  const n = actives.length;

  const etapes: EtapeParcours[] = [];

  // ── 1. Formateur assigné ──────────────────────────────────────────────────
  etapes.push(
    etape({
      cle: "formateur_assigne",
      libelle: "Formateur assigné",
      fait: session.formateurPrincipalId !== null,
      faitLe: null,
      echeance: avant(debut, 5),
      borne: debut,
      maintenant,
      geste: "Manuel — bouton « Assigner un formateur » en tête de session (ind. 17).",
    }),
  );

  // ── 2. Convention générée ─────────────────────────────────────────────────
  const conventions = piecesVivantes(documents, "convention", "convention_tripartite", "contrat");
  const doublonActif = conventions.length > 1;
  etapes.push(
    etape({
      cle: "convention_generee",
      libelle: "Convention générée",
      fait: conventions.length > 0,
      faitLe: conventions[0]?.createdAt ?? null,
      echeance: avant(debut, 10),
      borne: debut,
      maintenant,
      geste: "Manuel — bloc Documents, bouton « Générer la convention ». Produire n'engage rien.",
      // 🔴 Deux conventions actives = deux pièces opposables sur le même
      // dossier. L'écran ne peut pas choisir laquelle fait foi ; l'humain doit
      // annuler l'ancienne AU REGISTRE, pas la supprimer.
      ...(doublonActif
        ? {
            avertissement: `${conventions.length} pièces contractuelles actives (${conventions
              .map((c) => c.numero)
              .join(", ")}) — annuler l'ancienne au registre.`,
          }
        : {}),
    }),
  );

  // ── 3. Convention signée — TOUTES les parties ─────────────────────────────
  // 🔴 DEUX ACTES, DEUX LIGNES — Lot 3sexies.
  //
  // Une seule étape « Convention signée par toutes les parties » confondait
  // deux gestes qui n'ont ni le même auteur, ni le même délai, ni le même
  // moyen d'action :
  //
  //   · le CLIENT signe par son lien — on ne peut que relancer ;
  //   · l'ORGANISME contresigne — c'est NOUS, et rien ne l'empêche.
  //
  // Confondues, la ligne restait rouge sans dire laquelle des deux manquait.
  // Or le geste diffère du tout au tout : relancer un tiers, ou cliquer
  // soi-même. La contresignature oubliée était invisible, alors que c'est la
  // seule des deux qui ne dépend de personne d'autre.
  //
  // ⚠️ La clé `convention_signee` est CONSERVÉE : elle est lue ailleurs
  // (`echeances-service`), et la renommer aurait cassé ces lecteurs en
  // silence. Ce qui change, c'est ce qu'elle mesure — la signature du client,
  // désormais nommée telle quelle.
  const conventionSigneeClient = conventions.some((c) =>
    signeeParUneAutrePartie(c, signaturesParPiece),
  );
  const conventionContresignee = conventions.some((c) =>
    contresigneeParOrganisme(c, signaturesParPiece),
  );
  etapes.push(
    etape({
      cle: "convention_signee",
      libelle: "Convention signée par le client",
      fait: conventionSigneeClient,
      faitLe: null,
      echeance: avant(debut, 3),
      borne: debut,
      maintenant,
      geste: "Le client signe par son lien. Sans réponse : relancer, ou réémettre le lien.",
    }),
  );

  etapes.push(
    etape({
      cle: "convention_contresignee",
      libelle: "Convention contresignée par l'organisme",
      // ⚠️ On ne coche PAS sur `conventionComplete` : une convention où seul
      // l'organisme aurait signé passerait alors pour contresignée à bon
      // droit — ce qu'elle est —, mais l'inverse aussi serait vrai si l'on
      // s'appuyait sur la complétude. Les deux lignes se mesurent séparément,
      // c'est tout l'intérêt de les séparer.
      fait: conventionContresignee,
      faitLe: null,
      echeance: avant(debut, 3),
      borne: debut,
      maintenant,
      geste:
        "Acte HABILITÉ, jamais automatique : bloc Signatures, « Contresigner ». Rien d'extérieur ne le retient.",
      ...(conventionSigneeClient && !conventionContresignee
        ? {
            avertissement:
              "Le client a signé, PAS nous. C'est le seul geste des deux qui ne dépend de personne d'autre.",
          }
        : {}),
      ...(!conventionSigneeClient && conventionContresignee
        ? {
            avertissement:
              "Contresignée avant que le client ait signé : vérifier le circuit, l'organisme signe en DERNIER.",
          }
        : {}),
    }),
  );

  // ── 4-5. Positionnement — par stagiaire ───────────────────────────────────
  const posEnvoyes = actives.filter((e) =>
    e.questionnaires.some((q) => q.type === "positionnement" && q.envoyeAt !== null),
  ).length;
  const posRepondus = actives.filter((e) =>
    e.questionnaires.some((q) => q.type === "positionnement" && q.reponduAt !== null),
  ).length;
  etapes.push(
    etape({
      cle: "positionnement_envoye",
      libelle: "Questionnaire de positionnement envoyé",
      fait: n > 0 && posEnvoyes === n,
      faitLe: null,
      echeance: avant(debut, 7),
      borne: debut,
      maintenant,
      avancement: { fait: posEnvoyes, total: n },
      geste: "Manuel — bloc Inscriptions, « Envoyer le positionnement » (ind. 8).",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
    etape({
      cle: "positionnement_repondu",
      libelle: "Positionnement répondu",
      fait: n > 0 && posRepondus === n,
      faitLe: null,
      echeance: avant(debut, 2),
      // 🔴 Un positionnement se recueille AVANT la formation : répondu après le
      // début, il ne positionne plus rien. C'est le défaut constaté sur le
      // premier dossier réel.
      borne: debut,
      maintenant,
      avancement: { fait: posRepondus, total: n },
      geste: "Le stagiaire répond. Action possible ici : RELANCER — pas répondre à sa place.",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
  );

  // ── 6. Convocation — la dérivation qui peut ne pas aboutir ────────────────
  const convoquees = actives.filter((e) => e.convocationEnvoyeeAt !== null).length;
  const etatConvocation = convocation({
    total: n,
    envoyees: convoquees,
    echeance: avant(debut, 5),
    borne: debut,
    maintenant,
  });
  etapes.push({
    cle: "convocation_envoyee",
    libelle: "Convocation envoyée",
    ...etatConvocation,
    geste:
      "Automatique — le planificateur J-5, puis rattrapage tant que la colonne d'état est nulle (ind. 9).",
    avancement: { fait: convoquees, total: n },
    // 🔴 `indetermine` n'est PAS terminal, et ne doit pas l'être : il dit qu'on
    // ne sait pas, et seul un humain peut lever le doute en allant vérifier les
    // envois. L'étape peut donc y rester indéfiniment — c'est voulu, et il faut
    // le DIRE, sinon cela ressemble à une borne oubliée.
    ...(etatConvocation.etat === "indetermine"
      ? {
          motifSansBorne:
            "L'état « rattachement non établi » ne se résout pas avec le temps : `EmailLog` n'a aucun lien vers une session, et seule une vérification humaine des envois peut trancher. Une borne le ferait basculer en « hors délai », ce qui affirmerait un manquement qu'on n'a pas constaté.",
        }
      : {}),
  });

  // ── 7. Créneaux d'émargement ──────────────────────────────────────────────
  etapes.push(
    etape({
      cle: "creneaux_emargement",
      libelle: "Journées de présence confirmées",
      fait: input.creneauxEmargement > 0,
      faitLe: null,
      echeance: avant(debut, 1),
      borne: debut,
      maintenant,
      geste:
        "Manuel — onglet Émargement, « Confirmer les journées ». Sans elles, aucun lien n'est émissible.",
    }),
  );

  // ── 8. Liens de signature émis ────────────────────────────────────────────
  etapes.push(
    etape({
      cle: "liens_signature_emis",
      libelle: "Liens d'émargement émis",
      fait: input.liensEmargementActifs > 0,
      faitLe: null,
      echeance: avant(debut, 1),
      // Les jetons expirent 48 h après la fin : au-delà, plus rien à émettre.
      borne: apres(fin, 2),
      maintenant,
      geste: "Manuel — « Émettre les liens », ou joints au rappel J-7.",
      // 🔴 Une réémission RÉVOQUE la précédente (index unique partiel) : le QR
      // déjà imprimé ou déjà distribué devient mort.
      avertissement:
        "Réémettre révoque les liens en circulation — un QR déjà imprimé cesse de fonctionner.",
    }),
  );

  // ── 9. Émargement signé — par stagiaire ───────────────────────────────────
  const emarges = actives.filter((e) => e.emargementSigneAt !== null).length;
  etapes.push(
    etape({
      cle: "emargement_signe",
      libelle: "Émargement signé",
      fait: n > 0 && emarges === n,
      faitLe: null,
      echeance: fin,
      borne: apres(fin, 2),
      maintenant,
      avancement: { fait: emarges, total: n },
      geste: "Le stagiaire signe, en salle ou par son lien. Le formateur dispose du mode groupe.",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
  );

  // ── 10. Évaluation finale des acquis ──────────────────────────────────────
  const evalues = actives.filter((e) => e.evaluationFinaleAt !== null).length;
  etapes.push(
    etape({
      cle: "evaluation_finale",
      libelle: "Évaluation finale des acquis",
      fait: n > 0 && evalues === n,
      faitLe: null,
      echeance: apres(fin, 2),
      borne: {
        sansBorne:
          "Évaluer en retard laisse un écart de DATE, pas une impossibilité : l'évaluation reste valable et l'indicateur 11 reste atteignable. La déclarer « hors délai » ferait renoncer à un geste encore utile.",
      },
      maintenant,
      avancement: { fait: evalues, total: n },
      geste: "Le formateur évalue ; la VALIDATION est un acte habilité (ind. 11).",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
  );

  // ── 11. Attestation ───────────────────────────────────────────────────────
  const attestations = piecesVivantes(
    documents,
    "attestation",
    "attestation_partielle",
    "certificat_realisation",
  );
  // 🔴 Le défaut du dossier n°1 : une attestation ÉMISE AVANT l'évaluation.
  // Elle atteste alors d'acquis que personne n'a constatés.
  const attestationAvantEvaluation =
    attestations.length > 0 &&
    evalues < n &&
    attestations.some((a) => a.createdAt.getTime() >= fin.getTime());
  etapes.push(
    etape({
      cle: "attestation",
      libelle: "Attestation de fin de formation",
      fait: n > 0 && attestations.length >= n,
      faitLe: attestations[0]?.createdAt ?? null,
      echeance: apres(fin, 3),
      borne: {
        sansBorne:
          "Une attestation s'émet avec des semaines de retard et reste opposable — c'est un droit du stagiaire (L.6353-1). L'écart est porté par la mention, jamais par un refus.",
      },
      maintenant,
      avancement: { fait: Math.min(attestations.length, n), total: n },
      geste: "Acte HABILITÉ — attester engage l'organisme. Jamais automatique.",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
      ...(attestationAvantEvaluation
        ? {
            avertissement:
              "Attestation émise alors que l'évaluation finale n'est pas complète — elle atteste d'acquis non constatés.",
          }
        : {}),
    }),
  );

  // ── 12. Accès portail ─────────────────────────────────────────────────────
  const avecAcces = actives.filter((e) => e.aUnAccesPortail).length;
  etapes.push(
    etape({
      cle: "acces_portail",
      libelle: "Accès à l'espace stagiaire",
      fait: n > 0 && avecAcces === n,
      faitLe: null,
      echeance: avant(debut, 5),
      borne: apres(fin, 30),
      maintenant,
      avancement: { fait: avecAcces, total: n },
      geste: "Automatique à la convocation ; « Générer l'accès » en secours.",
      // 🔴 L'accès est GLOBAL au stagiaire, pas scopé à cette session. Un
      // stagiaire inscrit à deux sessions a un seul accès, et les pièces y sont
      // dédupliquées par type : la convocation de l'une masque celle de l'autre.
      avertissement:
        "L'accès est global au stagiaire, pas propre à cette session : un stagiaire suivant deux formations n'en a qu'un.",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
  );

  // ── 13-14. Satisfaction ───────────────────────────────────────────────────
  const chaud = actives.filter((e) =>
    e.questionnaires.some((q) => q.type === "satisfaction_chaud" && q.reponduAt !== null),
  ).length;
  const froid = actives.filter((e) =>
    e.questionnaires.some((q) => q.type === "satisfaction_froid" && q.reponduAt !== null),
  ).length;
  etapes.push(
    etape({
      cle: "satisfaction_chaud",
      libelle: "Satisfaction à chaud recueillie",
      fait: n > 0 && chaud === n,
      faitLe: null,
      echeance: apres(fin, 7),
      borne: {
        sansBorne:
          "Un retour à chaud recueilli tard vaut mieux qu'aucun retour : l'indicateur 30 compte les réponses, pas leur ponctualité.",
      },
      maintenant,
      avancement: { fait: chaud, total: n },
      geste: "Automatique J+1, relance J+3 et J+10. Action ici : relancer (ind. 30).",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
    etape({
      cle: "satisfaction_froid",
      libelle: "Suivi à froid (J+30) recueilli",
      fait: n > 0 && froid === n,
      faitLe: null,
      echeance: apres(fin, 37),
      borne: {
        sansBorne:
          "Le suivi à froid reste utile longtemps après J+30. Le déclarer hors délai enverrait renoncer à un recueil encore possible — et c'est l'obligation la plus facilement oubliée du parcours.",
      },
      maintenant,
      avancement: { fait: froid, total: n },
      geste: "Automatique J+30. 🔴 Recueilli AVANT J+30, il ne mesure pas le même objet.",
      sansObjetSi: n === 0,
      motifSansObjet: "Aucune inscription active",
    }),
  );

  const comptees = etapes.filter((e) => e.etat !== "sans_objet");
  return {
    etapes,
    pire: pireEtat(etapes.map((e) => e.etat)),
    avancement: {
      fait: comptees.filter((e) => e.etat === "fait").length,
      total: comptees.length,
    },
    repliee: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fabrique d'étape
// ─────────────────────────────────────────────────────────────────────────────

function etape(args: {
  cle: EtapeCle;
  libelle: string;
  fait: boolean;
  faitLe: Date | null;
  echeance: Date | null;
  /**
   * Date après laquelle le geste ne produit plus un dossier conforme, OU une
   * déclaration explicite d'absence de borne.
   *
   * 🔴 `Date | null` avant le 2026-08-17 : on ne pouvait pas distinguer « pas
   * de borne, et c'est voulu » de « borne oubliée ». Désormais l'absence se
   * DÉCLARE — le compilateur pose la question à celui qui ajoute une étape.
   */
  borne: Date | { readonly sansBorne: string };
  maintenant: Date;
  geste: string;
  avancement?: { fait: number; total: number };
  avertissement?: string;
  sansObjetSi?: boolean;
  motifSansObjet?: string;
}): EtapeParcours {
  // Une borne DÉCLARÉE absente vaut `null` pour le calcul — mais son motif
  // survit jusqu'à l'écran, ce qui est toute la différence avec un oubli.
  const borneEffective = args.borne instanceof Date ? args.borne : null;
  const motifSansBorne = args.borne instanceof Date ? undefined : args.borne.sansBorne;

  const etat: EtatEtape = args.sansObjetSi
    ? "sans_objet"
    : calculerEtat({
        fait: args.fait,
        echeance: args.echeance,
        borneRattrapage: borneEffective,
        maintenant: args.maintenant,
      });
  return {
    cle: args.cle,
    libelle: args.libelle,
    etat,
    mention: mentionPour({
      etat,
      echeance: args.echeance,
      borneRattrapage: borneEffective,
      faitLe: args.faitLe,
      maintenant: args.maintenant,
      ...(args.motifSansObjet !== undefined ? { motifSansObjet: args.motifSansObjet } : {}),
    }),
    geste: args.geste,
    ...(args.avancement !== undefined ? { avancement: args.avancement } : {}),
    ...(args.avertissement !== undefined ? { avertissement: args.avertissement } : {}),
    ...(motifSansBorne !== undefined ? { motifSansBorne } : {}),
  };
}

/**
 * La convocation, et le seul cas d'`indetermine` du parcours.
 *
 * 🔴 `EmailLog` n'a AUCUN lien vers une session : le `jobId` est le seul
 * rattachement. La colonne `Enrollment.convocationEnvoyeeAt` a été posée pour
 * cela — c'est un ÉTAT, pas une fenêtre de date, et c'est elle qui rend le cron
 * rattrapant. Mais si elle est nulle pour une session déjà commencée, on ne
 * peut pas conclure : l'envoi a pu avoir lieu avant que la colonne n'existe.
 *
 * Alors on dit qu'on ne sait pas. Un ✅ par défaut mentirait sur une obligation
 * réglementaire (ind. 9) ; un ✗ par défaut enverrait reconvoquer des stagiaires
 * déjà convoqués, la veille de leur formation.
 */
function convocation(args: {
  total: number;
  envoyees: number;
  echeance: Date;
  borne: Date;
  maintenant: Date;
}): { etat: EtatEtape; mention: string } {
  if (args.total === 0) {
    return {
      etat: "sans_objet",
      mention: mentionPour({
        etat: "sans_objet",
        echeance: null,
        borneRattrapage: null,
        faitLe: null,
        maintenant: args.maintenant,
        motifSansObjet: "Aucune inscription active",
      }),
    };
  }
  const complete = args.envoyees === args.total;
  const sessionCommencee = args.maintenant.getTime() >= args.borne.getTime();
  if (!complete && args.envoyees === 0 && sessionCommencee) {
    return {
      etat: "indetermine",
      mention: mentionPour({
        etat: "indetermine",
        echeance: args.echeance,
        borneRattrapage: args.borne,
        faitLe: null,
        maintenant: args.maintenant,
        motifIndetermine:
          "Rattachement non établi — aucune trace d'envoi sur une session déjà commencée. " +
          "Vérifier les envois à la main avant de reconvoquer.",
      }),
    };
  }
  const etat = calculerEtat({
    fait: complete,
    echeance: args.echeance,
    borneRattrapage: args.borne,
    maintenant: args.maintenant,
  });
  return {
    etat,
    mention: mentionPour({
      etat,
      echeance: args.echeance,
      borneRattrapage: args.borne,
      faitLe: null,
      maintenant: args.maintenant,
    }),
  };
}
