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

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { requireFormateurAction } from "@/server/formateur/guard";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import {
  signerDocument,
  type RefusSignatureDocument,
} from "@/server/qualiopi/documents/signature/document-signature-service";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { partiesRequisesPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

/**
 * 🔴 Les parties attendues viennent du SSOT, jamais d'une liste locale. Une
 * liste écrite ici divergerait un jour, en silence : la pièce passerait `signee`
 * à une signature sur deux, et la fiche afficherait « contrat signé » sur un
 * contrat que l'employeur n'a jamais signé.
 */
const PARTIES_CONTRAT: readonly PartieSignataire[] = partiesRequisesPour("contrat_travail") ?? [];

export type RefusContratTravail =
  RefusSignatureDocument | "non_titulaire" | "requete_invalide" | "role_insuffisant" | "stockage";

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

/**
 * 🔴 LE CONTRAT SIGNÉ REMPLIT LE CASIER DU DOSSIER — sans quoi la conformité
 * resterait rouge sur une pièce parfaitement signée.
 *
 * `REQUIS_SALARIE` (trainers/conformite.ts) exige un `TrainerDocument` de type
 * `contrat_travail` pour qu'un salarié soit conforme. Ce casier se remplissait
 * jusqu'ici par DÉPÔT MANUEL d'un fichier. Depuis que l'organisme produit et
 * fait signer le contrat lui-même, laisser le casier vide obligerait à
 * retélécharger le PDF pour le redéposer à côté — et le premier oubli laisserait
 * un salarié « non conforme » avec son contrat signé au registre.
 *
 * ⚠️ FAIL-SOFT, et c'est délibéré : la signature est DÉJÀ écrite et scellée
 * quand on arrive ici. Faire échouer l'action sur le classement dirait au
 * signataire que sa signature n'a pas été prise, ce qui serait faux — et il
 * signerait deux fois.
 *
 * ⚠️ IDEMPOTENT par le numéro de pièce : les deux parties signent, la seconde
 * déclenche `signee`, et une réexécution ne doit pas créer un second casier.
 */
async function classerContratAuDossier(
  trainerId: string,
  numero: string,
  documentGenereId: string,
): Promise<void> {
  try {
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
        // La route de l'espace du salarié : c'est elle qui rend l'exemplaire
        // SIGNÉ une fois la pièce complète, et elle vérifie la titularité.
        fichierUrl: `/api/formateur/contrat-travail/${documentGenereId}`,
        dateEmission: new Date(),
        // 🔑 `valide` sans réserve : la pièce est produite par l'organisme,
        // numérotée, hashée et signée des deux parties. La mettre « en attente »
        // demanderait de valider ce qu'on vient soi-même d'émettre.
        //
        // ⚠️ AUCUNE `dateExpiration` : un contrat de travail n'expire pas. Un CDD
        // a un TERME, mais ce terme n'est pas l'échéance d'une pièce à
        // renouveler — l'y porter ferait lever une alerte « pièce périmée » le
        // jour où le contrat prend normalement fin.
        statutValidation: "valide",
      },
    });
  } catch (err) {
    console.warn("[contrat-travail] classement au dossier impossible (fail-soft)", err);
  }
}

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
    return { ok: false, raison: "piece_introuvable", message: "Contrat de travail introuvable." };
  }

  // Le titulaire EST l'ancre. `null` = la pièce n'appartient à personne : elle se
  // régénère, elle ne se signe pas.
  if (piece.trainerId === null || piece.trainerId !== formateur.trainerId) {
    Sentry.captureException(new Error("Signature de contrat de travail tentée hors titulaire"), {
      tags: { action: "signerContratTravailFormateurAction:non_titulaire" },
      extra: { documentGenereId: donnees.documentGenereId },
    });
    return {
      ok: false,
      raison: "non_titulaire",
      message:
        "Ce contrat de travail ne vous concerne pas : il nomme une personne précise, et elle seule peut le signer.",
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
      partiesRequises: PARTIES_CONTRAT,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;
    if (res.statutSignature === "signee") {
      await classerContratAuDossier(formateur.trainerId, piece.numero, donnees.documentGenereId);
    }
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
  if (session.role !== "super_admin" && session.role !== "admin") {
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

    if (res.statutSignature === "signee" && piece.trainerId !== null) {
      await classerContratAuDossier(piece.trainerId, piece.numero, donnees.documentGenereId);
    }

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
