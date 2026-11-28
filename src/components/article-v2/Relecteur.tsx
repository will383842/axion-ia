import { useTranslations } from "next-intl";

interface RelecteurProps {
  /** Relecteur RÉEL enregistré : sans nom, rien n'est rendu (jamais de nom générique). */
  readonly nom: string | null | undefined;
  readonly fonction?: string | null;
  readonly dateIso?: string | null;
  readonly dateLisible?: string | null;
}

/** Bloc « Relu et validé par » (`.relu`), rendu seulement si la donnée existe. */
export function Relecteur({ nom, fonction, dateIso, dateLisible }: RelecteurProps) {
  const t = useTranslations("articleGabarits.commun");
  if (!nom) return null;
  return (
    <p className="relu" data-aeo="reviewer">
      <span>
        <strong>{t("relu")}</strong> {nom}
        {fonction ? `, ${fonction}` : null}
        {dateIso && dateLisible ? (
          <>
            {", "}
            <time dateTime={dateIso}>{dateLisible}</time>
          </>
        ) : null}
        .
      </span>
    </p>
  );
}
