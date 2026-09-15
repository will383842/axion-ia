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
 * Au-delà de 30 jours civils après la fin, l'automate ne facture plus — et
 * l'alerte de ce module se tait (celle des sessions jamais facturées, J+15 à
 * J+365, prend le relais).
 *
 * Deux raisons. Une session bloquée (fiche client incomplète) qu'on complète
 * six semaines plus tard ne doit pas se facturer dans le dos de celui qui
 * corrige : passé un mois, la facture est un geste. Et l'alerte d'un cas
 * insoluble par nature (action réellement offerte, montant nul) doit finir par
 * s'éteindre d'elle-même plutôt que de rester ouverte pour toujours.
 */
export const FENETRE_FACTURE_AUTO_JOURS = 30;

/**
 * Jours civils après la fin à partir desquels une session ÉLIGIBLE toujours
 * sans facture est signalée comme un passage en échec.
 *
 * 🔑 Trois, et pas deux — c'est la chronologie des crons qui le fixe, pas un
 * goût. Le balayage des alertes passe à 07:00 UTC, le passage de facturation à
 * 09:30. Une session clôturée par le cron de 08:00 le surlendemain (clôture
 * automatique à fin + 24 h), ou à la main l'après-midi du lendemain, n'est
 * facturée qu'au passage de 09:30 du surlendemain : à « deux jours », le
 * balayage de 07:00 crierait donc à l'échec deux heures et demie AVANT la
 * tentative. Une alerte qui se lève avant ce qu'elle surveille apprend à
 * l'ignorer.
 */
export const JOURS_AVANT_ECHEC_SIGNALE = 3;

/** Journal : génération automatique (`adminUserId: null`). */
export const ACTION_JOURNAL_FACTURE_AUTO = "qualiopi.facture.generer.auto";

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
  dateFin: Date;
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
    payeurs: Array<{
      payeurType: string;
      montantAttenduCents: number;
      factureFormationId: string | null;
    }>;
  }>;
}

export const SESSION_FACTURE_AUTO_SELECT = {
  id: true,
  numero: true,
  titreSession: true,
  statut: true,
  dateFin: true,
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
      payeurs: {
        select: { payeurType: true, montantAttenduCents: true, factureFormationId: true },
      },
    },
  },
} as const;

/**
 * Sessions réalisées finies dans la fenêtre de l'automate, les plus anciennes
 * d'abord. Le filtre fin (lendemain, factures, motifs) est celui de
 * `deciderFactureAuto`, en mémoire : le volume est borné par la fenêtre.
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
  return lignes as unknown as SessionFactureAuto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Décision
// ─────────────────────────────────────────────────────────────────────────────

export type MotifNonAutomatisable =
  | "refacturation_apres_annulation"
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

/**
 * Une facture est VIVANTE tant qu'elle n'est ni annulée ni entièrement
 * rectifiée par ses avoirs non annulés. Un brouillon est vivant : il est déjà
 * « la facture de cette session », à émettre — pas une absence.
 */
function factureVivante(f: SessionFactureAuto["facturesFormation"][number]): boolean {
  if (f.statut === "annulee") return false;
  const rectifie = (f.avoirs ?? [])
    .filter((a) => a.statut !== "annulee")
    .reduce((somme, a) => somme + Math.abs(a.montantHtCents), 0);
  return rectifie < f.montantHtCents;
}

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
 *   1. la session ne se facture pas automatiquement (motifs nommés) ;
 *   2. elle aurait dû l'être, et trois jours après aucune facture n'existe — le
 *      passage a échoué (identité de l'organisme incomplète, accord manquant,
 *      panne) : c'est l'échec SILENCIEUX que ce module refuse ;
 *   3. la facture a été émise automatiquement, mais son e-mail n'a jamais été
 *      préparé (PDF non rendu, corbeille indisponible, adresse retenue).
 *
 * 🔑 Chaque cas DISPARAÎT quand il est résolu — facture émise à la main, fiche
 * complétée puis facture générée, e-mail préparé — et l'alerte, déclarée
 * `resolutionAuto: true`, se ferme alors seule au balayage suivant.
 */
export async function casFactureAutoASignaler(now: Date): Promise<CasFactureAuto[]> {
  const cas: CasFactureAuto[] = [];

  for (const s of await chargerSessionsFactureAuto(now)) {
    const d = deciderFactureAuto(s, now);
    if (d.verdict === "non_automatisable") {
      cas.push({
        cibleType: "TrainingSession",
        cibleId: s.id,
        message:
          `${designer(s)} est réalisée et sa facture n'a PAS été générée automatiquement : ` +
          `${d.motifs.map((m) => m.libelle).join(" ; ")}. ` +
          "Corrigez ce qui peut l'être puis générez la facture depuis la fiche de session " +
          "(section Financier) ; son e-mail passera par « E-mails à valider ».",
      });
    } else if (
      d.verdict === "emettre" &&
      joursCivilsParisEntre(s.dateFin, now) >= JOURS_AVANT_ECHEC_SIGNALE
    ) {
      cas.push({
        cibleType: "TrainingSession",
        cibleId: s.id,
        message:
          `${designer(s)} remplissait les conditions de la facturation automatique, et aucune ` +
          "facture n'existe trois jours après sa fin : le passage quotidien n'a pas abouti. " +
          "Générez la facture depuis la fiche de session (section Financier) : le motif du " +
          "refus s'affichera s'il y en a un.",
      });
    }
  }

  // ── Famille 3 : facture automatique sans e-mail préparé ───────────────────
  const depuis = new Date(now.getTime() - FENETRE_FACTURE_AUTO_JOURS * 86_400_000);
  const generees = await prisma.activityLog.findMany({
    where: { action: ACTION_JOURNAL_FACTURE_AUTO, createdAt: { gte: depuis } },
    select: { targetId: true },
  });
  const ids = [...new Set(generees.map((g) => g.targetId).filter((t): t is string => !!t))];
  if (ids.length === 0) return cas;

  const [emails, factures] = await Promise.all([
    prisma.activityLog.findMany({
      where: { action: ACTION_JOURNAL_EMAIL_FACTURE, targetId: { in: ids } },
      select: { targetId: true },
    }),
    prisma.factureFormation.findMany({
      where: { id: { in: ids }, statut: { notIn: ["annulee", "brouillon"] } },
      select: { id: true, numero: true },
    }),
  ]);
  const preparees = new Set(emails.map((e) => e.targetId));
  for (const f of factures) {
    if (preparees.has(f.id)) continue;
    cas.push({
      cibleType: "FactureFormation",
      cibleId: f.id,
      message:
        `La facture ${f.numero} a été générée automatiquement, mais son e-mail n'a pas pu être ` +
        "préparé (PDF non rendu, corbeille de validation indisponible ou adresse retenue). " +
        "Ouvrez la facture et cliquez « Envoyer par email » : il attendra votre validation.",
    });
  }
  return cas;
}
