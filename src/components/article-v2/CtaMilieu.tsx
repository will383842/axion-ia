import { useId } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CHEMIN_JOURNEE_IA, lienDiagnostic } from "@/content/journee-ia-commun";
import { ROUTES } from "@/lib/routes";

export type PrincipalCta = "diagnostic" | "journee";
export type SecondaireCta = PrincipalCta | "message";

interface CtaMilieuProps {
  readonly gabarit: string;
  /** Bouton principal selon le gabarit (PLAN §15.3) ; l'autre devient le lien. */
  readonly principal?: PrincipalCta;
  /** Lien secondaire (défaut : l'autre bouton principal). */
  readonly secondaire?: SecondaireCta;
  /** Lien secondaire libre propre au gabarit (prime sur `secondaire`), déjà traduit. */
  readonly lienSecondaire?: { readonly label: string; readonly href: string };
  /** Titre et texte propres au gabarit, déjà traduits (défaut : ceux de `commun`). */
  readonly titre?: string;
  readonly texte?: string;
}

/**
 * Encart d'appel à l'action du milieu d'article (socle, section 19) : titre en `<p>` (jamais
 * un `<h2>` : hors sommaire), un bouton et un lien. Sans prix.
 */
export function CtaMilieu({
  gabarit,
  principal = "diagnostic",
  secondaire,
  lienSecondaire,
  titre,
  texte,
}: CtaMilieuProps) {
  const id = `${useId()}-titre`;
  const t = useTranslations("articleGabarits.commun");
  const a = useTranslations("articleGabarits.commun.actions");
  const hrefs = {
    diagnostic: lienDiagnostic(`${gabarit}-milieu`),
    journee: CHEMIN_JOURNEE_IA,
    message: ROUTES.contact,
  } as const;
  const autre: SecondaireCta =
    secondaire ?? (principal === "diagnostic" ? "journee" : "diagnostic");
  return (
    <aside className="cta-milieu" aria-labelledby={id}>
      <p className="cta-milieu__titre" id={id}>
        {titre ?? t("ctaMilieu.titre")}
      </p>
      <p>{texte ?? t("ctaMilieu.texte")}</p>
      <div className="cta-milieu__actions">
        <Link className="btn btn--terracotta" href={hrefs[principal] as never} data-cta={principal}>
          {a(`${principal}.long`)}
        </Link>
        {lienSecondaire ? (
          <Link className="lien-fleche" href={lienSecondaire.href as never}>
            {lienSecondaire.label} →
          </Link>
        ) : (
          <Link className="lien-fleche" href={hrefs[autre] as never} data-cta={autre}>
            {a(`${autre}.long`)} →
          </Link>
        )}
      </div>
    </aside>
  );
}
