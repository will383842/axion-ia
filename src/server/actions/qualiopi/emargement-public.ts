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
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { verifierToken } from "@/server/qualiopi/emargement/token-service";
import { signerCreneau, type RefusSignature } from "@/server/qualiopi/emargement/signature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

/**
 * Par JETON — donc par stagiaire. Il signe deux fois par jour ; 12 tentatives
 * par minute laissent largement la place aux reprises après une erreur de tracé.
 */
const LIMITE_PAR_JETON = { limit: 12, windowSec: 60 } as const;

/**
 * Par IP — donc, en salle, pour TOUT LE GROUPE derrière le NAT du client.
 *
 * Le dimensionnement doit partir de la plus grande salle possible, pas d'un
 * chiffre confortable : le catalogue contient un séminaire déclaré « jusqu'à 50
 * participants ». Cinquante personnes qui scannent le QR en même temps, avec
 * quelques reprises, dépassent 120 requêtes par minute — et le garde-fou censé
 * arrêter un balayage extérieur bloquerait alors la salle entière.
 *
 * 600/min laisse passer 50 personnes faisant chacune une dizaine de tentatives,
 * et reste très en dessous de ce qu'un balayage automatisé produirait.
 *
 * ⚠️ Ce plafond ne protège pas grand-chose à lui seul : la vraie barrière est la
 * limite PAR JETON, qu'aucun nombre de participants ne dilue.
 */
const LIMITE_PAR_IP = { limit: 600, windowSec: 60 } as const;

export type RefusPublic = RefusSignature | "lien_invalide" | "trop_de_tentatives" | "stockage";

export type ResultatSignaturePublique =
  { ok: true; signatureId: string } | { ok: false; raison: RefusPublic; message: string };

function sha256Hex(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/**
 * 🔴 Validation d'entrée — c'est la SEULE action non authentifiée du domaine, et
 * elle était la seule des 45 actions Qualiopi à ne pas valider ses arguments.
 *
 * Les types TypeScript ne sont pas une garde : ils disparaissent à la
 * compilation. Un appel forgé pouvait donc poser `methode: "papier_scanne"`
 * depuis le portail public — et `methode` entre dans le tuple HACHÉ. La pièce
 * était alors scellée sur un fait faux, « photo de feuille papier » pour une
 * signature au doigt, et définitivement : son empreinte la déclarerait intacte.
 *
 * Le plafond de taille est ici, avant tout décodage. `decoderDataUrl` en pose un
 * aussi, mais après que Next a bufferisé jusqu'à 10 Mo (`bodySizeLimit`) : la
 * mémoire est déjà consommée à ce stade.
 */
const signerDepuisPortailSchema = z.object({
  token: z.string().min(1).max(2048),
  creneauId: z.string().uuid(),
  // Volontairement limité à ce que la page publique sait produire. Les autres
  // modalités (`papier_scanne`, recueil sur le poste du formateur) passent par
  // des chemins authentifiés, et c'est leur seule garantie d'être vraies.
  methode: z.enum(["canvas", "confirmation_accessible"]),
  // 2 Mio en base64 ≈ 2,8 Mo de chaîne. Au-delà, ce n'est plus une signature.
  imageDataUrl: z.string().max(3_000_000).optional(),
  nomConfirme: z.string().max(200).optional(),
});

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
  const parse = signerDepuisPortailSchema.safeParse(input);
  if (!parse.success) {
    // Message unique et neutre : détailler ce qui ne va pas renseignerait un
    // appelant forgé sur la forme attendue.
    return {
      ok: false,
      raison: "lien_invalide",
      message: "Cette demande n'est pas valide. Rouvrez le lien reçu par courriel.",
    };
  }
  const donnees = parse.data;
  const tokenHash = sha256Hex(donnees.token);

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
  const verif = await verifierToken(donnees.token);
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
      creneauId: donnees.creneauId,
      porteur: {
        type: "stagiaire",
        enrollmentId: verif.enrollmentId,
        tokenId: verif.tokenId,
      },
      methode: donnees.methode,
      imageDataUrl: donnees.imageDataUrl,
      nomConfirme: donnees.nomConfirme,
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
