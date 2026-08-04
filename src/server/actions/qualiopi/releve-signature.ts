/**
 * Phase 2 — Signature du RELEVÉ DE CONNEXION FOAD (canal B).
 *
 * Premier consommateur réel du socle `DocumentSignature`, et le plus simple des
 * dix circuits : deux signataires INTERNES, aucune dépendance externe, aucun
 * jeton public. Il éprouve la phase 1 en conditions réelles avant qu'on engage
 * du contractuel avec un tiers.
 *
 * ## Les deux cadres existaient déjà, vides
 *
 * `releve-connexion.tsx` porte depuis toujours « Signature du formateur » et
 * « Visa du responsable pédagogique » — deux cadres à remplir au stylo. Cette
 * phase ne crée donc pas un circuit : elle donne une preuve réelle à un cadre
 * qui existe et que rien ne remplissait.
 *
 * ## 🔴 Le plafond probant, dit avant qu'on nous le fasse remarquer
 *
 * Le « responsable pédagogique » n'est PAS un rôle d'habilitation distinct dans
 * ce dépôt : `qualiopi/config/registry.ts` décrit `dirigeant_nom` comme « Nom du
 * dirigeant / responsable pédagogique ». Dans un organisme d'une personne, le
 * formateur et le responsable pédagogique sont donc le MÊME humain.
 *
 * Les deux signatures attestent deux QUALITÉS distinctes, pas deux personnes
 * indépendantes. Le visa n'ajoute aucun contrôle croisé, et prétendre le
 * contraire serait exactement le genre d'affirmation non fondée que ce chantier
 * retire. On l'écrit donc, plutôt que de laisser croire à un double contrôle.
 *
 * ⚠️ `Trainer.statut = dirigeant` est un AUTRE axe (« dirigeant-formateur » :
 * l'organisme anime lui-même). Ne pas les confondre.
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { requireFormateurAction } from "@/server/formateur/guard";
import { resoudreAppartenance, type RoleFormateur } from "@/server/formateur/session-membership";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import {
  signerDocument,
  type RefusSignatureDocument,
} from "@/server/qualiopi/documents/signature/document-signature-service";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { partiesRequisesPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

/**
 * 🔴 Les parties attendues viennent du SSOT, jamais d'une liste locale.
 *
 * Une liste écrite ici divergerait un jour de celle d'un autre circuit, en
 * silence : une pièce déclarée à deux parties d'un côté et à trois de l'autre
 * passerait `signee` à deux signatures sur trois, et le dossier afficherait
 * « signé » sur une pièce que l'organisme n'a jamais contresignée.
 */
const PARTIES_RELEVE: readonly PartieSignataire[] = partiesRequisesPour("releve_connexion") ?? [];

export type RefusReleve =
  RefusSignatureDocument | "non_membre" | "requete_invalide" | "role_insuffisant" | "stockage";

export type ResultatSignatureReleve =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: RefusReleve; message: string };

/**
 * ⚠️ Le signataire est authentifié, mais ses arguments ne le sont pas.
 *
 * `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
 * scellée définitivement.
 */
const entreeSchema = z.object({
  documentGenereId: z.string().uuid(),
  methode: z.enum(["trace", "papier_scanne", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/** Empreintes de contexte, hors tuple haché donc effaçables (RGPD art. 17). */
async function contexteRequete(): Promise<{
  ipHash: string | null;
  userAgentSha256: string | null;
}> {
  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = entetes.get("user-agent");
  return {
    ipHash: hashIp(ipBrute),
    userAgentSha256: ua === null ? null : createHash("sha256").update(ua).digest("hex"),
  };
}

/**
 * Traduit une panne de stockage en refus exploitable.
 *
 * 🔴 `storeSignatureImage` LÈVE quand R2 est absent ou l'écriture ratée, et
 * c'est sa raison d'être : une signature dont l'image n'a pas été écrite est une
 * preuve qui n'existe pas. L'appelant doit REFUSER la signature, jamais la
 * simuler — d'où ce mapping plutôt qu'un `catch` silencieux.
 */
function refusStockage(err: SignatureStockageError): ResultatSignatureReleve {
  return {
    ok: false,
    raison: "stockage",
    message: err.imputableAuClient
      ? err.message
      : "La signature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, signez le relevé sur papier et versez-le au dossier.",
  };
}

/**
 * Le formateur signe le relevé de connexion de SA session.
 *
 * L'appartenance est vérifiée ICI, sur la session, en plus du recoupement que
 * `signerDocument` fait de son côté sur la pièce. Deux contrôles, et ce n'est
 * pas redondant : le premier refuse tôt, avec un message qui a du sens pour le
 * formateur ; le second est la garde du service, qui ne fait confiance à aucun
 * appelant.
 */
export async function signerReleveFormateurAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureReleve> {
  const formateur = await requireFormateurAction();

  const parse = entreeSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: donnees.documentGenereId },
    select: { type: true, sessionId: true },
  });
  if (piece === null || piece.type !== "releve_connexion") {
    return {
      ok: false,
      raison: "piece_introuvable",
      message: "Relevé de connexion introuvable.",
    };
  }

  if (
    piece.sessionId === null ||
    !(await estMembreDeSession(piece.sessionId, formateur.trainerId))
  ) {
    Sentry.captureException(new Error("Signature de relevé tentée sur une session non animée"), {
      tags: { action: "signerReleveFormateurAction:non_membre" },
      extra: { documentGenereId: donnees.documentGenereId },
    });
    return { ok: false, raison: "non_membre", message: "Vous n'animez pas cette session." };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: {
        type: "formateur_authentifie",
        trainerId: formateur.trainerId,
        partie: "formateur",
      },
      methode: donnees.methode,
      partiesRequises: PARTIES_RELEVE,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;
    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerReleveFormateurAction" } });
    throw err;
  }
}

/**
 * Le responsable pédagogique vise le relevé.
 *
 * ⚠️ `requireAdminWrite` admet `editor`, et `signerDocument` ne l'admet PAS —
 * viser une pièce opposable engage l'organisme. On refuse donc ICI, avec un
 * message qui dit pourquoi, plutôt que de laisser remonter un
 * `identite_non_resolvable` que personne ne saurait interpréter.
 */
export async function viserReleveResponsablePedagogiqueAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureReleve> {
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      ok: false,
      raison: "role_insuffisant",
      message:
        "Viser un relevé de connexion engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
    };
  }

  const parse = entreeSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: donnees.documentGenereId },
    select: { type: true, numero: true },
  });
  if (piece === null || piece.type !== "releve_connexion") {
    return { ok: false, raison: "piece_introuvable", message: "Relevé de connexion introuvable." };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: {
        type: "organisme_authentifie",
        adminId: session.userId,
        partie: "responsable_pedagogique",
      },
      methode: donnees.methode,
      partiesRequises: PARTIES_RELEVE,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;

    await logQualiopiActivity({
      action: "qualiopi.releve.visa",
      targetType: "DocumentSignature",
      targetId: res.signatureId,
      changes: { documentGenereId: donnees.documentGenereId, numero: piece.numero },
      session,
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "viserReleveResponsablePedagogiqueAction" } });
    throw err;
  }
}

/**
 * Appartenance du formateur à la session — même source de vérité que
 * l'émargement (`resoudreAppartenance`). Une garde d'autorisation dupliquée est
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
