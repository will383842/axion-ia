/**
 * Lot 5 : les deux gestes des liens de l'e-mail. Afficher la page n'écrit RIEN : seul l'envoi du
 * formulaire (un POST) appelle le cœur. Les erreurs rendent TOUTES la même réponse neutre.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { getClientIp, getClientUserAgent } from "@/lib/client-ip";
import { confirmerDemande, sOpposerALaDemande } from "@/features/apporteurs-reseau/changement-iban";

export type ResultatLien = { ok: true } | { ok: false };

const v = (x: FormDataEntryValue | null) => (typeof x === "string" ? x.slice(0, 200) : "");

async function ip(): Promise<string | null> {
  try {
    return (await getClientIp()) ?? null;
  } catch {
    return null;
  }
}

export async function confirmerLienAction(fd: FormData): Promise<ResultatLien> {
  let ua: string | null = null;
  try {
    ua = (await getClientUserAgent()) ?? null;
  } catch {
    ua = null;
  }
  const r = await confirmerDemande({
    demandeId: v(fd.get("demande")),
    signature: v(fd.get("signature")),
    ip: await ip(),
    userAgent: ua,
  });
  return { ok: r.ok };
}

export async function bloquerLienAction(fd: FormData): Promise<ResultatLien> {
  const r = await sOpposerALaDemande({
    demandeId: v(fd.get("demande")),
    signature: v(fd.get("signature")),
    ip: await ip(),
  });
  return { ok: r.ok };
}
