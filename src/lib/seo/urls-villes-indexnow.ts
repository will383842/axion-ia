import { getIndexableVilles, isVilleIndexable } from "@/content/villes";

/**
 * URL des pages ville signalées à IndexNow : uniquement les villes de la liste
 * `villes-indexees.ts` (`isVilleIndexable`), jamais les pages service × ville
 * (toutes en `noindex, follow` depuis le 18/11/2026).
 */
export function urlsVillesIndexNow(siteUrl: string, locales: ReadonlyArray<"fr" | "en">): string[] {
  const urls: string[] = [];
  for (const ville of getIndexableVilles().filter((v) => isVilleIndexable(v.slug))) {
    for (const locale of locales) {
      const segment = locale === "fr" ? "implantations" : "locations";
      urls.push(`${siteUrl}/${locale}/${segment}/${ville.region}/${ville.slug}`);
    }
  }
  return urls;
}
