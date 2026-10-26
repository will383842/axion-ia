// use-client: not needed — Route Handler, pas un composant React.
//
// Dépôt du cookie de provenance de campagne `axion_utm` APRÈS consentement.
//
// ── Pourquoi cette route existe ───────────────────────────────────────────
// Le cookie rattache une campagne à un rendez-vous nominatif : il n'est pas
// strictement nécessaire, donc il ne se dépose qu'après l'accord du visiteur.
// Décision de Will (2026-10-26) : le proxy ne le pose plus à l'arrivée ; c'est
// la bannière qui appelle cette route, et seulement après « Accepter », avec
// les `utm_*` de l'adresse courante.
//
// ── Gardes ────────────────────────────────────────────────────────────────
//   - même site uniquement (en-tête `Origin` obligatoire et égal à l'hôte) ;
//   - limitation de débit par IP, comme `api/funnel` ;
//   - valeurs filtrées par `parseUtmFromUrl` — la même liste blanche (5 clés)
//     et la même longueur maximale que partout ailleurs ;
//   - aucun `utm_*` valide → aucun cookie.
//
// ── Vie privée ────────────────────────────────────────────────────────────
// 🔴 Rien n'est écrit en base. L'IP ne sert que de clé de limitation de débit.

import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { buildUtmSetCookie, parseUtmFromUrl } from "@/lib/utm";

/** Cinq valeurs de 200 caractères au plus : 4 Ko est déjà généreux. */
const MAX_BODY_BYTES = 4096;

/** Un visiteur n'accepte qu'une fois ; 20/min coupe un script sans gêner personne. */
const RATE_LIMIT = { limit: 20, windowSec: 60 } as const;

const SANS_CACHE = { "Cache-Control": "no-store" } as const;

/** Même site uniquement : sans en-tête `Origin` (pas un navigateur), refus. */
function memeSite(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() === (req.headers.get("host") ?? "").toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!memeSite(req)) return new Response(null, { status: 403, headers: SANS_CACHE });

  const ip = await getClientIp();
  const rl = await checkRateLimit(`utm-consent:${ip}`, RATE_LIMIT);
  if (!rl.allowed) return new Response(null, { status: 429, headers: SANS_CACHE });

  const annonce = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(annonce) && annonce > MAX_BODY_BYTES) {
    return new Response(null, { status: 413, headers: SANS_CACHE });
  }

  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    return new Response(null, { status: 400, headers: SANS_CACHE });
  }

  // On ne recopie que des chaînes ; `parseUtmFromUrl` applique ensuite la liste
  // blanche des cinq clés, la borne de 200 caractères et le nettoyage.
  const params = new URLSearchParams();
  if (brut && typeof brut === "object" && !Array.isArray(brut)) {
    for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
      if (typeof valeur === "string") params.set(cle, valeur);
    }
  }
  const utm = parseUtmFromUrl(params);
  if (Object.keys(utm).length === 0) {
    return new Response(null, { status: 400, headers: SANS_CACHE });
  }

  return new Response(null, {
    status: 204,
    headers: { ...SANS_CACHE, "Set-Cookie": buildUtmSetCookie(utm) },
  });
}
