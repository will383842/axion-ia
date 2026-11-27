/**
 * Porte du Studio de la couche Méthode (fiche KB-05b, ADR 0076).
 *
 * `POST /api/internal/methode/studio` : le Studio y envoie un sujet et reçoit au plus cinq
 * extraits de la Méthode. Route sœur, LECTURE SEULE, FERMÉE PAR DÉFAUT, avec son propre
 * secret. Elle ne lit que par `obtenirContexteMethode` : elle ne sert donc que des sections
 * approuvées à la main (marque d'approbation) puis passées par `filtrerPourSortie`. Le
 * noyau, les étiquettes et la collection ne sont jamais rendus.
 *
 * Ordre des refus (figé par les tests) :
 *   503 build hors ligne → 404 fermée → 503 sans secret → 429 débit → 401 secret → 400 entrée.
 * Une route fermée ressemble à une route absente : elle ne révèle ni le secret ni sa forme.
 *
 * Aucun verbe d'écriture, aucun `console.*` : ni le sujet, ni un slug, ni un texte servi
 * n'est écrit au journal. Toute réponse porte `Cache-Control: no-store`.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ipDepuisEntetes } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { obtenirContexteMethode } from "@/server/methode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** La chaîne magique du build hors ligne (ADR 0026). Ne pas la changer sans la propager. */
const HOTE_DE_BUILD = "stub.invalid";

const ENTETE_DU_SECRET = "x-methode-secret";
const SECRET_LONGUEUR_MIN = 32;
const PLAFOND_PAR_MINUTE = 30;
/** Une demande valide pèse moins de 400 octets ; au-delà on refuse sans analyser. */
const CORPS_MAX_CARACTERES = 2_000;
/** Nombre d'extraits : fixé ici, jamais exposé au client. */
const EXTRAITS_SERVIS = 5;

const DEMANDE = z.object({ sujet: z.string().trim().min(2).max(300) }).strict();

const SANS_CACHE = { "Cache-Control": "no-store" } as const;

function reponse(corps: string | null, status: number, plus: Record<string, string> = {}) {
  return new Response(corps, { status, headers: { ...SANS_CACHE, ...plus } });
}

function json(corps: unknown, status = 200): Response {
  return Response.json(corps, { status, headers: SANS_CACHE });
}

/** Comparaison à temps constant sur deux empreintes SHA-256 de même taille. */
function egalesATempsConstant(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest | Request): Promise<Response> {
  // 1. Build hors ligne : rien à faire, rien à lire.
  if (process.env.DATABASE_URL?.includes(HOTE_DE_BUILD)) {
    return reponse("build_stub", 503);
  }

  // 2. Fermée par défaut : seule la valeur EXACTE "true", sur les deux interrupteurs.
  if (process.env.METHODE_STUDIO_OUVERT !== "true" || process.env.METHODE_ACTIVE !== "true") {
    return reponse("Not Found", 404);
  }

  // 3. Ouverte mais sans secret exploitable : on ne sert rien.
  const secret = process.env.METHODE_STUDIO_SECRET;
  if (!secret || secret.length < SECRET_LONGUEUR_MIN) {
    return reponse("not_configured", 503);
  }

  // 4. Débit par adresse, AVANT la comparaison du secret (sinon : oracle à force brute).
  const ip = ipDepuisEntetes(req.headers);
  const debit = await checkRateLimit(`methode:studio:${ip}`, {
    limit: PLAFOND_PAR_MINUTE,
    windowSec: 60,
  });
  if (!debit.allowed) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...SANS_CACHE, "Retry-After": "60" } },
    );
  }

  // 5. Secret de l'en-tête.
  const presente = req.headers.get(ENTETE_DU_SECRET);
  if (!presente || !egalesATempsConstant(presente, secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  // 6. Entrée stricte. Le texte reçu n'est jamais renvoyé ni écrit.
  let brut: string;
  try {
    brut = await req.text();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (brut.length === 0 || brut.length > CORPS_MAX_CARACTERES) {
    return json({ error: "invalid_request" }, 400);
  }
  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const demande = DEMANDE.safeParse(corps);
  if (!demande.success) {
    return json({ error: "invalid_request" }, 400);
  }

  // 7. Un seul chemin vers la couche : le point d'entrée, donc la marque et le filtre.
  const { extraits } = await obtenirContexteMethode({
    sujet: demande.data.sujet,
    max: EXTRAITS_SERVIS,
  });
  const items = extraits.map((e) => ({
    slug: e.slug,
    titre: e.titre,
    texte: e.texte,
    source: "methode" as const,
  }));
  return json({ items, meta: { returned: items.length } });
}

function refuserLEcriture(): Response {
  return reponse(null, 405, { Allow: "POST" });
}

export const GET = refuserLEcriture;
export const PUT = refuserLEcriture;
export const PATCH = refuserLEcriture;
export const DELETE = refuserLEcriture;
