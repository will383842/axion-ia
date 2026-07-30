/**
 * Canal A — jetons de signature d'une PIÈCE par un tiers non authentifié.
 *
 * Deux couches, comme `emargement/token-service.ts` et `formateur/magic-link.ts` :
 *   1. Intégrité — magic-token HMAC signé : un lien ne peut pas être forgé.
 *   2. Révocation — `DocumentSignatureToken` stocke le HASH SHA-256 du jeton,
 *      jamais le clair, avec `expiresAt` et `revokedAt`. La base reste
 *      l'autorité : un jeton dont le HMAC est encore valide est refusé si la
 *      ligne est révoquée ou expirée.
 *
 * ## 🔴 Ce que ce module porte et que le jeton d'émargement ne portait pas
 *
 * **L'identité du signataire, figée à l'ÉMISSION.**
 *
 * Le socle exige que, sur le canal maison, l'identité soit lue de la BASE et
 * jamais de l'entrée — « sceller un nom fourni par l'appelant produirait une
 * signature dont l'identité serait exactement ce que l'appelant a bien voulu
 * déclarer ». Mais le porteur d'un lien public n'est, par construction, pas
 * authentifié : on ne peut pas résoudre son identité AU MOMENT de signer.
 *
 * On la résout donc à l'ÉMISSION, depuis la fiche client, dans une action
 * d'administration authentifiée, et on la FIGE dans la ligne de jeton. Au moment
 * de signer, le service la relit ici — donc en base. La doctrine est respectée,
 * et le déplacement du moment de résolution est explicite plutôt que subi.
 *
 * ⚠️ Conséquence assumée : si la fiche client est corrigée après émission, le
 * lien déjà envoyé continue de porter l'ancienne identité. C'est VOULU — c'est
 * la même exigence de snapshot que partout ailleurs dans ce module. Pour
 * corriger, on révoque et on ré-émet ; le message de refus le dit.
 *
 * ## ⚠️ Différence avec le jeton d'émargement : la portée
 *
 * Un jeton d'émargement vise une INSCRIPTION et sert plusieurs demi-journées.
 * Un jeton d'engagement vise UNE pièce pour UNE partie, et n'a plus d'objet une
 * fois la pièce signée à ce titre. L'index unique partiel
 * `document_signature_token_actif` impose un seul jeton vivant par couple.
 *
 * ⚠️ Il n'est pas pour autant consommé à l'OUVERTURE : un client peut ouvrir le
 * lien, lire le devis, fermer, puis revenir signer. `usedAt` n'horodate que le
 * premier usage, à titre de trace. C'est le service de signature qui refuse une
 * seconde signature (`deja_signe`), pas ce module.
 *
 * Node runtime (accès Prisma). Stub-aware pour le build SSG.
 */

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";
import type { DocumentPartieSignataire } from "../../../../../prisma/generated/client";

/**
 * Plancher de validité d'un lien, en millisecondes.
 *
 * 🔴 Sans lui, un devis dont la date de validité est déjà passée — ou expire
 * dans l'heure — produirait un lien mort, envoyé sans avertissement, et le
 * client découvrirait « lien expiré » en essayant de signer. L'admin qui émet un
 * lien doit obtenir un lien UTILISABLE, ou un refus explicite : jamais un lien
 * né expiré.
 *
 * Même raisonnement que le plancher de `calculerExpiration` côté émargement.
 */
export const PLANCHER_VALIDITE_MS = 48 * 60 * 60 * 1000;

/** Motifs de refus à l'ÉMISSION — tous devant l'admin, qui peut corriger. */
export type MotifRefusEmissionDocument =
  /** Identité du signataire absente de la fiche : la signature serait anonyme. */
  | "signataire_non_identifie"
  /** Aucune adresse : un lien sans destinataire ne peut être lié à personne. */
  | "destinataire_absent";

export class TokenDocumentError extends Error {
  readonly motif: MotifRefusEmissionDocument;
  constructor(motif: MotifRefusEmissionDocument, message: string) {
    super(message);
    this.name = "TokenDocumentError";
    this.motif = motif;
  }
}

/** Motifs de refus à la VÉRIFICATION. Différenciés : « expiré » est actionnable. */
export type RefusTokenDocument = "signature_invalide" | "inconnu" | "expire" | "revoque";

export type VerificationTokenDocument =
  | {
      ok: true;
      tokenId: string;
      documentGenereId: string;
      partie: DocumentPartieSignataire;
      /**
       * 🔴 Identité FIGÉE à l'émission, relue en base. C'est elle — et jamais
       * l'entrée du formulaire — que le service de signature scellera.
       */
      signataireNom: string;
      signataireEmail: string | null;
      signataireQualite: string | null;
    }
  | { ok: false; raison: RefusTokenDocument };

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** SHA-256 hex (64 chars) via Web Crypto. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Expiration d'un lien de signature : la borne métier, plancher garanti.
 *
 * Logique PURE, exposée pour être testée sans base.
 *
 * Pour un devis, `borneMetier` est la date de validité : signer un devis périmé
 * n'aurait aucun sens commercial, et laisser le lien vivre au-delà reviendrait à
 * tenir une offre ferme indéfiniment. Le plancher garantit qu'un lien émis reste
 * utilisable même si cette borne est déjà proche ou dépassée.
 */
export function calculerExpirationDocument(borneMetier: Date, maintenant: Date): Date {
  return new Date(Math.max(borneMetier.getTime(), maintenant.getTime() + PLANCHER_VALIDITE_MS));
}

function nettoyer(valeur: string | null | undefined): string | null {
  const v = (valeur ?? "").trim();
  return v === "" ? null : v;
}

/**
 * Crée un jeton de signature pour une (pièce, partie) et retourne le CLAIR.
 *
 * Toute création révoque le jeton actif du MÊME couple, dans la même
 * transaction : sans cela l'index partiel ferait échouer l'insertion et l'admin
 * verrait une erreur Prisma brute. Deux liens vivants signifieraient de toute
 * façon qu'en révoquer un donne une fausse impression de sécurité.
 *
 * @throws {TokenDocumentError} Si l'identité ou l'adresse du signataire manque.
 *         Le refus tombe ICI, devant l'admin qui a la fiche client sous les
 *         yeux, et non devant le client qui ne peut rien y faire.
 */
export async function creerTokenDocument(input: {
  documentGenereId: string;
  partie: DocumentPartieSignataire;
  /** Identité résolue par l'APPELANT depuis la base, jamais depuis un formulaire. */
  signataireNom: string;
  signataireEmail: string;
  signataireQualite?: string | null;
  /** Borne métier de validité (pour un devis : sa date de validité). */
  borneMetier: Date;
  createdIpHash?: string | null;
  maintenant?: Date;
}): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
  const nom = nettoyer(input.signataireNom);
  if (nom === null) {
    throw new TokenDocumentError(
      "signataire_non_identifie",
      "Aucun nom de signataire n'est renseigné sur cette fiche : une signature sans signataire identifié ne prouve rien. Renseignez le contact du client, puis réémettez le lien.",
    );
  }

  const email = (input.signataireEmail ?? "").trim().toLowerCase();
  if (email === "" || !email.includes("@")) {
    throw new TokenDocumentError(
      "destinataire_absent",
      "Aucune adresse électronique n'est renseignée pour ce signataire : sans destinataire, le lien ne peut être lié à personne et n'aurait aucune valeur probante.",
    );
  }

  const maintenant = input.maintenant ?? new Date();
  const expiresAt = calculerExpirationDocument(input.borneMetier, maintenant);

  const token = await signMagicToken({
    scope: "document_signature",
    resourceId: input.documentGenereId,
    email,
    ttlMs: Math.max(1, expiresAt.getTime() - maintenant.getTime()),
  });
  const tokenHash = await sha256Hex(token);
  const destinataireEmailSha256 = await sha256Hex(email);

  const ligne = await prisma.$transaction(async (tx) => {
    await tx.documentSignatureToken.updateMany({
      where: { documentGenereId: input.documentGenereId, partie: input.partie, revokedAt: null },
      data: { revokedAt: maintenant, revokedMotif: "Remplacé par un nouveau lien" },
    });
    return tx.documentSignatureToken.create({
      data: {
        documentGenereId: input.documentGenereId,
        partie: input.partie,
        tokenHash,
        signataireNom: nom,
        signataireEmail: email,
        signataireQualite: nettoyer(input.signataireQualite),
        destinataireEmailSha256,
        expiresAt,
        createdIpHash: input.createdIpHash ?? null,
      },
      select: { id: true },
    });
  });

  return { token, tokenId: ligne.id, expiresAt };
}

/**
 * Vérifie un jeton et rend l'identité FIGÉE du signataire. Ne consomme rien.
 *
 * Le motif de refus est différencié — « votre lien a expiré » est actionnable
 * pour le client, et n'apprend rien à un attaquant : ces motifs ne sont
 * atteignables qu'APRÈS validation du HMAC, donc seulement par qui détient déjà
 * un lien signé, et l'oracle ne renseigne alors que sur ce lien-là.
 *
 * ⚠️ Les motifs de FORME (`malformed_*`, `scope_mismatch`, `resource_mismatch`,
 * `invalid_email`) restent fondus dans `signature_invalide` : eux se rencontrent
 * en trafiquant un jeton, et les détailler renseignerait sur la structure
 * attendue.
 *
 * 🔴 `expired` est distingué explicitement. `magic-token.ts` vérifie la
 * signature D'ABORD et l'expiration ENSUITE : aplatir les deux ferait ressortir
 * un jeton authentique mais périmé en « signature invalide », et rendrait la
 * branche `expire` du bas de cette fonction MORTE pour tout jeton JWT périmé.
 * C'est exactement le défaut constaté le 2026-07-27 côté émargement — on ne le
 * reproduit pas.
 */
export async function verifierTokenDocument(token: string): Promise<VerificationTokenDocument> {
  if (estStub()) return { ok: false, raison: "inconnu" };

  const verified = await verifyMagicToken(token, { scope: "document_signature" });
  if (!verified.ok) {
    return { ok: false, raison: verified.reason === "expired" ? "expire" : "signature_invalide" };
  }

  const tokenHash = await sha256Hex(token);
  const ligne = await prisma.documentSignatureToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      documentGenereId: true,
      partie: true,
      signataireNom: true,
      signataireEmail: true,
      signataireQualite: true,
      expiresAt: true,
      revokedAt: true,
      usedAt: true,
    },
  });

  if (ligne === null) return { ok: false, raison: "inconnu" };
  // Révocation d'abord : un devis révisé prime sur l'expiration, et le message
  // doit refléter la vraie raison.
  if (ligne.revokedAt !== null) return { ok: false, raison: "revoque" };
  if (ligne.expiresAt.getTime() <= Date.now()) return { ok: false, raison: "expire" };

  if (ligne.usedAt === null) {
    // Trace du premier usage. `updateMany` conditionnel : deux onglets ouverts
    // simultanément ne doivent pas s'écraser l'un l'autre.
    await prisma.documentSignatureToken.updateMany({
      where: { id: ligne.id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  return {
    ok: true,
    tokenId: ligne.id,
    documentGenereId: ligne.documentGenereId,
    partie: ligne.partie,
    signataireNom: ligne.signataireNom,
    signataireEmail: ligne.signataireEmail,
    signataireQualite: ligne.signataireQualite,
  };
}

/**
 * Révoque les jetons actifs d'une pièce — tous, ou ceux d'une seule partie.
 *
 * Cas d'usage : devis révisé (l'ancienne version passe `expire`, son lien ne
 * doit plus permettre de signer), erreur de destinataire, demande RGPD.
 * Retourne le nombre de jetons révoqués.
 */
export async function revoquerTokensDocument(input: {
  documentGenereId: string;
  partie?: DocumentPartieSignataire;
  motif: string;
  parAdminId?: string | null;
}): Promise<number> {
  if (estStub()) return 0;

  const res = await prisma.documentSignatureToken.updateMany({
    where: {
      documentGenereId: input.documentGenereId,
      revokedAt: null,
      ...(input.partie !== undefined ? { partie: input.partie } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokedMotif: input.motif.slice(0, 500),
      revokedById: input.parAdminId ?? null,
    },
  });
  return res.count;
}
