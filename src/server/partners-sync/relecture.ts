/**
 * relecture.ts — `GET /api/partners/evenements?after_sequence=&limit=` (INT-T02, REQ-INT-012).
 *
 * Partners rattrape une lacune en relisant la file de sortie à partir d'un numéro de séquence. La
 * réponse porte la charge EXACTE conservée : les `corps` stockés, octet pour octet, un par ligne
 * (NDJSON — un corps est un JSON sur une seule ligne, `JSON.stringify` n'écrit aucun saut de
 * ligne). Partners peut donc passer chaque ligne au MÊME chemin que ses webhooks, empreinte
 * comprise, sans rien reconstruire.
 *
 * ── Authentification de la requête (Partners → axionia) ──────────────────────────────────────
 * HMAC-SHA256, sous un secret DÉDIÉ (`PARTNERS_RELECTURE_SECRET`), de
 *
 *     <horodatage>.<chemin et requête exacts>        ex. 1790000000./api/partners/evenements?after_sequence=12&limit=100
 *
 * en-têtes `X-Partners-Timestamp` / `X-Partners-Signature`, fenêtre de 300 s, comparaison à temps
 * constant. Un GET n'a pas de corps : ce qui est signé est la CIBLE, sans quoi une signature
 * valide pour `after_sequence=12` le serait pour n'importe quelle autre lecture pendant 5 minutes.
 * L'horodatage est contraint aux chiffres : la découpe « t.cible » reste non ambiguë (même règle
 * que `signerCorps`).
 *
 * ── Authentification de la réponse (axionia → Partners) ──────────────────────────────────────
 * Le corps de réponse est signé EXACTEMENT comme un envoi du relais : `X-Axionia-Timestamp` /
 * `X-Axionia-Signature` sur « t.corps » avec le secret d'émission. Partners la vérifie avec la
 * fonction qu'il a déjà (`verifierSignatureAxionia`) : une relecture ne vaut pas moins qu'un envoi.
 *
 * ── Inertie ──────────────────────────────────────────────────────────────────────────────────
 * Canal fermé, build, ou secret absent : 404, avant toute lecture — la route n'existe pas.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { horodatageSignature, signerCorps } from "@/server/partners/enveloppe";

import { canalPartnersOuvert, secretPartners, secretRelecture } from "./config";

export const ENTETE_HORODATAGE_RELECTURE = "x-partners-timestamp";
export const ENTETE_SIGNATURE_RELECTURE = "x-partners-signature";

/** REQ-SEC-010 : la même tolérance que le récepteur de Partners. */
export const TOLERANCE_RELECTURE_S = 300;
export const LIMITE_PAR_DEFAUT = 100;
export const LIMITE_MAX = 500;

const HORODATAGE = /^[0-9]{1,20}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;
const ENTIER = /^[0-9]{1,18}$/;

export interface LecteurRelecture {
  partnersSyncOutbox: {
    findMany(args: {
      where: { sequence: { gt: bigint } };
      orderBy: { sequence: "asc" };
      take: number;
    }): PromiseLike<{ sequence: bigint | null; corps: string }[]>;
  };
}

export type DependancesRelecture = {
  prisma?: LecteurRelecture;
  maintenantMs?: number;
};

/** Égalité à temps constant, longueur comprise (les deux côtés sont d'abord hachés). */
function egaux(presente: string, attendue: string): boolean {
  const a = createHash("sha256").update(presente, "utf8").digest();
  const b = createHash("sha256").update(attendue, "utf8").digest();
  return timingSafeEqual(a, b) && presente !== "";
}

/** La signature qu'un appelant légitime pose sur `cible` (chemin + requête). */
export function signerCibleRelecture(secret: string, horodatage: string, cible: string): string {
  if (!HORODATAGE.test(horodatage)) throw new Error("[partners-sync] horodatage invalide");
  return createHmac("sha256", secret).update(`${horodatage}.${cible}`).digest("hex");
}

function verifier(requete: Request, cible: string, secret: string, maintenantMs: number): boolean {
  const horodatage = requete.headers.get(ENTETE_HORODATAGE_RELECTURE);
  const signature = requete.headers.get(ENTETE_SIGNATURE_RELECTURE) ?? "";
  if (horodatage === null || !HORODATAGE.test(horodatage)) return false;
  if (Math.abs(maintenantMs / 1000 - Number(horodatage)) > TOLERANCE_RELECTURE_S) return false;
  const attendue = signerCibleRelecture(secret, horodatage, cible);
  // La comparaison a lieu dans tous les cas ; la forme est jugée après.
  return egaux(signature, attendue) && SIGNATURE.test(signature);
}

type Parametres = { apres: bigint; limite: number };

function lireParametres(url: URL): Parametres | null {
  const apresBrut = url.searchParams.get("after_sequence") ?? "0";
  const limiteBrute = url.searchParams.get("limit") ?? String(LIMITE_PAR_DEFAUT);
  if (!ENTIER.test(apresBrut) || !ENTIER.test(limiteBrute)) return null;
  const limite = Number(limiteBrute);
  if (limite < 1 || limite > LIMITE_MAX) return null;
  return { apres: BigInt(apresBrut), limite };
}

function texte(statut: number, corps: string): Response {
  return new Response(corps, {
    status: statut,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function repondreRelecture(
  requete: Request,
  dependances: DependancesRelecture = {},
): Promise<Response> {
  if (!canalPartnersOuvert()) return texte(404, "not_found");
  const secretLecture = secretRelecture();
  const secretEmission = secretPartners();
  if (secretLecture === null || secretEmission === null) return texte(404, "not_found");

  const url = new URL(requete.url);
  const cible = `${url.pathname}${url.search}`;
  const maintenantMs = dependances.maintenantMs ?? Date.now();
  if (!verifier(requete, cible, secretLecture, maintenantMs))
    return texte(401, "signature_refusee");

  const parametres = lireParametres(url);
  if (parametres === null) return texte(400, "parametres_illisibles");

  const prisma =
    dependances.prisma ?? ((await import("@/lib/prisma")).prisma as unknown as LecteurRelecture);

  // Une ligne de plus que demandé : c'est elle qui dit s'il reste une suite.
  const lignes = await prisma.partnersSyncOutbox.findMany({
    where: { sequence: { gt: parametres.apres } },
    orderBy: { sequence: "asc" },
    take: parametres.limite + 1,
  });
  const rendues = lignes.slice(0, parametres.limite);
  const corps = rendues.map((l) => l.corps).join("\n");
  const derniere = rendues.at(-1)?.sequence ?? parametres.apres;

  const horodatage = horodatageSignature(new Date(maintenantMs));
  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Axionia-Timestamp": horodatage,
      "X-Axionia-Signature": signerCorps(secretEmission, horodatage, corps),
      "X-Axionia-Derniere-Sequence": derniere.toString(),
      "X-Axionia-Suite": lignes.length > parametres.limite ? "1" : "0",
    },
  });
}
