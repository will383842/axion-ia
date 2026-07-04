import { getLocale } from "next-intl/server";
import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";

/**
 * Bandeau de réassurance « Organisme de formation certifié Qualiopi », rendu
 * sur TOUTES les pages publiques (placé par le layout, juste au-dessus du
 * footer). Server Component, ZÉRO JavaScript.
 *
 * Choix Web Vitals (budgets stricts : LCP ≤ 1800 ms, CLS = 0) : le bandeau est
 * positionné en BAS de page (sous le contenu, au-dessus du footer) et non en
 * tête → il ne participe ni au LCP above-the-fold ni à un décalage de mise en
 * page du contenu principal. Texte uniquement (pas le logo lourd ici, le logo
 * complet + mention vit dans le footer via `QualiopiBadge`).
 *
 * Rend `null` hors Phase B (cf. `getQualiopiPublicIdentity`).
 */
export async function QualiopiReassuranceBand() {
  const identity = await getQualiopiPublicIdentity();
  if (!identity) return null;

  const locale = await getLocale();
  const isFr = locale === "fr";

  return (
    <aside
      aria-label={isFr ? "Certification Qualiopi" : "Qualiopi certification"}
      className="bg-sage-soft text-fg border-border border-t"
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm sm:px-6 lg:px-10">
        <span data-speakable className="font-semibold">
          {isFr
            ? "Organisme de formation certifié Qualiopi"
            : "Qualiopi-certified training provider"}
        </span>
        <span aria-hidden="true" className="text-fg-muted">
          ·
        </span>
        <span className="text-fg-soft">
          {isFr ? "Catégorie : " : "Category: "}
          {identity.categoriesCertifiees}
        </span>
        {/* Décision Will : le n° de certificat n'est JAMAIS affiché publiquement. */}
      </div>
    </aside>
  );
}
