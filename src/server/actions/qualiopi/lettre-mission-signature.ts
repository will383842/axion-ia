/**
 * Phase 6a — Signature de la LETTRE DE MISSION FORMATEUR (canal B).
 *
 * Deuxième circuit maison après le relevé de connexion, et la même forme : deux
 * signataires, aucun tiers, aucun jeton public. Il en diffère sur un point qui
 * change tout — ici, les deux parties ne sont PAS le même humain.
 *
 * ## Le cadre existait déjà, vide
 *
 * `lettre-mission.tsx` §7 porte depuis toujours deux cadres au stylo : « Pour
 * l'organisme de formation » et « Pour le formateur ». Cette phase ne crée donc
 * pas un circuit, elle donne une preuve réelle à un cadre que rien ne remplissait.
 *
 * ## 🔴 Ce que la lettre engage, et pourquoi la partie « formateur » est stricte
 *
 * La lettre de mission est le contrat de sous-traitance du formateur : périmètre,
 * tarif journalier, confidentialité (5 ans), et l'engagement Qualiopi de
 * l'indicateur 27. Elle NOMME une personne — `data.formateur.nomPrenom` — et une
 * seule. Une signature « formateur » apposée par quelqu'un d'autre que la
 * personne nommée produirait une pièce dont le nom imprimé et l'identité scellée
 * divergent : exactement la contradiction qu'un contrôle relève.
 *
 * ## 🔴 Rattachement : indirect, et il faut le dire
 *
 * `DocumentGenere` ne porte AUCUNE clé vers `Trainer` (cf. `documents-service.ts`,
 * `refs` = formationId / sessionId / traineeId / clientId / coachingSessionId).
 * `genererLettreMissionAction` ne pose donc que `refs: { sessionId }`.
 *
 * Le formateur nommé sur la pièce n'est retrouvable que par le MÊME chemin que
 * celui qui l'a imprimé : `resolvePrincipalTrainerId(session)`. On le réemploie
 * tel quel plutôt que d'écrire un second résolveur — deux résolveurs pour la même
 * question sont l'endroit où le nom imprimé et le nom autorisé divergent en
 * silence.
 *
 * ⚠️ Conséquence directe : `estMembreDeSession` (l'appartenance de l'émargement,
 * employée par le relevé) NE CONVIENT PAS ici. Un co-formateur ou un assistant
 * est membre de la session sans être le mandataire de la lettre ; le laisser
 * signer apposerait SON identité sous le nom d'un autre.
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { requireFormateurAction } from "@/server/formateur/guard";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
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
 * « lettre de mission signée » sur une lettre que l'organisme n'a jamais
 * contresignée — c'est-à-dire un mandat que personne n'a donné.
 */
const PARTIES_LETTRE: readonly PartieSignataire[] = partiesRequisesPour("lettre_mission") ?? [];

export type RefusLettreMission =
  | RefusSignatureDocument
  | "non_mandataire"
  | "requete_invalide"
  | "role_insuffisant"
  | "stockage";

export type ResultatSignatureLettreMission =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: RefusLettreMission; message: string };

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
function refusStockage(err: SignatureStockageError): ResultatSignatureLettreMission {
  return {
    ok: false,
    raison: "stockage",
    message: err.imputableAuClient
      ? err.message
      : "La signature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, signez la lettre de mission sur papier et versez-la au dossier.",
  };
}

/**
 * Le formateur signe SA lettre de mission depuis son espace authentifié.
 *
 * Le rattachement est vérifié ICI, sur la session, en plus du recoupement que
 * `signerDocument` fait de son côté sur la pièce. Deux contrôles, et ce n'est
 * pas redondant : le premier refuse tôt et STRICTEMENT (seul le mandataire
 * nommé), avec un message qui a du sens pour le formateur ; le second est la
 * garde du service, qui ne fait confiance à aucun appelant mais ne connaît que
 * l'appartenance à la session — plus large que le mandat.
 */
export async function signerLettreMissionFormateurAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureLettreMission> {
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

  // 🔴 Le TYPE d'abord. Sans lui, un formateur qui devine un identifiant de pièce
  // apposerait sa signature « formateur » sur la facture ou la convention de la
  // même session : le service ne verrait qu'un formateur autorisé sur la pièce,
  // et la partie « formateur » est acceptable sur d'autres circuits.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: donnees.documentGenereId },
    select: { type: true, sessionId: true },
  });
  if (piece === null || piece.type !== "lettre_mission") {
    return {
      ok: false,
      raison: "piece_introuvable",
      message: "Lettre de mission introuvable.",
    };
  }

  if (
    piece.sessionId === null ||
    !(await estMandataireDeLaLettre(piece.sessionId, formateur.trainerId))
  ) {
    Sentry.captureException(
      new Error("Signature de lettre de mission tentée hors mandat du formateur"),
      {
        tags: { action: "signerLettreMissionFormateurAction:non_mandataire" },
        extra: { documentGenereId: donnees.documentGenereId },
      },
    );
    return {
      ok: false,
      raison: "non_mandataire",
      message:
        "Cette lettre de mission ne vous est pas adressée : elle nomme le formateur principal de la session, et lui seul peut la signer.",
    };
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
      partiesRequises: PARTIES_LETTRE,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;
    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerLettreMissionFormateurAction" } });
    throw err;
  }
}

/**
 * L'organisme contresigne la lettre de mission depuis la console.
 *
 * ⚠️ `requireAdminWrite` admet `editor`, et `signerDocument` ne l'admet PAS —
 * contresigner une lettre de mission CONFIE une mission, un tarif et une clause
 * de confidentialité de cinq ans. On refuse donc ICI, avec un message qui dit
 * pourquoi, plutôt que de laisser remonter un `identite_non_resolvable` que
 * personne ne saurait interpréter.
 *
 * ⚠️ Partie `axionia`, PAS `responsable_pedagogique` : les deux sont écrivables
 * par un porteur `organisme_authentifie`, mais elles ne disent pas la même
 * chose. `axionia` engage la personne morale (elle mandate) ; le responsable
 * pédagogique atteste d'un fait pédagogique. Le SSOT tranche — la lettre de
 * mission attend `["formateur", "axionia"]`.
 */
export async function contresignerLettreMissionAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureLettreMission> {
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      ok: false,
      raison: "role_insuffisant",
      message:
        "Contresigner une lettre de mission engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
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
  if (piece === null || piece.type !== "lettre_mission") {
    return { ok: false, raison: "piece_introuvable", message: "Lettre de mission introuvable." };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: {
        type: "organisme_authentifie",
        adminId: session.userId,
        partie: "axionia",
      },
      methode: donnees.methode,
      partiesRequises: PARTIES_LETTRE,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;

    await logQualiopiActivity({
      action: "qualiopi.lettre_mission.contresignature",
      targetType: "DocumentSignature",
      targetId: res.signatureId,
      changes: { documentGenereId: donnees.documentGenereId, numero: piece.numero },
      session,
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "contresignerLettreMissionAction" } });
    throw err;
  }
}

/**
 * Ce formateur est-il celui que la lettre NOMME ?
 *
 * 🔴 Même résolveur que le générateur (`genererLettreMissionAction`), et c'est
 * l'invariant de cette fonction : `resolvePrincipalTrainerId` est ce qui a
 * imprimé `data.formateur.nomPrenom` sur la pièce. Toute autre règle
 * d'autorisation — l'appartenance à la session, une lecture directe de la FK
 * sans le repli Json — autoriserait un jour quelqu'un que la lettre ne nomme
 * pas, ou refuserait celui qu'elle nomme sur une session legacy.
 *
 * ⚠️ `null` (aucun formateur résolvable) refuse TOUT LE MONDE, et c'est voulu :
 * dans ce cas le générateur a imprimé la raison sociale de l'organisme à la
 * place d'un nom de formateur. La pièce ne mandate personne d'identifiable —
 * elle doit être régénérée, pas signée.
 */
async function estMandataireDeLaLettre(sessionId: string, trainerId: string): Promise<boolean> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (session === null) return false;
  const principal = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  return principal !== null && principal === trainerId;
}
