import { useId } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CHEMIN_JOURNEE_IA, lienDiagnostic } from "@/content/journee-ia-commun";

export type PrincipalCta = "diagnostic" | "journee";

/** Lien secondaire personnalisé (ex. « Le glossaire complet »), libellé déjà traduit. */
export interface LienSecondairePerso {
  readonly href: string;
  readonly libelle: string;
  readonly code: string;
}
export type LienSecondaire = LienSecondairePerso;

interface CtaMilieuProps {
  readonly gabarit: string;
  /** Bouton principal selon le gabarit (PLAN §15.3) ; l'autre devient le lien. */
  readonly principal?: PrincipalCta;
  /** Remplace le lien « l'autre bouton » par un lien propre au gabarit. */
  readonly secondaire?: LienSecondairePerso | undefined;
}

/**
 * Encart d'appel à l'action du milieu d'article (socle, section 19) : titre en `<p>` (jamais
 * un `<h2>` : hors sommaire), un bouton et un lien. Sans prix.
 */
export function CtaMilieu({ gabarit, principal = "diagnostic", secondaire }: CtaMilieuProps) {
  const id = `${useId()}-titre`;
  const t = useTranslations("articleGabarits.commun");
  const a = useTranslations("articleGabarits.commun.actions");
  const hrefs = {
    diagnostic: lienDiagnostic(`${gabarit}-milieu`),
    journee: CHEMIN_JOURNEE_IA,
  } as const;
  const autre: PrincipalCta = principal === "diagnostic" ? "journee" : "diagnostic";
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
        <Link
          className="lien-fleche"
          href={(secondaire ? secondaire.href : hrefs[autre]) as never}
          data-cta={secondaire ? secondaire.code : autre}
        >
          {secondaire ? secondaire.libelle : a(`${autre}.long`)} →
        </Link>
      </div>
    </aside>
  );
}
