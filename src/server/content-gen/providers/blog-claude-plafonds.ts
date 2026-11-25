/**
 * Plafonds du contenu via Claude (clés `blog_claude_*`, nom conservé : pas de migration) : validation commune à l'écran d'administration
 * et au script de pose.
 *
 * Module PUR : pas de base de données, pas de "use server", pas d'alias `@/`
 * (le script tourne par tsx dans le worker, qui ne contient que /app/src).
 * Seules les bornes de GARDE y figurent, jamais les plafonds réels.
 */

/** Bornes de GARDE (pas les plafonds réels). */
export const BORNE_JOUR_USD = 20;
export const BORNE_MOIS_USD = 300;
/** Borne de garde du nombre de relectures par jour. */
export const BORNE_JUGE_MAX_JOUR = 500;

export const CLES_PLAFONDS_BLOG = {
  jour: "blog_claude_daily_cap_usd",
  mois: "blog_claude_monthly_cap_usd",
  reserve: "blog_claude_reserve_qualiopi_usd",
  juge: "blog_claude_juge_max_jour",
} as const;

export class ErreurPlafondsBlog extends Error {}

export interface LibellesPlafondsBlog {
  jour: string;
  mois: string;
  reserve: string;
  jugeMax: string;
}

export const LIBELLES_SCRIPT: LibellesPlafondsBlog = {
  jour: "--jour",
  mois: "--mois",
  reserve: "--reserve",
  jugeMax: "--juge-max",
};

export const LIBELLES_ECRAN: LibellesPlafondsBlog = {
  jour: "Plafond du jour",
  mois: "Plafond mensuel du contenu via Claude",
  reserve: "Réserve Qualiopi",
  jugeMax: "Relectures max par jour",
};

export interface PlafondsBlog {
  jour: number;
  mois: number;
  reserve: number;
  jugeMax: number;
}

export function lireNombreStrict(brut: string | undefined, nom: string): number {
  if (brut === undefined || brut.trim() === "" || brut.startsWith("--")) {
    throw new ErreurPlafondsBlog(`${nom} : valeur manquante`);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(brut.trim())) {
    throw new ErreurPlafondsBlog(`${nom} : nombre décimal positif attendu (2 décimales max)`);
  }
  const n = Number(brut);
  if (!Number.isFinite(n)) throw new ErreurPlafondsBlog(`${nom} : nombre invalide`);
  return n;
}

/** Valide les bornes et rend les 4 clés extraConfig. Lève ErreurPlafondsBlog au moindre doute. */
export function validerPlafondsBlog(
  v: PlafondsBlog,
  l: LibellesPlafondsBlog = LIBELLES_SCRIPT,
): Record<string, number> {
  const { jour, mois, reserve, jugeMax } = v;
  if (!(jour > 0 && jour <= BORNE_JOUR_USD)) {
    throw new ErreurPlafondsBlog(`${l.jour} hors bornes de garde (0 < jour ≤ ${BORNE_JOUR_USD})`);
  }
  if (!(mois > 0 && mois <= BORNE_MOIS_USD)) {
    throw new ErreurPlafondsBlog(`${l.mois} hors bornes de garde (0 < mois ≤ ${BORNE_MOIS_USD})`);
  }
  if (jour > mois) throw new ErreurPlafondsBlog(`${l.jour} ne peut pas dépasser ${l.mois}`);
  if (!(Number.isFinite(reserve) && reserve >= 0))
    throw new ErreurPlafondsBlog(`${l.reserve} doit être ≥ 0`);
  if (!Number.isInteger(jugeMax) || jugeMax < 1 || jugeMax > BORNE_JUGE_MAX_JOUR) {
    throw new ErreurPlafondsBlog(`${l.jugeMax} : entier entre 1 et ${BORNE_JUGE_MAX_JOUR}`);
  }
  return {
    [CLES_PLAFONDS_BLOG.jour]: jour,
    [CLES_PLAFONDS_BLOG.mois]: mois,
    [CLES_PLAFONDS_BLOG.reserve]: reserve,
    [CLES_PLAFONDS_BLOG.juge]: jugeMax,
  };
}

/** Fusionne sans perdre les autres clés d'extraConfig. */
export function fusionnerExtraConfig(
  existant: unknown,
  ajout: Record<string, number>,
): Record<string, unknown> {
  const base =
    existant && typeof existant === "object" && !Array.isArray(existant)
      ? (existant as Record<string, unknown>)
      : {};
  return { ...base, ...ajout };
}

/** Lecture des 4 plafonds posés (nombre fini, sinon null) : jamais tout extraConfig. */
export function lirePlafondsBlogExistants(extra: unknown): {
  jour: number | null;
  mois: number | null;
  reserve: number | null;
  jugeMax: number | null;
} {
  const o =
    extra && typeof extra === "object" && !Array.isArray(extra)
      ? (extra as Record<string, unknown>)
      : {};
  const nb = (cle: string): number | null => {
    const v = o[cle];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    jour: nb(CLES_PLAFONDS_BLOG.jour),
    mois: nb(CLES_PLAFONDS_BLOG.mois),
    reserve: nb(CLES_PLAFONDS_BLOG.reserve),
    jugeMax: nb(CLES_PLAFONDS_BLOG.juge),
  };
}
