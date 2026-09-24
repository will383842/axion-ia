/**
 * Événement Plausible émis CÔTÉ SERVEUR (lot L2, 2026-09-24).
 *
 * Le téléchargement du guide depuis l'e-mail n'est vu par aucun script du
 * site : l'extension `file-downloads` ne compte que les clics SUR le site. Le
 * seul endroit qui sait qu'un humain a ouvert le guide, c'est la route du lien
 * personnel, au POST de son bouton. Elle émet donc l'événement elle-même, via
 * l'API d'événements de l'instance Plausible auto-hébergée.
 *
 * ⛔ AUCUNE donnée personnelle dans `props` : des libellés seulement
 * (`source=guide-ia`). L'agent et l'IP transmis en en-têtes sont ceux que le
 * script client enverrait lui-même ; Plausible ne les stocke pas (empreinte
 * quotidienne salée), c'est ce qui le rend exempté de consentement.
 *
 * Fail-soft et borné : 1,5 s au plus, et jamais d'exception. Une mesure ratée
 * ne doit pas retarder ni casser le téléchargement.
 */

import { env } from "@/env";
import { SITE_URL } from "@/lib/site-url";

export interface EvenementPlausibleServeur {
  readonly nom: string;
  /** Chemin de la page « vue » (ex. `/api/guide-ia/telecharger`), sans jeton. */
  readonly chemin: string;
  readonly props?: Readonly<Record<string, string>>;
  readonly userAgent?: string | null;
  readonly ip?: string | null;
}

const DELAI_MS = 1_500;

export async function emettreEvenementPlausible(e: EvenementPlausibleServeur): Promise<boolean> {
  const domaine = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domaine) return false;
  const api = (env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com").replace(
    /\/+$/,
    "",
  );
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const res = await fetch(`${api}/api/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": e.userAgent || "axion-ia-serveur",
        ...(e.ip ? { "x-forwarded-for": e.ip } : {}),
      },
      body: JSON.stringify({
        name: e.nom,
        domain: domaine,
        url: `${SITE_URL.replace(/\/+$/, "")}${e.chemin}`,
        ...(e.props ? { props: e.props } : {}),
      }),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(minuteur);
  }
}
