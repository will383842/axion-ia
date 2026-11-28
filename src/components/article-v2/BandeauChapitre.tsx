import { useTranslations } from "next-intl";

interface BandeauChapitreProps {
  /** Position du chapitre (1, 2…), identique à `step.position`. */
  readonly numero: number;
  readonly total: number;
  /** Minutes estimées du chapitre, et minutes restantes (ce chapitre compris). */
  readonly minutes: number;
  readonly minutesRestantes: number;
  /** Avancement 0-100 à la fin de ce chapitre (décor). */
  readonly progression: number;
  readonly titre: string;
}

/**
 * Bandeau d'un chapitre (`.chapitre__bandeau`), mocha ou terracotta en alternance : « Chapitre
 * n sur N », durée, temps restant, barre de progression (décor), titre en `<h2 id="step-n">`
 * (l'ancre du sommaire de la V1). Le chiffre géant est un décor `aria-hidden`. Composant
 * serveur, zéro JS.
 */
export function BandeauChapitre({
  numero,
  total,
  minutes,
  minutesRestantes,
  progression,
  titre,
}: BandeauChapitreProps) {
  const t = useTranslations("articleGabarits.guide-pilier.chapitre");
  const terracotta = numero % 2 === 0;
  return (
    <div
      className={
        terracotta
          ? "chapitre__bandeau chapitre__bandeau--terracotta sur-terracotta"
          : "chapitre__bandeau sur-sombre"
      }
    >
      <span className="chapitre__numero" aria-hidden="true">
        {numero}
      </span>
      <p className="chapitre__position">
        <span>{t("position", { numero, total })}</span>
        <span className="chapitre__duree">{t("duree", { minutes })}</span>
        <span className="chapitre__reste">
          {numero === total ? t("dernier") : t("reste", { minutes: minutesRestantes })}
        </span>
      </p>
      <span
        className="chapitre__barre"
        style={{ "--p": `${progression}%` } as React.CSSProperties}
        aria-hidden="true"
      />
      <h2 id={`step-${numero}`} data-speakable="true">
        {titre}
      </h2>
    </div>
  );
}
