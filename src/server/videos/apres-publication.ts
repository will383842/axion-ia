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

export interface ResultatPurgeLarge {
  readonly purgee: boolean;
  readonly configure: boolean;
}

/** Verrou de fenêtre : la valeur est l'heure (ms) de DÉMARRAGE de la purge qui le tient. */
export interface VerrouPurgeLarge {
  /** Pose le verrou (60 s) si libre ; `false` = déjà pris. */
  prendre(debutMs: number): Promise<boolean>;
  /** Heure de démarrage de la purge qui tient le verrou, `null` s'il est libre. */
  debut(): Promise<number | null>;
  /** Temps restant avant la fin de la fenêtre (0 si libre). */
  ttlMs(): Promise<number>;
  /** Libère le verrou si c'est bien celui de cette purge (purge en échec). */
  liberer(debutMs: number): Promise<void>;
}

export interface DepsApresPublication {
  viderCache?: () => void;
  revalidateTag?: (tag: string) => void;
  revalidatePath?: (chemin: string) => void;
  /** Revalide TOUTES les pages d'un gabarit de route (`revalidatePath(gabarit, "page")`). */
  revalidateGabarit?: (gabarit: string) => void;
  purgerEdge?: (chemins: ReadonlyArray<string>) => Promise<unknown>;
  /** Purge LARGE de l'edge, au retrait seulement (pages hôtes des encarts). */
  purgerEdgeLarge?: () => Promise<ResultatPurgeLarge>;
  /** Verrou « une purge large par fenêtre de 60 s » (clé = heure de démarrage de la purge). */
  verrouPurgeLarge?: VerrouPurgeLarge;
  /** Attente de la fin de la fenêtre (injectable pour les tests). */
  attendre?: (ms: number) => Promise<void>;
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
const CLE_PURGE_LARGE = "videos:purge-large";
/** Tentatives max d'un retrait qui attend la fin de la fenêtre (purge, ou purge de rattrapage). */
const TENTATIVES_PURGE_LARGE = 3;
const MARGE_ATTENTE_MS = 1_000;

let repliMemoire: { debut: number; expire: number } | null = null;
const repliVivant = () => (repliMemoire && repliMemoire.expire > Date.now() ? repliMemoire : null);

/**
 * `SET videos:purge-large <debut> PX 60000 NX` (partagé entre processus). Redis injoignable →
 * repli sur un état en mémoire (par processus).
 */
const verrouPurgeLargeParDefaut: VerrouPurgeLarge = {
  async prendre(debutMs) {
    try {
      return (
        (await redis.set(
          CLE_PURGE_LARGE,
          String(debutMs),
          "PX",
          FENETRE_PURGE_LARGE_S * 1000,
          "NX",
        )) === "OK"
      );
    } catch {
      if (repliVivant()) return false;
      repliMemoire = { debut: debutMs, expire: Date.now() + FENETRE_PURGE_LARGE_S * 1000 };
      return true;
    }
  },
  async debut() {
    try {
      const v = await redis.get(CLE_PURGE_LARGE);
      return v === null ? null : Number(v);
    } catch {
      return repliVivant()?.debut ?? null;
    }
  },
  async ttlMs() {
    try {
      return Math.max(0, await redis.pttl(CLE_PURGE_LARGE));
    } catch {
      const r = repliVivant();
      return r ? r.expire - Date.now() : 0;
    }
  },
  async liberer(debutMs) {
    try {
      if ((await redis.get(CLE_PURGE_LARGE)) === String(debutMs)) await redis.del(CLE_PURGE_LARGE);
    } catch {
      if (repliMemoire?.debut === debutMs) repliMemoire = null;
    }
  },
};

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
  //
  // Une purge par fenêtre de 60 s, sans perdre de retrait : `tB` (heure du retrait, après la
  // revalidation de l'origine) est comparée à l'heure de démarrage de la purge qui tient le
  // verrou. Démarrée avant `tB`, elle n'a pas vidé ce que l'origine a régénéré depuis : on
  // attend la fin de la fenêtre et on repurge (purge de rattrapage).
  if (effet.type === "retrait") {
    const verrou = deps.verrouPurgeLarge ?? verrouPurgeLargeParDefaut;
    const attendre =
      deps.attendre ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const purger = deps.purgerEdgeLarge ?? (() => purgerToutEdge("videos-retrait"));
    const tB = Date.now();
    let couvert = false;
    let purgee = false;
    let configure: boolean | undefined;
    await etape("purgerEdgeLarge", async () => {
      for (let essai = 0; essai < TENTATIVES_PURGE_LARGE && !couvert; essai++) {
        const debut = Date.now();
        if (await verrou.prendre(debut)) {
          let r: ResultatPurgeLarge;
          try {
            r = await purger();
          } catch (err) {
            await verrou.liberer(debut);
            throw err;
          }
          configure = r.configure;
          purgee = r.purgee;
          // Purge en échec : le verrou est libéré, le retrait suivant repurge aussitôt.
          if (!r.purgee) await verrou.liberer(debut);
          couvert = true;
          return;
        }
        const tenue = await verrou.debut();
        if (tenue !== null && tenue >= tB) {
          couvert = true; // la purge qui tient le verrou a démarré après ce retrait
          purgee = true;
          console.info(
            `[videos] retrait de « ${effet.slug} » : couvert par une purge large démarrée après lui`,
          );
          return;
        }
        console.info(
          `[videos] retrait de « ${effet.slug} » : purge large en cours (démarrée avant ce retrait), purge de rattrapage à la fin de la fenêtre`,
        );
        await attendre((await verrou.ttlMs()) + MARGE_ATTENTE_MS);
      }
    });
    if (!couvert && !erreurs.includes("purgerEdgeLarge")) erreurs.push("purgerEdgeLarge");
    // `purgerToutEdge` ne lève jamais : un 429/403/réseau/secrets absents est un `purgee: false`.
    if (!purgee) {
      if (!erreurs.includes("purgerEdgeLarge")) erreurs.push("purgerEdgeLarge");
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
