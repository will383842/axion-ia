import { revalidatePath } from "next/cache";

/**
 * Invalide ce que le public voit d'une fiche : la fiche, le hub et le sitemap.
 * À appeler après toute publication, tout retrait, tout interrupteur de carte et toute modification
 * d'une fiche publiée : sans cela, une URL vue avant publication garde un 404 en cache 24 h et un
 * retrait ne serait pas immédiat.
 */
export function revaliderFicheEquipe(slug: string): void {
  revalidatePath(`/fr/equipe/${slug}`);
  revalidatePath("/fr/equipe");
  revalidatePath("/sitemap.xml");
}
