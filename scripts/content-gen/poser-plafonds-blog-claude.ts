#!/usr/bin/env tsx
/**
 * Pose les plafonds du blog via Claude (jour, mois, réserve Qualiopi, limite du juge)
 * et, au besoin, lève le drapeau de suspension.
 *
 * Les valeurs sont passées en ARGUMENT : jamais écrites dans le dépôt. Seules les
 * bornes de GARDE ci-dessous (20 $/jour, 300 $/mois) y figurent ; ce ne sont pas
 * les plafonds réels, juste le maximum que ce script accepte de poser.
 *
 * Usage (en production : DANS le conteneur worker) :
 *   pnpm tsx scripts/content-gen/poser-plafonds-blog-claude.ts \
 *     --jour <usd> --mois <usd> --reserve <usd> --juge-max <n>            # À SEC
 *   … mêmes arguments + --reel                                            # écrit
 *   pnpm tsx scripts/content-gen/poser-plafonds-blog-claude.ts --lever-suspension [--reel]
 *
 * Par défaut : à sec (lecture seule, affiche ce qui serait écrit). N'écrit QUE dans
 * extraConfig de la ligne `anthropic` (clés blog_claude_*, les autres clés sont
 * conservées) et dans la clé `blog_claude_suspendu` de ContentGenConfig.
 * Ne crée jamais la ligne `anthropic`, ne touche ni au kill switch, ni à
 * `monthlyCapUsd`, ni aux compteurs, ni à la variable d'allumage.
 */

import { existsSync, readFileSync } from "node:fs";

/** Bornes de GARDE (pas les plafonds réels). */
export const BORNE_JOUR_USD = 20;
export const BORNE_MOIS_USD = 300;
/** Borne de garde du nombre de relectures par jour. */
export const BORNE_JUGE_MAX_JOUR = 500;

export const CLES = {
  jour: "blog_claude_daily_cap_usd",
  mois: "blog_claude_monthly_cap_usd",
  reserve: "blog_claude_reserve_qualiopi_usd",
  juge: "blog_claude_juge_max_jour",
} as const;
export const CLE_SUSPENSION = "blog_claude_suspendu";

export interface Options {
  jour?: number;
  mois?: number;
  reserve?: number;
  jugeMax?: number;
  leverSuspension: boolean;
  reel: boolean;
}

export class ErreurUsage extends Error {}

function nombreStrict(brut: string | undefined, nom: string): number {
  if (brut === undefined || brut.trim() === "" || brut.startsWith("--")) {
    throw new ErreurUsage(`${nom} : valeur manquante`);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(brut.trim())) {
    throw new ErreurUsage(`${nom} : nombre décimal positif attendu (2 décimales max)`);
  }
  const n = Number(brut);
  if (!Number.isFinite(n)) throw new ErreurUsage(`${nom} : nombre invalide`);
  return n;
}

export function lireArguments(argv: readonly string[]): Options {
  const o: Options = { leverSuspension: false, reel: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--reel":
        o.reel = true;
        break;
      case "--lever-suspension":
        o.leverSuspension = true;
        break;
      case "--jour":
        o.jour = nombreStrict(argv[++i], "--jour");
        break;
      case "--mois":
        o.mois = nombreStrict(argv[++i], "--mois");
        break;
      case "--reserve":
        o.reserve = nombreStrict(argv[++i], "--reserve");
        break;
      case "--juge-max":
        o.jugeMax = nombreStrict(argv[++i], "--juge-max");
        break;
      default:
        throw new ErreurUsage(`argument inconnu : ${a}`);
    }
  }
  return o;
}

export interface PlanEcriture {
  extraConfig: Record<string, number> | null;
  leverSuspension: boolean;
}

/** Valide les options et rend ce qui serait écrit. Lève ErreurUsage au moindre doute. */
export function construirePlan(o: Options): PlanEcriture {
  const fournis = [o.jour, o.mois, o.reserve, o.jugeMax].filter((v) => v !== undefined).length;
  if (fournis === 0 && !o.leverSuspension) {
    throw new ErreurUsage("rien à faire : donner les 4 plafonds et/ou --lever-suspension");
  }
  if (fournis === 0) return { extraConfig: null, leverSuspension: true };
  if (fournis !== 4) {
    throw new ErreurUsage("--jour, --mois, --reserve et --juge-max vont ensemble (les 4 ou aucun)");
  }
  const { jour, mois, reserve, jugeMax } = o as Required<
    Pick<Options, "jour" | "mois" | "reserve" | "jugeMax">
  >;
  if (!(jour > 0 && jour <= BORNE_JOUR_USD)) {
    throw new ErreurUsage(`--jour hors bornes de garde (0 < jour ≤ ${BORNE_JOUR_USD})`);
  }
  if (!(mois > 0 && mois <= BORNE_MOIS_USD)) {
    throw new ErreurUsage(`--mois hors bornes de garde (0 < mois ≤ ${BORNE_MOIS_USD})`);
  }
  if (jour > mois) throw new ErreurUsage("--jour ne peut pas dépasser --mois");
  if (!(reserve >= 0)) throw new ErreurUsage("--reserve doit être ≥ 0");
  if (!Number.isInteger(jugeMax) || jugeMax < 1 || jugeMax > BORNE_JUGE_MAX_JOUR) {
    throw new ErreurUsage(`--juge-max : entier entre 1 et ${BORNE_JUGE_MAX_JOUR}`);
  }
  return {
    extraConfig: {
      [CLES.jour]: jour,
      [CLES.mois]: mois,
      [CLES.reserve]: reserve,
      [CLES.juge]: jugeMax,
    },
    leverSuspension: o.leverSuspension,
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

async function principal(): Promise<void> {
  if (!process.env["DATABASE_URL"] && existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  const options = lireArguments(process.argv.slice(2));
  const plan = construirePlan(options);
  console.log(`Mode : ${options.reel ? "RÉEL" : "À SEC (rien n'est écrit)"}`);

  const { PrismaClient } = await import("../../prisma/generated/client");
  const prisma = new PrismaClient();
  try {
    if (plan.extraConfig) {
      const ligne = await prisma.providerConfig.findUnique({ where: { provider: "anthropic" } });
      if (!ligne) {
        throw new ErreurUsage(
          "ligne provider_config « anthropic » absente : rien posé (non créée ici)",
        );
      }
      const apres = fusionnerExtraConfig(ligne.extraConfig, plan.extraConfig);
      console.log("extraConfig (clés blog posées) :", JSON.stringify(plan.extraConfig));
      if (options.reel) {
        // Course connue : `handleCostCapHit` (cost-tracker) réécrit aussi extraConfig quand
        // il pose ses propres clés. Fenêtre de quelques ms ; c'est pourquoi on RELIT
        // juste après l'écriture et on échoue bruyamment si une clé a disparu.
        await prisma.providerConfig.update({
          where: { provider: "anthropic" },
          data: { extraConfig: apres as never },
        });
        const relu = await prisma.providerConfig.findUnique({ where: { provider: "anthropic" } });
        const extra = (relu?.extraConfig ?? {}) as Record<string, unknown>;
        const manquantes = Object.entries(plan.extraConfig)
          .filter(([cle, valeur]) => extra[cle] !== valeur)
          .map(([cle]) => cle);
        if (manquantes.length > 0) {
          throw new ErreurUsage(
            `relecture après écriture : clés absentes ou différentes (${manquantes.join(", ")}) : relancer`,
          );
        }
        console.log("→ plafonds écrits et relus.");
      }
    }
    if (plan.leverSuspension) {
      const actuel = await prisma.contentGenConfig.findUnique({ where: { key: CLE_SUSPENSION } });
      console.log(
        `Suspension actuelle : ${actuel ? JSON.stringify(actuel.value) : "(aucune)"} → sera levée`,
      );
      if (options.reel) {
        const valeur = { active: false, lifted_at: new Date().toISOString() };
        await prisma.contentGenConfig.upsert({
          where: { key: CLE_SUSPENSION },
          create: { key: CLE_SUSPENSION, value: valeur as never },
          update: { value: valeur as never },
        });
        console.log("→ suspension levée.");
      }
    }
    if (!options.reel) console.log("À sec terminé. Ajouter --reel pour écrire.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /poser-plafonds-blog-claude\.[cm]?[tj]s$/.test(process.argv[1])) {
  principal().catch((err: unknown) => {
    // Jamais l'objet brut (une erreur de connexion contient l'hôte et l'URL de la base).
    console.error(
      err instanceof ErreurUsage
        ? `Refus : ${err.message}`
        : `Échec : ${err instanceof Error ? err.message.replace(/\b\w+:\/\/\S+/g, "[url masquée]") : "erreur inconnue"}`,
    );
    process.exit(1);
  });
}
