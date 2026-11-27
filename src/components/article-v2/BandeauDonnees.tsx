import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";

interface BandeauDonneesProps {
  /** Date du relevé (AAAA-MM-JJ) : sans elle, le bandeau n'est pas rendu. */
  readonly dateIso: string | null | undefined;
  /** Date lisible, déjà formatée pour la langue. */
  readonly dateLisible: string;
}

/**
 * Bandeau « Données au <date> » + lien vers l'Observatoire. Rendu SEULEMENT si
 * la date du relevé est disponible : jamais de date ni de chiffre devinés.
 */
export function BandeauDonnees({ dateIso, dateLisible }: BandeauDonneesProps) {
  const t = useTranslations("articleGabarits.commun");
  if (!dateIso) return null;
  return (
    <p className="encadre encadre--saviez">
      {t.rich("donneesAu", {
        date: dateLisible,
        dateBalise: (morceaux) => <time dateTime={dateIso}>{morceaux}</time>,
      })}{" "}
      <Link href={ROUTES.barometre as never}>{t("voirObservatoire")}</Link>
    </p>
  );
}
