import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

interface ResumeFinProps {
  readonly points: ReadonlyArray<string>;
  /** Fin du titre en italique terracotta (facultatif). */
  readonly titreEm?: ReactNode;
}

/** Résumé de fin « Ce qu'il faut retenir » (`.resume`) : numéros par compteur CSS. */
export function ResumeFin({ points, titreEm }: ResumeFinProps) {
  const t = useTranslations("articleGabarits.commun");
  if (points.length === 0) return null;
  return (
    <section className="resume" aria-labelledby="resume-fin-titre">
      <h2 className="resume__titre" id="resume-fin-titre">
        {t("resumeTitre")}
        {titreEm ? <em> {titreEm}</em> : null}
      </h2>
      <ol className="resume__liste">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </section>
  );
}
