import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { EnteteQuestion } from "./EnteteQuestion";

/** Halo terracotta seul (jamais le halo bleu des fonds foncés du site). */
export const HALO_TERRACOTTA = {
  backgroundImage: "radial-gradient(at 85% 15%, rgba(194, 74, 27, 0.22) 0px, transparent 55%)",
} as const;

export type TonSection = "ivoire" | "creme" | "papier" | "fonce" | "terracotta";

const FOND: Record<TonSection, { classes: string; data: "clair" | "fonce" | "terracotta" }> = {
  ivoire: { classes: "bg-bg text-fg", data: "clair" },
  creme: { classes: "bg-sand text-fg", data: "clair" },
  papier: { classes: "bg-paper text-fg", data: "clair" },
  fonce: { classes: "bg-mocha text-mocha-fg", data: "fonce" },
  terracotta: { classes: "bg-terracotta-deep text-mocha-fg", data: "terracotta" },
};

/**
 * Section de la fiche : fond, espacement, `data-fond` (lu par le test d'enchaînement des fonds)
 * et, si fournie, l'en-tête en question. Sans en-tête, `aria-labelledby` n'est pas posé.
 */
export function SectionFiche({
  id,
  ton = "ivoire",
  entete,
  className,
  children,
}: {
  id: string;
  ton?: TonSection;
  entete?: { surTitre: string; question: string; reponse?: string };
  className?: string;
  children: ReactNode;
}) {
  const fond = FOND[ton];
  return (
    <section
      id={id}
      aria-labelledby={entete ? `${id}-titre` : undefined}
      data-fond={fond.data}
      style={ton === "fonce" ? HALO_TERRACOTTA : undefined}
      className={`${fond.classes} py-16 sm:py-20 lg:py-24${className ? ` ${className}` : ""}`}
    >
      <Container>
        {entete ? (
          <EnteteQuestion
            id={id}
            surTitre={entete.surTitre}
            question={entete.question}
            {...(entete.reponse ? { reponse: entete.reponse } : {})}
            ton={ton === "fonce" || ton === "terracotta" ? "fonce" : "clair"}
          />
        ) : null}
        <div className={entete ? "mt-10 lg:mt-14" : undefined}>{children}</div>
      </Container>
    </section>
  );
}
