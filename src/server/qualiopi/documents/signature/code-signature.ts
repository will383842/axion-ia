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
 * - **10 minutes** : assez pour aller lire sa boîte, trop peu pour qu'un code
 *   oublié reste une porte ouverte.
 * - **5 essais au plus** : l'essai est compté AVANT la comparaison, par un
 *   `updateMany` conditionnel — deux essais concurrents ne passent pas sous le
 *   plafond à deux. Au cinquième échec, le code est invalidé.
 * - **Invalidé après usage**, atomiquement : un code accepté ne l'est qu'une
 *   fois, même si deux requêtes arrivent ensemble.
 * - **Comparaison à temps constant** (`timingSafeEqual`).
 * - **Un seul code vivant** par (pièce, partie) : en émettre un nouveau
 *   invalide le précédent.
 * - **Refus uniformes** : un code faux, expiré, épuisé ou inexistant rend le
 *   même message — le refus ne dit pas lequel des quatre, pour ne pas guider
 *   un essai suivant.
 */

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { PartieSignataire } from "./document-signature-hash";

export const CODE_LONGUEUR = 6;
export const CODE_VALIDITE_MS = 10 * 60 * 1000;
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
}): Promise<{ code: string; expiresAt: Date }> {
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
  return { code, expiresAt };
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
  if (ligne === null) return REFUS;

  // L'essai est COMPTÉ avant la comparaison, sous condition : sans place sous
  // le plafond, la comparaison n'a même pas lieu.
  const compte = await prisma.documentSignatureCode.updateMany({
    where: { id: ligne.id, essais: { lt: CODE_ESSAIS_MAX }, utiliseAt: null, invalideAt: null },
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
    if (ligne.essais + 1 >= CODE_ESSAIS_MAX) {
      await prisma.documentSignatureCode.updateMany({
        where: { id: ligne.id, invalideAt: null },
        data: { invalideAt: maintenant },
      });
    }
    return REFUS;
  }

  // Consommation atomique : de deux requêtes simultanées, une seule passe.
  const consomme = await prisma.documentSignatureCode.updateMany({
    where: { id: ligne.id, utiliseAt: null, invalideAt: null },
    data: { utiliseAt: maintenant },
  });
  return consomme.count === 1 ? { ok: true } : REFUS;
}
