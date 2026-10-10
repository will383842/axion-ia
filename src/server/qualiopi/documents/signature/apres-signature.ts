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

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { changerActivationFormateur } from "@/server/qualiopi/formateurs-independants/activation";
import { lireEtatsSignature } from "@/server/qualiopi/formateurs-independants/interrupteurs-lecture";
import { envoyerPositionnement } from "@/server/qualiopi/notifications/notifications-service";
import {
  devisConcernesPourEmission,
  emettreDevisSigne,
  transactionDevisSigne,
} from "@/server/partners-sync/producteurs/devis";
import type { PartieSignataire } from "./document-signature-hash";
import { circuitPour } from "./parties-requises";
import { estPieceEngageante } from "./pieces-engageantes";
import { lettreDue, reevaluerMission } from "./crochets-mission";
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
async function accepterDevis(documentGenereId: string): Promise<void> {
  const garde = { documentGenereId, statut: { in: ["envoye" as const, "expire" as const] } };
  await transactionDevisSigne(prisma, async (tx) => {
    const concernes = await devisConcernesPourEmission(tx, garde);
    await tx.devis.updateMany({
      where: garde,
      data: { statut: "accepte", acceptedAt: new Date() },
    });
    for (const id of concernes) await emettreDevisSigne(tx, id);
  });
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
 *   4. l'activation DEMANDÉE par l'écrivain unique (lot S1) — et seulement si
 *      l'acteur est un administrateur identifié. La garde de S1 peut refuser
 *      (pièces manquantes) : c'est son rôle, le refus est journalisé, la
 *      signature reste acquise.
 *
 * ⚠️ Un contrat rattaché à un ORGANISME sous-traitant (`sousTraitantId`) ne
 * concerne aucune fiche formateur : rien à faire ici. ⚠️ Salariés et
 * dirigeants : hors parcours (ADR 0066 a) — rien n'est écrit sur leur fiche.
 */
async function contratSousTraitanceFormateur(ctx: ContexteApresSignature): Promise<void> {
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
  if (piece == null || trainerId === null) return;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true },
  });
  if (trainer?.statut !== "sous_traitant") return;

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
  if (ctx.acteur.type !== "administrateur") return;
  const r = await changerActivationFormateur({
    trainerId,
    actif: true,
    acteur: { type: "administrateur", session: ctx.acteur.session },
    motif: `Contrat-cadre de sous-traitance ${ctx.numero} intégralement signé.`,
  });
  if (!r.ok && r.code !== "garde") {
    Sentry.captureMessage("Activation après contrat-cadre non aboutie", {
      level: "warning",
      tags: { action: "apresSignature:activation", code: r.code },
      extra: { documentGenereId: ctx.documentGenereId },
    });
  }
}

/**
 * L'après-signature, pour toutes les actions.
 *
 * Ne lève jamais : chaque branche est encapsulée (voir l'en-tête).
 */
export async function apresSignature(ctx: ContexteApresSignature): Promise<void> {
  const circuit = circuitPour(ctx.type);
  const libelle = circuit?.libelle ?? "pièce";

  // 🔴 Les comportements NEUFS de S6a sont livrés ÉTEINTS : clé absente,
  // illisible ou lecture en panne = comportement d'avant S6a, à l'identique.
  const interrupteurs = await lireEtatsSignature();
  const alerter = ctx.canal === "lien_a_jeton" || interrupteurs.alertes_hors_jeton;

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
        await sendTelegram({
          tag: "AUTO",
          body: `✍️ ${libelle} ${ctx.numero} : signature reçue (${ctx.partie}). Reste à signer : ${manquantes.join(", ")}.`,
        });
      } catch (err) {
        capturer(err, "alerte", ctx);
      }
    }
    if (interrupteurs.copie_partielle) {
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
    await sendTelegram({
      tag: "AUTO",
      body: `✅ ${libelle} ${ctx.numero} : intégralement signée.`,
    }).catch(() => {});
  }

  // ── 2. Lettre de mission : la mission se réévalue à chaque signature ──────
  if (ctx.type === "lettre_mission") {
    try {
      await reevaluerMission(ctx.documentGenereId);
    } catch (err) {
      capturer(err, "reevaluer_mission", ctx);
    }
  }

  if (ctx.statutSignature !== "signee") return;

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
    return;
  }

  // ── 4. Branches propres à un type ──────────────────────────────────────────
  try {
    if (ctx.type === "devis") await accepterDevis(ctx.documentGenereId);
    else if (ctx.type === "contrat_travail") {
      await classerContratTravail(ctx.documentGenereId, ctx.numero);
    } else if (ctx.type === "contrat_sous_traitance" && interrupteurs.suite_contrat_cadre) {
      await contratSousTraitanceFormateur(ctx);
    }
  } catch (err) {
    capturer(err, ctx.type, ctx);
  }
}
