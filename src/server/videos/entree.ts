/**
 * ENTRÉE SIGNÉE DES ADRESSES `/api/interne/*` — étapes 1 à 5 du §3.3, communes à
 * `POST/DELETE /api/interne/videos` et `GET /api/interne/reglages-publics`.
 *
 *   1. drapeau éteint        → 503 reception_eteinte (rien n'est lu ni écrit)
 *   2. secret absent/court   → 503 reception_non_configuree ; base factice du
 *                              build (`stub.invalid`) → 503 base_indisponible
 *      limitation de débit par IP → 429
 *   3. en-têtes malformés    → 400 ; Content-Type ≠ JSON → 415 ; corps > 256 Kio → 413
 *      (le corps est lu AVEC plafond, avant tout calcul de HMAC)
 *   4-5. horodatage hors fenêtre / signature fausse → 401 (aucun détail)
 */
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipDepuisEntetes } from "@/lib/client-ip";
import { raisonExtinction, secretsStudio, videosSiteActives } from "./config";
import { refus } from "./reponse";
import { RE_HORODATAGE, RE_NONCE, RE_SIGNATURE, sha256Hex, verifierRequete } from "./signature";

export const CORPS_MAX_OCTETS = 256 * 1024;

export interface EntreeSignee {
  readonly ok: true;
  readonly corps: Buffer;
  readonly corpsSha256: string;
  readonly horodatage: number;
  readonly nonce: string;
  readonly methode: string;
  readonly chemin: string;
  readonly secret: "courant" | "precedent";
}

export type ResultatEntree = EntreeSignee | { readonly ok: false; readonly reponse: Response };

async function lireCorpsPlafonne(req: NextRequest, max: number): Promise<Buffer | null> {
  const annonce = Number(req.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > max) return null;
  if (!req.body) return Buffer.alloc(0);
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel();
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

export async function controlerEntree(
  req: NextRequest,
  options: { methode: "GET" | "POST" | "DELETE"; chemin: string },
): Promise<ResultatEntree> {
  // 1-2. Interrupteur, configuration, base factice.
  if (!videosSiteActives()) return { ok: false, reponse: refus(503, "reception_eteinte") };
  if (raisonExtinction() !== null)
    return { ok: false, reponse: refus(503, "reception_non_configuree") };
  const secrets = secretsStudio()!;
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { ok: false, reponse: refus(503, "base_indisponible") };
  }

  const ip = ipDepuisEntetes(req.headers);
  const limite = await checkRateLimit(`internal:videos:${ip}`, { limit: 60, windowSec: 60 });
  if (!limite.allowed) return { ok: false, reponse: refus(429, "trop_de_requetes") };

  // 3. Forme des en-têtes, type du contenu, plafond du corps.
  const horodatage = req.headers.get("x-axion-horodatage");
  const nonce = req.headers.get("x-axion-nonce");
  const signature = req.headers.get("x-axion-signature");
  if (
    !horodatage ||
    !nonce ||
    !signature ||
    !RE_HORODATAGE.test(horodatage) ||
    !RE_NONCE.test(nonce) ||
    !RE_SIGNATURE.test(signature)
  ) {
    return { ok: false, reponse: refus(400, "entetes_invalides") };
  }
  if (options.methode !== "GET") {
    const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (type !== "application/json") return { ok: false, reponse: refus(415, "type_non_supporte") };
  }
  const corps =
    options.methode === "GET" ? Buffer.alloc(0) : await lireCorpsPlafonne(req, CORPS_MAX_OCTETS);
  if (corps === null) return { ok: false, reponse: refus(413, "corps_trop_gros") };

  // 4-5. Horodatage et signature.
  const verdict = verifierRequete({
    secrets,
    entetes: { horodatage, nonce, signature },
    methode: options.methode,
    chemin: options.chemin,
    corps,
    maintenantSec: Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) {
    return {
      ok: false,
      reponse: refus(verdict.raison === "entetes_invalides" ? 400 : 401, verdict.raison),
    };
  }
  if (verdict.secret === "precedent") {
    console.warn(JSON.stringify({ event: "videos_signature", secret: "secret_precedent" }));
  }
  return {
    ok: true,
    corps,
    corpsSha256: sha256Hex(corps),
    horodatage: Number(horodatage),
    nonce,
    methode: options.methode,
    chemin: options.chemin,
    secret: verdict.secret,
  };
}
