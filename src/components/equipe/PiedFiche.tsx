import { Link } from "@/i18n/navigation";
import type { LienFiche } from "@/lib/equipe";
import { Container } from "@/components/layout/Container";

/** Liens du pied de fiche quand la fiche n'en déclare pas (chaque href existe dans le routage). */
export const LIENS_PIED_PAR_DEFAUT: ReadonlyArray<LienFiche> = [
  { href: "/equipe", libelle: "Toute l'équipe" },
  { href: "/journee-ia", libelle: "La Journée IA" },
  { href: "/implementation", libelle: "Les implémentations IA" },
  { href: "/formations", libelle: "Les formations" },
];

/**
 * Pied de fiche : maillage interne vers les pages d'offre et le hub de l'équipe. La date
 * « Mis à jour le » est dans le héros (`<time>`), pas répétée ici. Aucun titre : un `nav` nommé.
 */
export function PiedFiche({ liens }: { liens?: ReadonlyArray<LienFiche> | undefined }) {
  const utiles = (liens && liens.length > 0 ? liens : LIENS_PIED_PAR_DEFAUT).filter(
    (l) => l.href !== "/appel" && l.href !== "/contact",
  );
  if (utiles.length === 0) return null;
  return (
    <nav aria-label="Pour aller plus loin" data-fond="clair" className="bg-bg py-10">
      <Container>
        <ul role="list" className="flex flex-wrap gap-3">
          {utiles.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href as never}
                className="border-border-strong bg-paper text-fg hover:text-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {l.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
