import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";
import { ActionsFiche } from "./ActionsFiche";
import { SectionsCategorie } from "./SectionsCategorie";
import { AvantApres, PorteEntree, Rassurance } from "./BlocsTransformation";
import { CitationsTerrain } from "./CitationsTerrain";
import { FicheIdentite } from "./FicheIdentite";
import { HeroCollaborateur } from "./HeroCollaborateur";
import { MetiersCollaborateur } from "./MetiersCollaborateur";
import { MethodeCollaborateur } from "./MethodeCollaborateur";
import { ParcoursSection } from "./ParcoursSection";

/**
 * Fiche d'un collaborateur — gabarit unique, Server Component pur.
 *
 * Plan des titres : un H1 (le nom), des H2 de sujets, des H3 pour les services et les
 * questions. Une section sans données n'est PAS rendue (jamais de H2 vide). Le fil
 * d'Ariane et le JSON-LD sont posés par la route.
 */
export function ProfilCollaborateur({
  fiche,
  contenu,
}: {
  fiche: FichePublique;
  contenu: ContenuFiche;
}) {
  return (
    <>
      <HeroCollaborateur fiche={fiche} contenu={contenu} />

      {contenu.faits && contenu.faits.length > 0 ? (
        <section aria-label="Repères" className="border-border bg-paper border-y py-10 sm:py-12">
          <Container>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4" role="list">
              {contenu.faits.map((f) => (
                <li key={f.chiffre} className="flex flex-col gap-1.5">
                  <span
                    className="text-fg text-[clamp(1.125rem,2.2vw,1.5rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {f.chiffre}
                  </span>
                  <span className="text-fg-soft text-sm leading-snug">{f.libelle}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <Section title={`${fiche.nom} en bref`}>
        <div className="max-w-4xl">
          <FicheIdentite fiche={fiche} lignes={contenu.identite} className="text-base" />
          {contenu.liens.linkedin ? (
            <p className="text-fg-soft mt-6 text-sm">
              Profil professionnel vérifiable :{" "}
              <a
                href={contenu.liens.linkedin}
                rel={fiche.estDirigeantPrincipal ? "me noopener noreferrer" : "noopener noreferrer"}
                target="_blank"
                className="text-terracotta hover:text-terracotta-deep font-medium underline underline-offset-4"
              >
                LinkedIn de {fiche.nom}
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
              .
            </p>
          ) : null}
        </div>
      </Section>

      {contenu.sectionsCategorie ? (
        <SectionsCategorie fiche={fiche} sections={contenu.sectionsCategorie} />
      ) : null}
      {contenu.avantApres ? <AvantApres donnees={contenu.avantApres} /> : null}
      {contenu.rassurance ? <Rassurance donnees={contenu.rassurance} /> : null}
      {contenu.porteEntree ? <PorteEntree donnees={contenu.porteEntree} /> : null}
      {contenu.services ? <MetiersCollaborateur donnees={contenu.services} /> : null}
      {contenu.methode ? <MethodeCollaborateur donnees={contenu.methode} /> : null}
      {contenu.parcours ? <ParcoursSection donnees={contenu.parcours} /> : null}
      {contenu.citations ? <CitationsTerrain donnees={contenu.citations} /> : null}

      {contenu.faq.length > 0 ? (
        <FaqBlock
          tone="paper"
          eyebrow="Questions fréquentes"
          title={`Questions fréquentes sur ${fiche.nom}`}
          items={contenu.faq}
          // Le `FAQPage` est dans le `@graph` unique de la route (et seulement si la fiche est indexable).
          emitJsonLd={false}
          questionAs="h3"
        />
      ) : null}

      <CtaBlock
        title={contenu.appelFinal.titre}
        description={contenu.appelFinal.texte}
        cta={
          <div className="flex flex-wrap items-center gap-4">
            <ActionsFiche fiche={fiche} contenu={contenu} emplacement="cta" />
          </div>
        }
        tone="mocha"
      />
    </>
  );
}
