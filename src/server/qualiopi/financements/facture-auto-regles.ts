/**
 * Qualiopi — la facture d'une session réalisée, générée LE LENDEMAIN de sa fin :
 * QUAND, POUR QUI, et QUAND NE PAS LE FAIRE.
 *
 * ## La demande (Will, 2026-09-15)
 *
 * La facture d'une session était 100 % manuelle : « Générer la facture de
 * formation » sur la fiche session, puis « Envoyer par email » sur la fiche
 * facture, puis validation dans « E-mails à valider ». Sur la seule session
 * réelle du 05/09, la facture n'a été générée que le 15/09 — dix jours pendant
 * lesquels la créance n'existait nulle part. Désormais : la facture est générée
 * automatiquement le lendemain, et son e-mail est mis tout seul dans « E-mails à
 * valider ». 🛑 Ordre permanent : RIEN ne part à un client sans sa validation —
 * l'envoi reste garé, jamais contourné.
 *
 * ## Ce module
 *
 * La DÉCISION, pure et testée à sec (`deciderFactureAuto`), la LECTURE des
 * sessions candidates, et les CAS À SIGNALER que la règle d'alerte
 * `facture_auto_non_emise` reprend telle quelle. Le cron (`facture-auto-
 * session.ts`) et l'alerte lisent la même décision : ils ne peuvent pas se
 * contredire sur « cette session aurait-elle dû être facturée ? ».
 *
 * Module léger À DESSEIN : Prisma, des modules purs, rien d'autre. Il est
 * importé par l'évaluateur d'alertes, lui-même chargé par l'application ; la
 * chaîne PDF n'a rien à y faire.
 *
 * ## 🔑 Le périmètre automatisé est ÉTROIT, et c'est voulu
 *
 * Automatiser l'émission d'une pièce comptable numérotée n'a de valeur que si
 * la pièce est juste sans relecture. Tout ce qui demande un arbitrage reste à la
 * main, et une alerte le DIT :
 *
 *   - financement direct (ou non renseigné), sans subrogation → facture à
 *     l'entreprise cliente, au forfait (montant HT de la session, ou de l'UNIQUE
 *     créance « entreprise » du dossier) ;
 *   - OPCO, CPF, France Travail, mixte, subrogation → le destinataire dépend
 *     d'un accord, d'une part prise en charge, d'un reste à charge : alerte ;
 *   - inter-entreprises → une facture PAR PARTICIPANT (`factures-inter.ts`),
 *     chacun selon son financement : alerte ;
 *   - fiche client incomplète (raison sociale, SIRET, adresse — art. L.441-9
 *     C. com. — ou e-mail de contact) → facture irrégulière ou impossible à
 *     préparer : alerte ;
 *   - facture annulée ou entièrement avoirée → refacturer est une décision :
 *     alerte, jamais une réémission automatique.
 */

import { prisma } from "@/lib/prisma";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { champsAcheteurManquants } from "@/server/qualiopi/documents/conformite";
import {
  resoudreDestinataireFacture,
  CLIENT_FACTURABLE_SELECT,
  type ClientFacturable,
} from "@/server/qualiopi/financements/destinataire-facture";
import { factureVivante } from "@/server/qualiopi/financements/facture-vivante";

// ─────────────────────────────────────────────────────────────────────────────
// Bornes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 BORNE BASSE — aucune session finie AVANT cet instant n'est facturée
 * automatiquement : 14/09/2026 00:00, heure de Paris.
 *
 * C'est la date de livraison de la fonctionnalité (15/09/2026) MOINS UN JOUR. Le
 * jour de marge couvre la session qui se termine la veille de la mise en service
 * et dont le lendemain tombe pile le jour du déploiement : c'est exactement le
 * cas pour lequel la fonctionnalité existe.
 *
 * ⚠️ Sans cette borne, le premier passage du cron facturerait d'un coup toutes
 * les sessions réalisées jamais facturées de l'historique — des pièces
 * comptables numérotées, émises en rafale, sur des dossiers que personne n'a
 * relus. Elles restent visibles (alerte `session_realisee_non_facturee`, J+15 à
 * J+365) et se facturent d'un geste, jamais sans.
 *
 * ⚠️ Si la fusion glisse de plus de quelques jours, avancer cette date au jour
 * de la fusion moins un : entre la date écrite ici et le déploiement, les
 * sessions finies seraient facturées au premier passage (bornées par la fenêtre
 * de 30 jours et le plafond par passage, mais sans que personne l'ait voulu).
 */
export const MISE_EN_SERVICE_FACTURE_AUTO = new Date("2026-09-13T22:00:00.000Z");

/**
 * Jour (après la fin) à partir duquel l'alerte historique
 * `session_realisee_non_facturee` prend le relais. SOURCE UNIQUE : l'évaluateur
 * la lit aussi, pour que les deux alertes ne se chevauchent jamais sur une même
 * session (relecture A09 de la PR 1097 : de J+15 à J+30, deux messages pour un
 * seul geste).
 */
export const DELAI_SESSION_NON_FACTUREE_JOURS = 15;

/**
 * Jusqu'à J+14 (jours civils à Paris), l'automate facture et SA propre alerte
 * parle ; à J+15, l'alerte historique prend le relais et l'automate s'arrête.
 *
 * Passé ce délai, la facture est un geste : une session bloquée (fiche client
 * incomplète) qu'on complète trois semaines plus tard ne doit pas se facturer
 * dans le dos de celui qui corrige.
 */
export const FENETRE_FACTURE_AUTO_JOURS = DELAI_SESSION_NON_FACTUREE_JOURS - 1;

/**
 * Une facture de session sans PDF ou sans e-mail préparé n'est signalée qu'au
 * bout de 12 h : le temps que le geste normal (bouton, passage du cron) ait eu
 * lieu. Elle cesse de l'être 30 jours après son émission.
 */
export const DELAI_FACTURE_INCOMPLETE_HEURES = 12;
export const FENETRE_FACTURE_INCOMPLETE_JOURS = 30;

/**
 * Une facture NON rattachée à la session, du même client, émise jusqu'à 90 jours
 * avant le début de la session, peut couvrir la prestation (facture libre émise
 * avant la convention, reprise d'historique). Dans le doute, l'automate s'abstient.
 */
export const PERIODE_FACTURE_HORS_SESSION_JOURS = 90;

/** Réglage où le cron consigne l'horodatage de son dernier passage. */
export const CLE_DERNIER_PASSAGE_FACTURE_AUTO = "facture_auto_dernier_passage";

/**
 * Au-delà de 26 h sans passage, le cron quotidien est considéré en panne (24 h +
 * marge d'un redéploiement). Jamais consigné, il ne l'est qu'une semaine après
 * la mise en service : le premier passage suit le déploiement.
 */
export const TOLERANCE_PASSAGE_HEURES = 26;

/** Journal : génération automatique (`adminUserId: null`). */
export const ACTION_JOURNAL_FACTURE_AUTO = "qualiopi.facture.generer.auto";

/**
 * 🔴 Écrite par le cron AVANT d'émettre, sur la SESSION. Si le processus meurt
 * entre le `create` et le journal de génération, c'est elle qui permet de
 * reconnaître la facture comme automatique — et de la reprendre.
 */
export const ACTION_JOURNAL_TENTATIVE_FACTURE_AUTO = "qualiopi.facture.generer.auto.tentative";

/** Écrite par le cron quand l'émission est REFUSÉE ou lève, avec le motif. */
export const ACTION_JOURNAL_ECHEC_FACTURE_AUTO = "qualiopi.facture.generer.auto.echec";

/**
 * Journal de préparation de l'e-mail — le MÊME code que le bouton « Envoyer par
 * email ». C'est lui que l'alerte lit pour savoir si l'e-mail d'une facture
 * automatique a bien été préparé, quel que soit le chemin qui l'a fait.
 */
export const ACTION_JOURNAL_EMAIL_FACTURE = "facturation.email.facture";

// ─────────────────────────────────────────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────────────────────────────────────────

/** Ce que la décision lit d'une session. */
export interface SessionFactureAuto {
  id: string;
  numero: string | null;
  titreSession: string | null;
  statut: string;
  dateDebut?: Date;
  dateFin: Date;
  clientId?: string | null;
  devisId?: string | null;
  montantHtCents: number;
  interEntreprises: boolean;
  financementType: string | null;
  opcoSubrogation: boolean;
  client: (ClientFacturable & { contactEmail: string | null }) | null;
  /** Factures ORIGINALES de la session (un avoir ne porte pas de `sessionId`). */
  facturesFormation: Array<{
    statut: string;
    montantHtCents: number;
    avoirs: Array<{ statut: string; montantHtCents: number }>;
  }>;
  /** Même lecture que l'émission : le PREMIER dossier, ses créances. */
  dossiersFinancement: Array<{
    id?: string;
    payeurs: Array<{
      payeurType: string;
      montantAttenduCents: number;
      factureFormationId: string | null;
    }>;
  }>;
  /**
   * Factures vivantes NON rattachées à la session qui pourraient couvrir la
   * prestation (même devis, même dossier, ou même client sur la période).
   * Rempli par `chargerSessionsFactureAuto` ; absent = aucune.
   */
  facturesHorsSession?: Array<{ numero: string }>;
}

export const SESSION_FACTURE_AUTO_SELECT = {
  id: true,
  numero: true,
  titreSession: true,
  statut: true,
  dateDebut: true,
  dateFin: true,
  clientId: true,
  devisId: true,
  montantHtCents: true,
  interEntreprises: true,
  financementType: true,
  opcoSubrogation: true,
  client: { select: { ...CLIENT_FACTURABLE_SELECT, contactEmail: true } },
  facturesFormation: {
    where: { avoirDeId: null },
    select: {
      statut: true,
      montantHtCents: true,
      avoirs: { select: { statut: true, montantHtCents: true } },
    },
  },
  // ⚠️ `orderBy` + `take: 1` : EXACTEMENT la lecture de l'émission
  // (`facture-formation-emission.ts`). Deux lectures différentes du « dossier »
  // feraient décider ici sur une créance et facturer là-bas sur une autre.
  dossiersFinancement: {
    orderBy: { createdAt: "asc" },
    take: 1,
    select: {
      id: true,
      payeurs: {
        select: { payeurType: true, montantAttenduCents: true, factureFormationId: true },
      },
    },
  },
} as const;

/**
 * Sessions réalisées finies dans la fenêtre de l'automate, les plus anciennes
 * d'abord, avec leurs factures NON rattachées suspectes. Le filtre fin
 * (lendemain, factures, motifs) est celui de `deciderFactureAuto`, en mémoire :
 * le volume est borné par la fenêtre.
 */
export async function chargerSessionsFactureAuto(now: Date): Promise<SessionFactureAuto[]> {
  const planchers = [
    MISE_EN_SERVICE_FACTURE_AUTO.getTime(),
    // Un jour de plus que la fenêtre : la décision tranche au jour civil près.
    now.getTime() - (FENETRE_FACTURE_AUTO_JOURS + 1) * 86_400_000,
  ];
  const lignes = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateFin: { gte: new Date(Math.max(...planchers)), lte: now },
    },
    select: SESSION_FACTURE_AUTO_SELECT,
    orderBy: { dateFin: "asc" },
  });
  return attacherFacturesHorsSession(lignes as unknown as SessionFactureAuto[]);
}

/** Une seule session, relue SOUS VERROU par le cron juste avant d'émettre. */
export async function chargerSessionFactureAuto(id: string): Promise<SessionFactureAuto | null> {
  const ligne = await prisma.trainingSession.findUnique({
    where: { id },
    select: SESSION_FACTURE_AUTO_SELECT,
  });
  if (ligne === null) return null;
  const [s] = await attacherFacturesHorsSession([ligne as unknown as SessionFactureAuto]);
  return s ?? null;
}

/**
 * 🔴 LES FACTURES QUI NE PORTENT PAS DE `sessionId` (relecture A09, PR 1097).
 *
 * Une « facture libre » du Hub, une reprise d'historique ou un plan récurrent
 * ne sont pas rattachés à la session : l'automate ne les voyait pas, et une
 * prestation déjà facturée ainsi aurait reçu une seconde facture.
 *
 * Est SUSPECTE, pour une session, toute facture vivante rattachée à AUCUNE
 * session, qui est :
 *   - sur le même devis, ou sur le même dossier de financement ;
 *   - OU du même client — par fiche, ou par raison sociale pour une reprise
 *     d'historique qui n'en porte pas —, d'activité formation ou non renseignée,
 *     émise depuis 90 jours avant le début de la session.
 *
 * ⚠️ Volontairement LARGE : un faux positif coûte une alerte et un clic ; un
 * faux négatif coûte une facture en double sur un registre légal.
 */
async function attacherFacturesHorsSession(
  sessions: SessionFactureAuto[],
): Promise<SessionFactureAuto[]> {
  if (sessions.length === 0) return sessions;
  const unique = (v: Array<string | null | undefined>): string[] => [
    ...new Set(v.filter((x): x is string => typeof x === "string" && x !== "")),
  ];
  const clientIds = unique(sessions.map((s) => s.clientId));
  const devisIds = unique(sessions.map((s) => s.devisId));
  const dossierIds = unique(
    sessions.flatMap((s) => (s.dossiersFinancement ?? []).map((d) => d.id)),
  );
  const noms = unique(sessions.map((s) => s.client?.raisonSociale?.trim()));

  const ou = [
    ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
    ...(devisIds.length > 0 ? [{ devisId: { in: devisIds } }] : []),
    ...(dossierIds.length > 0 ? [{ dossierFinancementId: { in: dossierIds } }] : []),
    ...(noms.length > 0 ? [{ destinataireNom: { in: noms } }] : []),
  ];
  if (ou.length === 0) return sessions;

  const candidates = await prisma.factureFormation.findMany({
    where: { sessionId: null, avoirDeId: null, statut: { not: "annulee" }, OR: ou },
    select: {
      numero: true,
      statut: true,
      montantHtCents: true,
      clientId: true,
      devisId: true,
      dossierFinancementId: true,
      destinataireNom: true,
      activite: true,
      emiseAt: true,
      createdAt: true,
      avoirs: { select: { statut: true, montantHtCents: true } },
    },
  });
  const vivantes = candidates.filter((f) => factureVivante(f));

  return sessions.map((s) => {
    const dossiers = new Set(
      (s.dossiersFinancement ?? []).map((d) => d.id).filter((id): id is string => !!id),
    );
    const nom = s.client?.raisonSociale?.trim().toLowerCase() ?? null;
    const debut = (s.dateDebut ?? s.dateFin).getTime();
    const plancher = debut - PERIODE_FACTURE_HORS_SESSION_JOURS * 86_400_000;
    const suspectes = vivantes.filter((f) => {
      if (s.devisId != null && f.devisId === s.devisId) return true;
      if (f.dossierFinancementId !== null && dossiers.has(f.dossierFinancementId)) return true;
      const memeClient =
        (s.clientId != null && f.clientId === s.clientId) ||
        (f.clientId === null && nom !== null && f.destinataireNom.trim().toLowerCase() === nom);
      if (!memeClient) return false;
      if (f.activite !== null && f.activite !== "formation") return false;
      return (f.emiseAt ?? f.createdAt).getTime() >= plancher;
    });
    return { ...s, facturesHorsSession: suspectes.map((f) => ({ numero: f.numero })) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Décision
// ─────────────────────────────────────────────────────────────────────────────

export type MotifNonAutomatisable =
  | "refacturation_apres_annulation"
  | "facture_hors_session_a_verifier"
  | "montant_absent"
  | "inter_entreprises"
  | "financement_non_automatisable"
  | "creances_non_automatisables"
  | "client_absent"
  | "client_sans_siret"
  | "client_sans_adresse"
  | "client_sans_email";

export type DecisionFactureAuto =
  | { verdict: "attendre"; raison: "non_realisee" | "avant_lendemain" }
  | { verdict: "hors_champ"; raison: "avant_mise_en_service" | "fenetre_depassee" }
  | { verdict: "deja_facturee" }
  | {
      verdict: "non_automatisable";
      motifs: Array<{ code: MotifNonAutomatisable; libelle: string }>;
    }
  | { verdict: "emettre"; destinataire: "entreprise"; ventilation: "forfait" };

/** Nombre de jours CIVILS (heure de Paris) entre deux instants. */
export function joursCivilsParisEntre(avant: Date, apres: Date): number {
  const a = Date.parse(`${dayKeyInParis(avant)}T00:00:00.000Z`);
  const b = Date.parse(`${dayKeyInParis(apres)}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

const estRenseigne = (v: string | null | undefined): boolean =>
  typeof v === "string" && v.trim() !== "";

const LIBELLE_FINANCEMENT: Record<string, string> = {
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
  mixte: "mixte",
};

/**
 * La session doit-elle être facturée automatiquement MAINTENANT ?
 *
 * ⚠️ « Le lendemain » se lit en jours CIVILS À PARIS : la facture est une pièce
 * française, datée en France. Une session finie le 5 à 16 h se facture à partir
 * du 6 à 00 h (heure de Paris), pas 24 h plus tard.
 */
export function deciderFactureAuto(s: SessionFactureAuto, now: Date): DecisionFactureAuto {
  if (s.statut !== "realisee") return { verdict: "attendre", raison: "non_realisee" };
  if (s.dateFin.getTime() < MISE_EN_SERVICE_FACTURE_AUTO.getTime()) {
    return { verdict: "hors_champ", raison: "avant_mise_en_service" };
  }
  const jours = joursCivilsParisEntre(s.dateFin, now);
  if (jours > FENETRE_FACTURE_AUTO_JOURS) {
    return { verdict: "hors_champ", raison: "fenetre_depassee" };
  }
  if (jours < 1) return { verdict: "attendre", raison: "avant_lendemain" };

  const factures = s.facturesFormation ?? [];
  if (factures.some(factureVivante)) return { verdict: "deja_facturee" };
  if (factures.length > 0) {
    return {
      verdict: "non_automatisable",
      motifs: [
        {
          code: "refacturation_apres_annulation",
          libelle:
            "sa facture a été annulée ou entièrement rectifiée par avoir : refacturer est une décision, pas une réémission automatique",
        },
      ],
    };
  }

  // 🔑 TOUS les motifs, jamais le premier seul : corriger un obstacle pour en
  // découvrir un deuxième au passage suivant fait perdre un jour par obstacle.
  const motifs: Array<{ code: MotifNonAutomatisable; libelle: string }> = [];

  const horsSession = s.facturesHorsSession ?? [];
  if (horsSession.length > 0) {
    motifs.push({
      code: "facture_hors_session_a_verifier",
      libelle:
        `une facture non rattachée à la session existe pour ce client ou ce dossier ` +
        `(${horsSession.map((f) => f.numero).join(", ")}) : vérifiez qu'elle ne couvre pas ` +
        "déjà cette prestation avant de facturer",
    });
  }

  const creances = (s.dossiersFinancement ?? [])[0]?.payeurs ?? [];
  const creanceUnique =
    creances.length === 1 &&
    creances[0]!.payeurType === "entreprise" &&
    creances[0]!.factureFormationId === null
      ? creances[0]!
      : null;
  const montant = creanceUnique !== null ? creanceUnique.montantAttenduCents : s.montantHtCents;

  if (!(montant > 0)) {
    motifs.push({
      code: "montant_absent",
      libelle: "aucun montant HT à facturer (montant de la session ou de la créance nul)",
    });
  }
  if (s.interEntreprises) {
    motifs.push({
      code: "inter_entreprises",
      libelle:
        "session inter-entreprises : la facture se fait PAR PARTICIPANT, selon le financement de chacun",
    });
  }
  // ⚠️ ASSUMÉ (relecture A09, PR 1097) : un financement NON RENSEIGNÉ est traité
  // comme un financement direct. Une session dont l'OPCO n'a jamais été saisi
  // est donc facturée à l'entreprise au HT plein — c'est le périmètre demandé,
  // et la console le dit (aide de la fiche session et du hub).
  const financement = s.financementType ?? "direct";
  if (financement !== "direct" || s.opcoSubrogation) {
    motifs.push({
      code: "financement_non_automatisable",
      libelle: s.opcoSubrogation
        ? "subrogation OPCO : l'OPCO paie sa part, le client le reste à charge — deux destinataires à arbitrer"
        : `financement ${LIBELLE_FINANCEMENT[financement] ?? financement} : le destinataire de la facture dépend du dossier de prise en charge`,
    });
  }
  if (creances.length > 0 && creanceUnique === null) {
    motifs.push({
      code: "creances_non_automatisables",
      libelle: `le dossier de financement porte ${creances.length} créance(s) qui ne se réduisent pas à une seule part « entreprise » à facturer`,
    });
  }

  const client = s.client;
  if (client === null || !estRenseigne(client.raisonSociale)) {
    motifs.push({
      code: "client_absent",
      libelle: "aucun client identifié (raison sociale) sur la session",
    });
  } else {
    const acheteur = resoudreDestinataireFacture("entreprise", client);
    if (client.type !== "particulier" && !estRenseigne(acheteur.siret)) {
      motifs.push({ code: "client_sans_siret", libelle: "SIRET du client absent" });
    }
    // Le MÊME prédicat que la garde de conformité de l'émission (L.441-9).
    if (
      champsAcheteurManquants({
        nom: acheteur.nom,
        adresse: client.adresse ?? null,
        adresseRue: client.adresseRue ?? null,
        adresseCodePostal: client.adresseCodePostal ?? null,
        adresseVille: client.adresseVille ?? null,
      }).length > 0
    ) {
      motifs.push({ code: "client_sans_adresse", libelle: "adresse du client absente" });
    }
    if (!estRenseigne(client.contactEmail)) {
      motifs.push({
        code: "client_sans_email",
        libelle: "aucun e-mail de contact sur la fiche client : l'e-mail ne peut pas être préparé",
      });
    }
  }

  if (motifs.length > 0) return { verdict: "non_automatisable", motifs };
  return { verdict: "emettre", destinataire: "entreprise", ventilation: "forfait" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ce que l'alerte `facture_auto_non_emise` doit dire
// ─────────────────────────────────────────────────────────────────────────────

export interface CasFactureAuto {
  cibleType: "TrainingSession" | "FactureFormation";
  cibleId: string;
  message: string;
}

function designer(s: Pick<SessionFactureAuto, "numero" | "titreSession">): string {
  const titre = estRenseigne(s.titreSession) ? ` « ${s.titreSession} »` : "";
  return `La session ${s.numero ?? "sans numéro"}${titre}`;
}

/**
 * Les cas que la génération automatique n'a PAS traités, et qu'un humain doit
 * voir. Trois familles :
 *
 *   1. la session ne se facture pas automatiquement (motifs nommés), de J+1 à
 *      J+14 — à J+15, `session_realisee_non_facturee` prend le relais ;
 *   2. elle remplit les conditions, n'a pas de facture, ET le passage a
 *      réellement échoué pour elle (journal d'échec du cron), ou le cron ne
 *      passe plus du tout. 🔑 Plus de seuil en jours : un seuil se déclenchait
 *      au balayage de 07:00 AVANT la tentative de 09:30 sur une session
 *      clôturée ou complétée tard (relecture A09, PR 1097) ;
 *   3. une facture de SESSION émise depuis la mise en service est restée sans
 *      PDF, ou sans e-mail préparé. 🔴 Lu sur la FACTURE, jamais sur un
 *      journal : un worker mort entre le `create` et son journal ne la rend
 *      plus invisible.
 *
 * 🔑 Chaque cas DISPARAÎT quand il est résolu, et l'alerte, déclarée
 * `resolutionAuto: true`, se ferme alors seule au balayage suivant.
 */
export async function casFactureAutoASignaler(now: Date): Promise<CasFactureAuto[]> {
  const cas: CasFactureAuto[] = [];
  const eligibles: SessionFactureAuto[] = [];

  for (const s of await chargerSessionsFactureAuto(now)) {
    const d = deciderFactureAuto(s, now);
    if (d.verdict === "non_automatisable") {
      cas.push({
        cibleType: "TrainingSession",
        cibleId: s.id,
        message:
          `${designer(s)} est réalisée et sa facture n'est PAS générée automatiquement : ` +
          `${d.motifs.map((m) => m.libelle).join(" ; ")}. ` +
          "Corrigez ou vérifiez ce qui doit l'être, puis générez la facture depuis la fiche de " +
          "session (section Financier) ; son e-mail passera par « E-mails à valider ».",
      });
    } else if (d.verdict === "emettre") {
      eligibles.push(s);
    }
  }

  if (eligibles.length > 0) {
    const [echecs, dernierPassage] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          action: ACTION_JOURNAL_ECHEC_FACTURE_AUTO,
          targetId: { in: eligibles.map((s) => s.id) },
        },
        select: { targetId: true, createdAt: true, changes: true },
      }),
      lireDernierPassage(),
    ]);
    const cronEnPanne = passageEnPanne(dernierPassage, now);
    for (const s of eligibles) {
      const echec = echecs
        .filter((e) => e.targetId === s.id && e.createdAt.getTime() >= s.dateFin.getTime())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (echec !== undefined) {
        const motif = (echec.changes as { motif?: unknown } | null)?.motif;
        cas.push({
          cibleType: "TrainingSession",
          cibleId: s.id,
          message:
            `${designer(s)} remplit les conditions de la facturation automatique, mais le ` +
            `passage du ${echec.createdAt.toLocaleDateString("fr-FR")} n'a pas pu émettre sa ` +
            `facture${typeof motif === "string" && motif !== "" ? ` : ${motif}` : ""}. ` +
            "Corrigez la cause, puis générez la facture depuis la fiche de session (section " +
            "Financier), ou attendez le passage suivant.",
        });
      } else if (cronEnPanne) {
        cas.push({
          cibleType: "TrainingSession",
          cibleId: s.id,
          message:
            `${designer(s)} remplit les conditions de la facturation automatique, et le passage ` +
            "quotidien de facturation n'a pas tourné depuis plus d'un jour : aucune facture ne " +
            "sera émise tant qu'il ne repart pas. Générez la facture depuis la fiche de session " +
            "(section Financier) et signalez la panne du worker.",
        });
      }
    }
  }

  for (const f of await facturesSessionIncompletes(now)) {
    cas.push({
      cibleType: "FactureFormation",
      cibleId: f.id,
      message: f.sansPdf
        ? `La facture ${f.numero} est émise mais n'a PAS de PDF : elle ne peut être ni ` +
          "envoyée ni remise. Ouvrez la facture, cliquez « Régénérer le PDF », puis « Envoyer " +
          "par email » : l'e-mail attendra votre validation."
        : `La facture ${f.numero} est émise, et aucun e-mail ne l'a encore préparée pour le ` +
          "client (ni en attente de validation, ni envoyé). Ouvrez la facture et cliquez " +
          "« Envoyer par email » : il attendra votre validation.",
    });
  }
  return cas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Passage du cron : horodatage
// ─────────────────────────────────────────────────────────────────────────────

export async function lireDernierPassage(): Promise<Date | null> {
  try {
    const ligne = await prisma.siteSetting.findUnique({
      where: { key: CLE_DERNIER_PASSAGE_FACTURE_AUTO },
      select: { value: true },
    });
    const v = ligne?.value;
    const at =
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)["at"]
        : undefined;
    if (typeof at !== "string") return null;
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function passageEnPanne(dernier: Date | null, now: Date): boolean {
  if (dernier === null) {
    return now.getTime() > MISE_EN_SERVICE_FACTURE_AUTO.getTime() + 7 * 86_400_000;
  }
  return now.getTime() - dernier.getTime() > TOLERANCE_PASSAGE_HEURES * 3_600_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factures de session incomplètes (sans PDF, ou sans e-mail préparé)
// ─────────────────────────────────────────────────────────────────────────────

export interface FactureIncomplete {
  id: string;
  numero: string;
  sessionId: string;
  createdAt: Date;
  sansPdf: boolean;
  sansEmail: boolean;
}

/**
 * Factures ORIGINALES de session, vivantes, émises depuis la mise en service
 * (et depuis moins de 30 jours), il y a plus de 12 h, restées sans PDF — ou,
 * pour une facture adressée à l'entreprise cliente, sans aucune trace d'e-mail.
 *
 * Trace d'e-mail = N'IMPORTE LAQUELLE de :
 *   - une ligne de corbeille `facture-envoi` rattachée à la facture (ou, avant
 *     ce rattachement, portant son numéro) — garée, approuvée ou refusée : un
 *     refus est une décision humaine, pas un oubli ;
 *   - une ligne d'e-mail `facture-envoi` rattachée à la facture ;
 *   - le journal `facturation.email.facture` du bouton ou de l'automate.
 *
 * ⚠️ Les factures à un OPCO, à France Travail ou au bénéficiaire ne sont
 * signalées que sans PDF : elles se déposent sur un portail, pas par e-mail.
 *
 * @param opts.ids  restreint aux factures données (relecture sous verrou).
 */
export async function facturesSessionIncompletes(
  now: Date,
  opts?: { ids?: string[] },
): Promise<FactureIncomplete[]> {
  const depuis = new Date(
    Math.max(
      MISE_EN_SERVICE_FACTURE_AUTO.getTime(),
      now.getTime() - FENETRE_FACTURE_INCOMPLETE_JOURS * 86_400_000,
    ),
  );
  const jusqua = new Date(now.getTime() - DELAI_FACTURE_INCOMPLETE_HEURES * 3_600_000);
  const lignes = await prisma.factureFormation.findMany({
    where: {
      ...(opts?.ids !== undefined ? { id: { in: opts.ids } } : {}),
      sessionId: { not: null },
      avoirDeId: null,
      statut: { notIn: ["annulee", "brouillon"] },
      emiseAt: { gte: depuis, lte: jusqua },
    },
    select: {
      id: true,
      numero: true,
      sessionId: true,
      destinataire: true,
      documentId: true,
      statut: true,
      montantHtCents: true,
      createdAt: true,
      avoirs: { select: { statut: true, montantHtCents: true } },
    },
  });
  const vivantes = lignes.filter((f) => factureVivante(f) && f.sessionId !== null);
  if (vivantes.length === 0) return [];

  const ids = vivantes.map((f) => f.id);
  const [journaux, corbeille, envois] = await Promise.all([
    prisma.activityLog.findMany({
      where: { action: ACTION_JOURNAL_EMAIL_FACTURE, targetId: { in: ids } },
      select: { targetId: true },
    }),
    prisma.emailOutbox.findMany({
      where: { template: "facture-envoi", createdAt: { gte: MISE_EN_SERVICE_FACTURE_AUTO } },
      select: { entityId: true, payload: true },
    }),
    prisma.emailLog.findMany({
      where: { template: "facture-envoi", entityId: { in: ids } },
      select: { entityId: true },
    }),
  ]);
  const traces = new Set<string>();
  for (const j of journaux) if (j.targetId) traces.add(j.targetId);
  for (const e of envois) if (e.entityId) traces.add(e.entityId);
  const parNumero = new Map(vivantes.map((f) => [f.numero, f.id]));
  for (const o of corbeille) {
    if (o.entityId) traces.add(o.entityId);
    const numero = (o.payload as { numero?: unknown } | null)?.numero;
    const id = typeof numero === "string" ? parNumero.get(numero) : undefined;
    if (id !== undefined) traces.add(id);
  }

  return vivantes
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      sessionId: f.sessionId as string,
      createdAt: f.createdAt,
      sansPdf: f.documentId === null,
      sansEmail: f.destinataire === "entreprise" && !traces.has(f.id),
    }))
    .filter((f) => f.sansPdf || f.sansEmail);
}
