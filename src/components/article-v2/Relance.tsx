import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/** Relance de lecture (`.relance`) : « Pour aller plus loin : <lien> ». */
export function Relance({ children }: { readonly children: ReactNode }) {
  const t = useTranslations("articleGabarits.commun");
  return (
    <p className="relance">
      <span>
        <strong>{t("relance")}</strong> {children}
      </span>
    </p>
  );
}
