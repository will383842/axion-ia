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
import { revalidateAndPurge } from "@/server/cache/revalidate-and-purge";
import { EXPIRATION_IMMEDIATE } from "@/server/cache/expiration-immediate";
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
  purgerEdge?: (chemins: ReadonlyArray<string>) => Promise<unknown>;
  indexNow?: (host: string, cle: string, urls: ReadonlyArray<string>) => Promise<IndexNowResult>;
  cleIndexNow?: string | undefined;
  siteUrl?: string;
  alerter?: (message: string, details: Record<string, unknown>) => void;
}

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
    // Liste publique lue par le proxy pour le 410 (`s-maxage=300`) : purgée pour que le retrait
    // ne tarde pas.
    "/api/interne/videos/retirees",
  ];
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
  // Purge de l'edge APRÈS l'invalidation de l'origine (jamais l'inverse), via le helper partagé.
  await etape("purgerEdge", () =>
    deps.purgerEdge
      ? deps.purgerEdge(chemins)
      : revalidateAndPurge(chemins, () => undefined, "videos"),
  );

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
