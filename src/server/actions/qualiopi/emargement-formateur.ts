/**
 * Qualiopi T13 — Émargement recueilli SUR LE POSTE DU FORMATEUR.
 *
 * C'est le mode dominant pour l'intra en entreprise : sur site client, le Wi-Fi
 * invité est souvent restreint, les filtres de messagerie bloquent les liens
 * externes, et certains clients interdisent les téléphones personnels en salle.
 * Envoyer douze liens individuels, c'est douze façons d'échouer.
 *
 * Le formateur ouvre donc la liste de son groupe sur son propre appareil, déjà
 * authentifié, et fait signer chacun à tour de rôle.
 *
 * ⚠️ Conséquence juridique assumée : dans ce mode, `tokenId` est nul et
 * l'identification du signataire repose sur le FORMATEUR qui atteste — comme
 * avec une feuille papier qu'il fait circuler. C'est pourquoi
 * `recueilliParTrainerId` est renseigné : une ligne qui ne dirait pas qui
 * atteste ne prouverait pas grand-chose devant un contrôle.
 *
 * Pattern d'autorisation : `requireFormateur` + appartenance à la session,
 * résolue par `resoudreAppartenance` (source de vérité unique de l'étape B).
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { requireFormateurAction } from "@/server/formateur/guard";
import { resoudreAppartenance, type RoleFormateur } from "@/server/formateur/session-membership";
import { signerCreneau, type RefusSignature } from "@/server/qualiopi/emargement/signature-service";
import {
  contresignerDemiJournee,
  type RefusContresignature,
} from "@/server/qualiopi/emargement/contresignature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { z } from "zod";

export type RefusFormateur = RefusSignature | "non_membre" | "stockage";

export type ResultatSignatureFormateur =
  | { ok: true; signatureId: string }
  | { ok: false; raison: RefusFormateur; message: string };

export type RefusContresignatureFormateur =
  | RefusContresignature
  | "non_membre"
  | "stockage"
  | "requete_invalide";

export type ResultatContresignatureFormateur =
  | { ok: true; contresignatureId: string }
  | { ok: false; raison: RefusContresignatureFormateur; message: string };

/**
 * ⚠️ Le formateur est authentifié, mais ses arguments ne le sont pas.
 *
 * `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
 * scellée définitivement. `papier_scanne` est admis ICI et nulle part ailleurs —
 * c'est le mode dégradé de la décision D11, et il n'a de sens que sur un poste
 * tenu par le formateur.
 */
const signerPourStagiaireSchema = z.object({
  sessionId: z.string().uuid(),
  creneauId: z.string().uuid(),
  methode: z.enum(["canvas", "confirmation_accessible", "papier_scanne"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
  nomConfirme: z.string().max(200).optional(),
});

/**
 * Appartenance du formateur à la session — source de vérité unique de l'étape B.
 *
 * Extraite pour valoir à l'identique sur les DEUX écritures du formateur (faire
 * signer un stagiaire ET contresigner) : une garde d'autorisation dupliquée est
 * l'endroit où les deux copies divergent en silence.
 */
async function estMembreDeSession(sessionId: string, trainerId: string): Promise<boolean> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      formateurPrincipalId: true,
      sessionFormateurs: { where: { trainerId }, select: { role: true } },
    },
  });
  if (session === null) return false;
  return resoudreAppartenance({
    estPrincipalFk: session.formateurPrincipalId === trainerId,
    roleSessionFormateur: (session.sessionFormateurs[0]?.role as RoleFormateur | undefined) ?? null,
  }).estMembre;
}

/**
 * Fait signer un stagiaire sur le poste du formateur.
 *
 * `sessionId` est exigé EN PLUS de `creneauId` : l'appartenance se vérifie sur
 * la session, et le service recoupe ensuite que le créneau en fait bien partie.
 * Sans ce double contrôle, un formateur pourrait faire signer un créneau d'une
 * session qu'il n'anime pas.
 */
export async function signerPourStagiaireAction(input: {
  sessionId: string;
  creneauId: string;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  imageDataUrl?: string;
  nomConfirme?: string;
}): Promise<ResultatSignatureFormateur> {
  const formateur = await requireFormateurAction();

  const parse = signerPourStagiaireSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "creneau_introuvable",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const estMembre = await estMembreDeSession(donnees.sessionId, formateur.trainerId);
  if (!estMembre) {
    Sentry.captureException(new Error("Signature tentée sur une session non animée"), {
      tags: { action: "signerPourStagiaireAction:non_membre" },
      extra: { sessionId: donnees.sessionId },
    });
    return {
      ok: false,
      raison: "non_membre",
      message: "Vous n'animez pas cette session.",
    };
  }

  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = entetes.get("user-agent");

  try {
    const res = await signerCreneau({
      creneauId: input.creneauId,
      porteur: {
        type: "formateur",
        sessionId: input.sessionId,
        trainerId: formateur.trainerId,
      },
      methode: input.methode,
      imageDataUrl: input.imageDataUrl,
      nomConfirme: input.nomConfirme,
      ipHash: hashIp(ipBrute),
      userAgentSha256: ua === null ? null : createHash("sha256").update(ua).digest("hex"),
    });

    if (!res.ok) return { ok: false, raison: res.raison, message: res.message };
    return { ok: true, signatureId: res.signatureId };
  } catch (err) {
    if (err instanceof SignatureStockageError) {
      return {
        ok: false,
        raison: "stockage",
        message: err.imputableAuClient
          ? err.message
          : "La signature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, faites signer une feuille papier.",
      };
    }
    Sentry.captureException(err, { tags: { action: "signerPourStagiaireAction" } });
    throw err;
  }
}

const contresignerSchema = z.object({
  sessionId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  demiJournee: z.enum(["matin", "apres_midi", "journee"]),
  methode: z.enum(["canvas", "confirmation_accessible", "papier_scanne"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
  nomConfirme: z.string().max(200).optional(),
});

/**
 * Le formateur contresigne une demi-journée, pour tout le groupe.
 *
 * Exigence jurisprudentielle « stagiaire ET formateur » (CAA Nantes
 * 20/04/2021) : sans cette signature, la feuille est insuffisamment probante.
 * Le formateur atteste ici un fait pédagogique — ce qui reste, par décision
 * D10, sans aucun effet sur `heuresAnimees` ni sur sa rémunération.
 *
 * Même garde d'appartenance que `signerPourStagiaireAction` : un formateur ne
 * contresigne que les sessions qu'il anime.
 */
export async function contresignerDemiJourneeAction(input: {
  sessionId: string;
  date: string;
  demiJournee: DemiJourneeLabel;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  imageDataUrl?: string;
  nomConfirme?: string;
}): Promise<ResultatContresignatureFormateur> {
  const formateur = await requireFormateurAction();

  const parse = contresignerSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const estMembre = await estMembreDeSession(donnees.sessionId, formateur.trainerId);
  if (!estMembre) {
    Sentry.captureException(new Error("Contresignature tentée sur une session non animée"), {
      tags: { action: "contresignerDemiJourneeAction:non_membre" },
      extra: { sessionId: donnees.sessionId },
    });
    return { ok: false, raison: "non_membre", message: "Vous n'animez pas cette session." };
  }

  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = entetes.get("user-agent");

  try {
    const res = await contresignerDemiJournee({
      sessionId: donnees.sessionId,
      date: donnees.date,
      demiJournee: donnees.demiJournee,
      trainerId: formateur.trainerId,
      methode: donnees.methode,
      imageDataUrl: donnees.imageDataUrl,
      nomConfirme: donnees.nomConfirme,
      ipHash: hashIp(ipBrute),
      userAgentSha256: ua === null ? null : createHash("sha256").update(ua).digest("hex"),
    });

    if (!res.ok) return { ok: false, raison: res.raison, message: res.message };
    return { ok: true, contresignatureId: res.contresignatureId };
  } catch (err) {
    if (err instanceof SignatureStockageError) {
      return {
        ok: false,
        raison: "stockage",
        message: err.imputableAuClient
          ? err.message
          : "La contresignature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, signez une feuille papier.",
      };
    }
    Sentry.captureException(err, { tags: { action: "contresignerDemiJourneeAction" } });
    throw err;
  }
}
