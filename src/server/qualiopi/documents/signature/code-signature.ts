/**
 * Code à usage unique pour SIGNER une pièce (lot S6a, e — ADR 0066 étape 7).
 *
 * Le formateur indépendant signe son contrat-cadre « avec un code reçu par
 * e-mail ». Ce module porte le MÉCANISME — émission, vérification — et rien
 * d'autre : l'envoi du code par courriel est câblé au lot S6b (il exige un
 * gabarit d'e-mail neuf, donc des fichiers partagés avec une PR en cours).
 *
 * ## Les règles, et pourquoi chacune
 *
 * - **6 chiffres**, tirés par `crypto.randomInt` (jamais `Math.random`).
 * - **Haché en base** : HMAC-SHA256 sous `AUTH_SECRET`, salé par l'identifiant
 *   de la ligne. Un code de six chiffres n'a qu'un million de valeurs : une
 *   empreinte SHA-256 nue se renverserait en une seconde depuis une copie de la
 *   base. Sans le secret serveur, l'empreinte ne dit rien. Secret absent :
 *   émission REFUSÉE (garde fermée, ADR 0066 f).
 * - **15 minutes** (décision 35, texte F17) : assez pour aller lire sa boîte,
 *   trop peu pour qu'un code oublié reste une porte ouverte.
 * - **5 essais au plus** : l'essai est compté AVANT la comparaison, par un
 *   `updateMany` conditionnel — deux essais concurrents ne passent pas sous le
 *   plafond à deux. Au cinquième échec, le code est invalidé — par une écriture
 *   conditionnée sur le compteur EN BASE, jamais sur une lecture antérieure.
 * - **Invalidé après usage**, atomiquement : un code accepté ne l'est qu'une
 *   fois, même si deux requêtes arrivent ensemble. Chaque écriture (essai,
 *   consommation) reprend l'échéance : un code expiré entre la lecture et
 *   l'écriture n'est ni compté ni consommé.
 * - **Comparaison à temps constant** (`timingSafeEqual`). Une empreinte est
 *   calculée même quand aucun code n'est vivant, ce qui RÉDUIT l'écart de durée
 *   entre les refus sans l'annuler (une écriture de moins) : il faut de toute
 *   façon détenir le jeton du lien pour poser la question.
 * - **Un seul code vivant** par (pièce, partie) : en émettre un nouveau
 *   invalide le précédent.
 * - **Refus uniformes** : un code faux, expiré, épuisé ou inexistant rend le
 *   même message — le refus ne dit pas lequel des quatre, pour ne pas guider
 *   un essai suivant.
 * - **Lié à l'adresse** (vérification 1, V1-A-8) : un code est envoyé à l'adresse
 *   de la fiche. Quand la console change cette adresse, les codes encore vivants
 *   sont invalidés DANS la même transaction (`invaliderCodesSignatureFormateur`) :
 *   le code reçu à l'ancienne adresse ne signe plus rien.
 */

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../prisma/generated/client";
import type { PartieSignataire } from "./document-signature-hash";

export const CODE_LONGUEUR = 6;
export const CODE_VALIDITE_MS = 15 * 60 * 1000;
export const CODE_ESSAIS_MAX = 5;

const FORMAT_CODE = /^\d{6}$/;

/** Message unique de refus — voir l'en-tête. */
export const MESSAGE_CODE_REFUSE =
  "Ce code n'est pas valide. Vérifiez-le, ou demandez-en un nouveau.";

export class CodeSignatureIndisponible extends Error {
  constructor() {
    super("Le code de signature ne peut pas être émis pour le moment.");
    this.name = "CodeSignatureIndisponible";
  }
}

function secret(): string {
  const s = process.env["AUTH_SECRET"];
  if (s === undefined || s.trim() === "") throw new CodeSignatureIndisponible();
  return s;
}

/** Empreinte d'un code pour UNE ligne. Exportée pour être éprouvée seule. */
export function empreinteCode(idLigne: string, code: string): string {
  return createHmac("sha256", secret()).update(`signature-code:${idLigne}:${code}`).digest("hex");
}

/** Tirage uniforme de 6 chiffres, zéros de tête compris. */
export function tirerCode(): string {
  return randomInt(0, 10 ** CODE_LONGUEUR)
    .toString()
    .padStart(CODE_LONGUEUR, "0");
}

/**
 * Émet un code pour (pièce, partie). Rend le code EN CLAIR, une seule fois —
 * à remettre au courriel, jamais à journaliser.
 */
export async function emettreCodeSignature(input: {
  readonly documentGenereId: string;
  readonly partie: PartieSignataire;
  readonly maintenant?: Date;
}): Promise<{ code: string; expiresAt: Date; id: string }> {
  secret(); // garde fermée AVANT toute écriture
  const maintenant = input.maintenant ?? new Date();
  const code = tirerCode();
  const id = randomUUID();
  const expiresAt = new Date(maintenant.getTime() + CODE_VALIDITE_MS);

  await prisma.$transaction([
    prisma.documentSignatureCode.updateMany({
      where: {
        documentGenereId: input.documentGenereId,
        partie: input.partie,
        utiliseAt: null,
        invalideAt: null,
      },
      data: { invalideAt: maintenant },
    }),
    prisma.documentSignatureCode.create({
      data: {
        id,
        documentGenereId: input.documentGenereId,
        partie: input.partie,
        codeHash: empreinteCode(id, code),
        expiresAt,
      },
    }),
  ]);
  // `id` : la ligne du code, relue au départ de l'e-mail (V2-P-7 — un code expiré ou
  // remplacé pendant l'attente ne part pas). Jamais le code.
  return { code, expiresAt, id };
}

export type VerificationCode = { ok: true } | { ok: false; message: string };

const REFUS: VerificationCode = { ok: false, message: MESSAGE_CODE_REFUSE };

function egauxATempsConstant(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Longueurs égales par construction (deux HMAC hex) ; le test protège
  // `timingSafeEqual`, qui lève sur des longueurs différentes.
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Vérifie — et CONSOMME en cas de succès — le code saisi pour (pièce, partie).
 */
export async function verifierCodeSignature(input: {
  readonly documentGenereId: string;
  readonly partie: PartieSignataire;
  readonly code: string;
  readonly maintenant?: Date;
}): Promise<VerificationCode> {
  const maintenant = input.maintenant ?? new Date();
  const saisi = (input.code ?? "").trim();
  if (!FORMAT_CODE.test(saisi)) return REFUS;
  const vivant = { utiliseAt: null, invalideAt: null, expiresAt: { gt: maintenant } } as const;

  const ligne = await prisma.documentSignatureCode.findFirst({
    where: {
      documentGenereId: input.documentGenereId,
      partie: input.partie,
      utiliseAt: null,
      invalideAt: null,
      expiresAt: { gt: maintenant },
      essais: { lt: CODE_ESSAIS_MAX },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, essais: true },
  });
  if (ligne === null) {
    // Empreinte calculée quand même : l'écart de durée avec un vrai refus est réduit.
    try {
      empreinteCode(randomUUID(), saisi);
    } catch {
      // secret absent : refus uniforme
    }
    return REFUS;
  }

  // L'essai est COMPTÉ avant la comparaison, sous condition : sans place sous
  // le plafond, la comparaison n'a même pas lieu.
  const compte = await prisma.documentSignatureCode.updateMany({
    where: { id: ligne.id, essais: { lt: CODE_ESSAIS_MAX }, ...vivant },
    data: { essais: { increment: 1 } },
  });
  if (compte.count === 0) return REFUS;

  let attendu: string;
  try {
    attendu = empreinteCode(ligne.id, saisi);
  } catch {
    return REFUS;
  }

  if (!egauxATempsConstant(attendu, ligne.codeHash)) {
    // Conditionné sur le compteur EN BASE : deux échecs simultanés ne laissent pas un
    // code épuisé « vivant ».
    await prisma.documentSignatureCode.updateMany({
      where: { id: ligne.id, invalideAt: null, essais: { gte: CODE_ESSAIS_MAX } },
      data: { invalideAt: maintenant },
    });
    return REFUS;
  }

  // Consommation atomique : de deux requêtes simultanées, une seule passe.
  const consomme = await prisma.documentSignatureCode.updateMany({
    where: { id: ligne.id, ...vivant },
    data: { utiliseAt: maintenant },
  });
  return consomme.count === 1 ? { ok: true } : REFUS;
}

/**
 * V1-A-8 — invalide les codes encore vivants des pièces d'un formateur, avec le
 * client de la transaction qui change son adresse (jamais après coup : entre les
 * deux écritures, le code de l'ancienne adresse signerait encore). Seule la partie
 * `sous_traitant` reçoit un code à l'adresse de la fiche ; les codes d'autres parties
 * partent ailleurs et ne sont pas touchés. Rend le nombre de codes invalidés.
 */
export async function invaliderCodesSignatureFormateur(
  client: Pick<Prisma.TransactionClient, "documentGenere" | "documentSignatureCode">,
  trainerId: string,
  maintenant: Date,
): Promise<number> {
  const pieces = await client.documentGenere.findMany({
    where: { trainerId },
    select: { id: true },
  });
  if (pieces.length === 0) return 0;
  const r = await client.documentSignatureCode.updateMany({
    where: {
      documentGenereId: { in: pieces.map((p) => p.id) },
      partie: "sous_traitant",
      utiliseAt: null,
      invalideAt: null,
    },
    data: { invalideAt: maintenant },
  });
  return r.count;
}
