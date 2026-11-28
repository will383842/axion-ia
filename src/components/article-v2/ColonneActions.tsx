import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CHEMIN_JOURNEE_IA, lienDiagnostic } from "@/content/journee-ia-commun";
import { ROUTES } from "@/lib/routes";

interface ColonneActionsProps {
  readonly gabarit: string;
  /** Rendu SEULEMENT si une certification Qualiopi publiée existe (jamais par défaut). */
  readonly qualiopiPublie?: boolean;
}

/**
 * UN seul `<aside aria-label="Passer à l'action">`, placé après `</article>` : carte
 * collante sur ordinateur, barre fixe à 3 cellules sur téléphone (mise en page : socle,
 * section 12). Trois actions : Diagnostic IA 45 min, Journée IA, message. Le Diagnostic
 * est en terracotta plein (la marque est terracotta ; le bleu n'est pas une couleur de
 * marque) et la Journée IA en contour. Chaque `aria-label` contient le texte visible.
 */
export function ColonneActions({ gabarit, qualiopiPublie = false }: ColonneActionsProps) {
  const t = useTranslations("articleGabarits.commun.actions");
  const rassurance = t.raw("rassurance") as ReadonlyArray<string>;
  const action = (
    cle: "diagnostic" | "journee" | "message",
    href: string,
    classe: string,
    pastille?: string,
  ) => (
    <li>
      <Link
        className={`btn ${classe} act`}
        href={href as never}
        data-cta={cle}
        aria-label={t(`${cle}.aria`)}
      >
        <span className="btn__texte">
          <span className="act__libelle">
            <span className="act__long">{t(`${cle}.long`)}</span>
            <span className="act__court">{t(`${cle}.court`)}</span>
          </span>
          <span className="btn__sous">{t(`${cle}.sous`)}</span>
        </span>
        {pastille ? (
          <span className="act__pastille" aria-hidden="true">
            {pastille}
          </span>
        ) : null}
        <span className="fleche" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
  return (
    <aside className="action" aria-label={t("aria")}>
      <div className="carte-action sur-sombre">
        <p className="carte-action__titre">
          {t("titreDebut")} <em>{t("titreEm")}</em>
        </p>
        <p className="carte-action__sous-titre">{t("sousTitre")}</p>
        <ul className="carte-action__liste">
          {action(
            "diagnostic",
            lienDiagnostic(`${gabarit}-colonne`),
            "btn--terracotta",
            t("diagnostic.pastille"),
          )}
          {action("journee", CHEMIN_JOURNEE_IA, "btn--contour")}
          {action("message", ROUTES.contact, "btn--contour")}
        </ul>
        <ul className="carte-action__rassurance">
          {rassurance.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {qualiopiPublie ? <li>{t("qualiopi")}</li> : null}
        </ul>
      </div>
    </aside>
  );
}
