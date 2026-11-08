/**
 * Ce qui suit une signature — UNE fonction, pour toutes les actions (lot S6a, a).
 *
 * ## Le défaut que ce module ferme
 *
 * Six actions de signature (pièce par jeton, contresignature de pièce, lettre
 * de mission côté formateur et côté organisme, contrat de travail côté salarié
 * et côté employeur), et autant de façons de « finir » :
 *
 *   - la pièce par jeton remettait l'exemplaire et prévenait par Telegram ;
 *   - la contresignature de pièce remettait l'exemplaire, sans prévenir ;
 *   - la lettre de mission ne remettait RIEN — le rattrapage horaire passait
 *     derrière, au mieux trente minutes plus tard ;
 *   - le contrat de travail classait la pièce au dossier, sans la remettre.
 *
 * C'est mot pour mot l'histoire du défaut du 2026-09-04 (AXI-DOC-2026-039),
 * où un canal notifiait et l'autre pas. Un seul après-signature, appelé par
 * toutes, et le verrou `socle-signature.spec.ts` refuse qu'une action appelle
 * `transmettreExemplaireSigne` en direct.
 *
 * ## Pourquoi HORS du fichier « use server »
 *
 * Tout export d'un fichier « use server » est un point d'entrée HTTP. Une
 * fonction qui remet un exemplaire et demande une activation n'a rien à faire
 * exposée au réseau : elle ne vérifie aucune session, ce sont ses appelants
 * qui le font.
 *
 * ## Règle commune : FAIL-SOFT
 *
 * Quand on arrive ici, la preuve est DÉJÀ écrite, chaînée et scellée. Une
 * panne d'e-mail, de R2, de Redis ou de Telegram ne doit jamais faire croire
 * au signataire que sa signature n'a pas été prise — il signerait deux fois.
 * Chaque branche est encapsulée ; ce qui reste dû est rattrapé ailleurs
 * (alerte `exemplaire_signe_non_transmis`, cron du positionnement).
 */

import {
  proposerPlansApresAcceptation,
  proposerPlansApresAcceptationDetaille,
} from "@/server/qualiopi/devis/proposer-plans";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { estNumeroEssai } from "@/server/qualiopi/essai/numerotation";
import { sortieSaufEssai } from "@/server/qualiopi/essai/sorties";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { changerActivationFormateur } from "@/server/qualiopi/formateurs-independants/activation";
import { marquerDossierVerifie } from "@/server/qualiopi/formateurs-independants/dossier-verifie";
import { lireEtatsSignature } from "@/server/qualiopi/formateurs-independants/interrupteurs-lecture";
import { envoyerPositionnement } from "@/server/qualiopi/notifications/notifications-service";
import {
  devisConcernesPourEmission,
  emettreDevisSigne,
  transactionDevisSigne,
} from "@/server/partners-sync/producteurs/devis";
import { accepterDevisAFormules } from "@/server/qualiopi/devis/acceptation-formules";
import { envoyerConfirmationCommande } from "@/server/qualiopi/devis/confirmation-commande";
import { faireMonterLesFichesDesDevisSignes } from "@/features/dossier-client/devis-signe-fait-client";
import type { PartieSignataire } from "./document-signature-hash";
import { circuitPour } from "./parties-requises";
import { estPieceEngageante } from "./pieces-engageantes";
import { lettreDue, reevaluerMission } from "./crochets-mission";
import { ficheDevisDePiece, prevenirDevisSigne } from "./notification-interne-devis";
import { transmettreCopiePartielle, transmettreExemplaireSigne } from "./transmission-exemplaire";

/**
 * Qui vient de signer.
 *
 * 🔴 Seul un `administrateur` porte une session : c'est la seule identité au
 * nom de laquelle une activation peut être DEMANDÉE. Un signataire (lien à
 * jeton, formateur dans son espace) n'active jamais rien — et aucun acteur
 * « système » n'existe ici (ADR 0066 étape 8).
 */
export type ActeurSignature =
  | { readonly type: "administrateur"; readonly session: AdminSession }
  | { readonly type: "signataire" };

export interface ContexteApresSignature {
  readonly documentGenereId: string;
  readonly type: string;
  readonly numero: string;
  readonly statutSignature: "partielle" | "signee";
  /** La partie qui vient de signer. */
  readonly partie: PartieSignataire;
  readonly acteur: ActeurSignature;
  /**
   * `lien_a_jeton` : la pièce signée par lien (`signerPieceParJetonAction`), le
   * seul canal qui alertait Telegram avant S6a. Les autres canaux n'alertent que
   * si l'interrupteur `signature.alertes_hors_jeton` est allumé.
   */
  readonly canal?: "lien_a_jeton";
  /**
   * Lot B (M3) : l'appelant remet lui-même la copie de la signature (F10 du dossier
   * formateur). Absent : comportement inchangé.
   */
  readonly sansCopiePartielle?: true;
}

function capturer(err: unknown, branche: string, ctx: ContexteApresSignature): void {
  Sentry.captureException(err, {
    tags: { action: `apresSignature:${branche}` },
    extra: { documentGenereId: ctx.documentGenereId, type: ctx.type },
  });
}

/**
 * Parties requises qui n'ont pas encore signé — lues APRÈS l'écriture.
 *
 * Sert l'alerte : « pièce incomplète » n'apprend rien, « reste à signer :
 * axionia » dit quoi faire (correctif F15).
 */
async function partiesManquantes(
  documentGenereId: string,
  requises: readonly PartieSignataire[],
): Promise<string[]> {
  const posees = await prisma.documentSignature.findMany({
    where: { documentGenereId, revokedAt: null },
    select: { partie: true },
  });
  const vues = new Set(posees.map((p) => p.partie));
  return requises.filter((p) => !vues.has(p));
}

/**
 * Envoie le questionnaire de positionnement à TOUS les stagiaires de la session
 * dès que la pièce qui engage l'action est intégralement signée (ind. 8).
 *
 * ⚠️ IDEMPOTENT par `envoyeAt: null`. ⚠️ Le booléen d'envoi n'est JAMAIS jeté :
 * `envoyerPositionnement` rend `false` sans lever sur cinq chemins, et poser la
 * trace pour un courrier jamais parti produirait une preuve fausse. Le cron du
 * positionnement reprend ce qui n'est pas parti.
 * Cliquet : `notifications/__tests__/appelant-ne-jette-pas-le-booleen-denvoi.spec.ts`.
 */
async function declencherPositionnement(documentGenereId: string): Promise<void> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { sessionId: true },
  });
  if (piece?.sessionId == null) return;

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      type: "positionnement",
      envoyeAt: null,
      reponduAt: null,
      enrollment: { sessionId: piece.sessionId },
    },
    select: { id: true },
  });

  for (const q of questionnaires) {
    try {
      if (!(await envoyerPositionnement(q.id))) {
        console.error(
          `[declencherPositionnement] NON ENVOYÉ — questionnaire ${q.id} laissé ` +
            "sans trace, candidat au rattrapage par le cron `positionnement`",
        );
        continue;
      }
      await prisma.questionnaire.update({
        where: { id: q.id },
        data: { envoyeAt: new Date() },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "declencherPositionnement" },
        extra: { documentGenereId, questionnaireId: q.id },
      });
    }
  }
}

/**
 * Le devis intégralement signé vaut accord.
 *
 * ⚠️ `updateMany` gardé sur le statut : un devis `accepte` ou
 * `transforme_convention` n'est jamais rétrogradé ; `expire` est INCLUS (une
 * signature intégrale reçue après l'échéance vaut accord). INT-T04 : l'accord et
 * l'événement `devis.signe` dans UNE transaction.
 */
/**
 * Devis À FORMULES (lot 4) : recopie du choix scellé + acceptation + fait `commande.signee`
 * dans UNE vraie transaction, canal Partners ouvert ou non. Idempotent (condition
 * `formule_retenue IS NULL`) : sert aussi à la REPRISE manuelle d'un devis signé des deux
 * parties dont l'acceptation avait échoué. `traite: false` = aucun devis à formules en attente.
 */
export async function reprendreAcceptationDevisFormules(
  documentGenereId: string,
  options?: { confirmer?: boolean },
): Promise<{
  traite: boolean;
  ids: string[];
  /** Devis que CET appel vient d'accepter (pas ceux déjà acceptés). */
  acceptes: string[];
  plansEchec: string[];
  confirmationsEchec: string[];
  /** Devis dont la confirmation vient d'être garée en corbeille par CET appel. */
  confirmationsPreparees: string[];
  /** Devis pour lesquels CET appel vient de créer au moins un plan récurrent (pas « déjà présents »). */
  plansProposes: string[];
}> {
  const formules = await accepterDevisAFormules(prisma, documentGenereId);
  if (formules.traite) {
    try {
      await faireMonterLesFichesDesDevisSignes(prisma, formules.ids, {
        origine: "signature_complete",
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
    }
  }
  // Confirmation de commande au client (CGV 6.2) : sur CONTRESIGNATURE EXPLICITE d'Axion-IA
  // seulement (`options.confirmer`). Cibles : les devis que CET appel vient d'accepter ET les devis
  // à formules DÉJÀ acceptés (reprise manuelle : la confirmation avait pu échouer — corbeille
  // indisponible, exemplaire absent — alors que l'acceptation, elle, était acquise). L'anti-rejeu
  // de `envoyerConfirmationCommande` (`dejaEnvoyee`, outbox + emailLog par jobId) interdit tout
  // doublon : `deja_envoyee` n'est NI un échec NI une préparation. Sans `confirmer: true`, jamais
  // de confirmation. Toujours garée en corbeille « à valider », jamais envoyée seule. Fail-soft.
  //
  // ⚠️ DÉCISION À TRANCHER PAR WILL (comportement inchangé) : une confirmation REFUSÉE ou SUPPRIMÉE
  // en corbeille laisse `jobIdDejaGare` vrai (la ligne d'outbox/emailLog existe) → `deja_envoyee`,
  // aucune nouvelle confirmation automatique. Une reprise ne la régénère donc pas.
  // Une seule lecture des devis déjà acceptés : sert à la confirmation ET à la reproposition.
  const dejaAcceptes =
    options?.confirmer === true || !formules.traite
      ? await devisAcceptesAFormules(documentGenereId)
      : [];
  const confirmationsEchec: string[] = [];
  const confirmationsPreparees: string[] = [];
  if (options?.confirmer === true) {
    const cibles = [...new Set([...(formules.traite ? formules.acceptes : []), ...dejaAcceptes])];
    for (const id of cibles) {
      try {
        const r = await envoyerConfirmationCommande({
          declencheur: "contresignature_axion_explicite",
          devisId: id,
        });
        if (r.envoye) {
          confirmationsPreparees.push(id);
        } else if (r.raison !== "formules_eteintes" && r.raison !== "deja_envoyee") {
          // `formules_eteintes` : lot éteint, rien n'est dû. `deja_envoyee` : déjà garée.
          confirmationsEchec.push(id);
        }
      } catch (err) {
        confirmationsEchec.push(id);
        Sentry.captureException(err, {
          tags: { action: "confirmation_commande_non_preparee" },
          extra: { devisId: id },
        });
      }
    }
  }
  // Plans récurrents PROPOSÉS en `pause` (lot 5) : APRÈS le COMMIT de l'acceptation, hors
  // transaction, fail-soft. Aussi pour un devis DÉJÀ accepté dont les plans manquent (la reprise
  // manuelle repropose) : idempotent (index unique partiel (devis_id, nature) + lecture
  // préalable → « déjà présents »). Inerte interrupteur éteint. Aucune facture, aucun e-mail.
  const aProposer = formules.traite ? formules.acceptes : dejaAcceptes;
  const plansEchec: string[] = [];
  const plansProposes: string[] = [];
  for (const id of aProposer) {
    const r = await proposerPlansApresAcceptationDetaille(id, "signature_complete");
    if (r.echec !== null) plansEchec.push(id);
    else if (r.proposes) plansProposes.push(id);
  }
  return {
    traite: formules.traite || aProposer.length > 0,
    ids: aProposer,
    acceptes: formules.traite ? formules.acceptes : [],
    plansEchec,
    confirmationsEchec,
    confirmationsPreparees,
    plansProposes,
  };
}

/** Devis à formules déjà acceptés de la pièce (formule retenue) : candidats à la reproposition. */
async function devisAcceptesAFormules(documentGenereId: string): Promise<string[]> {
  const lignes = await prisma.devis.findMany({
    where: {
      documentGenereId,
      offreSha256: { not: null },
      formuleRetenue: { not: null },
      statut: { in: ["accepte", "transforme_convention"] },
    },
    select: { id: true },
  });
  return lignes.map((d) => d.id);
}

/** Plans récurrents non proposés après une acceptation réussie : la signature reste acquise. */
export const PREFIXE_PLANS_NON_PROPOSES =
  "Devis accepté, mais les plans récurrents n'ont pas pu être proposés.";

/** Devis accepté, mais la confirmation de commande n'a pas été mise en corbeille. */
export const PREFIXE_CONFIRMATION_NON_PREPAREE =
  "Devis accepté, mais la confirmation de commande n'a pas été préparée.";

async function accepterDevis(
  documentGenereId: string,
  options: { confirmer: boolean },
): Promise<ActivationRefusee | null> {
  // Aucun devis à formules → chemin ci-dessous, inchangé.
  const formules = await reprendreAcceptationDevisFormules(documentGenereId, options);
  if (formules.traite) {
    const plans = formules.plansEchec.length > 0;
    const confirmations = formules.confirmationsEchec.length > 0;
    if (!plans && !confirmations) return null;
    if (plans && !confirmations) {
      return {
        code: "plans_recurrents_non_proposes",
        message:
          "L'acceptation est enregistrée. Relancez la proposition des plans depuis la fiche du devis.",
        manques: [],
        prefixe: PREFIXE_PLANS_NON_PROPOSES,
      };
    }
    const messageConfirmation =
      "La signature et l'acceptation sont enregistrées. Relancez l'acceptation depuis la fiche du devis pour préparer la confirmation de commande.";
    return {
      code: "confirmation_commande_non_preparee",
      message: plans
        ? `${messageConfirmation} Les plans récurrents n'ont pas non plus pu être proposés : relancez leur proposition depuis la fiche du devis.`
        : messageConfirmation,
      manques: [],
      prefixe: plans
        ? `${PREFIXE_CONFIRMATION_NON_PREPAREE} ${PREFIXE_PLANS_NON_PROPOSES}`
        : PREFIXE_CONFIRMATION_NON_PREPAREE,
    };
  }
  const garde = { documentGenereId, statut: { in: ["envoye" as const, "expire" as const] } };
  const vises = await transactionDevisSigne(prisma, async (tx) => {
    const concernes = await devisConcernesPourEmission(tx, garde);
    // Lecture propre à la montée du prospect : `devisConcernesPourEmission` rend [] canal Partners fermé.
    const lus = await tx.devis.findMany({ where: garde, select: { id: true } });
    await tx.devis.updateMany({
      where: garde,
      data: { statut: "accepte", acceptedAt: new Date() },
    });
    for (const id of concernes) await emettreDevisSigne(tx, id);
    return lus.map((d) => d.id);
  });
  // Un prospect passe en client lorsqu'un devis est signé (Will, 04/11/2026) : APRÈS le COMMIT,
  // hors transaction (B1) ; une erreur ne touche jamais l'acceptation.
  try {
    await faireMonterLesFichesDesDevisSignes(prisma, vises, { origine: "signature_complete" });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
  }
  // Devis à formules : plans récurrents PROPOSÉS en `pause` (lot 5). Après le COMMIT, hors
  // transaction, fail-soft ; inerte interrupteur éteint ou devis sans offre. Aucune facture,
  // aucun e-mail.
  for (const id of vises) await proposerPlansApresAcceptation(id, "signature_complete");
  return null;
}

/**
 * Le contrat de travail signé remplit le casier du dossier du salarié.
 *
 * `REQUIS_SALARIE` exige un `TrainerDocument` `contrat_travail` : sans ce
 * classement, un salarié resterait « non conforme » avec son contrat signé au
 * registre. IDEMPOTENT par le numéro de pièce. Aucune `dateExpiration` : un
 * contrat de travail n'expire pas, son terme n'est pas une échéance de pièce.
 */
async function classerContratTravail(documentGenereId: string, numero: string): Promise<void> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { trainerId: true },
  });
  const trainerId = piece?.trainerId ?? null;
  if (trainerId === null) return;
  const existant = await prisma.trainerDocument.findFirst({
    where: { trainerId, type: "contrat_travail", numeroPiece: numero },
    select: { id: true },
  });
  if (existant !== null) return;
  await prisma.trainerDocument.create({
    data: {
      trainerId,
      type: "contrat_travail",
      numeroPiece: numero,
      fichierUrl: `/api/formateur/contrat-travail/${documentGenereId}`,
      dateEmission: new Date(),
      // `valide` sans réserve : la pièce est produite, numérotée, hachée et
      // signée des deux parties par l'organisme lui-même.
      statutValidation: "valide",
    },
  });
}

/**
 * Contrat-cadre de sous-traitance d'un FORMATEUR INDÉPENDANT intégralement signé.
 *
 * Quatre effets, dans cet ordre :
 *   1. la date de signature sur la fiche (`sousTraitantContratSigneAt`) — que
 *      la garde d'activation lit ;
 *   2. le casier `TrainerDocument` `contrat_sous_traitance`, idempotent par
 *      numéro ;
 *   3. la preuve au journal (numéro et empreinte, aucune donnée personnelle) ;
 *   4. le dossier en ligne « vérifié », lien révoqué (lot B, M15), puis
 *      l'activation DEMANDÉE par l'écrivain unique (lot S1) — et seulement si
 *      l'acteur est un administrateur identifié. La garde de S1 peut refuser
 *      (pièces manquantes) : c'est son rôle, le refus est journalisé, la
 *      signature reste acquise.
 *
 * ⚠️ Un contrat rattaché à un ORGANISME sous-traitant (`sousTraitantId`) ne
 * concerne aucune fiche formateur : rien à faire ici. ⚠️ Salariés et
 * dirigeants : hors parcours (ADR 0066 a) — rien n'est écrit sur leur fiche.
 */
/**
 * Étape 3 du C4 (décision de Will) — l'activation demandée après une contresignature
 * réussie a été REFUSÉE. Le refus n'est plus avalé : il est rendu à l'appelant (qui
 * l'affiche en console), signalé à Sentry et journalisé. La signature reste acquise.
 * Aucune donnée personnelle : le message et les manques sont ceux de la garde.
 */
export interface ActivationRefusee {
  readonly code: string;
  /** Message d'écran : le motif, puis la liste des manques. */
  readonly message: string;
  readonly manques: ReadonlyArray<string>;
  /** Phrase d'ouverture de l'alerte, si ce n'est pas celle du contrat-cadre. */
  readonly prefixe?: string;
}

/** Devis signé des deux parties, mais son acceptation n'a pas été enregistrée. */
export const PREFIXE_ACCEPTATION_DEVIS_ECHOUEE =
  "Devis signé par les deux parties, mais son acceptation n'a pas été enregistrée.";

/** Ce que la console lit avant le motif d'un refus d'activation après contresignature. */
export const PREFIXE_ACTIVATION_REFUSEE =
  "Contrat contresigné, mais l'espace du formateur n'est pas ouvert.";

/** Ce que l'après-signature rend à l'appelant. Ne lève jamais. */
export interface ResultatApresSignature {
  /** Contrat-cadre contresigné mais espace NON ouvert : pourquoi. `null` sinon. */
  readonly activationRefusee: ActivationRefusee | null;
}

async function contratSousTraitanceFormateur(
  ctx: ContexteApresSignature,
): Promise<ActivationRefusee | null> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: ctx.documentGenereId },
    select: {
      trainerId: true,
      hashSha256: true,
      signatures: {
        where: { revokedAt: null },
        orderBy: { signeAt: "desc" },
        take: 1,
        select: { signeAt: true },
      },
    },
  });
  const trainerId = piece?.trainerId ?? null;
  if (piece == null || trainerId === null) return null;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true },
  });
  if (trainer?.statut !== "sous_traitant") return null;

  const signeLe = piece.signatures[0]?.signeAt ?? new Date();

  // 1. Date — jamais reculée : un contrat plus récent remplace, un rejeu ne
  //    réécrit rien.
  await prisma.trainer.updateMany({
    where: {
      id: trainerId,
      OR: [{ sousTraitantContratSigneAt: null }, { sousTraitantContratSigneAt: { lt: signeLe } }],
    },
    data: { sousTraitantContratSigneAt: signeLe },
  });

  // 2. Casier.
  const existant = await prisma.trainerDocument.findFirst({
    where: { trainerId, type: "contrat_sous_traitance", numeroPiece: ctx.numero },
    select: { id: true },
  });
  if (existant === null) {
    await prisma.trainerDocument.create({
      data: {
        trainerId,
        type: "contrat_sous_traitance",
        numeroPiece: ctx.numero,
        hashSha256: piece.hashSha256,
        fichierUrl: `/api/espace-formateur/documents/${ctx.documentGenereId}`,
        dateEmission: signeLe,
        statutValidation: "valide",
      },
    });
  }

  // 3. Preuve.
  const changes = {
    documentGenereId: ctx.documentGenereId,
    numero: ctx.numero,
    empreinte: piece.hashSha256,
    signeLe: signeLe.toISOString(),
  };
  if (ctx.acteur.type === "administrateur") {
    await logQualiopiActivity({
      action: "qualiopi.trainer.contrat_sous_traitance_signe",
      targetType: "Trainer",
      targetId: trainerId,
      changes,
      session: ctx.acteur.session,
    });
  } else {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "qualiopi.trainer.contrat_sous_traitance_signe",
        targetType: "Trainer",
        targetId: trainerId,
        changes: changes as never,
      },
    });
  }

  // 4. Activation demandée — jamais par un signataire, jamais par « système ».
  if (ctx.acteur.type !== "administrateur") return null;
  // Lot B (M15) : contresigné par l'administrateur, quel que soit l'écran — le dossier
  // en ligne passe « vérifié » et son lien est révoqué (sans effet sur la session de
  // l'espace). Écriture conditionnelle : une fiche sans dossier ouvert n'est pas touchée.
  // Une panne ne défait ni la signature ni l'activation.
  try {
    await marquerDossierVerifie({
      trainerId,
      parId: ctx.acteur.session.userId,
      maintenant: new Date(),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apresSignature:dossier-verifie" } });
  }
  const r = await changerActivationFormateur({
    trainerId,
    actif: true,
    acteur: { type: "administrateur", session: ctx.acteur.session },
    motif: `Contrat-cadre de sous-traitance ${ctx.numero} intégralement signé.`,
  });
  if (r.ok) return null;
  // Étape 3 du C4 : le refus de la GARDE n'est plus avalé — il est signalé comme les
  // autres, journalisé et rendu à l'appelant.
  Sentry.captureMessage("Activation après contrat-cadre non aboutie", {
    level: "warning",
    tags: { action: "apresSignature:activation", code: r.code },
    extra: { documentGenereId: ctx.documentGenereId, manques: r.manques.length },
  });
  const refus: ActivationRefusee = {
    code: r.code,
    message: r.manques.length === 0 ? r.message : `${r.message} ${r.manques.join(" ")}`,
    manques: r.manques,
  };
  try {
    await logQualiopiActivity({
      action: "qualiopi.trainer.activation_refusee",
      targetType: "Trainer",
      targetId: trainerId,
      changes: { documentGenereId: ctx.documentGenereId, numero: ctx.numero, ...refus },
      session: ctx.acteur.session,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apresSignature:activation-journal" } });
  }
  return refus;
}

/**
 * L'après-signature, pour toutes les actions.
 *
 * Ne lève jamais : chaque branche est encapsulée (voir l'en-tête).
 */
export async function apresSignature(ctx: ContexteApresSignature): Promise<ResultatApresSignature> {
  let activationRefusee: ActivationRefusee | null = null;
  const circuit = circuitPour(ctx.type);
  const libelle = circuit?.libelle ?? "pièce";

  // 🔴 Les comportements NEUFS de S6a sont livrés ÉTEINTS : clé absente,
  // illisible ou lecture en panne = comportement d'avant S6a, à l'identique.
  const interrupteurs = await lireEtatsSignature();
  const alerter = ctx.canal === "lien_a_jeton" || interrupteurs.alertes_hors_jeton;
  // QNC L02 — la pièce d'une session d'ESSAI (numéro `-ESSAI-`) n'alerte pas Telegram.
  const essai = estNumeroEssai(ctx.numero);
  const alerteBloquee = {
    canal: "telegram",
    cibleType: "DocumentGenere",
    cibleId: ctx.documentGenereId,
    objet: "signature",
  } as const;

  // ── 1. Remise ─────────────────────────────────────────────────────────────
  //
  // ⚠️ AVANT toute branche par type : c'est ce qui manquait à la lettre de
  // mission, et une remise placée après un `return` de branche ne
  // s'exécuterait que pour certains types.
  // Le contrat de travail n'était que classé : sa remise au salarié est neuve.
  const remettre = ctx.type !== "contrat_travail" || interrupteurs.exemplaire_contrat_travail;
  if (ctx.statutSignature === "signee" && remettre) {
    try {
      const remise = await transmettreExemplaireSigne(ctx.documentGenereId);
      if (!remise.ok && remise.motif !== "deja_transmis" && remise.motif !== "aucun_destinataire") {
        Sentry.captureMessage("Exemplaire signé non transmis", {
          level: "warning",
          tags: { action: "apresSignature:exemplaire", motif: remise.motif },
          extra: { documentGenereId: ctx.documentGenereId, type: ctx.type, detail: remise.detail },
        });
      }
    } catch (err) {
      capturer(err, "exemplaire", ctx);
    }
  } else if (ctx.statutSignature !== "signee") {
    // 🔴 Une signature reçue que personne ne remarque laisse la pièce en
    // attente indéfiniment. ⚠️ AUCUNE donnée personnelle : Telegram est un
    // canal tiers — libellé, numéro et codes de parties suffisent à agir.
    if (alerter) {
      try {
        const manquantes =
          circuit === null ? [] : await partiesManquantes(ctx.documentGenereId, circuit.parties);
        // Le numéro du devis (AXI-DEV-…) s'ajoute à celui de la pièce : aucune donnée personnelle.
        const fiche = ctx.type === "devis" ? await ficheDevisDePiece(ctx.documentGenereId) : null;
        const numeroDevis = fiche !== null ? ` (n° ${fiche.numero})` : "";
        await sortieSaufEssai(essai, alerteBloquee, () =>
          sendTelegram({
            tag: "AUTO",
            body: `✍️ ${libelle} ${ctx.numero}${numeroDevis} : signature reçue (${ctx.partie}). Reste à signer : ${manquantes.join(", ")}.`,
          }),
        );
      } catch (err) {
        capturer(err, "alerte", ctx);
      }
    }
    // E-mail INTERNE à l'organisme : le client vient de signer son devis par lien, il reste
    // à contresigner. Fail-soft (module qui ne lève pas), muet pour une pièce d'essai.
    if (ctx.type === "devis" && ctx.partie === "client" && ctx.canal === "lien_a_jeton") {
      try {
        await prevenirDevisSigne({
          documentGenereId: ctx.documentGenereId,
          numeroPiece: ctx.numero,
          etape: "a_contresigner",
          essai,
        });
      } catch (err) {
        capturer(err, "email_interne_devis", ctx);
      }
    }
    if (interrupteurs.copie_partielle && ctx.sansCopiePartielle !== true) {
      try {
        await transmettreCopiePartielle(ctx.documentGenereId, ctx.partie);
      } catch (err) {
        capturer(err, "copie_partielle", ctx);
      }
    }
  }

  // Le canal jeton prévenait aussi d'une complétion : on le garde pour les
  // signataires extérieurs, l'organisme qui contresigne le sait déjà.
  if (ctx.statutSignature === "signee" && ctx.acteur.type === "signataire" && alerter) {
    await sortieSaufEssai(essai, alerteBloquee, () =>
      sendTelegram({
        tag: "AUTO",
        body: `✅ ${libelle} ${ctx.numero} : intégralement signée.`,
      }),
    ).catch(() => {});
    // Le client a signé EN DERNIER (l'organisme avait déjà contresigné) : même trace par e-mail
    // interne. La contresignature par l'organisme n'en envoie pas, il le sait déjà.
    if (ctx.type === "devis" && ctx.partie === "client" && ctx.canal === "lien_a_jeton") {
      try {
        await prevenirDevisSigne({
          documentGenereId: ctx.documentGenereId,
          numeroPiece: ctx.numero,
          etape: "complete",
          essai,
        });
      } catch (err) {
        capturer(err, "email_interne_devis", ctx);
      }
    }
  }

  // ── 2. Lettre de mission : la mission se réévalue à chaque signature ──────
  if (ctx.type === "lettre_mission") {
    try {
      await reevaluerMission(ctx.documentGenereId);
    } catch (err) {
      capturer(err, "reevaluer_mission", ctx);
    }
  }

  if (ctx.statutSignature !== "signee") return { activationRefusee: null };

  // ── 3. Pièce engageante : positionnement, puis lettre de mission due ──────
  if (estPieceEngageante(ctx.type)) {
    try {
      await declencherPositionnement(ctx.documentGenereId);
    } catch (err) {
      capturer(err, "positionnement", ctx);
    }
    try {
      await lettreDue(ctx.documentGenereId);
    } catch (err) {
      capturer(err, "lettre_due", ctx);
    }
    return { activationRefusee: null };
  }

  // ── 4. Branches propres à un type ──────────────────────────────────────────
  try {
    if (ctx.type === "devis") {
      try {
        // La confirmation de commande ne part que de la contresignature EXPLICITE d'un
        // administrateur d'Axion-IA : jamais sur la signature du client ni par un signataire.
        activationRefusee = await accepterDevis(ctx.documentGenereId, {
          confirmer: ctx.partie === "axionia" && ctx.acteur.type === "administrateur",
        });
      } catch (err) {
        // Signé des deux parties mais non accepté : ne reste pas qu'un message Sentry, l'écran
        // de contresignature le dit et la reprise manuelle existe.
        capturer(err, ctx.type, ctx);
        const motif = (err as { motif?: unknown } | null)?.motif;
        activationRefusee = {
          code: "acceptation_devis_echouee",
          message:
            (typeof motif === "string" ? `Motif : ${motif}. ` : "") +
            "Relancez l'acceptation depuis la fiche du devis.",
          manques: [],
          prefixe: PREFIXE_ACCEPTATION_DEVIS_ECHOUEE,
        };
      }
    } else if (ctx.type === "contrat_travail") {
      await classerContratTravail(ctx.documentGenereId, ctx.numero);
    } else if (ctx.type === "contrat_sous_traitance" && interrupteurs.suite_contrat_cadre) {
      activationRefusee = await contratSousTraitanceFormateur(ctx);
    }
  } catch (err) {
    capturer(err, ctx.type, ctx);
  }
  return { activationRefusee };
}
