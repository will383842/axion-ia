import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CHEMIN_JOURNEE_IA, lienDiagnostic } from "@/content/journee-ia-commun";
import { ROUTES } from "@/lib/routes";

/**
 * Appel de fin (socle, section 19) : bloc mocha, trois actions, déroulé du Diagnostic en
 * trois étapes, réassurance factuelle. Hors `<article>`. Sans prix.
 */
export function CtaFin({ gabarit }: { readonly gabarit: string }) {
  const t = useTranslations("articleGabarits.commun");
  const a = useTranslations("articleGabarits.commun.actions");
  const etapes = t.raw("ctaFin.etapes") as ReadonlyArray<string>;
  const rassurance = a.raw("rassurance") as ReadonlyArray<string>;
  return (
    <section className="cta-fin sur-sombre" aria-labelledby="cta-fin-titre">
      <p className="pastille pastille--pleine cta-fin__surtitre">{t("ctaFin.surtitre")}</p>
      <h2 className="cta-fin__titre" id="cta-fin-titre">
        {t("ctaFin.titre")}
      </h2>
      <p className="cta-fin__phrase">{t("ctaFin.texte")}</p>
      <ul className="cta-fin__actions">
        <li>
          <Link
            className="btn btn--terracotta"
            href={lienDiagnostic(`${gabarit}-fin`) as never}
            data-cta="diagnostic"
          >
            {t("ctaFin.diagnostic")}
          </Link>
        </li>
        <li>
          <Link
            className="btn btn--contour-clair"
            href={CHEMIN_JOURNEE_IA as never}
            data-cta="journee"
          >
            {t("ctaFin.journee")}
          </Link>
        </li>
        <li>
          <Link
            className="btn btn--contour-clair"
            href={ROUTES.contact as never}
            data-cta="message"
          >
            {t("ctaFin.message")}
          </Link>
        </li>
      </ul>
      <ol className="deroule" aria-label={t("ctaFin.etapesTitre")}>
        {etapes.map((e) => (
          <li key={e}>
            <strong>{e}</strong>
          </li>
        ))}
      </ol>
      <ul className="rassurance">
        {rassurance.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}
