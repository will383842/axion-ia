/**
 * État du disque du serveur, pour la tuile « État du serveur » de l'accueil de
 * la console et pour l'alerte Telegram.
 *
 * Le site tourne dans un conteneur, mais `statfs("/")` y lit le disque RÉEL du
 * VPS (calque overlay posé sur `/dev/sda1`) : mesuré le 2026-10-23, 149 Go au
 * total et 38 Go libres des deux côtés. C'est ce disque qui porte la base —
 * tombée pour disque plein le 2026-10-10.
 *
 * Le dernier passage de l'élagueur (`src/server/cache/elagueur-cache-isr.ts`)
 * est rangé sur `globalThis` : `instrumentation.ts` et les pages sont des
 * bundles distincts, une variable de module ne serait pas partagée entre eux.
 */
import { promises as fsp } from "node:fs";

import type { RapportElagage } from "@/server/cache/elagueur-cache-isr";

/** Au-delà : la tuile passe en alerte et Telegram prévient (canal Système). */
export const SEUIL_ALERTE_DISQUE_POURCENT = 85;
/** Au-delà : avertissement visible sur la tuile, sans message. */
export const SEUIL_VIGILANCE_DISQUE_POURCENT = 75;

export type EtatDisque = {
  pourcent: number;
  libresGo: number;
  totalGo: number;
  niveau: "ok" | "vigilance" | "alerte";
};

export type DernierElagage = RapportElagage & { a: string };

export type EtatServeur = {
  disque: EtatDisque | null;
  dernierElagage: DernierElagage | null;
};

const CLE_GLOBALE = "__axionDernierElagageIsr";

export function niveauDisque(pourcent: number): EtatDisque["niveau"] {
  if (pourcent >= SEUIL_ALERTE_DISQUE_POURCENT) return "alerte";
  if (pourcent >= SEUIL_VIGILANCE_DISQUE_POURCENT) return "vigilance";
  return "ok";
}

/** Même calcul que `df` : utilisé / (utilisé + disponible), arrondi au-dessus. */
export function calculerEtatDisque(s: {
  blocks: number;
  bfree: number;
  bavail: number;
  bsize: number;
}): EtatDisque {
  const go = (blocs: number): number => (blocs * s.bsize) / 1024 ** 3;
  const utilises = s.blocks - s.bfree;
  const pourcent = Math.ceil((utilises / (utilises + s.bavail)) * 100);
  return {
    pourcent,
    libresGo: Math.round(go(s.bavail) * 10) / 10,
    totalGo: Math.round(go(s.blocks)),
    niveau: niveauDisque(pourcent),
  };
}

export async function lireEtatDisque(): Promise<EtatDisque | null> {
  try {
    return calculerEtatDisque(await fsp.statfs("/"));
  } catch {
    return null; // une tuile ne fait jamais tomber l'accueil
  }
}

export function memoriserDernierElagage(r: RapportElagage, maintenant = new Date()): void {
  (globalThis as unknown as Record<string, unknown>)[CLE_GLOBALE] = {
    ...r,
    a: maintenant.toISOString(),
  };
}

export function lireDernierElagage(): DernierElagage | null {
  return (
    ((globalThis as unknown as Record<string, unknown>)[CLE_GLOBALE] as
      | DernierElagage
      | undefined) ?? null
  );
}

export async function lireEtatServeur(): Promise<EtatServeur> {
  return { disque: await lireEtatDisque(), dernierElagage: lireDernierElagage() };
}

/**
 * Prévient sur Telegram (canal Système) quand le disque dépasse le seuil.
 * Une fois toutes les 6 h au plus (clé de dédup par tranche de 6 h). Fail-soft.
 */
export async function alerterSiDisquePlein(maintenant = new Date()): Promise<boolean> {
  const disque = await lireEtatDisque();
  if (!disque || disque.niveau !== "alerte") return false;
  const tranche = `${maintenant.toISOString().slice(0, 10)}-${Math.floor(maintenant.getUTCHours() / 6)}`;
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "MONITORING_ALERT",
      payload: {
        kind: "disque-serveur-plein",
        details: {
          legacyBody:
            `⚠️ Disque du serveur plein à ${disque.pourcent} % (${disque.libresGo} Go libres sur ${disque.totalGo}). ` +
            "Le 10/10, un disque plein a mis la base du site en panne. " +
            "À faire : libérer de la place sur le VPS (dossiers de test dans /tmp, cache Docker) ; l'accueil de la console montre l'état.",
          pourcent: disque.pourcent,
          libresGo: disque.libresGo,
        },
      },
      dedupKey: `disque-serveur-plein-${tranche}`,
      // Sans TTL, `notify` ne déduplique que 5 min : un message par tour (20 min).
      dedupTtlSec: 6 * 3600,
    });
    return true;
  } catch {
    return false;
  }
}
