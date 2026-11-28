import { useId } from "react";
import { useTranslations } from "next-intl";

interface TriptyqueActualiteProps {
  /** « Point clé » existant (`Article.keyTakeaway`) : première carte, « Ce qui change ». */
  readonly ceQuiChange: string | null | undefined;
  /** Seulement si la donnée existe : jamais déduite du texte. */
  readonly pourQui?: string | null;
  readonly queFaire?: ReadonlyArray<string>;
}

/**
 * Triptyque « Ce qui change / Pour qui / Que faire maintenant » : le point clé de
 * l'actualité en cartes colorées. Chaque carte n'est rendue que si sa donnée existe : le
 * gabarit n'invente rien (PLAN §1.7). Sans point clé, aucun bloc. `data-aeo="key-point"`
 * est conservé (extraction par bloc autonome). Composant serveur, zéro JS.
 */
export function TriptyqueActualite({ ceQuiChange, pourQui, queFaire }: TriptyqueActualiteProps) {
  const id = `${useId()}-titre`;
  const t = useTranslations("articleGabarits.actualite.triptyque");
  const changement = ceQuiChange?.trim() ?? "";
  if (changement.length === 0) return null;
  const qui = pourQui?.trim() ?? "";
  const etapes = (queFaire ?? []).filter((e) => e.trim().length > 0);
  return (
    <section className="triptyque" aria-labelledby={id} data-aeo="key-point">
      <div className="triptyque__entete">
        <p className="triptyque__titre" id={id}>
          {t("titre")}
        </p>
      </div>
      <ol className="triptyque__liste">
        <li className="triptyque__carte">
          <p className="triptyque__libelle">{t("changement")}</p>
          <p data-answer>{changement}</p>
        </li>
        {qui ? (
          <li className="triptyque__carte triptyque__carte--qui">
            <p className="triptyque__libelle">{t("pourQui")}</p>
            <p>{qui}</p>
          </li>
        ) : null}
        {etapes.length > 0 ? (
          <li className="triptyque__carte triptyque__carte--faire">
            <p className="triptyque__libelle">{t("queFaire")}</p>
            <ol>
              {etapes.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ol>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
