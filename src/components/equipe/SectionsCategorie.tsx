import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { jetonsDe, varCss } from "./couleurs-categorie";

/**
 * Sections propres à la catégorie (registre `modeles-categorie.ts`) : un H2 par section.
 * Une section sans paragraphe ni liste n'est pas rendue (jamais de titre vide).
 */
export function SectionsCategorie({
  fiche,
  sections,
}: {
  fiche: FichePublique;
  sections: NonNullable<ContenuFiche["sectionsCategorie"]>;
}) {
  const { fort, forme } = jetonsDe(fiche.categorie);
  const utiles = sections.filter((s) => s.paragraphes.length > 0 || (s.liste?.length ?? 0) > 0);
  return (
    <>
      {utiles.map((s) => (
        <Section key={s.id} title={s.titre}>
          <div className="max-w-4xl" style={{ borderLeft: `3px solid ${varCss(forme)}` }}>
            <div className="pl-6">
              {s.paragraphes.map((p) => (
                <p key={p} className="text-fg-soft mb-4 text-lg leading-relaxed last:mb-0">
                  {p}
                </p>
              ))}
              {s.liste && s.liste.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2" role="list">
                  {s.liste.map((c) => (
                    <li
                      key={c}
                      className="border-border bg-paper text-fg rounded-full border px-3 py-1 text-sm"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.lien ? (
                <p className="mt-6">
                  <Link
                    href={s.lien.href as never}
                    className="font-semibold underline underline-offset-4"
                    style={{ color: varCss(fort) }}
                  >
                    {s.lien.libelle}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </Section>
      ))}
    </>
  );
}
