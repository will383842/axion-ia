/**
 * TOUT CE QUI SUIT UNE PUBLICATION OU UN RETRAIT (lots W3-W4, plan PLAN-W1-W4 §7.2 et §8.4).
 *
 * Une fonction UNIQUE, appelée par `POST` et `DELETE` dans `after()` (la réponse au studio est
 * déjà partie) :
 *   1. vide le cache mémoire de `lecture.ts` ;
 *   2. `revalidateTag("videos")` et `revalidatePath` des surfaces (page, galerie, thème, série,
 *      `llms.txt`, `llms-full.txt`, index des plans du site, `sitemap-videos.xml`) ;
 *   3. purge l'edge Cloudflare sur ces mêmes adresses ;
 *   4. IndexNow sur l'URL de la PAGE.
 *
 * IndexNow est un BONUS : il prévient Bing, Yandex, Naver… PAS Google (qui découvre par le plan
 * du site et le maillage). Son échec ALERTE (console + Sentry) mais ne casse JAMAIS la
 * publication — et n'est pas un `|| true` muet (leçon du 2026-08-11, cf. `lib/indexnow.ts`).
 *
 * Chaque étape est isolée : l'échec d'une ne dispense pas les suivantes. Dépendances injectables.
 */
import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";
import { submitToIndexNow, type IndexNowResult } from "@/lib/indexnow";
import { purgerToutEdge, revalidateAndPurge } from "@/server/cache/revalidate-and-purge";
import { EXPIRATION_IMMEDIATE } from "@/server/cache/expiration-immediate";
import { THEMES } from "@/content/videos/themes";
import { redis } from "@/lib/redis";
import { viderCacheVideos } from "./lecture";

export interface EffetPublication {
  readonly type: "publication" | "retrait";
  readonly slug: string;
  readonly theme: string;
  readonly serieSlug: string | null;
}

export interface ResultatApresPublication {
  readonly indexnow: "ok" | "echec" | "non_configure";
  readonly erreurs: ReadonlyArray<string>;
}

export interface DepsApresPublication {
  viderCache?: () => void;
  revalidateTag?: (tag: string) => void;
  revalidatePath?: (chemin: string) => void;
  /** Revalide TOUTES les pages d'un gabarit de route (`revalidatePath(gabarit, "page")`). */
  revalidateGabarit?: (gabarit: string) => void;
  purgerEdge?: (chemins: ReadonlyArray<string>) => Promise<unknown>;
  /** Purge LARGE de l'edge, au retrait seulement (pages hôtes des encarts). */
  purgerEdgeLarge?: () => Promise<{ purgee: boolean; configure: boolean } | unknown>;
  /** Prend le verrou « une purge large par fenêtre de 60 s » ; `false` = déjà prise. */
  verrouPurgeLarge?: () => Promise<boolean>;
  indexNow?: (host: string, cle: string, urls: ReadonlyArray<string>) => Promise<IndexNowResult>;
  cleIndexNow?: string | undefined;
  siteUrl?: string;
  alerter?: (message: string, details: Record<string, unknown>) => void;
}

/**
 * Pages HÔTES des encarts « En vidéo » : un retrait doit les vider elles aussi, sinon la
 * vignette et le lien (vers un 410) restent servis jusqu'à l'échéance de l'ISR (24 h sur les
 * 2 157 villes). Les pages de service et la page des formations sont des adresses fixes
 * (revalidées et purgées à l'edge) ; villes, blog et fiches de formation sont des gabarits
 * (revalidés d'un coup à l'origine : une purge d'edge par adresse y dépasserait le plafond de
 * 30 URLs : leur copie d'edge est vidée par la purge LARGE du retrait, cf. `apresPublication`).
 */
export const GABARITS_HOTES: ReadonlyArray<string> = [
  "/[locale]/implantations/[region]/[ville]",
  "/[locale]/blog/[slug]",
  "/[locale]/formations/[slug]",
];

/** Chemins publics touchés par la publication ou le retrait de cette vidéo. */
export function urlsAImpacter(e: EffetPublication): string[] {
  return [
    `/fr/videos/${e.slug}`,
    "/fr/videos",
    `/fr/videos/theme/${e.theme}`,
    ...(e.serieSlug ? [`/fr/videos/serie/${e.serieSlug}`] : []),
    "/llms.txt",
    "/llms-full.txt",
    "/sitemap-index.xml",
    "/sitemap-videos.xml",
    ...THEMES.map((t) => `/fr${t.service}`),
    "/fr/formations",
    // Liste publique lue par le proxy pour le 410 (`s-maxage=300`) : purgée pour que le retrait
    // ne tarde pas.
    "/api/interne/videos/retirees",
  ];
}

const FENETRE_PURGE_LARGE_S = 60;
let dernierePurgeLargeMs = 0;

/**
 * Une purge large par fenêtre de 60 s : `SET videos:purge-large NX EX 60` (partagé entre
 * processus). Redis injoignable → repli sur un horodatage en mémoire (par processus).
 */
async function verrouPurgeLargeParDefaut(): Promise<boolean> {
  try {
    return (await redis.set("videos:purge-large", "1", "EX", FENETRE_PURGE_LARGE_S, "NX")) === "OK";
  } catch {
    const maintenant = Date.now();
    if (maintenant - dernierePurgeLargeMs < FENETRE_PURGE_LARGE_S * 1000) return false;
    dernierePurgeLargeMs = maintenant;
    return true;
  }
}

function alerteParDefaut(message: string, details: Record<string, unknown>): void {
  console.error(JSON.stringify({ event: "videos_apres_publication", message, ...details }));
  Sentry.captureMessage(message, { level: "warning", extra: details });
}

export async function apresPublication(
  effet: EffetPublication,
  deps: DepsApresPublication = {},
): Promise<ResultatApresPublication> {
  const erreurs: string[] = [];
  const etape = async (nom: string, f: () => unknown): Promise<void> => {
    try {
      await f();
    } catch (err) {
      erreurs.push(nom);
      console.error(`[videos] après ${effet.type} — étape « ${nom} » en échec :`, err);
    }
  };

  const chemins = urlsAImpacter(effet);
  const alerter = deps.alerter ?? alerteParDefaut;
  const siteUrl = (
    deps.siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://axion-ia.com"
  ).replace(/\/+$/, "");

  await etape("viderCache", () => (deps.viderCache ?? viderCacheVideos)());
  await etape("revalidateTag", () =>
    (deps.revalidateTag ?? ((t: string) => revalidateTag(t, EXPIRATION_IMMEDIATE)))("videos"),
  );
  await etape("revalidatePath", () => {
    const revalider = deps.revalidatePath ?? ((c: string) => revalidatePath(c));
    for (const c of chemins) revalider(c);
  });
  await etape("revalidateGabarits", () => {
    const revalider = deps.revalidateGabarit ?? ((g: string) => revalidatePath(g, "page"));
    for (const g of GABARITS_HOTES) revalider(g);
  });
  // Purge de l'edge APRÈS l'invalidation de l'origine (jamais l'inverse), via le helper partagé.
  await etape("purgerEdge", () =>
    deps.purgerEdge
      ? deps.purgerEdge(chemins)
      : revalidateAndPurge(chemins, () => undefined, "videos"),
  );

  // RETRAIT seulement (événement rare) : les copies d'edge des pages hôtes (2 157 villes,
  // articles, fiches — `s-maxage` jusqu'à 24 h) ne se purgent pas par adresse. Purge large,
  // après la revalidation de l'origine. Une publication ne la déclenche jamais.
  if (effet.type === "retrait") {
    let purgee = false;
    let configure: boolean | undefined;
    let sautee = false;
    await etape("purgerEdgeLarge", async () => {
      if (!(await (deps.verrouPurgeLarge ?? verrouPurgeLargeParDefaut)())) {
        sautee = true;
        console.info(
          `[videos] retrait de « ${effet.slug} » : purge large déjà faite il y a moins de ${FENETRE_PURGE_LARGE_S} s, sautée`,
        );
        return;
      }
      const r = await (deps.purgerEdgeLarge ?? (() => purgerToutEdge("videos-retrait")))();
      const rep = (r ?? {}) as { purgee?: boolean; configure?: boolean };
      purgee = rep.purgee ?? true; // un faux injecté qui ne rend rien = succès
      configure = rep.configure;
    });
    // `purgerToutEdge` ne lève jamais : un 429/403/réseau/secrets absents est un `purgee: false`.
    if (!sautee && !purgee && !erreurs.includes("purgerEdgeLarge")) {
      erreurs.push("purgerEdgeLarge");
    }
    if (!sautee && !purgee) {
      alerter(
        "Retrait : copie d'edge non purgée, la vidéo retirée peut rester visible jusqu'à 24 h",
        { slug: effet.slug, configure },
      );
    }
  }

  // IndexNow : l'URL de la page seulement.
  const cle = "cleIndexNow" in deps ? deps.cleIndexNow : process.env.INDEXNOW_KEY;
  let indexnow: ResultatApresPublication["indexnow"] = "ok";
  if (!cle) {
    indexnow = "non_configure";
    alerter("IndexNow non configuré : la vidéo n'a pas été notifiée aux moteurs", {
      slug: effet.slug,
      type: effet.type,
    });
  } else {
    try {
      const r = await (deps.indexNow ?? submitToIndexNow)(
        siteUrl.replace(/^https?:\/\//, ""),
        cle,
        [`${siteUrl}/fr/videos/${effet.slug}`],
      );
      if (!r.accepted) {
        indexnow = "echec";
        alerter("IndexNow : aucun endpoint n'a accepté la vidéo", {
          slug: effet.slug,
          type: effet.type,
          tentatives: r.attempts,
        });
      }
    } catch (err) {
      indexnow = "echec";
      alerter("IndexNow : échec inattendu", {
        slug: effet.slug,
        type: effet.type,
        erreur: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { indexnow, erreurs };
}
