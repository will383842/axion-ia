import { useTranslations } from "next-intl";
import { CHEMIN_JOURNEE_IA } from "@/content/journee-ia-commun";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";

export type VarianteCta = "audit" | "journeeIa" | "rdv";

const CIBLES: Record<VarianteCta, string> = {
  audit: ROUTES.audit,
  journeeIa: CHEMIN_JOURNEE_IA,
  rdv: ROUTES.appel,
};

/**
 * UN seul appel à l'action par gabarit (PLAN §4.12) : libellés sans prix,
 * liens déjà utilisés par le site. Surface mocha → anneau de focus clair.
 */
export function CtaGabarit({ variante }: { readonly variante: VarianteCta }) {
  const t = useTranslations(`articleGabarits.commun.cta.${variante}`);
  return (
    <section className="art-cta art-sombre" aria-labelledby="art-cta-titre">
      <h2 id="art-cta-titre" className="art-cta-titre">
        {t("titre")}
      </h2>
      <p>{t("description")}</p>
      <Link href={CIBLES[variante] as never} className="art-cta-bouton">
        {t("bouton")}
      </Link>
    </section>
  );
}
