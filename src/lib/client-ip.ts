// Point d'entrée de la résolution d'IP client — tout le raisonnement (chaîne
// Cloudflare → Traefik → Next, plages Cloudflare, en-tête forgeable si l'on
// contourne Cloudflare) est écrit dans `client-ip-core.ts`.
//
// 🔴 N'écrivez JAMAIS une lecture directe de `cf-connecting-ip`,
// `x-forwarded-for` ou `x-real-ip` ailleurs : passez par `ipDepuisEntetes`,
// `ipVisiteurOuNull` ou `getClientIp`. Plan : `_PLANS/PLAN-IP-CLIENT-UNIFIEE-2026-09-25.md`.

import { headers } from "next/headers";

import { ipDepuisEntetes } from "./client-ip-core";

export * from "./client-ip-core";

/**
 * Extrait l'IP client depuis les headers Next.js (Server Action / Server Comp).
 * En prod, exige que le proxy upstream soit dans la liste de confiance.
 * En dev, accepte n'importe quel x-forwarded-for (utile pour test local).
 */
export async function getClientIp(): Promise<string> {
  return ipDepuisEntetes(await headers());
}

/** Agent du navigateur (Server Action), pour le contexte d'une preuve de consentement. */
export async function getClientUserAgent(): Promise<string | null> {
  const ua = (await headers()).get("user-agent");
  return ua ? ua.slice(0, 500) : null;
}
