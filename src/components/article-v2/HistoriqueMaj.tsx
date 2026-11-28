import { useTranslations } from "next-intl";

export interface EntreeHistorique {
  readonly dateIso: string;
  readonly dateLisible: string;
  readonly resume: string;
}

/** Historique des mises à jour (`.historique`), rendu seulement s'il existe des entrées réelles. */
export function HistoriqueMaj({ entrees }: { readonly entrees: ReadonlyArray<EntreeHistorique> }) {
  const t = useTranslations("articleGabarits.commun");
  if (entrees.length === 0) return null;
  return (
    <details className="historique" data-aeo="update-history">
      <summary>{t("historique")}</summary>
      <ul>
        {entrees.map((e) => (
          <li key={e.dateIso}>
            <time dateTime={e.dateIso}>{e.dateLisible}</time> : {e.resume}
          </li>
        ))}
      </ul>
    </details>
  );
}
