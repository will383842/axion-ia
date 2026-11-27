// Server Component, aucun JS client — V2-11 (GEO) : « Mis à jour le … » visible.
//
// La date vient du contenu (`dateAfficheeDeChemin`, même source que le `dateModified`
// JSON-LD et le `<lastmod>` du sitemap), jamais de `new Date()`. Soit `chemin` (route
// statique connue), soit `date` (AAAA-MM-JJ portée par le contenu : champ `updatedAt`,
// constante datée). Sans date exploitable, le composant ne rend rien.
//
// Ce n'est PAS une mention de relecture : « mis à jour » ne dit rien d'une relecture
// humaine (voir V2-17).

import { Container } from "@/components/layout/Container";
import { dateAfficheeDeChemin, formaterDateAffichee } from "@/lib/seo/date-affichee";

interface Props {
  locale: string;
  /** Chemin localisé de la route statique, tel que passé aux fabriques JSON-LD. */
  chemin?: string;
  /** Date ISO (AAAA-MM-JJ ou ISO complet) tenue par le contenu, prioritaire. */
  date?: string | Date | null;
  /** Enveloppe en `Container` (pages sans conteneur propre en pied de page). */
  contenu?: boolean;
}

export function MisAJourLe({ locale, chemin, date, contenu = true }: Props) {
  const brut = date instanceof Date ? date.toISOString() : date;
  const jour = brut ? brut.slice(0, 10) : chemin ? dateAfficheeDeChemin(chemin, locale) : undefined;
  if (!jour || Number.isNaN(new Date(`${jour}T00:00:00Z`).getTime())) return null;
  const p = (
    <p className="text-fg-soft py-4 text-sm">
      {locale === "fr" ? "Mis à jour le" : "Updated"}{" "}
      <time dateTime={jour}>{formaterDateAffichee(jour, locale)}</time>
    </p>
  );
  return contenu ? <Container>{p}</Container> : p;
}
