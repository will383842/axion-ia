/**
 * Passage du référentiel des communes (lot L2c, ADR 0066) — appelé chaque matin
 * par le worker (`formation-crons.communes-geo`) ; il ne travaille qu'une fois
 * par mois, quand le référentiel a 30 jours ou plus (ou qu'il est vide).
 *
 * Interrupteur `formateurs.communes_geo_cron` : absent ou illisible = ARRÊTÉ,
 * aucun appel réseau. Une réponse tronquée n'est jamais écrite ; rien n'est
 * jamais supprimé. Ne lève jamais : le bilan dit ce qui s'est passé.
 *
 * Sans `server-only` ; Prisma et le réseau sont chargés PARESSEUSEMENT.
 */

import {
  MINIMUM_COMMUNES_ATTENDUES,
  URL_COMMUNES_GEO,
  analyserCommunesGeo,
  referentielAJour,
  type CommuneGeoLue,
} from "./communes-geo";

/** Délai du téléchargement complet (quelques Mo). */
const DELAI_TELECHARGEMENT_MS = 60_000;

export interface DepsPassageCommunes {
  envoiAllume(): Promise<boolean>;
  derniereMaj(): Promise<Date | null>;
  telecharger(): Promise<unknown>;
  ecrire(communes: CommuneGeoLue[], maintenant: Date): Promise<number>;
}

export type BilanCommunesGeo =
  | { etat: "coupe" }
  | { etat: "a_jour" }
  | { etat: "refuse"; lues: number; rejets: number }
  | { etat: "echec"; message: string }
  | { etat: "ecrit"; ecrites: number; rejets: number };

function depsReelles(): DepsPassageCommunes {
  return {
    async envoiAllume() {
      const { envoiAllume } =
        await import("@/server/qualiopi/formateurs-independants/interrupteurs-envoi");
      return envoiAllume("communes_geo_cron");
    },
    async derniereMaj() {
      const { prisma } = await import("@/lib/prisma");
      const r = await prisma.communeGeo.aggregate({ _max: { majAt: true } });
      return r._max.majAt ?? null;
    },
    async telecharger() {
      const rep = await fetch(URL_COMMUNES_GEO, {
        signal: AbortSignal.timeout(DELAI_TELECHARGEMENT_MS),
        headers: { Accept: "application/json" },
      });
      if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
      return rep.json();
    },
    async ecrire(communes, maintenant) {
      const { prisma } = await import("@/lib/prisma");
      const { ecrireCommunes } = await import("./communes-geo-ecriture");
      return ecrireCommunes(prisma, communes, maintenant);
    },
  };
}

export async function passerCommunesGeo(
  maintenant: Date,
  deps: DepsPassageCommunes = depsReelles(),
): Promise<BilanCommunesGeo> {
  try {
    if (!(await deps.envoiAllume())) return { etat: "coupe" };
    if (referentielAJour(await deps.derniereMaj(), maintenant)) return { etat: "a_jour" };
    const { communes, rejets } = analyserCommunesGeo(await deps.telecharger());
    if (communes.length < MINIMUM_COMMUNES_ATTENDUES) {
      return { etat: "refuse", lues: communes.length, rejets };
    }
    const ecrites = await deps.ecrire(communes, maintenant);
    return { etat: "ecrit", ecrites, rejets };
  } catch (err) {
    return { etat: "echec", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Une ligne de journal, sans aucune donnée personnelle (il n'y en a pas). */
export function ligneBilanCommunesGeo(b: BilanCommunesGeo): {
  niveau: "log" | "error";
  ligne: string;
} {
  const p = "[formation-crons] communes-geo:";
  switch (b.etat) {
    case "coupe":
      return { niveau: "log", ligne: `${p} coupé (interrupteur)` };
    case "a_jour":
      return { niveau: "log", ligne: `${p} référentiel à jour` };
    case "refuse":
      return {
        niveau: "error",
        ligne: `${p} réponse tronquée (${b.lues} communes lues, ${b.rejets} écartées) — rien écrit`,
      };
    case "echec":
      return { niveau: "error", ligne: `${p} échec : ${b.message}` };
    case "ecrit":
      return { niveau: "log", ligne: `${p} ${b.ecrites} communes écrites, ${b.rejets} écartées` };
  }
}
