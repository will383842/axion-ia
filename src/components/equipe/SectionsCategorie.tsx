import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CATEGORIES } from "@/lib/equipe";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { jetonsDe, varCss } from "./couleurs-categorie";
import { SectionFiche } from "./visuels/SectionFiche";

/**
 * Sections propres à la catégorie (registre `modeles-categorie.ts`) : un H2 en question par
 * section (`entetes[id]`, à défaut le titre du registre). Une section sans paragraphe ni liste
 * n'est pas rendue (jamais de titre vide). Fonds clairs en alternance ; compétences en pastilles
 * à icône de la couleur de la catégorie ; lien de section en bouton-lien.
 */
export function SectionsCategorie({
  fiche,
  sections,
  entetes,
}: {
  fiche: FichePublique;
  sections: NonNullable<ContenuFiche["sectionsCategorie"]>;
  entetes?: ContenuFiche["entetes"];
}) {
  const { fort } = jetonsDe(fiche.categorie);
  const utiles = sections.filter((s) => s.paragraphes.length > 0 || (s.liste?.length ?? 0) > 0);
  const surTitreDefaut = CATEGORIES[fiche.categorie].libelleSingulier;
  return (
    <>
      {utiles.map((s, i) => {
        const e = entetes?.[s.id];
        const entete = {
          surTitre: e?.surTitre || surTitreDefaut,
          question: e?.question || s.titre,
          ...(e?.reponse ? { reponse: e.reponse } : {}),
        };
        return (
          <SectionFiche key={s.id} id={s.id} ton={i % 2 === 0 ? "ivoire" : "creme"} entete={entete}>
            <div className="max-w-3xl">
              {s.paragraphes.map((p) => (
                <p key={p} className="text-fg-soft mb-4 text-lg leading-relaxed last:mb-0">
                  {p}
                </p>
              ))}
              {s.liste && s.liste.length > 0 ? (
                <ul className="mt-6 flex flex-wrap gap-2.5" role="list">
                  {s.liste.map((c) => (
                    <li
                      key={c}
                      className="border-border-strong bg-paper text-fg inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-medium"
                    >
                      <Sparkles
                        aria-hidden="true"
                        focusable="false"
                        className="h-4 w-4"
                        style={{ color: varCss(fort) }}
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.lien ? (
                <p className="mt-8">
                  <Link
                    href={s.lien.href as never}
                    className="border-border-strong bg-paper text-fg focus-visible:outline-terracotta inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-base font-semibold hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition"
                  >
                    {s.lien.libelle}
                    <ArrowRight
                      aria-hidden="true"
                      focusable="false"
                      className="h-4 w-4"
                      style={{ color: varCss(fort) }}
                    />
                  </Link>
                </p>
              ) : null}
            </div>
          </SectionFiche>
        );
      })}
    </>
  );
}
