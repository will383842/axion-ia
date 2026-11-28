import type { ContenuFiche } from "@/lib/equipe";
import { SectionFiche } from "./visuels/SectionFiche";
import type { EnteteProp } from "./BlocsTransformation";

/** Constats de terrain : la première citation en grand, les autres en grille, sur fond foncé. */
export function CitationsTerrain({
  donnees,
  entete,
  auteur,
  id = "constats",
}: {
  donnees: NonNullable<ContenuFiche["citations"]>;
  entete?: EnteteProp;
  /** Prénom seul pour un collaborateur ; nom complet pour Williams Jullin. */
  auteur: string;
  id?: string;
}) {
  const [premiere, ...autres] = donnees.items;
  if (!premiere) return null;
  return (
    <SectionFiche
      id={id}
      ton="fonce"
      entete={entete ?? { surTitre: "Sur le terrain", question: donnees.titre }}
    >
      <figure className="max-w-4xl">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 64 64"
          className="text-terracotta-on-mocha size-16"
          fill="currentColor"
        >
          <path d="M8 36c0-12 6-22 20-26l2 5c-8 3-11 8-11 13h9v18H8V36zm28 0c0-12 6-22 20-26l2 5c-8 3-11 8-11 13h9v18H36V36z" />
        </svg>
        <blockquote className="text-mocha-fg mt-2 font-serif text-[clamp(1.5rem,3vw,2.25rem)] leading-snug italic">
          <p>«&nbsp;{premiere}&nbsp;»</p>
        </blockquote>
        <figcaption className="text-mocha-fg mt-4 text-base">
          <cite className="not-italic">{auteur}</cite>
        </figcaption>
      </figure>
      {autres.length > 0 ? (
        <ul role="list" className="mt-12 grid gap-8 lg:grid-cols-2">
          {autres.map((c) => (
            <li key={c}>
              <figure className="h-full">
                <blockquote className="border-terracotta-on-mocha text-mocha-fg h-full border-l-4 pl-5 text-lg leading-relaxed">
                  <p>«&nbsp;{c}&nbsp;»</p>
                </blockquote>
                <figcaption className="text-mocha-fg mt-3 pl-6 text-base">
                  <cite className="not-italic">{auteur}</cite>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionFiche>
  );
}
