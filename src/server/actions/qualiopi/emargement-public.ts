/**
 * Qualiopi T13 — Server Actions de la page publique d'émargement.
 *
 * ⚠️ SURFACE NON AUTHENTIFIÉE. Le jeton est la seule barrière : tout ce qui est
 * vérifié ailleurs dans la console admin doit l'être ici explicitement.
 *
 * Trois gardes, dans cet ordre, et l'ordre compte :
 *   1. **Rate-limit** AVANT tout décodage d'image — sinon un envoi massif fait
 *      travailler `sharp` pour rien et met le conteneur à genoux, privant de
 *      signature toute une salle.
 *   2. **Vérification du jeton** — signature HMAC, puis la ligne en base qui
 *      reste l'autorité (révocation, expiration).
 *   3. **Recoupement porteur ↔ créneau**, porté par le service de signature :
 *      le jeton atteste d'une inscription, le créneau appartient à une
 *      inscription, les deux doivent coïncider.
 *
 * La clé de rate-limit porte sur le HASH DU JETON, jamais sur l'IP : en salle,
 * quinze stagiaires partagent une seule adresse derrière le NAT du client, et
 * une clé IP en bloquerait quatorze. Jamais le jeton en clair non plus — Redis
 * persiste, et `MONITOR` l'exposerait.
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { verifierToken } from "@/server/qualiopi/emargement/token-service";
import { signerCreneau, type RefusSignature } from "@/server/qualiopi/emargement/signature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

/** Quelques signatures par minute suffisent : un stagiaire signe 2 fois par jour. */
const LIMITE_PAR_JETON = { limit: 12, windowSec: 60 } as const;
/** Garde-fou large contre un balayage depuis l'extérieur, sans gêner une salle. */
const LIMITE_PAR_IP = { limit: 120, windowSec: 60 } as const;

export type RefusPublic = RefusSignature | "lien_invalide" | "trop_de_tentatives" | "stockage";

export type ResultatSignaturePublique =
  | { ok: true; signatureId: string }
  | { ok: false; raison: RefusPublic; message: string };

function sha256Hex(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/**
 * Signe une demi-journée depuis la page publique.
 *
 * @param token       Jeton en clair, tel qu'il figure dans l'URL.
 * @param creneauId   Demi-journée signée.
 * @param methode     `canvas` ou `confirmation_accessible`.
 */
export async function signerDepuisPortailAction(input: {
  token: string;
  creneauId: string;
  methode: "canvas" | "confirmation_accessible";
  imageDataUrl?: string;
  nomConfirme?: string;
}): Promise<ResultatSignaturePublique> {
  const tokenHash = sha256Hex(input.token);

  // ── 1. Rate-limit, AVANT tout travail coûteux ──
  const parJeton = await checkRateLimit(`emargement:sig:${tokenHash}`, LIMITE_PAR_JETON);
  if (!parJeton.allowed) {
    return {
      ok: false,
      raison: "trop_de_tentatives",
      message: "Trop de tentatives. Patientez une minute avant de réessayer.",
    };
  }

  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ipHash = hashIp(ipBrute);
  if (ipHash !== null) {
    const parIp = await checkRateLimit(`emargement:ip:${ipHash}`, LIMITE_PAR_IP);
    if (!parIp.allowed) {
      return {
        ok: false,
        raison: "trop_de_tentatives",
        message: "Trop de tentatives depuis ce réseau. Patientez une minute.",
      };
    }
  }

  // ── 2. Jeton ──
  const verif = await verifierToken(input.token);
  if (!verif.ok || verif.enrollmentId === null) {
    // Message unique : distinguer « expiré » de « révoqué » est utile au
    // stagiaire sur la PAGE (où le motif est déjà connu), pas ici, où l'appel
    // peut venir de n'importe où.
    return {
      ok: false,
      raison: "lien_invalide",
      message: "Ce lien n'est plus valable. Demandez-en un nouveau à votre organisme.",
    };
  }

  // ── 3. Signature ──
  try {
    const res = await signerCreneau({
      creneauId: input.creneauId,
      porteur: {
        type: "stagiaire",
        enrollmentId: verif.enrollmentId,
        tokenId: verif.tokenId,
      },
      methode: input.methode,
      imageDataUrl: input.imageDataUrl,
      nomConfirme: input.nomConfirme,
      ipHash,
      // Le user-agent est HACHÉ : ne jamais figer une donnée personnelle en
      // clair dans une empreinte immuable qu'un effacement ne pourrait plus
      // atteindre.
      userAgentSha256: (() => {
        const ua = entetes.get("user-agent");
        return ua === null ? null : sha256Hex(ua);
      })(),
    });

    if (!res.ok) return { ok: false, raison: res.raison, message: res.message };
    return { ok: true, signatureId: res.signatureId };
  } catch (err) {
    // Un échec de stockage LÈVE, volontairement : la signature ne doit pas être
    // simulée. On le traduit ici en refus explicite plutôt qu'en erreur 500
    // muette — le stagiaire doit savoir qu'il devra recommencer.
    if (err instanceof SignatureStockageError) {
      if (err.imputableAuClient) {
        return { ok: false, raison: "stockage", message: err.message };
      }
      return {
        ok: false,
        raison: "stockage",
        message:
          "Votre signature n'a pas pu être enregistrée. Prévenez votre formateur : elle ne sera pas prise en compte tant que vous n'aurez pas réessayé.",
      };
    }
    Sentry.captureException(err, { tags: { action: "signerDepuisPortailAction" } });
    throw err;
  }
}
