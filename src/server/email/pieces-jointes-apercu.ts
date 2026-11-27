// Pièces jointes de l'APERÇU d'un e-mail (console) : la liste que montre « Voir l'e-mail avant
// envoi » et les références qui ouvrent chaque fichier (route `emails/piece-jointe`).
//
// 🔑 AUCUNE logique de construction ici. La liste des pièces (`{ filename, r2Key, … }`) est celle
// que l'envoi met en file ; ce qui part réellement est décidé par `resoudrePiecesJointes`
// (`./pieces-jointes`), la fonction même du worker. L'aperçu l'appelle : mêmes fichiers, mêmes
// poids, mêmes pièces facultatives écartées. Prouvé par `pieces-jointes-apercu.spec.ts`.
//
// Le lien « Ouvrir » ne porte jamais la clé R2, ni en clair ni en base64 lisible : la charge est
// CHIFFRÉE (AES-256-GCM, clé dérivée d'`AUTH_SECRET`) puis SIGNÉE (HMAC, échéance 30 min). La
// route vérifie la signature avant de déchiffrer et de relire le fichier par la même fonction. Rien n'est envoyé,
// rien n'est marqué.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { PieceJointeApercu } from "@/lib/email/apercu-lecteur";
import { fabriqueLienSigne } from "@/lib/security/lien-signe";
import { resoudrePiecesJointes } from "@/server/email/pieces-jointes";
import type { EmailJobData } from "@/server/queue/types";

export type PiecesAJoindre = NonNullable<EmailJobData["attachments"]>;
type PieceAJoindre = PiecesAJoindre[number];

const SIGNATURE = fabriqueLienSigne({
  domaine: "apercu-piece-jointe",
  version: 1,
  cle: "axion-apercu-piece-jointe",
});
const VALIDITE_SEC = 30 * 60;

/** Clé de chiffrement de la charge, dérivée d'`AUTH_SECRET` (domaine distinct de la signature). */
function cleChiffrement(): Buffer | null {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length > 0) {
    return createHash("sha256").update(`axion-apercu-piece-jointe-chiffrement|${secret}`).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  return createHash("sha256").update("axion-apercu-piece-jointe-chiffrement|dev").digest();
}

/** `base64url(iv · tag · chiffré)` de la charge, ou `null` (pas de secret en production). */
function charge(p: PieceAJoindre): string | null {
  const cle = cleChiffrement();
  if (cle === null) return null;
  const iv = randomBytes(12);
  const chiffre = createCipheriv("aes-256-gcm", cle, iv);
  const clair = JSON.stringify([
    p.filename,
    p.r2Key,
    p.contentType ?? null,
    p.facultative === true,
  ]);
  const donnees = Buffer.concat([chiffre.update(clair, "utf-8"), chiffre.final()]);
  return Buffer.concat([iv, chiffre.getAuthTag(), donnees]).toString("base64url");
}

function dechiffrer(c: string): string | null {
  const cle = cleChiffrement();
  if (cle === null) return null;
  try {
    const brut = Buffer.from(c, "base64url");
    if (brut.length < 29) return null;
    const dechiffre = createDecipheriv("aes-256-gcm", cle, brut.subarray(0, 12));
    dechiffre.setAuthTag(brut.subarray(12, 28));
    return Buffer.concat([dechiffre.update(brut.subarray(28)), dechiffre.final()]).toString(
      "utf-8",
    );
  } catch {
    return null;
  }
}

/** Référence signée d'une pièce, ou `null` (pas de secret en production). */
export function referencePieceJointe(p: PieceAJoindre, maintenant = Date.now()): string | null {
  const c = charge(p);
  if (c === null) return null;
  const jeton = SIGNATURE.signer(c, { expireA: Math.floor(maintenant / 1000) + VALIDITE_SEC });
  return jeton === null ? null : `${c}.${jeton}`;
}

/** La pièce que désigne une référence, si elle est authentique et non expirée. Sinon `null`. */
export function pieceDeLaReference(ref: string, maintenant = Date.now()): PieceAJoindre | null {
  const coupe = ref.indexOf(".");
  if (coupe < 1) return null;
  const c = ref.slice(0, coupe);
  // La signature est vérifiée AVANT tout déchiffrement.
  if (!SIGNATURE.verifier(c, ref.slice(coupe + 1), { maintenant: Math.floor(maintenant / 1000) })) {
    return null;
  }
  let valeurs: unknown;
  try {
    const clair = dechiffrer(c);
    if (clair === null) return null;
    valeurs = JSON.parse(clair);
  } catch {
    return null;
  }
  if (!Array.isArray(valeurs) || typeof valeurs[0] !== "string" || typeof valeurs[1] !== "string") {
    return null;
  }
  return {
    filename: valeurs[0],
    r2Key: valeurs[1],
    ...(typeof valeurs[2] === "string" ? { contentType: valeurs[2] } : {}),
    ...(valeurs[3] === true ? { facultative: true } : {}),
  };
}

/** Adresse de la route d'ouverture (la console passe toujours par `/fr/<préfixe>/…`). */
export function hrefPieceJointe(ref: string, prefixeAdmin: string): string | null {
  if (prefixeAdmin.trim() === "") return null; // préfixe non configuré : pas de lien cassé
  return `/fr/${prefixeAdmin}/emails/piece-jointe/${encodeURIComponent(ref)}`;
}

const MOTIFS = {
  introuvable: "ne sera pas jointe : fichier introuvable",
  "trop lourde": "ne sera pas jointe : fichier trop lourd",
} as const;

/**
 * Ce que l'envoi joindra, pour l'aperçu. Appelle `resoudrePiecesJointes` (la fonction du worker) :
 * une pièce exigée introuvable, ou un stockage non configuré, fait lever le worker (l'envoi
 * échouerait) ; l'aperçu le DIT au lieu de lever. `[]` = « Aucune pièce jointe ».
 */
export async function piecesJointesPourApercu(
  attachments: EmailJobData["attachments"],
  prefixeAdmin: string,
): Promise<PieceJointeApercu[]> {
  if (!attachments || attachments.length === 0) return [];
  let r;
  try {
    r = await resoudrePiecesJointes(attachments, { silencieux: true });
  } catch {
    return attachments.map((a) => ({
      nom: a.filename,
      remarque: "fichier introuvable ou stockage indisponible : l'envoi échouerait",
    }));
  }
  // Seules des pièces FACULTATIVES sont écartées ; chacune garde sa place d'origine.
  const ecartees = [...r.omises];
  const jointes = [...r.pieces];
  const liste: PieceJointeApercu[] = [];
  for (const a of attachments) {
    const i = a.facultative === true ? ecartees.findIndex((o) => o.filename === a.filename) : -1;
    if (i >= 0) {
      const [omise] = ecartees.splice(i, 1);
      liste.push({ nom: a.filename, remarque: omise ? MOTIFS[omise.motif] : "ne sera pas jointe" });
      continue;
    }
    const piece = jointes.shift();
    if (!piece) continue;
    const ref = referencePieceJointe(a);
    liste.push({
      nom: piece.filename,
      taille: Buffer.byteLength(piece.content),
      href: ref === null ? null : hrefPieceJointe(ref, prefixeAdmin),
    });
  }
  return liste;
}
