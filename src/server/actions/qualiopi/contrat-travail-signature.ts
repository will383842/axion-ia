/**
 * Signature du CONTRAT DE TRAVAIL d'un formateur salarié — circuit maison.
 *
 * Troisième circuit à deux signataires distincts, après la lettre de mission, et
 * il en reprend la forme exacte : deux parties, aucun tiers, aucun jeton public.
 * Chacun signe depuis un espace authentifié — le salarié depuis le sien, un
 * administrateur depuis la console.
 *
 * ## 🔴 Ce que ce contrat engage, et pourquoi la partie « formateur » est stricte
 *
 * Le contrat NOMME une personne, et lui seule. Une signature « formateur »
 * apposée par quelqu'un d'autre produirait une pièce dont le nom imprimé et
 * l'identité scellée divergent — sur un contrat de travail, cette divergence ne
 * se rattrape pas : c'est la pièce qu'on produit devant un conseil de
 * prud'hommes ou un inspecteur du travail.
 *
 * ## 🔑 Le rattachement est DIRECT, sans résolveur
 *
 * Contrairement à la lettre de mission, il n'y a ici ni session ni Json de
 * co-formateurs : l'action qui produit la pièce passe toujours
 * `refs: { trainerId }`. Le titulaire EST cette ancre. Une pièce qui ne la porte
 * pas n'appartient à personne et se régénère — elle ne se signe pas.
 *
 * ⚠️ CE FICHIER NE CRÉE PAS DE RÈGLE D'AUTORISATION NOUVELLE : il applique
 * exactement celle que `contrat-travail-queries.ts` emploie pour décider
 * d'afficher le bouton. Deux règles pour la même question sont l'endroit où
 * l'écran propose ce que l'action refuse.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import {
  signerDocument,
  type RefusSignatureDocument,
} from "@/server/qualiopi/documents/signature/document-signature-service";
import { REFUS_PIECE_INTROUVABLE } from "@/server/qualiopi/documents/signature/refus-piece-introuvable";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { partiesRequisesPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { apresSignature } from "@/server/qualiopi/documents/signature/apres-signature";
import { contexteRequete } from "@/server/qualiopi/documents/signature/contexte-requete";
import { peutSignerPourOrganisme } from "@/server/qualiopi/documents/signature/garde-engagement";

/**
 * 🔴 Les parties attendues viennent du SSOT, jamais d'une liste locale. Une
 * liste écrite ici divergerait un jour, en silence : la pièce passerait `signee`
 * à une signature sur deux, et la fiche afficherait « contrat signé » sur un
 * contrat que l'employeur n'a jamais signé.
 */
const PARTIES_CONTRAT: readonly PartieSignataire[] = partiesRequisesPour("contrat_travail") ?? [];

export type RefusContratTravail =
  RefusSignatureDocument | "requete_invalide" | "role_insuffisant" | "stockage";

export type ResultatSignatureContratTravail =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: RefusContratTravail; message: string };

/**
 * ⚠️ Le signataire est authentifié, mais ses arguments ne le sont pas.
 * `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
 * scellée définitivement.
 */
const entreeSchema = z.object({
  documentGenereId: z.string().uuid(),
  methode: z.enum(["trace", "papier_scanne", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/**
 * Traduit une panne de stockage en refus exploitable.
 *
 * 🔴 `storeSignatureImage` LÈVE quand R2 est absent ou l'écriture ratée, et
 * c'est sa raison d'être : une signature dont l'image n'a pas été écrite est une
 * preuve qui n'existe pas. L'appelant doit REFUSER, jamais simuler.
 */
function refusStockage(err: SignatureStockageError): ResultatSignatureContratTravail {
  return {
    ok: false,
    raison: "stockage",
    message: err.imputableAuClient
      ? err.message
      : "La signature n'a pas pu être enregistrée. Réessayez ; en cas d'échec répété, signez le contrat sur papier — deux exemplaires, un pour chaque partie — et versez-le au dossier.",
  };
}

// 🔑 Le classement du contrat signé au casier du dossier (`REQUIS_SALARIE`)
// vit désormais dans l'après-signature commun (S6a) : `apres-signature.ts`.

/**
 * 🔴 La MÊME réponse que le service et que les deux autres actions formateur
 * (`REFUS_PIECE_INTROUVABLE`) : un message propre à cette action distinguerait,
 * d'une action à l'autre, une pièce existante d'une pièce inventée.
 *
 * L'unique réponse « introuvable » du côté salarié : identifiant inconnu, pièce
 * d'un autre type ou contrat d'une autre personne répondent à l'identique.
 */
const CONTRAT_INTROUVABLE = REFUS_PIECE_INTROUVABLE;

/** Le salarié signe SON contrat depuis son espace authentifié. */
export async function signerContratTravailFormateurAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureContratTravail> {
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
  // apposerait sa signature « formateur » sur sa lettre de mission ou sur une
  // autre pièce où la partie « formateur » est acceptable — le service ne
  // verrait qu'un formateur autorisé sur une pièce qui l'attend.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: donnees.documentGenereId },
    select: { type: true, numero: true, trainerId: true },
  });
  if (piece === null || piece.type !== "contrat_travail") {
    return { ...CONTRAT_INTROUVABLE };
  }

  // Le titulaire EST l'ancre. `null` = la pièce n'appartient à personne : elle se
  // régénère, elle ne se signe pas.
  if (piece.trainerId === null || piece.trainerId !== formateur.trainerId) {
    Sentry.captureException(new Error("Signature de contrat de travail tentée hors titulaire"), {
      tags: { action: "signerContratTravailFormateurAction:non_titulaire" },
      extra: { documentGenereId: donnees.documentGenereId },
    });
    // Même réponse qu'un identifiant inconnu : le contrat d'un autre salarié ne
    // doit pas se distinguer d'un contrat qui n'existe pas.
    return { ...CONTRAT_INTROUVABLE };
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
      partiesRequises: PARTIES_CONTRAT,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) {
      // Défense en profondeur : le service masque déjà tout refus d'autorisation
      // d'un formateur ; un `porteur_non_autorise` qui remonterait quand même ne
      // doit pas se distinguer d'un identifiant inconnu.
      return res.raison === "porteur_non_autorise" ? { ...CONTRAT_INTROUVABLE } : res;
    }
    await apresSignature({
      documentGenereId: donnees.documentGenereId,
      type: "contrat_travail",
      numero: piece.numero,
      statutSignature: res.statutSignature,
      partie: "formateur",
      acteur: { type: "signataire" },
    });
    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerContratTravailFormateurAction" } });
    throw err;
  }
}

/**
 * L'employeur signe le contrat depuis la console.
 *
 * ⚠️ `requireAdminWrite` admet `editor`, et signer un contrat de travail est le
 * geste le plus engageant de la console : on refuse donc ICI, avec un message
 * qui dit pourquoi, plutôt que de laisser remonter un refus du service que
 * personne ne saurait interpréter.
 *
 * ⚠️ Partie `axionia`, PAS `responsable_pedagogique` : c'est la personne morale
 * qui embauche, pas une attestation pédagogique. Le SSOT tranche — le contrat de
 * travail attend `["formateur", "axionia"]`.
 */
export async function signerContratTravailEmployeurAction(input: {
  documentGenereId: string;
  methode: "trace" | "papier_scanne" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureContratTravail> {
  const session = await requireAdminWrite();
  if (!peutSignerPourOrganisme(session.role)) {
    return {
      ok: false,
      raison: "role_insuffisant",
      message:
        "Signer un contrat de travail engage l'organisme comme employeur : seuls un administrateur ou le dirigeant peuvent le faire.",
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
    select: { type: true, numero: true, trainerId: true },
  });
  if (piece === null || piece.type !== "contrat_travail") {
    return { ok: false, raison: "piece_introuvable", message: "Contrat de travail introuvable." };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: { type: "organisme_authentifie", adminId: session.userId, partie: "axionia" },
      methode: donnees.methode,
      partiesRequises: PARTIES_CONTRAT,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;

    await apresSignature({
      documentGenereId: donnees.documentGenereId,
      type: "contrat_travail",
      numero: piece.numero,
      statutSignature: res.statutSignature,
      partie: "axionia",
      acteur: { type: "administrateur", session },
    });

    await logQualiopiActivity({
      action: "qualiopi.document.contrat_travail.signe_employeur",
      targetType: "DocumentGenere",
      targetId: donnees.documentGenereId,
      changes: {
        numero: piece.numero,
        trainerId: piece.trainerId,
        statutSignature: res.statutSignature,
      },
      session,
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerContratTravailEmployeurAction" } });
    throw err;
  }
}
