import { useId } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { CHEMIN_JOURNEE_IA, lienDiagnostic } from "@/content/journee-ia-commun";

export type PrincipalCta = "diagnostic" | "journee";

interface CtaMilieuProps {
  readonly gabarit: string;
  /** Bouton principal selon le gabarit (PLAN §15.3) ; l'autre devient le lien. */
  readonly principal?: PrincipalCta;
  /** Lien secondaire : l'autre bouton (défaut) ou « Écrire un message » (Comparatif). */
  readonly secondaire?: "autre" | "message";
}

/**
 * Encart d'appel à l'action du milieu d'article (socle, section 19) : titre en `<p>` (jamais
 * un `<h2>` : hors sommaire), un bouton et un lien. Sans prix.
 */
export function CtaMilieu({
  gabarit,
  principal = "diagnostic",
  secondaire = "autre",
}: CtaMilieuProps) {
  const id = `${useId()}-titre`;
  const t = useTranslations("articleGabarits.commun");
  const a = useTranslations("articleGabarits.commun.actions");
  const hrefs = {
    diagnostic: lienDiagnostic(`${gabarit}-milieu`),
    journee: CHEMIN_JOURNEE_IA,
  } as const;
  const autre: PrincipalCta | "message" =
    secondaire === "message" ? "message" : principal === "diagnostic" ? "journee" : "diagnostic";
  const hrefAutre = autre === "message" ? ROUTES.contact : hrefs[autre];
  return (
    <aside className="cta-milieu" aria-labelledby={id}>
      <p className="cta-milieu__titre" id={id}>
        {t("ctaMilieu.titre")}
      </p>
      <p>{t("ctaMilieu.texte")}</p>
      <div className="cta-milieu__actions">
        <Link className="btn btn--terracotta" href={hrefs[principal] as never} data-cta={principal}>
          {a(`${principal}.long`)}
        </Link>
        <Link className="lien-fleche" href={hrefAutre as never} data-cta={autre}>
          {a(`${autre}.long`)} →
        </Link>
      </div>
    </aside>
  );
}
