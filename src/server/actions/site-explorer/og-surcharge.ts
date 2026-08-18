/**
 * Écriture des surcharges d'aperçu depuis la console.
 *
 * 🔑 ENREGISTRER NE SUFFIT PAS — IL FAUT QUE LA PAGE REPARTE.
 *
 * Une page pré-rendue au build reste figée : écrire en base sans régénérer
 * donnerait un formulaire qui dit « enregistré » pendant que le site continue
 * de servir l'ancien aperçu. C'est exactement le défaut qu'on vient de
 * corriger sur le champ « URL de l'image OG » du blog — on ne va pas le
 * réintroduire au niveau supérieur.
 *
 * Trois invalidations, dans cet ordre, chacune nécessaire :
 *   1. le cache mémoire du chargeur (sinon le process qui vient d'écrire
 *      servirait encore l'ancienne valeur pendant 30 s) ;
 *   2. le cache de rendu Next (`revalidatePath`) — vérifié le 2026-08-17 sur
 *      une application Next 16.3.0 minimale : il régénère bien une page SSG
 *      sans `revalidate`, et sa variante `"page"` régénère toute une famille ;
 *   3. le cache Cloudflare (`revalidateAndPurge`), sans quoi l'edge sert
 *      l'ancienne page jusqu'à expiration de son `s-maxage`.
 */

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { revalidateAndPurge } from "@/server/cache/revalidate-and-purge";
import { oublierSurchargesOg } from "@/server/seo/og-overrides";
// Helper PUR, hébergé hors de ce module : `"use server"` interdit d'exporter
// autre chose que des fonctions `async` (cf. en-tête de chemin-de-route.ts).
import { cheminDeRoute } from "@/server/seo/chemin-de-route";
import { requireAdminWrite } from "./_guards";

export interface EntreeSurcharge {
  readonly portee: "route" | "modele";
  /** Chemin visé, préfixe de locale inclus. */
  readonly cible: string;
  readonly ogTitle?: string | null;
  readonly ogDescription?: string | null;
  readonly ogImage?: string | null;
  readonly ogImageWidth?: number | null;
  readonly ogImageHeight?: number | null;
  readonly ogEyebrow?: string | null;
  readonly note?: string | null;
}

export interface ResultatSurcharge {
  readonly ok: boolean;
  readonly message: string;
  /** Chemins effectivement régénérés — dit, jamais supposé. */
  readonly regeneres: readonly string[];
  /** URLs purgées de l'edge. Peut être vide sur une portée `modele`. */
  readonly purgees: readonly string[];
  readonly avertissement?: string;
}

/** `null` pour une chaîne vide : « effacé » et « jamais renseigné » se valent ici. */
function vide(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

export async function enregistrerSurchargeOg(entree: EntreeSurcharge): Promise<ResultatSurcharge> {
  const session = await requireAdminWrite();

  const cible = entree.cible.trim();
  if (!cible.startsWith("/")) {
    return { ok: false, message: "La cible doit commencer par « / ».", regeneres: [], purgees: [] };
  }

  // 🔑 Une image de partage DOIT être une URL absolue : aucun robot social ne
  // résout un chemin relatif. Même exigence que la garde du feuilletoir.
  const image = vide(entree.ogImage);
  if (image && !/^https?:\/\//i.test(image)) {
    return {
      ok: false,
      message:
        "L'image doit être une URL absolue (https://…) : les réseaux ne résolvent pas un chemin relatif.",
      regeneres: [],
      purgees: [],
    };
  }

  // Dimensions : les deux ou aucune. Une seule ne décrit rien et ferait
  // déclarer un nombre inventé.
  const l = entree.ogImageWidth ?? null;
  const h = entree.ogImageHeight ?? null;
  if ((l === null) !== (h === null)) {
    return {
      ok: false,
      message: "Renseigner la largeur ET la hauteur, ou aucune des deux.",
      regeneres: [],
      purgees: [],
    };
  }

  const donnees = {
    ogTitle: vide(entree.ogTitle),
    ogDescription: vide(entree.ogDescription),
    ogImage: image,
    ogImageWidth: l,
    ogImageHeight: h,
    ogEyebrow: vide(entree.ogEyebrow),
    note: vide(entree.note),
    actif: true,
    updatedBy: session.userId,
  };

  await prisma.ogOverride.upsert({
    where: { portee_cible: { portee: entree.portee, cible } },
    create: { portee: entree.portee, cible, ...donnees, createdBy: session.userId },
    update: donnees,
  });

  return propager(entree.portee, cible, "Surcharge enregistrée.");
}

export async function retirerSurchargeOg(
  portee: "route" | "modele",
  cible: string,
): Promise<ResultatSurcharge> {
  await requireAdminWrite();

  // Suppression franche : une surcharge retirée doit rendre la page à son
  // calcul d'origine, pas la laisser dans un état intermédiaire.
  await prisma.ogOverride
    .delete({ where: { portee_cible: { portee, cible } } })
    .catch(() => undefined);

  return propager(portee, cible, "Surcharge retirée — la page revient à son aperçu calculé.");
}

async function propager(
  portee: "route" | "modele",
  cible: string,
  message: string,
): Promise<ResultatSurcharge> {
  oublierSurchargesOg();

  if (portee === "route") {
    // `revalidateAndPurge` fait les deux étages : origine puis edge. On lui
    // passe `revalidatePath` plutôt que de l'appeler nous-mêmes, pour ne pas
    // revalider deux fois et pour hériter de sa journalisation.
    const invalidation = await revalidateAndPurge([cible], revalidatePath, "surcharge-og");
    return {
      ok: true,
      message,
      regeneres: invalidation.cheminsRevalides,
      purgees: invalidation.urlsPurgees,
      ...(invalidation.edgeConfigure
        ? {}
        : {
            avertissement:
              "Cloudflare n'est pas configuré dans cet environnement : l'origine est " +
              "régénérée, l'edge ne l'est pas. En production, les deux le sont.",
          }),
    };
  }

  // Portée `modele` : une seule régénération couvre toute la famille.
  const routeFichier = cheminDeRoute(cible);
  revalidatePath(routeFichier, "page");

  // ⚠️ L'EDGE N'EST PAS PURGÉ POUR TOUTE LA FAMILLE, et c'est dit.
  //
  // Cloudflare plafonne les purges par URL (30 par appel sur le plan gratuit,
  // cf. `revalidate-and-purge.ts`). Une famille peut compter 10 162 pages : les
  // énumérer serait impossible, et purger tout le site pour une vignette serait
  // disproportionné. L'origine est régénérée immédiatement ; l'edge se remet à
  // jour à l'expiration de son `s-maxage`. Le dire vaut mieux que laisser
  // croire à un effet immédiat partout.
  return {
    ok: true,
    message,
    regeneres: [routeFichier],
    purgees: [],
    avertissement:
      "Régénération faite à l'origine pour tout le modèle. Le cache Cloudflare, lui, " +
      "n'est pas purgé page par page (plafond de 30 URLs) : les pages déjà en cache " +
      "afficheront l'ancien aperçu jusqu'à expiration de leur s-maxage.",
  };
}
